import { create } from 'zustand';
import { api, type AppInfo } from '../lib/api';
import { DEFAULT_SETTINGS, defaultButtonBars, newFolder, newSession, uid } from '../lib/defaults';
import { equalize, leaf, leafIds, neighbor, removeLeaf, splitLeaf } from '../lib/panes';
import { DEFAULT_RULES } from '../lib/highlight';
import { typeInfo } from '../lib/sessionTypes';
import { setCustomThemes } from '../lib/themes';
import { terminals } from '../lib/terminals';
import type {
  ButtonBar,
  ConnectSpec,
  Credential,
  HistoryEntry,
  ServerStats,
  FolderItem,
  HostKeyPayload,
  PromptPayload,
  SessionItem,
  Settings,
  SftpTab,
  Snippet,
  Tab,
  TerminalTab,
  TransferJob,
  TreeItem,
  Trigger,
  Workspace,
  SplitDir,
} from '../lib/types';

export type SidebarPanel = 'sessions' | 'files' | 'snippets';

export type Dialog =
  | { id: string; type: 'session'; sessionId?: string; parentId?: string | null; draft?: Partial<SessionItem>; section?: string }
  | { id: string; type: 'settings'; section?: string }
  | { id: string; type: 'ask'; askId: string; kind: 'prompt'; payload: PromptPayload }
  | { id: string; type: 'ask'; askId: string; kind: 'hostkey'; payload: HostKeyPayload }
  | {
      id: string;
      type: 'confirm';
      title: string;
      message: string;
      detail?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      extraLabel?: string;
      danger?: boolean;
      resolve: (v: 'confirm' | 'cancel' | 'extra') => void;
    }
  | {
      id: string;
      type: 'input';
      title: string;
      label?: string;
      value?: string;
      placeholder?: string;
      confirmLabel?: string;
      selectBase?: boolean;
      resolve: (v: string | null) => void;
    }
  | { id: string; type: 'permissions'; names: string[]; mode: number; isDir: boolean; resolve: (v: { mode: number; recursive: boolean } | null) => void }
  | { id: string; type: 'quick-connect' }
  | { id: string; type: 'folder'; folderId?: string; parentId?: string | null }
  | { id: string; type: 'credential'; credentialId?: string; onSaved?: (id: string) => void }
  | { id: string; type: 'snippet'; snippet?: Snippet; isNew?: boolean }
  | { id: string; type: 'button'; barId: string; buttonId?: string }
  | { id: string; type: 'workspace'; workspaceId?: string; fromTabs?: boolean }
  | { id: string; type: 'backup'; mode: 'export' | 'import' };

type DialogInput = Dialog extends infer D ? (D extends { id: string } ? Omit<D, 'id'> : never) : never;

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'error';
  text: string;
  action?: { label: string; run: () => void };
}

interface FilesState {
  path: string;
  follow: boolean;
  /** "root" when the user chose Browse as root (sudo); '' = login user */
  asUser?: string;
  /** why browsing as another user (sudo) failed */
  sudoError?: { user: string; message: string };
}

interface AppState {
  ready: boolean;
  info: AppInfo | null;
  items: TreeItem[];
  settings: Settings;
  snippets: Snippet[];
  credentials: Credential[];
  tabs: Tab[];
  activeTabId: string;
  sidebarPanel: SidebarPanel;
  broadcast: boolean;
  dialogs: Dialog[];
  toasts: Toast[];
  transfers: Record<string, TransferJob>;
  files: Record<string, FilesState>;
  /** latest monitor sample per connection */
  stats: Record<string, ServerStats>;
  /** recent samples per connection for the sparklines (oldest first) */
  statsHistory: Record<string, { cpu?: number; mem?: number; rx?: number; tx?: number }[]>;
  /** commands run in each terminal tab (newest last) */
  history: Record<string, HistoryEntry[]>;
  /** sidebar panel last chosen by hand for a tab */
  tabPanels: Record<string, SidebarPanel>;
  buttonBars: ButtonBar[];
  triggers: Trigger[];
  workspaces: Workspace[];
  /** pane last focused in each tab with split panes */
  focusedPane: Record<string, string>;
  /** live view state of each terminal (for the status bar) */
  termUi: Record<string, TermUi>;
  /** where the terminals of the visible tab are drawn (px, inside the views area) */
  paneArea: { x: number; y: number; w: number; h: number };
  /** compose bar: drafts a command and sends it to chosen terminals */
  compose: { open: boolean; target: ComposeTarget };
  sync: SyncStatus;
}

export interface TermUi {
  cols: number;
  rows: number;
  fontSize: number;
  highlight: boolean;
}

/** 'pane' = focused terminal, 'tab' = every pane of the tab, 'all' = every connected terminal, or picked terminals */
export type ComposeTarget = 'pane' | 'tab' | 'all' | string[];

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSync?: number;
  message?: string;
  hasPassphrase?: boolean;
  file?: string;
}

export const useApp = create<AppState>(() => ({
  ready: false,
  info: null,
  items: [],
  settings: DEFAULT_SETTINGS,
  snippets: [],
  credentials: [],
  tabs: [],
  activeTabId: '',
  sidebarPanel: 'sessions',
  broadcast: false,
  dialogs: [],
  toasts: [],
  transfers: {},
  files: {},
  stats: {},
  statsHistory: {},
  history: {},
  tabPanels: {},
  buttonBars: [],
  triggers: [],
  workspaces: [],
  focusedPane: {},
  termUi: {},
  paneArea: { x: 0, y: 0, w: 0, h: 0 },
  compose: { open: false, target: 'pane' },
  sync: { state: 'off' },
}));

const get = useApp.getState;
const set = useApp.setState;

// ---- persistence -------------------------------------------------------------------

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
type StoreKey = 'sessions' | 'settings' | 'snippets' | 'credentials' | 'automation';

function storeData(key: StoreKey) {
  const s = get();
  switch (key) {
    case 'sessions':
      return { version: 1, items: s.items };
    case 'settings':
      return s.settings;
    case 'credentials':
      return s.credentials;
    case 'snippets':
      return s.snippets;
    case 'automation':
      return { version: 1, buttonBars: s.buttonBars, triggers: s.triggers, workspaces: s.workspaces };
  }
}

