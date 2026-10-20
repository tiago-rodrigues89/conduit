import type { ConnectSpec, FileEntry, Listing, TransferJob } from './types';

interface Bridge {
  platform: string;
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, cb: (...args: any[]) => void): () => void;
  pathForFile(file: File): string;
}

declare global {
  interface Window {
    conduit: Bridge;
  }
}

const b = window.conduit;
const inv = <T = unknown>(channel: string, ...args: unknown[]) => b.invoke<T>(channel, ...args);

export interface MenuItem {
  id?: string;
  label?: string;
  type?: 'separator';
  enabled?: boolean;
  checked?: boolean;
  accelerator?: string;
  submenu?: MenuItem[];
}

export interface ShellOptions {
  cols: number;
  rows: number;
  integrate: boolean;
  /** prompt style injected into bash/zsh on the server ('shell' keeps the server's prompt) */
  prompt?: string;
  startDir?: string;
  initCommand?: string;
}

export interface AppInfo {
  version: string;
  home: string;
  downloads: string;
  user: string;
  hostname: string;
}

export interface ImportedSsh {
  name: string;
  host: string;
  port: number;
  username: string;
  keyPath: string;
  jump: string;
}

export interface ImportedMoba {
  sessions: {
    type: 'ssh' | 'sftp' | 'telnet' | 'rdp' | 'vnc';
    name: string;
    folder: string[];
    host: string;
    port: number;
    username: string;
    initCommand: string;
    keyPath: string;
    gateway?: { host: string; port: number; username: string };
  }[];
  skipped: Record<string, number>;
}

export interface BackupSummary {
  sessions: number;
  folders: number;
  credentials: number;
  snippets: number;
  buttonBars: number;
  triggers: number;
  workspaces: number;
  secrets: number;
  settings: boolean;
}

export interface BackupInfo {
  file: string;
  encrypted: boolean;
  created: string;
  app: string;
  summary: BackupSummary | null;
}

export interface SyncInfo {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSync?: number;
  message?: string;
  hasPassphrase: boolean;
  file: string;
}

