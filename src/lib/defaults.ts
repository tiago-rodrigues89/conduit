import { DEFAULT_RULES } from './highlight';
import type { ButtonBar, FolderItem, SessionItem, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'conduit',
  fontFamily: 'JetBrains Mono',
  fontSize: 13,
  lineHeight: 1.25,
  letterSpacing: 0,
  fontWeight: 400,
  cursorStyle: 'bar',
  cursorBlink: true,
  scrollback: 20000,
  padding: 12,
  copyOnSelect: true,
  rightClick: 'paste',
  optionAsMeta: false,
  pasteWarning: true,
  bell: 'visual',
  highlight: true,
  highlightRules: DEFAULT_RULES,
  followFolder: true,
  autoShowFiles: true,
  showHidden: false,
  doubleClick: 'edit',
  downloadDir: '',
  askDownloadDir: false,
  editorApp: '',
  promptStyle: 'conduit',
  promptOnServers: true,
  monitoring: true,
  historyPanel: false,
  confirmClose: true,
  translucentSidebar: true,
  keepAlive: 30,
  sidebarWidth: 280,
  sidebarVisible: true,
  buttonBarVisible: true,
  logAuto: false,
  logDir: '',
  logName: '{session}_{date}_{time}',
  logTimestamps: false,
  logRaw: false,
  syncEnabled: false,
  syncDir: '',
  syncSecrets: false,
  customThemes: [],
};

export const DEFAULT_LOG_DIR = '~/Documents/Conduit Logs';

// Fixed ids: two Macs that sync start with the same defaults instead of doubling them.
export function defaultButtonBars(): ButtonBar[] {
  return [
    {
      id: 'default-bar-linux',
      name: 'Linux',
      buttons: [
        { id: 'default-btn-disk', label: 'Disk', text: 'df -h', enter: true, color: '', target: 'pane' },
        { id: 'default-btn-memory', label: 'Memory', text: 'free -h', enter: true, color: '', target: 'pane' },
        { id: 'default-btn-top', label: 'Top 15', text: 'ps aux --sort=-%cpu | head -15', enter: true, color: '', target: 'pane' },
        { id: 'default-btn-failed', label: 'Failed units', text: 'systemctl --failed', enter: true, color: '', target: 'pane' },
      ],
    },
  ];
}

export function uid(): string {
  return crypto.randomUUID();
}

export function newSession(patch: Partial<SessionItem> = {}): SessionItem {
  return {
    id: uid(),
    kind: 'session',
    parentId: null,
    order: Date.now(),
    name: '',
    host: '',
    port: 22,
    username: '',
    authMethod: 'auto',
    keyPath: '',
    color: '',
    jumpHostId: '',
    initCommand: '',
    startDir: '',
    followFolder: 'default',
    highlight: 'default',
    theme: '',
    legacyAlgorithms: false,
    keepAlive: 30,
    forwards: [],
    notes: '',
    type: 'ssh',
    icon: '',
    credentialId: '',
    pinned: false,
    promptStyle: '',
    shell: '',
    command: '',
    serialDevice: '',
    baudRate: 115200,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: 'none',
    rdpDomain: '',
    rdpFullscreen: false,
    awsInstanceId: '',
    awsRegion: '',
    awsProfile: '',
    buttonBar: '',
    logging: 'default',
    loginScript: [],
    createdAt: Date.now(),
    ...patch,
  };
}

export function newFolder(patch: Partial<FolderItem> = {}): FolderItem {
  return {
    id: uid(),
    kind: 'folder',
    parentId: null,
    order: Date.now(),
    name: 'New folder',
    expanded: true,
    color: '',
    icon: '',
    ...patch,
  };
}

/** Parses "user@host:port" (also "ssh user@host -p 2222"). */
export function parseQuickConnect(input: string): { username: string; host: string; port: number } | null {
  let s = input.trim();
  if (!s) return null;
  let port = 22;
  s = s.replace(/^ssh\s+/, '');
  const pFlag = s.match(/\s-p\s*(\d+)/);
  if (pFlag) {
    port = Number(pFlag[1]);
    s = s.replace(pFlag[0], '');
  }
  s = s.trim().split(/\s+/)[0];
  let username = '';
  const at = s.lastIndexOf('@');
  if (at > 0) {
    username = s.slice(0, at);
    s = s.slice(at + 1);
  }
  const v6 = s.match(/^\[(.+)\](?::(\d+))?$/);
  if (v6) {
    s = v6[1];
    if (v6[2]) port = Number(v6[2]);
  } else {
    const m = s.match(/^([^:]+):(\d+)$/);
    if (m) {
      s = m[1];
      port = Number(m[2]);
    }
  }
  if (!s) return null;
  return { username, host: s, port };
}