function persist(key: StoreKey) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => {
    delete timers[key];
    api.store.save(key, storeData(key)).catch((err) => toast('error', `Could not save ${key}: ${err.message}`));
  }, 250);
}

/** Writes pending changes right away (before an export or sync). */
export async function flushPersist() {
  const keys = Object.keys(timers) as StoreKey[];
  for (const key of keys) {
    clearTimeout(timers[key]);
    delete timers[key];
  }
  await Promise.all(keys.map((key) => api.store.save(key, storeData(key))));
}

/** Replaces the stored data after an import or a sync from another Mac. */
export function applyStoreData(data: { sessions?: any; snippets?: any; credentials?: any; automation?: any; settings?: any }) {
  const patch: Partial<AppState> = {};
  if (data.sessions && Array.isArray(data.sessions.items)) {
    patch.items = data.sessions.items.map((it: TreeItem) => (it.kind === 'session' ? newSession(it) : newFolder(it)));
  }
  if (Array.isArray(data.snippets)) patch.snippets = data.snippets;
  if (Array.isArray(data.credentials)) patch.credentials = data.credentials;
  if (data.automation) {
    if (Array.isArray(data.automation.buttonBars)) patch.buttonBars = data.automation.buttonBars;
    if (Array.isArray(data.automation.triggers)) patch.triggers = data.automation.triggers;
    if (Array.isArray(data.automation.workspaces)) patch.workspaces = data.automation.workspaces;
  }
  if (data.settings) {
    const settings = { ...get().settings, ...data.settings };
    setCustomThemes(settings.customThemes);
    patch.settings = settings;
  }
  set(patch);
}

// fixed ids, so two Macs that sync do not get the defaults twice
const DEFAULT_SNIPPETS: Snippet[] = [
  { id: 'default-snip-disk', name: 'Disk usage', command: 'df -h', run: true },
  { id: 'default-snip-memory', name: 'Memory', command: 'free -h', run: true },
  { id: 'default-snip-top', name: 'Top processes', command: 'ps aux --sort=-%cpu | head -15', run: true },
  { id: 'default-snip-ports', name: 'Listening ports', command: 'sudo ss -tulpn', run: true },
  { id: 'default-snip-syslog', name: 'Follow syslog', command: 'sudo journalctl -f', run: true },
];

export async function initApp() {
  const [data, info] = await Promise.all([api.store.load(), api.app.info()]);
  const automation = data.automation || {};
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  setCustomThemes(settings.customThemes);
  if (!Array.isArray(settings.highlightRules) || !settings.highlightRules.length) settings.highlightRules = DEFAULT_RULES;
  const items: TreeItem[] = Array.isArray(data.sessions?.items)
    ? data.sessions.items.map((it: TreeItem) => (it.kind === 'session' ? newSession(it) : newFolder(it)))
    : [];
  const home = { id: uid(), kind: 'home' as const, title: 'Home' };
  set({
    ready: true,
    info,
    settings,
    items,
    snippets: Array.isArray(data.snippets) ? data.snippets : DEFAULT_SNIPPETS,
    credentials: Array.isArray(data.credentials) ? data.credentials : [],
    buttonBars: Array.isArray(automation.buttonBars) ? automation.buttonBars : defaultButtonBars(),
    triggers: Array.isArray(automation.triggers) ? automation.triggers : [],
    workspaces: Array.isArray(automation.workspaces) ? automation.workspaces : [],
    tabs: [home],
    activeTabId: home.id,
  });
  api.app.setConfirmClose(settings.confirmClose);
  for (const ws of get().workspaces) if (ws.openOnLaunch) openWorkspace(ws.id);
}

// ---- toasts --------------------------------------------------------------------------

export function toast(kind: Toast['kind'], text: string, action?: Toast['action']) {
  const t: Toast = { id: uid(), kind, text, action };
  set((s) => ({ toasts: [...s.toasts.slice(-4), t] }));
  setTimeout(() => dismissToast(t.id), action ? 6000 : kind === 'error' ? 6000 : 3200);
}

export function dismissToast(id: string) {
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

// ---- dialogs -------------------------------------------------------------------------

export function openDialog(d: DialogInput): string {
  const id = uid();
  set((s) => ({ dialogs: [...s.dialogs, { ...d, id } as Dialog] }));
  return id;
}

export function closeDialog(id: string) {
  set((s) => ({ dialogs: s.dialogs.filter((d) => d.id !== id) }));
}

export function confirmDialog(opts: {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  extraLabel?: string;
  danger?: boolean;
}): Promise<'confirm' | 'cancel' | 'extra'> {
  return new Promise((resolve) => openDialog({ type: 'confirm', ...opts, resolve }));
}

export async function confirm(opts: { title: string; message: string; detail?: string; confirmLabel?: string; danger?: boolean }) {
  return (await confirmDialog(opts)) === 'confirm';
}

export function inputDialog(opts: {
  title: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  selectBase?: boolean;
}): Promise<string | null> {
  return new Promise((resolve) => openDialog({ type: 'input', ...opts, resolve }));
}

export function permissionsDialog(names: string[], mode: number, isDir: boolean) {
  return new Promise<{ mode: number; recursive: boolean } | null>((resolve) =>
    openDialog({ type: 'permissions', names, mode, isDir, resolve })
  );
}

// ---- settings ------------------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>) {
  if ('customThemes' in patch) setCustomThemes(patch.customThemes);
  set((s) => ({ settings: { ...s.settings, ...patch } }));
  persist('settings');
  if ('confirmClose' in patch) api.app.setConfirmClose(!!patch.confirmClose);
  if ('translucentSidebar' in patch) api.app.setVibrancy(!!patch.translucentSidebar);
  if ('syncEnabled' in patch || 'syncDir' in patch || 'syncSecrets' in patch) configureSync();
}

/** Tells the main process how to sync (Settings → Sync & backup). */
export function configureSync() {
  const { syncEnabled, syncDir, syncSecrets } = get().settings;
  return api.sync
    .configure({ enabled: syncEnabled, dir: syncDir, includeSecrets: syncSecrets })
    .then(() => api.sync.status())
    .then((st) => set({ sync: st }))
    .catch(() => {});
}