export const api = {
  on: b.on,
  pathForFile: b.pathForFile,

  app: {
    info: () => inv<AppInfo>('app:info'),
    setConfirmClose: (v: boolean) => b.send('app:set-confirm-close', v),
    closeConfirmed: () => b.send('app:close-confirmed'),
    closeCancelled: () => b.send('app:close-cancelled'),
    setVibrancy: (v: boolean) => b.send('app:set-vibrancy', v),
  },
  store: {
    load: () => inv<{ sessions: any; settings: any; snippets: any; credentials: any; automation: any }>('store:load'),
    save: (key: 'sessions' | 'settings' | 'snippets' | 'credentials' | 'automation', data: unknown) => inv('store:save', key, data),
  },
  secrets: {
    set: (id: string, patch: { password?: string | null; passphrase?: string | null }) => inv('secrets:set', id, patch),
    flags: (id: string) => inv<{ password: boolean; passphrase: boolean }>('secrets:flags', id),
    remove: (id: string) => inv('secrets:delete', id),
    /** returns a saved secret after Touch ID confirmation */
    reveal: (id: string, field: 'password' | 'passphrase' = 'password') => inv<string>('secrets:reveal', id, field),
  },
  clipboard: {
    read: () => inv<string>('clipboard:read'),
    write: (text: string) => inv('clipboard:write', text),
  },
  openExternal: (url: string) => inv('shell:open-external', url),
  openDialog: (opts: { title?: string; directory?: boolean; multiple?: boolean; defaultPath?: string; buttonLabel?: string }) =>
    inv<string[] | null>('dialog:open', opts),
  popupMenu: (items: MenuItem[]) => inv<string | null>('menu:popup', items),
  answer: (id: string, result: unknown) => b.send('ui:answer', id, result),

  term: {
    write: (termId: string, data: string) => b.send('term:write', termId, data),
    resize: (termId: string, cols: number, rows: number) => b.send('term:resize', termId, cols, rows),
    ack: (termId: string, chars: number) => b.send('term:ack', termId, chars),
    close: (termId: string) => inv('term:close', termId),
    spawnLocal: (opts: {
      termId: string;
      cols: number;
      rows: number;
      cwd?: string;
      shell?: string;
      command?: string;
      prompt?: string;
    }) => inv<{ shell: string; pid: number }>('local:spawn', opts),
    shells: () => inv<{ default: string; shells: string[] }>('local:shells'),
    telnet: (opts: { termId: string; host: string; port: number; cols: number; rows: number }) => inv('telnet:connect', opts),
    serialDevices: () => inv<string[]>('serial:list'),
    serial: (opts: {
      termId: string;
      device: string;
      baud: number;
      dataBits: number;
      parity: string;
      stopBits: number;
      flow: string;
    }) => inv('serial:open', opts),
  },
  launch: {
    rdp: (opts: { name: string; host: string; port: number; username: string; domain: string; fullscreen: boolean }) =>
      inv('launch:rdp', opts),
    vnc: (opts: { host: string; port: number; username: string }) => inv('launch:vnc', opts),
  },
  ssh: {
    connect: (opts: { holderId: string; session: ConnectSpec; shell?: ShellOptions }) =>
      inv<{ connId: string }>('ssh:connect', opts),
    /** another shell on an open connection (split panes): no second login */
    openShell: (opts: { holderId: string; connId: string; shell: ShellOptions }) => inv<{ connId: string }>('ssh:open-shell', opts),
    attach: (holderId: string, connId: string) => inv<{ connId: string }>('ssh:attach', { holderId, connId }),
    detach: (holderId: string) => inv('ssh:detach', { holderId }),
  },
  sftp: {
    home: (connId: string) => inv<string>('sftp:home', connId),
    list: (connId: string, dir: string) => inv<Listing>('sftp:list', connId, dir),
    mkdir: (connId: string, target: string) => inv('sftp:mkdir', connId, target),
    touch: (connId: string, target: string) => inv('sftp:touch', connId, target),
    rename: (connId: string, from: string, to: string) => inv('sftp:rename', connId, from, to),
    remove: (connId: string, targets: string[]) => inv('sftp:remove', connId, targets),
    chmod: (connId: string, targets: string[], mode: number, recursive: boolean) =>
      inv('sftp:chmod', connId, targets, mode, recursive),
    edit: (connId: string, remotePath: string, appName?: string) => inv('sftp:edit', { connId, remotePath, appName }),
    readTail: (connId: string, target: string) => inv<string>('sftp:read-tail', connId, target),
  },
  transfer: {
    start: (opts: {
      connId: string;
      direction: 'upload' | 'download';
      sources: string[];
      targetDir: string;
      conflict?: 'overwrite' | 'skip';
    }) => inv<string>('transfer:start', opts),
    cancel: (id: string) => inv('transfer:cancel', id),
    clear: () => inv('transfer:clear'),
  },
  fs: {
    list: (dir: string) => inv<Listing>('fs:list', dir),
    mkdir: (target: string) => inv('fs:mkdir', target),
    touch: (target: string) => inv('fs:touch', target),
    rename: (from: string, to: string) => inv('fs:rename', from, to),
    trash: (targets: string[]) => inv('fs:trash', targets),
    open: (target: string) => inv('fs:open', target),
    reveal: (target: string) => inv('fs:reveal', target),
    readTail: (target: string) => inv<string>('fs:read-tail', target),
  },
  appearance: {
    /** copies a picture into Conduit's backgrounds folder; returns its file name */
    chooseImage: () => inv<string | null>('appearance:choose-image'),
    removeImage: (name: string) => inv('appearance:remove-image', name),
  },
  log: {
    /** starts writing a terminal's output to a file; returns the file path */
    start: (
      termId: string,
      opts: { dir: string; name: string; timestamps: boolean; raw: boolean; session: string; host: string; user: string }
    ) => inv<string>('log:start', termId, opts),
    stop: (termId: string) => inv('log:stop', termId),
    openDir: (dir: string) => inv('log:open-dir', dir),
  },
  backup: {
    /** asks where to save; returns the file or null */
    export: (opts: { includeSecrets: boolean; includeSettings: boolean; passphrase?: string }) => inv<string | null>('backup:export', opts),
    choose: () => inv<BackupInfo | null>('backup:choose'),
    read: (file: string, passphrase?: string) => inv<BackupSummary>('backup:read', file, passphrase),
    apply: (file: string, passphrase: string | undefined, opts: { mode: 'merge' | 'replace'; settings: boolean; secrets: boolean }) =>
      inv<{ data: any; backupDir: string; secrets: number }>('backup:apply', file, passphrase, opts),
    sshConfig: () => inv<{ file: string; count: number } | null>('backup:ssh-config'),
  },
  sync: {
    configure: (cfg: { enabled: boolean; dir: string; includeSecrets: boolean }) => inv('sync:configure', cfg),
    setPassphrase: (passphrase: string) => inv('sync:passphrase', passphrase),
    now: () => inv('sync:now'),
    status: () => inv<SyncInfo>('sync:get-status'),
    defaultDir: () => inv<string>('sync:default-dir'),
  },
  monitor: {
    start: (connId: string) => inv('monitor:start', connId),
    stop: (connId: string) => inv('monitor:stop', connId),
  },
  importer: {
    sshConfig: () => inv<ImportedSsh[]>('import:ssh-config'),
    mobaxterm: () => inv<ImportedMoba | null>('import:mobaxterm'),
  },
};

export type { FileEntry, Listing, TransferJob };
