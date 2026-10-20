'use strict';

const { app, BrowserWindow, Menu, ipcMain, nativeTheme, shell, dialog, clipboard, screen, systemPreferences, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

app.setName('Conduit');
// Development only: run with separate data and an automation script (UI tests).
if (process.env.CONDUIT_USER_DATA && !app.isPackaged) app.setPath('userData', process.env.CONDUIT_USER_DATA);

const store = require('./store');
const { TermOutput } = require('./output');
const { SshManager } = require('./ssh');
const { SftpManager } = require('./sftp');
const { LocalShells, availableShells } = require('./pty');
const { TelnetSessions } = require('./telnet');
const { SerialSessions, listDevices } = require('./serial');
const launch = require('./launch');
const { Monitor } = require('./monitor');
const shellint = require('./shellint');
const localfs = require('./localfs');
const importers = require('./importers');
const { SessionLogger } = require('./logger');
const backup = require('./backup');
const { SyncEngine } = require('./sync');

const DEV_URL = process.env.CONDUIT_DEV_URL;

// Background images of custom themes are copied into this folder and shown
// through conduit-media://backgrounds/<file> (nothing else can be read that way).
protocol.registerSchemesAsPrivileged([{ scheme: 'conduit-media', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const IMAGE_RE = /^[\w-]+\.(png|jpe?g|gif|webp|avif)$/i;
const backgroundsDir = () => path.join(app.getPath('userData'), 'backgrounds');

let win = null;
let confirmClose = true;
let allowClose = false;
let quitting = false;

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

// ---- asking the renderer (password prompts, host keys) ------------------------

const pendingAsks = new Map();

function ask(kind, payload) {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    pendingAsks.set(id, resolve);
    send('ui:ask', id, kind, payload);
  });
}

function cancelAsks() {
  for (const resolve of pendingAsks.values()) resolve(null);
  pendingAsks.clear();
}

// ---- managers -------------------------------------------------------------------

const logger = new SessionLogger();
const output = new TermOutput(send, (termId, data) => logger.write(termId, data));
const ssh = new SshManager({ send, ask, output });
const sftp = new SftpManager({ ssh, send });
let integration = null;
try {
  integration = shellint.prepareLocal(path.join(app.getPath('userData'), 'shell-integration'));
} catch (err) {
  console.error('shell integration unavailable:', err.message);
}
const local = new LocalShells({ send, output, integration });
const telnet = new TelnetSessions({ send, output });
const monitor = new Monitor({ ssh, send });
const sync = new SyncEngine({ send });
const serial = new SerialSessions({ send, output });

/** The backend that owns a terminal (SSH shells are handled by `ssh`). */
function backendFor(termId) {
  if (local.has(termId)) return local;
  if (telnet.has(termId)) return telnet;
  if (serial.has(termId)) return serial;
  return ssh;
}

function activeSessions() {
  return ssh.activeCount() + local.activeCount() + telnet.activeCount() + serial.activeCount();
}

function teardownSessions() {
  cancelAsks();
  logger.stopAll();
  ssh.closeAll();
  local.killAll();
  telnet.closeAll();
  serial.closeAll();
}

// ---- window ---------------------------------------------------------------------

function windowBounds() {
  const saved = store.readJson('windowState', null);
  if (!saved) return { width: 1380, height: 880 };
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return saved.x < a.x + a.width - 100 && saved.x + saved.width > a.x + 100 && saved.y >= a.y - 10 && saved.y < a.y + a.height - 100;
  });
  return visible ? saved : { width: saved.width, height: saved.height };
}

function createWindow() {
  const bounds = windowBounds();
  const settings = store.readJson('settings', {}) || {};
  const translucent = settings.translucentSidebar !== false;

  win = new BrowserWindow({
    ...bounds,
    minWidth: 760,
    minHeight: 480,
    show: false,
    title: 'Conduit',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    vibrancy: translucent ? 'sidebar' : undefined,
    visualEffectState: 'followWindow',
    backgroundColor: translucent ? '#00000000' : '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (bounds.maximized) win.maximize();

  win.once('ready-to-show', () => win.show());

  win.on('close', (e) => {
    if (!allowClose && confirmClose && activeSessions() > 0) {
      e.preventDefault();
      send('app:confirm-close');
      return;
    }
    const b = win.getNormalBounds();
    store.writeJson('windowState', { ...b, maximized: win.isMaximized() });
  });
  win.on('closed', () => {
    teardownSessions();
    win = null;
    allowClose = false;
  });

  win.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument && win.webContents.getURL()) teardownSessions();
  });
  win.webContents.on('render-process-gone', () => teardownSessions());

  // Links never navigate the app window; they open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return;
    e.preventDefault();
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  if (process.env.CONDUIT_AUTOMATION && !app.isPackaged) runAutomation(win);
}