// ---- sessions tree -------------------------------------------------------------------

export function sessionById(id?: string): SessionItem | undefined {
  if (!id) return undefined;
  const it = get().items.find((x) => x.id === id);
  return it && it.kind === 'session' ? it : undefined;
}

export function childrenOf(parentId: string | null, items = get().items): TreeItem[] {
  return items.filter((i) => i.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function saveItem(item: TreeItem) {
  set((s) => {
    const exists = s.items.some((i) => i.id === item.id);
    if (exists) return { items: s.items.map((i) => (i.id === item.id ? item : i)) };
    const siblings = childrenOf(item.parentId, s.items);
    const order = siblings.length ? siblings[siblings.length - 1].order + 1 : 0;
    return { items: [...s.items, { ...item, order }] };
  });
  persist('sessions');
  // keep open tabs in sync with renamed sessions
  if (item.kind === 'session') {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        (t.kind === 'terminal' || t.kind === 'sftp') && t.sessionId === item.id
          ? { ...t, title: t.kind === 'sftp' ? `SFTP · ${item.name}` : item.name, color: item.color }
          : t
      ),
    }));
  }
}

export function patchItem(id: string, patch: Partial<SessionItem> | Partial<FolderItem>) {
  set((s) => ({ items: s.items.map((i) => (i.id === id ? ({ ...i, ...patch } as TreeItem) : i)) }));
  persist('sessions');
}

export function setAllFolders(expanded: boolean) {
  set((s) => ({ items: s.items.map((i) => (i.kind === 'folder' ? { ...i, expanded } : i)) }));
  persist('sessions');
}

export function descendants(id: string, items = get().items): string[] {
  const out: string[] = [];
  const walk = (pid: string) => {
    for (const it of items) {
      if (it.parentId === pid) {
        out.push(it.id);
        if (it.kind === 'folder') walk(it.id);
      }
    }
  };
  walk(id);
  return out;
}

export function removeItems(ids: string[]) {
  const all = new Set<string>();
  for (const id of ids) {
    all.add(id);
    for (const d of descendants(id)) all.add(d);
  }
  const removedSessions = get().items.filter((i) => all.has(i.id) && i.kind === 'session');
  set((s) => ({ items: s.items.filter((i) => !all.has(i.id)) }));
  for (const sess of removedSessions) api.secrets.remove(sess.id).catch(() => {});
  persist('sessions');
}

/** Moves an item before/after a sibling, or into a folder. */
export function moveItem(id: string, targetId: string | null, position: 'before' | 'after' | 'into') {
  const { items } = get();
  const item = items.find((i) => i.id === id);
  if (!item || id === targetId) return;
  const target = targetId ? items.find((i) => i.id === targetId) : null;
  let parentId: string | null;
  if (!target) parentId = null;
  else if (position === 'into' && target.kind === 'folder') parentId = target.id;
  else parentId = target.parentId;
  if (item.kind === 'folder' && parentId && (parentId === item.id || descendants(item.id).includes(parentId))) return;

  const siblings = childrenOf(parentId, items).filter((i) => i.id !== id);
  let index = siblings.length;
  if (target && position !== 'into') {
    const ti = siblings.findIndex((i) => i.id === target.id);
    index = position === 'before' ? ti : ti + 1;
  }
  siblings.splice(index, 0, { ...item, parentId });
  const reordered = new Map(siblings.map((s, i) => [s.id, i]));
  set((s) => ({
    items: s.items.map((i) => {
      if (i.id === id) return { ...i, parentId, order: reordered.get(id)! } as TreeItem;
      if (reordered.has(i.id)) return { ...i, order: reordered.get(i.id)! } as TreeItem;
      return i;
    }),
  }));
  if (target && position === 'into' && target.kind === 'folder' && !target.expanded) patchItem(target.id, { expanded: true });
  persist('sessions');
}

export function duplicateSession(id: string) {
  const s = sessionById(id);
  if (!s) return;
  const copy = newSession({ ...s, id: uid(), name: `${s.name} copy`, lastUsed: undefined, createdAt: Date.now() });
  saveItem(copy);
}

export function folderPath(id: string | null): string {
  const parts: string[] = [];
  let cur = id ? get().items.find((i) => i.id === id) : undefined;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? get().items.find((i) => i.id === cur!.parentId) : undefined;
  }
  return parts.join(' / ');
}

/** Finds or creates a folder path like ["Imported", "Prod"]. */
export function ensureFolderPath(names: string[], parentId: string | null = null): string | null {
  let pid = parentId;
  for (const name of names) {
    const existing = get().items.find((i) => i.kind === 'folder' && i.parentId === pid && i.name === name);
    if (existing) pid = existing.id;
    else {
      const f = newFolder({ name, parentId: pid, expanded: false });
      saveItem(f);
      pid = f.id;
    }
  }
  return pid;
}

// ---- snippets -------------------------------------------------------------------------

export function saveSnippet(snip: Snippet) {
  set((s) => ({
    snippets: s.snippets.some((x) => x.id === snip.id) ? s.snippets.map((x) => (x.id === snip.id ? snip : x)) : [...s.snippets, snip],
  }));
  persist('snippets');
}

export function removeSnippet(id: string) {
  set((s) => ({ snippets: s.snippets.filter((x) => x.id !== id) }));
  persist('snippets');
}

// ---- credentials (saved logins) ------------------------------------------------------------

export function credentialById(id?: string): Credential | undefined {
  return id ? get().credentials.find((c) => c.id === id) : undefined;
}

export function saveCredential(c: Credential) {
  set((s) => ({
    credentials: s.credentials.some((x) => x.id === c.id) ? s.credentials.map((x) => (x.id === c.id ? c : x)) : [...s.credentials, c],
  }));
  persist('credentials');
}

export function removeCredential(id: string) {
  set((s) => ({
    credentials: s.credentials.filter((c) => c.id !== id),
    items: s.items.map((i) => (i.kind === 'session' && i.credentialId === id ? { ...i, credentialId: '' } : i)),
  }));
  api.secrets.remove(`cred:${id}`).catch(() => {});
  persist('credentials');
  persist('sessions');
}

