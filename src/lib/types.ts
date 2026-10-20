export type AuthMethod = 'auto' | 'password' | 'key' | 'agent';
export type SessionType = 'ssh' | 'sftp' | 'local' | 'command' | 'telnet' | 'serial' | 'rdp' | 'vnc' | 'ssm';
export type PromptStyle = 'conduit' | 'frame' | 'minimal' | 'shell';
export type TriState = 'default' | 'on' | 'off';

export interface Forward {
  id: string;
  type: 'local' | 'remote' | 'dynamic';
  bindHost: string;
  bindPort: number;
  destHost: string;
  destPort: number;
  enabled: boolean;
}

interface TreeBase {
  id: string;
  parentId: string | null;
  order: number;
  name: string;
}

export interface SessionItem extends TreeBase {
  kind: 'session';
  type: SessionType;
  /** icon override for the session tree ('' = icon of the type) */
  icon: string;
  /** saved login to use instead of this session's own username/password ('' = none) */
  credentialId: string;
  /** shown in the Pinned row of the home screen */
  pinned: boolean;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string;
  color: string;
  jumpHostId: string;
  initCommand: string;
  startDir: string;
  followFolder: TriState;
  highlight: TriState;
  theme: string;
  legacyAlgorithms: boolean;
  keepAlive: number;
  forwards: Forward[];
  notes: string;
  /** '' = use the global prompt setting */
  promptStyle: PromptStyle | '';
  // local shell & command sessions
  shell: string;
  command: string;
  // serial
  serialDevice: string;
  baudRate: number;
  dataBits: number;
  parity: 'none' | 'even' | 'odd';
  stopBits: number;
  flowControl: 'none' | 'rtscts' | 'xonxoff';
  // RDP
  rdpDomain: string;
  rdpFullscreen: boolean;
  // AWS Session Manager
  awsInstanceId: string;
  awsRegion: string;
  awsProfile: string;
  // automation
  /** button bar shown for this session ('' = the first bar) */
  buttonBar: string;
  /** write the terminal output to a log file */
  logging: TriState;
  /** wait-for / send steps run once after connecting */
  loginScript: LoginStep[];
  lastUsed?: number;
  createdAt: number;
}

export interface FolderItem extends TreeBase {
  kind: 'folder';
  expanded: boolean;
  color: string;
  icon: string;
}

export type TreeItem = SessionItem | FolderItem;

/** What the main process needs to open a connection. */
export interface ConnectSpec {
  id?: string;
  credentialId?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath: string;
  legacyAlgorithms: boolean;
  keepAlive: number;
  forwards: Forward[];
  password?: string;
  jump?: ConnectSpec;
}

export type HighlightColor =
  | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray'
  | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue' | 'brightMagenta' | 'brightCyan';

export interface HighlightRule {
  id: string;
  name: string;
  pattern: string;
  ignoreCase: boolean;
  color: HighlightColor;
  bold: boolean;
  enabled: boolean;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  run: boolean;
}

export interface LoginStep {
  id: string;
  /** text to wait for ('' = send right away) */
  expect: string;
  /** text to type, followed by Enter */
  send: string;
}

/** A one-click button of the button bar. */
export interface CommandButton {
  id: string;
  label: string;
  /** text to send; several lines are sent one after the other */
  text: string;
  /** press Enter after each line */
  enter: boolean;
  color: string;
  /** where the text goes: the focused pane, every pane of the tab, or every connected terminal */
  target: 'pane' | 'tab' | 'all';
}

export interface ButtonBar {
  id: string;
  name: string;
  buttons: CommandButton[];
}

/** Watches terminal output and acts when a pattern appears. */
export interface Trigger {
  id: string;
  name: string;
  /** regular expression matched against each line of output */
  pattern: string;
  ignoreCase: boolean;
  action: 'notify' | 'send' | 'mark';
  /** text typed for 'send' (followed by Enter) */
  text: string;
  /** session names or hosts it applies to, comma separated, * wildcards ('' = all) */
  hosts: string;
  enabled: boolean;
}

/** One pane of a workspace: a saved session (or a local shell) and where it opens. */
export interface WorkspaceEntry {
  id: string;
  /** saved session, '' = local shell */
  sessionId: string;
  /** new tab, or split the previous pane to the right / below */
  placement: 'tab' | 'right' | 'down';
}

export interface Workspace {
  id: string;
  name: string;
  entries: WorkspaceEntry[];
  /** open automatically when Conduit starts */
  openOnLaunch: boolean;
}