function runAutomation(target) {
  target.webContents.once('did-finish-load', async () => {
    const helpers = {
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      capture: async (file) => fs.writeFileSync(file, (await target.webContents.capturePage()).toPNG()),
      exec: (code) => target.webContents.executeJavaScript(code, true),
      key: (keyCode, modifiers = []) => {
        target.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
        target.webContents.sendInputEvent({ type: 'char', keyCode, modifiers });
        target.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
      },
      menu: (id) => send('menu', id),
      ssh,
      sftp,
      local,
    };
    try {
      await require(process.env.CONDUIT_AUTOMATION)(target, helpers);
    } catch (err) {
      console.error('[automation] failed:', err);
    }
    if (process.env.CONDUIT_AUTOMATION_EXIT) {
      allowClose = true;
      app.quit();
    }
  });
}

// ---- application menu -----------------------------------------------------------

function buildMenu() {
  const action = (id) => () => send('menu', id);
  const item = (label, accelerator, id, extra = {}) => ({ label, accelerator, click: action(id), ...extra });
  const hidden = (accelerator, id) => ({ label: id, accelerator, click: action(id), visible: false, acceleratorWorksWhenHidden: true });

  const template = [
    {
      label: 'Conduit',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        item('Settings…', 'Cmd+,', 'settings'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        item('New Session…', 'Cmd+N', 'new-session'),
        item('Quick Connect…', 'Cmd+L', 'quick-connect'),
        item('New Local Terminal', 'Cmd+T', 'new-local'),
        { type: 'separator' },
        item('Split Right', 'Cmd+D', 'split-right'),
        item('Split Down', 'Cmd+Shift+D', 'split-down'),
        item('Duplicate Tab', 'Cmd+Alt+D', 'duplicate-tab'),
        item('Open SFTP Browser', 'Cmd+Shift+O', 'open-sftp'),
        item('Reconnect', 'Cmd+R', 'reconnect'),
        item('Log Output to File', 'Cmd+Alt+L', 'toggle-log'),
        { type: 'separator' },
        {
          label: 'Workspaces',
          submenu: [item('Save Open Tabs as Workspace…', undefined, 'save-workspace'), item('Manage Workspaces…', undefined, 'workspaces')],
        },
        {
          label: 'Import',
          submenu: [
            item('From ~/.ssh/config', undefined, 'import-ssh-config'),
            item('From MobaXterm Sessions…', undefined, 'import-mobaxterm'),
            { type: 'separator' },
            item('Conduit Backup…', undefined, 'import-backup'),
          ],
        },
        {
          label: 'Export',
          submenu: [item('Conduit Backup…', undefined, 'export-backup'), item('OpenSSH Config…', undefined, 'export-ssh-config')],
        },
        { type: 'separator' },
        item('Close Pane or Tab', 'Cmd+W', 'close-tab'),
        item('Close Tab', 'Cmd+Shift+W', 'close-tab-group'),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        item('Select All', 'Cmd+A', 'select-all'),
        { type: 'separator' },
        item('Find…', 'Cmd+F', 'find'),
        item('Clear Terminal', 'Cmd+K', 'clear'),
      ],
    },
    {
      label: 'View',
      submenu: [
        item('Toggle Sidebar', 'Cmd+B', 'toggle-sidebar'),
        item('Sessions', 'Cmd+Shift+1', 'panel-sessions'),
        item('Files (SFTP)', 'Cmd+Shift+2', 'panel-files'),
        item('Snippets', 'Cmd+Shift+3', 'panel-snippets'),
        { type: 'separator' },
        item('Bigger Text', 'Cmd+=', 'font-bigger'),
        hidden('Cmd+Plus', 'font-bigger'),
        item('Smaller Text', 'Cmd+-', 'font-smaller'),
        item('Actual Size', 'Cmd+0', 'font-reset'),
        { type: 'separator' },
        item('Syntax Highlighting', 'Cmd+Shift+H', 'toggle-highlight'),
        item('Command History', 'Cmd+Shift+Y', 'toggle-history'),
        item('Server Monitoring', undefined, 'toggle-monitoring'),
        item('Broadcast Input to All Terminals', 'Cmd+Shift+B', 'toggle-broadcast'),
        item('Button Bar', 'Cmd+Shift+U', 'toggle-button-bar'),
        item('Compose Bar', 'Cmd+Shift+E', 'toggle-compose'),
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(DEV_URL || !app.isPackaged ? [{ role: 'toggleDevTools' }, { role: 'reload', accelerator: 'Cmd+Shift+R' }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        item('Select Pane Left', 'Cmd+Alt+Left', 'pane-left'),
        item('Select Pane Right', 'Cmd+Alt+Right', 'pane-right'),
        item('Select Pane Above', 'Cmd+Alt+Up', 'pane-up'),
        item('Select Pane Below', 'Cmd+Alt+Down', 'pane-down'),
        item('Maximize Pane', 'Cmd+Shift+Enter', 'zoom-pane'),
        item('Make Panes Equal Size', undefined, 'equalize-panes'),
        item('Close Other Panes (Back to One)', 'Cmd+Alt+W', 'unsplit'),
        { type: 'separator' },
        item('Next Tab', 'Cmd+Shift+]', 'next-tab'),
        item('Previous Tab', 'Cmd+Shift+[', 'prev-tab'),
        hidden('Ctrl+Tab', 'next-tab'),
        hidden('Ctrl+Shift+Tab', 'prev-tab'),
        ...Array.from({ length: 9 }, (_, i) => hidden(`Cmd+${i + 1}`, `tab-${i + 1}`)),
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- IPC ------------------------------------------------------------------------

function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err), cancelled: !!(err && err.cancelled) };
    }
  });
}