// ---- connection specs ------------------------------------------------------------------

export function specFor(session: SessionItem, seen = new Set<string>()): ConnectSpec {
  seen.add(session.id);
  const jumpSession = session.jumpHostId && !seen.has(session.jumpHostId) ? sessionById(session.jumpHostId) : undefined;
  const cred = credentialById(session.credentialId);
  return {
    id: session.id,
    credentialId: cred ? cred.id : undefined,
    name: session.name || session.host,
    host: session.host,
    port: Number(session.port) || 22,
    username: session.username || cred?.username || '',
    authMethod: session.authMethod,
    keyPath: session.keyPath,
    legacyAlgorithms: session.legacyAlgorithms,
    keepAlive: Number.isFinite(session.keepAlive) ? session.keepAlive : get().settings.keepAlive,
    forwards: session.forwards || [],
    jump: jumpSession ? specFor(jumpSession, seen) : undefined,
  };
}

// ---- tabs --------------------------------------------------------------------------------
//
// `tabs` holds every terminal, including the panes of split tabs. A pane has
// `paneOf` set to the tab that owns it; that tab keeps the split `layout`.
// The tab bar shows only tabs without `paneOf`. `activeTabId` is the focused
// terminal, which may be a pane.

export function activeTab(): Tab | undefined {
  const s = get();
  return s.tabs.find((t) => t.id === s.activeTabId);
}

export function updateTab(id: string, patch: Partial<TerminalTab> | Partial<SftpTab>) {
  set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? ({ ...t, ...patch } as Tab) : t)) }));
}

/** The tab (in the tab bar) that shows this terminal. */
export function rootOf(id: string, tabs = get().tabs): string {
  const t = tabs.find((x) => x.id === id);
  return t && t.kind === 'terminal' && t.paneOf ? t.paneOf : id;
}

export function isRoot(t: Tab) {
  return !(t.kind === 'terminal' && t.paneOf);
}

/** Tabs as shown in the tab bar. */
export function rootTabs(tabs = get().tabs): Tab[] {
  return tabs.filter(isRoot);
}

/** The terminals shown in a tab (one, or all panes of a split tab). */
export function panesOf(rootId: string, tabs = get().tabs): TerminalTab[] {
  const root = tabs.find((t) => t.id === rootId);
  if (!root || root.kind !== 'terminal') return [];
  if (!root.layout) return [root];
  return leafIds(root.layout)
    .map((id) => tabs.find((t) => t.id === id))
    .filter((t): t is TerminalTab => !!t && t.kind === 'terminal');
}

export function isSplit(id: string) {
  const root = get().tabs.find((t) => t.id === rootOf(id));
  return !!root && root.kind === 'terminal' && !!root.layout;
}

function addTab(tab: Tab, activate = true, atEnd = false) {
  set((s) => {
    const idx = atEnd ? -1 : s.tabs.findIndex((t) => t.id === rootOf(s.activeTabId, s.tabs));
    const tabs = [...s.tabs];
    tabs.splice(idx >= 0 ? idx + 1 : tabs.length, 0, tab);
    return { tabs };
  });
  if (activate) activateTab(tab.id);
}

/**
 * Focuses a tab. For a tab with split panes this is the pane focused last,
 * unless `pane` says the id means exactly that terminal.
 */
export function activateTab(id: string, opts: { pane?: boolean } = {}) {
  const s = get();
  const t = s.tabs.find((x) => x.id === id);
  if (!t) return;
  let target = id;
  if (!opts.pane && t.kind === 'terminal' && !t.paneOf && t.layout) {
    const remembered = s.focusedPane[id];
    if (remembered && leafIds(t.layout).includes(remembered)) target = remembered;
  }
  const root = rootOf(target, s.tabs);
  set((st) => ({
    activeTabId: target,
    focusedPane: { ...st.focusedPane, [root]: target },
    tabs: st.tabs.some((x) => x.id === target && x.kind === 'terminal' && x.attention)
      ? st.tabs.map((x) => (x.id === target ? ({ ...x, attention: false } as Tab) : x))
      : st.tabs,
  }));
}

/** Builds the terminal tab for a saved session (null for SFTP / external types). */
function terminalFor(session: SessionItem): TerminalTab | null {
  const info = typeInfo(session.type);
  if (info.opens !== 'terminal') return null;
  const mode: TerminalTab['mode'] =
    session.type === 'telnet' ? 'telnet' : session.type === 'serial' ? 'serial' : session.type === 'ssh' ? 'ssh' : 'local';
  return {
    id: uid(),
    kind: 'terminal',
    mode,
    title: session.name || session.host || info.label,
    sessionId: session.id,
    spec: session.type === 'ssh' ? specFor(session) : undefined,
    status: 'connecting',
    color: session.color,
    cwd: mode === 'local' ? session.startDir || undefined : undefined,
    generation: 0,
  };
}

function localTerminal(cwd?: string): TerminalTab {
  const n = get().tabs.filter((t) => t.kind === 'terminal' && t.mode === 'local' && !t.sessionId).length;
  return { id: uid(), kind: 'terminal', mode: 'local', title: n ? `Local ${n + 1}` : 'Local', status: 'connecting', cwd, generation: 0 };
}

/** Opens a saved session the way its type needs: terminal tab, SFTP browser or external app. */
export function openSession(sessionId: string, opts: { split?: SplitDir; activate?: boolean; beside?: string; before?: boolean } = {}) {
  const session = sessionById(sessionId);
  if (!session) return;
  patchItem(sessionId, { lastUsed: Date.now() });
  const info = typeInfo(session.type);
  if (info.opens === 'sftp') return openSftp({ sessionId });
  if (info.opens === 'external') return launchExternal(session);
  const tab = terminalFor(session)!;
  if (opts.split && placeInSplit(tab, opts.split, opts.activate, opts.beside, opts.before)) return tab.id;
  addTab(tab, opts.activate !== false);
  return tab.id;
}

