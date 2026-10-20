'use strict';
// Remote desktop sessions open in the Mac's own apps:
// RDP in Microsoft's free "Windows App", VNC in the built-in Screen Sharing.

const { app, shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const RDP_BUNDLE_IDS = ['com.microsoft.rdc.macos', 'com.microsoft.rdc.mac'];
const WINDOWS_APP_STORE = 'macappstore://apps.apple.com/app/id1295203466';

function findApp(bundleId) {
  return new Promise((resolve) =>
    execFile('/usr/bin/mdfind', [`kMDItemCFBundleIdentifier == '${bundleId}'`], (err, out) =>
      resolve(err ? null : out.split('\n').find((l) => l.endsWith('.app')) || null)
    )
  );
}

async function rdpAppInstalled() {
  for (const id of RDP_BUNDLE_IDS) if (await findApp(id)) return true;
  for (const p of ['/Applications/Windows App.app', '/Applications/Microsoft Remote Desktop.app']) if (fs.existsSync(p)) return true;
  return false;
}

async function openRdp({ name, host, port, username, domain, fullscreen }) {
  if (!(await rdpAppInstalled())) {
    const err = new Error('RDP needs Microsoft’s free “Windows App” from the Mac App Store.');
    err.code = 'NO_RDP_APP';
    throw err;
  }
  const lines = [
    `full address:s:${host}${port && Number(port) !== 3389 ? ':' + port : ''}`,
    username ? `username:s:${domain ? domain + '\\' : ''}${username}` : null,
    `screen mode id:i:${fullscreen ? 2 : 1}`,
    'prompt for credentials on client:i:1',
    'redirectclipboard:i:1',
    'audiomode:i:0',
    'use multimon:i:0',
  ].filter(Boolean);
  const dir = path.join(app.getPath('temp'), 'conduit-rdp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${String(name || host).replace(/[^\w.-]+/g, '_')}.rdp`);
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n');
  const err = await shell.openPath(file);
  if (err) throw new Error(err);
}

async function openVnc({ host, port, username }) {
  const user = username ? `${encodeURIComponent(username)}@` : '';
  const p = port && Number(port) !== 5900 ? `:${port}` : '';
  await shell.openExternal(`vnc://${user}${host}${p}`);
}

function getWindowsApp() {
  return shell.openExternal(WINDOWS_APP_STORE);
}

module.exports = { openRdp, openVnc, getWindowsApp, rdpAppInstalled };