function registerIpc() {
  ipcMain.on('ui:answer', (_e, id, result) => {
    const resolve = pendingAsks.get(id);
    if (resolve) {
      pendingAsks.delete(id);
      resolve(result);
    }
  });

  // app
  handle('app:info', () => ({
    version: app.getVersion(),
    home: os.homedir(),
    downloads: app.getPath('downloads'),
    user: os.userInfo().username,
    hostname: os.hostname(),
  }));
  ipcMain.on('app:set-confirm-close', (_e, value) => (confirmClose = !!value));
  ipcMain.on('app:close-cancelled', () => (quitting = false));
  ipcMain.on('app:close-confirmed', () => {
    allowClose = true;
    if (quitting) app.quit();
    else if (win) win.close();
  });
  ipcMain.on('app:set-vibrancy', (_e, on) => {
    if (!win) return;
    win.setVibrancy(on ? 'sidebar' : null);
    win.setBackgroundColor(on ? '#00000000' : '#0d0f14');
  });

  // storage
  handle('store:load', () => store.loadAll());
  handle('store:save', (key, data) => {
    store.save(key, data);
    if (key !== 'settings') sync.localChanged();
  });
  handle('secrets:set', (id, patch) => {
    store.setSecret(id, patch);
    sync.localChanged();
  });
  handle('secrets:flags', (id) => store.secretFlags(id));
  handle('secrets:delete', (id) => {
    store.deleteSecret(id);
    sync.localChanged();
  });

  // backup & export
  const today = () => new Date().toISOString().slice(0, 10);
  handle('backup:export', async (opts = {}) => {
    const doc = backup.buildBackup({ ...opts, version: app.getVersion() });
    const res = await dialog.showSaveDialog(win, {
      title: 'Export Conduit backup',
      defaultPath: path.join(app.getPath('documents'), `Conduit Backup ${today()}.conduit`),
      filters: [{ name: 'Conduit backup', extensions: ['conduit'] }],
    });
    if (res.canceled || !res.filePath) return null;
    backup.writeFile(res.filePath, JSON.stringify(doc, null, 2));
    return res.filePath;
  });
  handle('backup:choose', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Import Conduit backup',
      properties: ['openFile'],
      filters: [{ name: 'Conduit backup', extensions: ['conduit', 'json'] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const file = res.filePaths[0];
    const { doc, data } = backup.openBackup(file);
    return { file, encrypted: !!doc.encrypted, created: doc.created, app: doc.app, summary: data ? backup.summary(data) : doc.summary || null };
  });
  handle('backup:read', (file, passphrase) => backup.summary(backup.openBackup(file, passphrase).data));
  handle('backup:apply', (file, passphrase, opts) => {
    const { data } = backup.openBackup(file, passphrase);
    if (!data) throw new Error('Enter the passphrase of the backup');
    const res = backup.applyBackup(data, opts);
    sync.localChanged();
    return res;
  });
  handle('backup:ssh-config', async () => {
    const { text, count } = backup.sshConfig();
    if (!count) throw new Error('There are no SSH sessions to export');
    const res = await dialog.showSaveDialog(win, {
      title: 'Export as OpenSSH config',
      defaultPath: path.join(os.homedir(), 'conduit_ssh_config'),
      message: 'Include it from ~/.ssh/config with “Include ~/conduit_ssh_config”, or copy the hosts you need.',
    });
    if (res.canceled || !res.filePath) return null;
    backup.writeFile(res.filePath, text);
    return { file: res.filePath, count };
  });

  // background images for custom themes
  handle('appearance:choose-image', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Choose a background image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'avif'] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const src = res.filePaths[0];
    if (fs.statSync(src).size > 40 * 1024 * 1024) throw new Error('The image is larger than 40 MB');
    const ext = path.extname(src).toLowerCase().replace('jpeg', 'jpg');
    fs.mkdirSync(backgroundsDir(), { recursive: true });
    if (ext === '.heic' || ext === '.heif') {
      // the window cannot show HEIC (e.g. the macOS wallpapers): convert to JPEG with macOS' sips
      const name = `${crypto.randomUUID()}.jpg`;
      await new Promise((resolve, reject) =>
        require('child_process').execFile('/usr/bin/sips', ['-s', 'format', 'jpeg', src, '--out', path.join(backgroundsDir(), name)], (err) =>
          err ? reject(new Error('This picture could not be converted')) : resolve()
        )
      );
      return name;
    }
    const name = `${crypto.randomUUID()}${ext}`;
    fs.copyFileSync(src, path.join(backgroundsDir(), name));
    return name;
  });
  // only Conduit's own copies are removed, never the original picture
  handle('appearance:remove-image', (name) => {
    if (!IMAGE_RE.test(String(name))) return;
    fs.rmSync(path.join(backgroundsDir(), name), { force: true });
  });

  // sync between Macs
  handle('sync:configure', (cfg) => sync.configure(cfg));
  handle('sync:passphrase', (passphrase) => sync.setPassphrase(passphrase));
  handle('sync:now', () => sync.syncNow());
  handle('sync:get-status', () => sync.getStatus());
  handle('sync:default-dir', () => sync.defaultDir());
  // showing a saved password asks for Touch ID first (when the Mac has it)
  handle('secrets:reveal', async (id, field) => {
    if (systemPreferences.canPromptTouchID()) {
      try {
        await systemPreferences.promptTouchID('show the saved password');
      } catch {
        const e = new Error('Not confirmed');
        e.cancelled = true;
        throw e;
      }
    }
    return store.getSecret(id)[field === 'passphrase' ? 'passphrase' : 'password'] || '';
  });

  // clipboard, shell, dialogs, menus
  handle('clipboard:read', () => clipboard.readText());
  handle('clipboard:write', (text) => clipboard.writeText(String(text)));
  handle('shell:open-external', (url) => {
    if (/^(https?|mailto):/i.test(url)) return shell.openExternal(url);
    throw new Error('Unsupported link');
  });
  handle('dialog:open', async (opts = {}) => {
    const res = await dialog.showOpenDialog(win, {
      title: opts.title,
      defaultPath: opts.defaultPath ? localfs.resolveDir(opts.defaultPath) : undefined,
      buttonLabel: opts.buttonLabel,
      properties: [
        ...(opts.directory ? ['openDirectory', 'createDirectory'] : ['openFile']),
        ...(opts.multiple ? ['multiSelections'] : []),
        'showHiddenFiles',
      ],
      filters: opts.filters,
    });
    return res.canceled ? null : res.filePaths;
  });
  handle('menu:popup', (items) => popupMenu(items));

  // terminals
  ipcMain.on('term:write', (_e, termId, data) => backendFor(termId).write(termId, data));
  ipcMain.on('term:resize', (_e, termId, cols, rows) => backendFor(termId).resize(termId, cols, rows));
  ipcMain.on('term:ack', (_e, termId, chars) => output.ack(termId, chars));
  handle('term:close', async (termId) => {
    logger.stop(termId);
    local.kill(termId);
    telnet.close(termId);
    serial.close(termId);
    await ssh.detach({ holderId: termId });
  });
  handle('local:spawn', (opts) => local.spawn(opts));
  handle('local:shells', () => availableShells());
  handle('telnet:connect', (opts) => telnet.open(opts));
  handle('serial:list', () => listDevices());
  handle('serial:open', (opts) => serial.open(opts));
  handle('launch:rdp', async (opts) => {
    try {
      await launch.openRdp(opts);
    } catch (err) {
      if (err.code !== 'NO_RDP_APP') throw err;
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        message: 'Install Windows App for RDP',
        detail: 'Remote Desktop sessions open in Microsoft’s free “Windows App”. It is not installed yet.',
        buttons: ['Open App Store', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) await launch.getWindowsApp();
      const e = new Error('Windows App is not installed');
      e.cancelled = true;
      throw e;
    }
  });
  handle('launch:vnc', (opts) => launch.openVnc(opts));

  // ssh
  handle('ssh:connect', (opts) => ssh.connect(opts));
  handle('ssh:open-shell', (opts) => ssh.openShell(opts));
  handle('ssh:attach', (opts) => ssh.attach(opts));
  handle('ssh:detach', (opts) => ssh.detach(opts));
  handle('ssh:exec', (connId, command) => ssh.exec(connId, command));

  // sftp
  handle('sftp:home', (connId) => sftp.home(connId));
  handle('sftp:list', (connId, dir) => sftp.list(connId, dir));
  handle('sftp:stat', (connId, target) => sftp.stat(connId, target));
  handle('sftp:mkdir', (connId, target) => sftp.mkdir(connId, target));
  handle('sftp:touch', (connId, target) => sftp.touch(connId, target));
  handle('sftp:rename', (connId, from, to) => sftp.rename(connId, from, to));
  handle('sftp:remove', (connId, targets) => sftp.remove(connId, targets));
  handle('sftp:chmod', (connId, targets, mode, recursive) => sftp.chmod(connId, targets, mode, recursive));
  handle('sftp:edit', (opts) => sftp.edit(opts));
  handle('sftp:read-tail', (connId, target) => sftp.readTail(connId, target));
  handle('log:start', (termId, opts) => logger.start(termId, opts));
  handle('log:stop', (termId) => logger.stop(termId));
  handle('log:open-dir', (dir) => {
    const target = localfs.resolveDir(dir);
    fs.mkdirSync(target, { recursive: true });
    return shell.openPath(target);
  });
  handle('monitor:start', (connId) => monitor.start(connId));
  handle('monitor:stop', (connId) => monitor.stop(connId));
  handle('transfer:start', (opts) => sftp.start(opts));
  handle('transfer:cancel', (id) => sftp.cancel(id));
  handle('transfer:clear', () => sftp.clearFinished());

  // local files
  handle('fs:list', (dir) => localfs.list(dir));
  handle('fs:mkdir', (target) => localfs.mkdir(target));
  handle('fs:touch', (target) => localfs.touch(target));
  handle('fs:rename', (from, to) => localfs.rename(from, to));
  handle('fs:trash', (targets) => localfs.trash(targets));
  handle('fs:open', (target) => localfs.open(target));
  handle('fs:reveal', (target) => localfs.reveal(target));
  handle('fs:read-tail', (target) => localfs.readTail(target));

  // import
  handle('import:ssh-config', () => importers.importSshConfig());
  handle('import:mobaxterm', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Import MobaXterm sessions',
      message: 'Choose a MobaXterm sessions export (.mxtsessions) or MobaXterm.ini',
      properties: ['openFile'],
      filters: [{ name: 'MobaXterm sessions', extensions: ['mxtsessions', 'ini', 'txt'] }],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return importers.importMobaXterm(res.filePaths[0]);
  });
}

function popupMenu(items) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    const build = (list) =>
      list.map((it) => {
        if (it.type === 'separator') return { type: 'separator' };
        return {
          label: it.label,
          enabled: it.enabled !== false,
          type: it.checked !== undefined ? 'checkbox' : 'normal',
          checked: it.checked,
          accelerator: it.accelerator,
          registerAccelerator: false,
          submenu: it.submenu ? build(it.submenu) : undefined,
          click: it.submenu ? undefined : () => finish(it.id),
        };
      });
    const menu = Menu.buildFromTemplate(build(items));
    menu.popup({ window: win, callback: () => setTimeout(() => finish(null), 120) });
  });
}

// ---- lifecycle --------------------------------------------------------------------

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  app.setAboutPanelOptions({
    applicationName: 'Conduit',
    applicationVersion: app.getVersion(),
    copyright: 'SSH & SFTP client',
  });
  protocol.handle('conduit-media', (req) => {
    const url = new URL(req.url);
    const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const file = path.join(backgroundsDir(), name);
    if (url.host !== 'backgrounds' || !IMAGE_RE.test(name) || !fs.existsSync(file)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  sftp.dispose();
  app.quit();
});