async function launchExternal(session: SessionItem) {
  const name = session.name || session.host;
  const username = credentialById(session.credentialId)?.username || session.username;
  try {
    if (session.type === 'rdp') {
      await api.launch.rdp({
        name,
        host: session.host,
        port: session.port,
        username,
        domain: session.rdpDomain,
        fullscreen: session.rdpFullscreen,
      });
      toast('info', `Opening ${name} in Windows App`);
    } else {
      await api.launch.vnc({ host: session.host, port: session.port, username });
      toast('info', `Opening ${name} in Screen Sharing`);
    }
  } catch (err: any) {
    if (!err.cancelled) toast('error', err.message);
  }
}

export function openQuickConnect(spec: ConnectSpec) {
  addTab({
    id: uid(),
    kind: 'terminal',
    mode: 'ssh',
    title: spec.name || spec.host,
    spec,
    status: 'connecting',
    generation: 0,
  });
}

export function openLocal(cwd?: string, opts: { split?: SplitDir; activate?: boolean } = {}) {
  const tab = localTerminal(cwd);
  if (opts.split && placeInSplit(tab, opts.split, opts.activate)) return tab.id;
  addTab(tab, opts.activate !== false);
  return tab.id;
}

export function openHome() {
  const existing = get().tabs.find((t) => t.kind === 'home');
  if (existing) return activateTab(existing.id);
  addTab({ id: uid(), kind: 'home', title: 'Home' });
}

/** Opens the dual-pane SFTP browser, borrowing a terminal's connection when possible. */
export function openSftp(opts: { fromTabId?: string; sessionId?: string }) {
  if (opts.fromTabId) {
    const src = get().tabs.find((t) => t.id === opts.fromTabId);
    if (src && src.kind === 'terminal' && src.mode === 'ssh') {
      addTab({
        id: uid(),
        kind: 'sftp',
        title: `SFTP · ${src.title}`,
        sessionId: src.sessionId,
        spec: src.spec,
        status: 'connecting',
        sourceTabId: src.id,
        connId: src.status === 'connected' ? src.connId : undefined,
        color: src.color,
        generation: 0,
      });
      return;
    }
  }
  const session = sessionById(opts.sessionId);
  if (!session) return;
  patchItem(session.id, { lastUsed: Date.now() });
  addTab({
    id: uid(),
    kind: 'sftp',
    title: `SFTP · ${session.name || session.host}`,
    sessionId: session.id,
    spec: specFor(session),
    status: 'connecting',
    color: session.color,
    generation: 0,
  });
}

export function duplicateTab(id: string) {
  const t = get().tabs.find((x) => x.id === id);
  if (!t || t.kind === 'home') return;
  if (t.kind === 'terminal' && t.mode === 'local' && !t.sessionId) return openLocal(t.cwd);
  if (t.kind === 'terminal') {
    if (t.sessionId && sessionById(t.sessionId)) return openSession(t.sessionId);
    if (t.spec) return openQuickConnect(t.spec);
  }
  if (t.kind === 'sftp' && t.sessionId) return openSftp({ sessionId: t.sessionId });
}

// ---- split panes -------------------------------------------------------------------------

/** Puts a new terminal next to a pane (default: the focused pane of the active tab). */
function placeInSplit(tab: TerminalTab, dir: SplitDir, activate = true, besideId?: string, before = false): boolean {
  const s = get();
  const beside = s.tabs.find((t) => t.id === (besideId || s.activeTabId));
  if (!beside || beside.kind !== 'terminal') return false;
  const rootId = rootOf(beside.id, s.tabs);
  set((st) => ({
    tabs: [
      ...st.tabs.map((t) => {
        if (t.id !== rootId || t.kind !== 'terminal') return t;
        return { ...t, layout: splitLeaf(t.layout || leaf(t.id), beside.id, tab.id, dir, before), zoomedPane: undefined, viewKey: t.viewKey || t.id };
      }),
      { ...tab, paneOf: rootId },
    ],
  }));
  if (activate) activateTab(tab.id, { pane: true });
  return true;
}

/** Splits a terminal: the new pane runs the same session (a new shell on the same SSH connection). */
export function splitPane(id: string, dir: SplitDir) {
  const t = get().tabs.find((x) => x.id === id);
  if (!t || t.kind !== 'terminal') return;
  const session = sessionById(t.sessionId);
  let pane: TerminalTab;
  if (session && typeInfo(session.type).opens === 'terminal') pane = terminalFor(session)!;
  else if (t.mode === 'ssh' && t.spec) pane = { id: uid(), kind: 'terminal', mode: 'ssh', title: t.title, spec: t.spec, status: 'connecting', generation: 0 };
  else pane = localTerminal(t.cwd);
  if (t.mode === 'ssh' && t.status === 'connected' && t.connId) pane.shareConnId = t.connId;
  if (t.mode === 'local' && !session) pane.cwd = t.cwd;
  // a new SSH pane starts in the folder the source pane is in
  if (t.mode === 'ssh' && t.cwd && t.integrated) pane.startIn = t.cwd;
  placeInSplit(pane, dir, true, id);
}

/** Can this tab be dragged into another tab (as split panes)? */
export function canMoveIntoSplit(tabId: string, targetRootId: string) {
  const t = get().tabs.find((x) => x.id === tabId);
  return !!t && t.kind === 'terminal' && !t.paneOf && tabId !== targetRootId;
}

/**
 * Moves a terminal tab (with its panes) into another tab next to `besideId`.
 * Nothing restarts: the terminals keep their connection and screen.
 */
export function moveTabIntoSplit(tabId: string, besideId: string, dir: SplitDir, before = false) {
  const s = get();
  const t = s.tabs.find((x) => x.id === tabId);
  const targetRoot = rootOf(besideId, s.tabs);
  if (!t || t.kind !== 'terminal' || !canMoveIntoSplit(tabId, targetRoot)) return;
  const part = t.layout || leaf(t.id);
  const moving = leafIds(part);
  const focus = s.focusedPane[tabId] && moving.includes(s.focusedPane[tabId]) ? s.focusedPane[tabId] : tabId;
  set((st) => ({
    tabs: st.tabs.map((x) => {
      if (x.id === targetRoot && x.kind === 'terminal') {
        return { ...x, layout: splitLeaf(x.layout || leaf(x.id), besideId, part, dir, before), zoomedPane: undefined, viewKey: x.viewKey || x.id };
      }
      if (moving.includes(x.id) && x.kind === 'terminal') return { ...x, paneOf: targetRoot, layout: undefined, zoomedPane: undefined };
      return x;
    }),
  }));
  activateTab(focus, { pane: true });
}