export interface Settings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: number;
  cursorStyle: 'block' | 'bar' | 'underline';
  cursorBlink: boolean;
  scrollback: number;
  padding: number;
  copyOnSelect: boolean;
  rightClick: 'paste' | 'menu';
  optionAsMeta: boolean;
  pasteWarning: boolean;
  bell: 'off' | 'visual';
  highlight: boolean;
  highlightRules: HighlightRule[];
  followFolder: boolean;
  autoShowFiles: boolean;
  showHidden: boolean;
  doubleClick: 'edit' | 'download';
  downloadDir: string;
  askDownloadDir: boolean;
  editorApp: string;
  promptStyle: PromptStyle;
  promptOnServers: boolean;
  /** CPU/RAM/disk of SSH servers in the status bar */
  monitoring: boolean;
  /** command history panel on the right of terminals */
  historyPanel: boolean;
  confirmClose: boolean;
  translucentSidebar: boolean;
  keepAlive: number;
  sidebarWidth: number;
  sidebarVisible: boolean;
  /** one-click command buttons under the terminal */
  buttonBarVisible: boolean;
  /** session logging (off unless turned on here or per session) */
  logAuto: boolean;
  logDir: string;
  /** file name pattern: {session} {host} {user} {date} {time} */
  logName: string;
  logTimestamps: boolean;
  /** keep colors and control codes instead of plain text */
  logRaw: boolean;
  /** sync through a folder (iCloud Drive, Dropbox, network share) */
  syncEnabled: boolean;
  syncDir: string;
  /** also sync saved passwords (inside the encrypted sync file) */
  syncSecrets: boolean;
}

export type SplitDir = 'row' | 'col';

/** Layout of a tab with split panes: leaves are terminal tab ids. */
export type PaneNode = { type: 'leaf'; id: string } | { type: 'split'; dir: SplitDir; children: PaneNode[]; sizes: number[] };

export type ConnStatus = 'connecting' | 'connected' | 'closed' | 'error';

export interface TerminalTab {
  id: string;
  kind: 'terminal';
  mode: 'ssh' | 'local' | 'telnet' | 'serial';
  title: string;
  sessionId?: string;
  spec?: ConnectSpec;
  status: ConnStatus;
  connId?: string;
  cwd?: string;
  color?: string;
  integrated?: boolean;
  /** user of the login shell and of the current (maybe sudo) shell, reported by the hook */
  loginUser?: string;
  shellUser?: string;
  /** bumps to ask the terminal view to reconnect */
  generation: number;
  /** set on panes that live inside another tab's split layout (the owning tab) */
  paneOf?: string;
  /** split layout, on the tab that owns the panes */
  layout?: PaneNode;
  /** pane shown alone (zoomed) */
  zoomedPane?: string;
  /** stable key for the tab's view while panes come and go */
  viewKey?: string;
  /** open the shell on this existing SSH connection instead of logging in again */
  shareConnId?: string;
  /** folder to start in (a split pane opens where its neighbour is) */
  startIn?: string;
  /** file the output is written to */
  logFile?: string;
  /** a trigger asked for attention */
  attention?: boolean;
}

export interface SftpTab {
  id: string;
  kind: 'sftp';
  title: string;
  sessionId?: string;
  spec?: ConnectSpec;
  status: ConnStatus;
  connId?: string;
  /** terminal tab whose connection this view borrows */
  sourceTabId?: string;
  error?: string;
  color?: string;
  generation: number;
}

export interface HomeTab {
  id: string;
  kind: 'home';
  title: string;
}

export type Tab = TerminalTab | SftpTab | HomeTab;

export interface FileEntry {
  name: string;
  type: 'file' | 'dir' | 'link';
  linkDir: boolean;
  size: number;
  mtime: number;
  mode: number;
  perms: string;
  owner?: string;
  group?: string;
}

export interface Listing {
  path: string;
  entries: FileEntry[];
}

export interface TransferJob {
  id: string;
  connId: string;
  direction: 'upload' | 'download';
  label: string;
  status: 'queued' | 'scanning' | 'running' | 'done' | 'error' | 'cancelled';
  totalBytes: number;
  doneBytes: number;
  files: number;
  filesDone: number;
  current: string;
  speed: number;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  targetDir: string;
  sources: string[];
}

export interface PromptPayload {
  holderId?: string;
  title: string;
  message: string;
  fields: { label: string; secret: boolean }[];
  allowSave?: boolean;
  error?: string;
}

export interface HostKeyPayload {
  holderId?: string;
  host: string;
  port: number;
  status: 'unknown' | 'changed';
  fingerprint: string;
  type: string;
  previous?: string;
}

/** A saved login (username + password/key) that sessions can share. */
export interface Credential {
  id: string;
  name: string;
  username: string;
  keyPath: string;
  notes: string;
}

/** One sample from the server monitor (status bar). */
export interface ServerStats {
  os?: string;
  kernel?: string;
  hostname?: string;
  cores?: number;
  cpu?: number;
  mem?: { total: number; used: number };
  swap?: { total: number; used: number };
  disk?: { total: number; used: number };
  rx?: number;
  tx?: number;
  uptime?: number;
  load?: number[];
}

export interface HistoryEntry {
  cmd: string;
  at: number;
}