/** Moves `id` right after `afterId` in the tab list (tab bar order). */
function placeAfter(tabs: Tab[], id: string, afterId: string): Tab[] {
  const item = tabs.find((x) => x.id === id);
  if (!item) return tabs;
  const rest = tabs.filter((x) => x.id !== id);
  const at = rest.findIndex((x) => x.id === afterId);
  rest.splice(at === -1 ? rest.length : at + 1, 0, item);
  return rest;
}

/**
 * Takes a pane out of its split tab; it becomes a tab of its own, placed after
 * `after` (default: the tab it came from). The terminal keeps running.
 */
function detachPane(tabs: Tab[], id: string, after?: string): Tab[] {
  const rootId = rootOf(id, tabs);
  const root = tabs.find((x) => x.id === rootId) as TerminalTab | undefined;
  if (!root?.layout) return tabs;
  const layout = removeLeaf(root.layout, id);
  const remaining = leafIds(layout || undefined);
  const keepLayout = layout && remaining.length > 1 ? layout : undefined;
  if (id !== rootId) {
    const out = tabs.map((x) => {
      if (x.id === rootId) return { ...x, layout: keepLayout, zoomedPane: root.zoomedPane === id ? undefined : root.zoomedPane } as Tab;
      if (x.id === id) return { ...x, paneOf: undefined, layout: undefined, zoomedPane: undefined, viewKey: undefined } as Tab;
      return x;
    });
    return placeAfter(out, id, after || rootId);
  }
  // the tab's own terminal leaves: the next pane takes over the tab (and its place in the tab bar)
  const heirId = remaining[0];
  let out = tabs.map((x) => {
    if (x.id === rootId) return { ...x, layout: undefined, zoomedPane: undefined, viewKey: uid() } as Tab;
    if (x.id === heirId) return { ...x, paneOf: undefined, layout: keepLayout, viewKey: root.viewKey || root.id, zoomedPane: undefined } as Tab;
    if (x.kind === 'terminal' && x.paneOf === rootId) return { ...x, paneOf: heirId };
    return x;
  });
  const heir = out.find((x) => x.id === heirId)!;
  out = out.filter((x) => x.id !== heirId);
  out.splice(out.findIndex((x) => x.id === rootId), 0, heir);
  return placeAfter(out, rootId, after || heirId);
}

/** Moves one pane out into a tab of its own. */
export function popOutPane(id: string) {
  if (!isSplit(id)) return;
  const s = get();
  const rootId = rootOf(id, s.tabs);
  const root = s.tabs.find((x) => x.id === rootId) as TerminalTab;
  const remembered = s.focusedPane[rootId];
  const stay = remembered && remembered !== id ? remembered : leafIds(root.layout).find((x) => x !== id)!;
  set((st) => {
    const focusedPane = { ...st.focusedPane };
    delete focusedPane[rootId];
    return { tabs: detachPane(st.tabs, id), focusedPane };
  });
  // stay in the split tab; the moved terminal waits in its own tab
  activateTab(stay, { pane: true });
}

/** Unsplit: every pane of the tab becomes a tab of its own again (all keep running). */
export function separatePanes(id = get().activeTabId) {
  const s = get();
  const rootId = rootOf(id, s.tabs);
  const root = s.tabs.find((x) => x.id === rootId);
  if (!root || root.kind !== 'terminal' || !root.layout) return;
  const order = leafIds(root.layout);
  set((st) => {
    let tabs = st.tabs;
    let after = order[0];
    // the first pane keeps the tab; the others follow it in their split order
    if (order[0] !== rootId) tabs = detachPane(tabs, rootId);
    for (const pid of order.slice(1)) {
      if (pid === rootId) continue;
      tabs = detachPane(tabs, pid, after);
      after = pid;
    }
    const focusedPane = { ...st.focusedPane };
    delete focusedPane[rootId];
    return { tabs, focusedPane };
  });
  activateTab(s.activeTabId, { pane: true });
}

export function focusPane(dir: 'left' | 'right' | 'up' | 'down') {
  const s = get();
  const rootId = rootOf(s.activeTabId);
  const root = s.tabs.find((t) => t.id === rootId);
  if (!root || root.kind !== 'terminal' || !root.layout || root.zoomedPane) return;
  const next = neighbor(root.layout, s.activeTabId, dir);
  if (next) activateTab(next, { pane: true });
}

export function toggleZoomPane(id = get().activeTabId) {
  const rootId = rootOf(id);
  const root = get().tabs.find((t) => t.id === rootId);
  if (!root || root.kind !== 'terminal' || !root.layout) return;
  updateTab(rootId, { zoomedPane: root.zoomedPane ? undefined : id });
  activateTab(id, { pane: true });
}

export function equalizePanes(id = get().activeTabId) {
  const rootId = rootOf(id);
  const root = get().tabs.find((t) => t.id === rootId);
  if (root && root.kind === 'terminal' && root.layout) updateTab(rootId, { layout: equalize(root.layout) });
}

/** Stops the terminal and drops its per-tab state. */
function disposeTerminal(id: string) {
  api.term.close(id).catch(() => {});
  setTimeout(() => terminals.forget(id), 2000);
}

function dropTabState(ids: string[]) {
  set((st) => {
    const files = { ...st.files };
    const history = { ...st.history };
    const termUi = { ...st.termUi };
    for (const id of ids) {
      delete files[id];
      delete history[id];
      delete termUi[id];
    }
    return { files, history, termUi };
  });
}

/** Closes one pane of a split tab (or the whole tab when it is not split). */
export async function closePane(id: string, force = false): Promise<void> {
  const s = get();
  const t = s.tabs.find((x) => x.id === id);
  if (!t) return;
  if (!isSplit(id)) return closeTab(id, force);
  if (t.kind !== 'terminal') return;
  if (!force && t.status === 'connected' && s.settings.confirmClose) {
    const ok = await confirm({
      title: `Close this pane?`,
      message: t.mode === 'ssh' ? `The shell on “${t.title}” will be closed.` : 'The running shell will be terminated.',
      confirmLabel: 'Close',
      danger: true,
    });
    if (!ok) return;
  }
  disposeTerminal(id);
  const rootId = rootOf(id);
  set((st) => {
    const root = st.tabs.find((x) => x.id === rootId) as TerminalTab | undefined;
    if (!root?.layout) return {};
    const remaining = leafIds(root.layout).filter((x) => x !== id);
    const tabs = detachPane(st.tabs, id).filter((x) => x.id !== id);
    const focusedPane = { ...st.focusedPane };
    delete focusedPane[rootId];
    return { tabs, focusedPane, activeTabId: st.activeTabId === id ? remaining[0] : st.activeTabId };
  });
  dropTabState([id]);
  activateTab(get().activeTabId, { pane: true });
}

/** Back to one terminal: keeps `id` (or the focused pane) and closes the other panes of its tab. */
export async function unsplitTab(id = get().activeTabId): Promise<void> {
  const s = get();
  const rootId = rootOf(id);
  const panes = panesOf(rootId);
  if (panes.length < 2) return;
  const keepId = panes.some((p) => p.id === id) && id !== rootId ? id : s.focusedPane[rootId] || id;
  const keep = panes.find((p) => p.id === keepId) || panes[0];
  const others = panes.filter((p) => p.id !== keep.id);
  const live = others.filter((p) => p.status === 'connected').length;
  if (live && s.settings.confirmClose) {
    const ok = await confirm({
      title: `Close the other ${others.length} pane${others.length === 1 ? '' : 's'}?`,
      message: `Only the pane you are in stays open. ${live} running shell${live === 1 ? '' : 's'} will be closed.`,
      confirmLabel: 'Close panes',
      danger: true,
    });
    if (!ok) return;
  }
  for (const p of others) await closePane(p.id, true);
  activateTab(keep.id, { pane: true });
}

export function reconnectTab(id: string) {
  const t = get().tabs.find((x) => x.id === id);
  if (!t || t.kind === 'home') return;
  // pick up edits made to the saved session since the tab was opened
  const session = t.sessionId ? sessionById(t.sessionId) : undefined;
  updateTab(id, {
    status: 'connecting',
    connId: undefined,
    generation: t.generation + 1,
    ...(t.kind === 'terminal' ? { shareConnId: undefined } : {}),
    ...(session
      ? {
          spec: session.type === 'ssh' || session.type === 'sftp' ? specFor(session) : undefined,
          title: t.kind === 'sftp' ? `SFTP · ${session.name}` : session.name,
          color: session.color,
        }
      : {}),
    ...(t.kind === 'sftp' ? { sourceTabId: undefined, error: undefined } : {}),
  });
}

export function isTabBusy(t: Tab) {
  return (t.kind === 'terminal' || t.kind === 'sftp') && (t.status === 'connected' || t.status === 'connecting');
}

/** Closes a tab with all its panes (a pane id closes just that pane). */
export async function closeTab(id: string, force = false): Promise<void> {
  const s = get();
  const t = s.tabs.find((x) => x.id === id);
  if (!t) return;
  if (t.kind === 'terminal' && t.paneOf) return closePane(id, force);
  const members = t.kind === 'terminal' ? panesOf(id) : [];
  const connected = members.filter((m) => m.status === 'connected');
  if (!force && connected.length && s.settings.confirmClose) {
    const ok = await confirm({
      title: `Close “${t.title}”?`,
      message:
        members.length > 1
          ? `${connected.length} of its ${members.length} panes ${connected.length === 1 ? 'is' : 'are'} still connected and will be closed.`
          : t.kind === 'terminal' && t.mode === 'ssh'
            ? 'The SSH session will be disconnected.'
            : 'The running shell will be terminated.',
      confirmLabel: 'Close',
      danger: true,
    });
    if (!ok) return;
  }
  const ids = t.kind === 'terminal' ? members.map((m) => m.id) : [id];
  if (!ids.includes(id)) ids.push(id);
  if (t.kind === 'terminal' || t.kind === 'sftp') for (const x of ids) disposeTerminal(x);
  set((st) => {
    const roots = rootTabs(st.tabs);
    const idx = roots.findIndex((x) => x.id === id);
    const tabs = st.tabs.filter((x) => !ids.includes(x.id));
    const rest = rootTabs(tabs);
    let activeTabId = st.activeTabId;
    if (ids.includes(activeTabId)) activeTabId = rest[Math.min(idx, rest.length - 1)]?.id || '';
    return { tabs, activeTabId };
  });
  dropTabState(ids);
  if (!get().tabs.length) openHome();
  else activateTab(get().activeTabId);
}

/** Moves a tab to a position in the tab bar. */
export function moveTab(id: string, toIndex: number) {
  set((s) => {
    const roots = rootTabs(s.tabs).filter((t) => t.id !== id);
    const tab = s.tabs.find((t) => t.id === id);
    if (!tab) return {};
    roots.splice(Math.max(0, Math.min(toIndex, roots.length)), 0, tab);
    const panes = s.tabs.filter((t) => !isRoot(t));
    return { tabs: [...roots, ...panes] };
  });
}

export function cycleTab(dir: 1 | -1) {
  const s = get();
  const roots = rootTabs(s.tabs);
  const idx = roots.findIndex((t) => t.id === rootOf(s.activeTabId, s.tabs));
  if (idx < 0 || roots.length < 2) return;
  activateTab(roots[(idx + dir + roots.length) % roots.length].id);
}

export function setTermUi(id: string, patch: Partial<TermUi>) {
  set((s) => {
    const cur = s.termUi[id] || { cols: 0, rows: 0, fontSize: s.settings.fontSize, highlight: true };
    const next = { ...cur, ...patch };
    if (Object.keys(patch).every((k) => (cur as any)[k] === (next as any)[k])) return {};
    return { termUi: { ...s.termUi, [id]: next } };
  });
}

// ---- files panel state -----------------------------------------------------------------

export function setFilesState(tabId: string, patch: Partial<FilesState>) {
  set((s) => {
    const base: FilesState = s.files[tabId] || { path: '', follow: s.settings.followFolder };
    return { files: { ...s.files, [tabId]: { ...base, ...patch } } };
  });
}

// ---- transfers -------------------------------------------------------------------------------

export function upsertTransfer(job: TransferJob) {
  set((s) => ({ transfers: { ...s.transfers, [job.id]: job } }));
}

export function clearFinishedTransfers(connId?: string) {
  set((s) => {
    const transfers: Record<string, TransferJob> = {};
    for (const [id, j] of Object.entries(s.transfers)) {
      const finished = j.status === 'done' || j.status === 'error' || j.status === 'cancelled';
      if (!finished || (connId && j.connId.split('|')[0] !== connId)) transfers[id] = j;
    }
    return { transfers };
  });
  api.transfer.clear().catch(() => {});
}

// ---- monitoring & command history ------------------------------------------------------------

export function setStats(connId: string, stats: ServerStats) {
  const point = {
    cpu: stats.cpu,
    mem: stats.mem ? (stats.mem.used / stats.mem.total) * 100 : undefined,
    rx: stats.rx,
    tx: stats.tx,
  };
  set((s) => ({
    stats: { ...s.stats, [connId]: stats },
    statsHistory: { ...s.statsHistory, [connId]: [...(s.statsHistory[connId] || []).slice(-59), point] },
  }));
}

export function addHistory(tabId: string, cmd: string) {
  const text = cmd.trim();
  if (!text) return;
  set((s) => {
    const list = s.history[tabId] || [];
    if (list.length && list[list.length - 1].cmd === text) return {};
    return { history: { ...s.history, [tabId]: [...list.slice(-499), { cmd: text, at: Date.now() }] } };
  });
}

/** The user picked a sidebar panel by hand: remember it for the active tab. */
export function chooseSidebarPanel(panel: SidebarPanel) {
  const { activeTabId } = get();
  set((s) => ({ sidebarPanel: panel, tabPanels: { ...s.tabPanels, [activeTabId]: panel } }));
}

// ---- button bars, triggers, workspaces -----------------------------------------------------

export function saveButtonBars(buttonBars: ButtonBar[]) {
  set({ buttonBars });
  persist('automation');
}

export function saveTriggers(triggers: Trigger[]) {
  set({ triggers });
  persist('automation');
}

export function saveWorkspace(ws: Workspace) {
  set((s) => ({
    workspaces: s.workspaces.some((w) => w.id === ws.id) ? s.workspaces.map((w) => (w.id === ws.id ? ws : w)) : [...s.workspaces, ws],
  }));
  persist('automation');
}

export function removeWorkspace(id: string) {
  set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) }));
  persist('automation');
}

/** Opens every session of a workspace in its tabs and split panes. */
export function openWorkspace(id: string) {
  const ws = get().workspaces.find((w) => w.id === id);
  if (!ws) return;
  let prev: string | null = null;
  let first: string | null = null;
  for (const e of ws.entries) {
    const session = e.sessionId ? sessionById(e.sessionId) : undefined;
    if (e.sessionId && !session) continue; // the session was deleted
    const tab = session ? terminalFor(session) : localTerminal();
    if (!tab) {
      openSession(session!.id);
      continue;
    }
    if (session) patchItem(session.id, { lastUsed: Date.now() });
    if (e.placement !== 'tab' && prev && placeInSplit(tab, e.placement === 'right' ? 'row' : 'col', false, prev)) {
      prev = tab.id;
      continue;
    }
    addTab(tab, false, true);
    prev = tab.id;
    first = first || tab.id;
  }
  if (first) activateTab(first);
}

/** Workspace entries that reopen the current tabs and their split panes. */
export function entriesFromTabs(): Workspace['entries'] {
  const s = get();
  const entries: Workspace['entries'] = [];
  const add = (id: string, placement: Workspace['entries'][number]['placement']) => {
    const t = s.tabs.find((x) => x.id === id);
    if (!t || t.kind !== 'terminal') return;
    if (t.sessionId && sessionById(t.sessionId)) entries.push({ id: uid(), sessionId: t.sessionId, placement });
    else if (t.mode === 'local' && !t.sessionId) entries.push({ id: uid(), sessionId: '', placement });
  };
  const walk = (node: import('../lib/types').PaneNode, placement: Workspace['entries'][number]['placement']) => {
    if (node.type === 'leaf') return add(node.id, placement);
    node.children.forEach((c, i) => walk(c, i === 0 ? placement : node.dir === 'row' ? 'right' : 'down'));
  };
  for (const t of rootTabs(s.tabs)) {
    if (t.kind !== 'terminal') {
      if (t.kind === 'sftp' && t.sessionId && sessionById(t.sessionId)) entries.push({ id: uid(), sessionId: t.sessionId, placement: 'tab' });
      continue;
    }
    walk(t.layout || leaf(t.id), 'tab');
  }
  // a split entry needs something to split
  if (entries[0]) entries[0].placement = 'tab';
  return entries;
}

// ---- sending text to terminals (buttons, compose bar) -----------------------------------------

/** Terminals a compose/button target means right now. */
export function targetTerminals(target: ComposeTarget): TerminalTab[] {
  const s = get();
  const connected = (t: Tab): t is TerminalTab => t.kind === 'terminal' && t.status === 'connected';
  if (target === 'pane') return s.tabs.filter((t) => t.id === s.activeTabId).filter(connected);
  if (target === 'tab') return panesOf(rootOf(s.activeTabId)).filter(connected);
  if (target === 'all') return s.tabs.filter(connected);
  return s.tabs.filter((t) => target.includes(t.id)).filter(connected);
}

/** Types text into the target terminals. Returns how many received it. */
export function sendToTerminals(text: string, target: ComposeTarget): number {
  const list = targetTerminals(target);
  for (const t of list) terminals.get(t.id)?.sendInput(text);
  return list.length;
}

export function setCompose(patch: Partial<AppState['compose']>) {
  set((s) => ({ compose: { ...s.compose, ...patch } }));
}
