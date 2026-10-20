import { useEffect } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { api } from './lib/api';
import { importFromMobaXterm, importFromSshConfig } from './lib/importflow';
import { terminals } from './lib/terminals';
import { applyUiTheme, getTheme } from './lib/themes';
import type { ServerStats, TransferJob } from './lib/types';
import {
  activateTab,
  activeTab,
  applyStoreData,
  closePane,
  closeTab,
  configureSync,
  confirmDialog,
  cycleTab,
  dismissToast,
  duplicateTab,
  equalizePanes,
  focusPane,
  openDialog,
  openLocal,
  openSftp,
  reconnectTab,
  rootOf,
  rootTabs,
  sessionById,
  setCompose,
  splitPane,
  toast,
  toggleZoomPane,
  unsplitTab,
  chooseSidebarPanel,
  setStats,
  updateSettings,
  upsertTransfer,
  useApp,
  type SidebarPanel,
  type SyncStatus,
} from './store/app';
import { exportSshConfig } from './lib/backup';
import { startLog, stopLog } from './lib/logging';
import { HomeView } from './components/HomeView';
import { Sidebar } from './components/Sidebar';
import { SftpView } from './components/SftpView';
import { TabBar } from './components/TabBar';
import { TerminalGroup } from './components/TerminalGroup';
import { SessionEditor } from './components/dialogs/SessionEditor';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { FolderDialog } from './components/dialogs/FolderDialog';
import { CredentialDialog } from './components/dialogs/CredentialDialog';
import {
  AskPromptDialog,
  ConfirmDialog,
  HostKeyDialog,
  InputDialog,
  PermissionsDialog,
  QuickConnectDialog,
  SnippetDialog,
} from './components/dialogs/SimpleDialogs';
import { BackupDialog, ButtonDialog, WorkspaceDialog } from './components/dialogs/AutomationDialogs';

function runMenuAction(action: string) {
  const state = useApp.getState();
  const tab = activeTab();
  const term = terminals.get(tab?.id);
  if (action === 'select-all') {
    // ⌘A selects the terminal buffer when a terminal has focus, text otherwise
    if (document.activeElement?.closest('.terminal-host') && term) term.selectAll();
    else document.execCommand('selectAll');
    return;
  }
  if (state.dialogs.length && action !== 'settings') return;
  const showPanel = (panel: SidebarPanel) => {
    chooseSidebarPanel(panel);
    if (!state.settings.sidebarVisible) updateSettings({ sidebarVisible: true });
  };
  if (action.startsWith('tab-')) {
    const n = Number(action.slice(4));
    const roots = rootTabs(state.tabs);
    const t = n === 9 ? roots[roots.length - 1] : roots[n - 1];
    if (t) activateTab(t.id);
    return;
  }
  if (action.startsWith('pane-')) return focusPane(action.slice(5) as 'left' | 'right' | 'up' | 'down');
  switch (action) {
    case 'settings':
      if (!state.dialogs.some((d) => d.type === 'settings')) openDialog({ type: 'settings' });
      return;
    case 'new-session':
      return openDialog({ type: 'session' });
    case 'quick-connect':
      return openDialog({ type: 'quick-connect' });
    case 'new-local':
      return openLocal();
    case 'duplicate-tab':
      return tab && duplicateTab(tab.id);
    case 'open-sftp':
      if (tab?.kind === 'terminal' && tab.mode === 'ssh' && tab.status === 'connected') return openSftp({ fromTabId: tab.id });
      return toast('info', 'Select a connected SSH tab first');
    case 'reconnect':
      return tab && tab.kind !== 'home' && reconnectTab(tab.id);
    case 'import-ssh-config':
      return importFromSshConfig();
    case 'import-mobaxterm':
      return importFromMobaXterm();
    case 'close-tab':
      // ⌘W closes the focused pane of a split tab, else the tab
      return tab && closePane(tab.id);
    case 'close-tab-group':
      return tab && closeTab(rootOf(tab.id));
    case 'split-right':
    case 'split-down':
      if (tab?.kind !== 'terminal') return toast('info', 'Open a terminal tab first');
      return splitPane(tab.id, action === 'split-right' ? 'row' : 'col');
    case 'unsplit':
      return tab?.kind === 'terminal' && unsplitTab(tab.id);
    case 'zoom-pane':
      return tab?.kind === 'terminal' && toggleZoomPane(tab.id);
    case 'equalize-panes':
      return tab?.kind === 'terminal' && equalizePanes(tab.id);
    case 'toggle-button-bar':
      return updateSettings({ buttonBarVisible: !state.settings.buttonBarVisible });
    case 'toggle-compose':
      if (tab?.kind !== 'terminal') return toast('info', 'Open a terminal tab first');
      return setCompose({ open: !state.compose.open });
    case 'toggle-log':
      if (tab?.kind !== 'terminal') return toast('info', 'Open a terminal tab first');
      if (tab.logFile) return stopLog(tab.id, true);
      if (tab.status !== 'connected') return toast('info', 'The terminal is not connected');
      return startLog(tab, sessionById(tab.sessionId), true);
    case 'save-workspace':
      return openDialog({ type: 'workspace', fromTabs: true });
    case 'workspaces':
      return openDialog({ type: 'settings', section: 'workspaces' });
    case 'export-backup':
      return openDialog({ type: 'backup', mode: 'export' });
    case 'import-backup':
      return openDialog({ type: 'backup', mode: 'import' });
    case 'export-ssh-config':
      return exportSshConfig();
    case 'find':
      return term?.find();
    case 'clear':
      return term?.clear();
    case 'toggle-sidebar':
      return updateSettings({ sidebarVisible: !state.settings.sidebarVisible });
    case 'panel-sessions':
      return showPanel('sessions');
    case 'panel-files':
      return showPanel('files');
    case 'panel-snippets':
      return showPanel('snippets');
    case 'font-bigger':
      return term?.zoom(1);
    case 'font-smaller':
      return term?.zoom(-1);
    case 'font-reset':
      return term?.zoom('reset');
    case 'toggle-highlight':
      return term?.toggleHighlight();
    case 'toggle-history':
      return updateSettings({ historyPanel: !state.settings.historyPanel });
    case 'toggle-monitoring':
      return updateSettings({ monitoring: !state.settings.monitoring });
    case 'toggle-broadcast': {
      const on = !state.broadcast;
      useApp.setState({ broadcast: on });
      return toast('info', on ? 'Broadcast on — typing goes to every connected terminal' : 'Broadcast off');
    }
    case 'next-tab':
      return cycleTab(1);
    case 'prev-tab':
      return cycleTab(-1);
  }
}

function useMainEvents() {
  useEffect(() => {
    const offs = [
      api.on('menu', runMenuAction),
      api.on('toast', (t: { kind: 'info' | 'success' | 'error'; text: string }) => toast(t.kind, t.text)),
      api.on('monitor:update', (connId: string, stats: ServerStats) => setStats(connId, stats)),
      // another Mac changed sessions, snippets or buttons (sync)
      api.on('store:external', (data: any) => applyStoreData(data)),
      api.on('sync:status', (status: SyncStatus) => useApp.setState({ sync: status })),
      api.on('ui:ask', (askId: string, kind: 'prompt' | 'hostkey', payload: any) => {
        openDialog({ type: 'ask', askId, kind, payload } as any);
      }),
      api.on('transfer:update', (job: TransferJob) => {
        const prev = useApp.getState().transfers[job.id];
        upsertTransfer(job);
        const justFinished = prev && prev.status !== job.status;
        if (justFinished && job.status === 'done' && job.direction === 'download') {
          const target = `${job.targetDir.replace(/\/$/, '')}/${job.sources[0].split('/').pop()}`;
          toast('success', `Downloaded ${job.label}`, { label: 'Show in Finder', run: () => api.fs.reveal(target) });
        }
        if (justFinished && job.status === 'error') toast('error', `${job.direction === 'upload' ? 'Upload' : 'Download'} of ${job.label} failed: ${job.error}`);
      }),
      api.on('app:confirm-close', async () => {
        const n = useApp.getState().tabs.filter((t) => (t.kind === 'terminal' || t.kind === 'sftp') && t.status === 'connected').length;
        const choice = await confirmDialog({
          title: 'Quit Conduit?',
          message: `${n || 'Some'} session${n === 1 ? ' is' : 's are'} still connected and will be closed.`,
          confirmLabel: 'Quit',
          danger: true,
        });
        if (choice === 'confirm') api.app.closeConfirmed();
        else api.app.closeCancelled();
      }),
    ];
    // sync starts once the window listens for changes from other Macs
    configureSync();
    return () => offs.forEach((off) => off());
  }, []);
}

/**
 * The sidebar follows the tabs: SSH and SFTP tabs show Files, everything else
 * Sessions. A panel picked by hand is remembered for that tab.
 */
function useSidebarFollowsTabs() {
  const activeTabId = useApp((s) => s.activeTabId);
  const kind = useApp((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    if (!t) return 'none';
    if (t.kind === 'sftp' || (t.kind === 'terminal' && t.mode === 'ssh')) return t.status === 'closed' || t.status === 'error' ? 'other' : 'files';
    return 'other';
  });
  useEffect(() => {
    const { settings, tabPanels } = useApp.getState();
    if (!settings.autoShowFiles) return;
    const manual = tabPanels[activeTabId];
    useApp.setState({ sidebarPanel: manual || (kind === 'files' ? 'files' : 'sessions') });
  }, [activeTabId, kind]);
}

function Dialogs() {
  const dialogs = useApp((s) => s.dialogs);
  return (
    <>
      {dialogs.map((d) => {
        switch (d.type) {
          case 'session':
            return <SessionEditor key={d.id} d={d} />;
          case 'settings':
            return <SettingsDialog key={d.id} d={d} />;
          case 'confirm':
            return <ConfirmDialog key={d.id} d={d} />;
          case 'input':
            return <InputDialog key={d.id} d={d} />;
          case 'permissions':
            return <PermissionsDialog key={d.id} d={d} />;
          case 'quick-connect':
            return <QuickConnectDialog key={d.id} d={d} />;
          case 'snippet':
            return <SnippetDialog key={d.id} d={d} />;
          case 'folder':
            return <FolderDialog key={d.id} d={d} />;
          case 'credential':
            return <CredentialDialog key={d.id} d={d} />;
          case 'button':
            return <ButtonDialog key={d.id} d={d} />;
          case 'workspace':
            return <WorkspaceDialog key={d.id} d={d} />;
          case 'backup':
            return <BackupDialog key={d.id} d={d} />;
          case 'ask':
            return d.kind === 'hostkey' ? <HostKeyDialog key={d.id} d={d} payload={d.payload} /> : <AskPromptDialog key={d.id} d={d} payload={d.payload} />;
        }
      })}
    </>
  );
}

function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === 'success' ? <CircleCheck size={16} /> : t.kind === 'error' ? <CircleAlert size={16} /> : <Info size={16} />}
          <span className="toast-text">{t.text}</span>
          {t.action && (
            <button
              className="link-btn"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn xs" onClick={() => dismissToast(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const tabs = useApp((s) => s.tabs);
  const activeRoot = useApp((s) => rootOf(s.activeTabId, s.tabs));
  const theme = useApp((s) => s.settings.theme);
  const sidebarVisible = useApp((s) => s.settings.sidebarVisible);
  const sidebarWidth = useApp((s) => s.settings.sidebarWidth);
  const translucent = useApp((s) => s.settings.translucentSidebar);

  useMainEvents();
  useSidebarFollowsTabs();

  useEffect(() => applyUiTheme(getTheme(theme)), [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  return (
    <div className={`app${sidebarVisible ? '' : ' sidebar-hidden'}${translucent ? ' translucent' : ''}`}>
      {sidebarVisible && <Sidebar />}
      <main className="main">
        <TabBar />
        <div className="views">
          {rootTabs(tabs).map((t) => {
            const active = t.id === activeRoot;
            if (t.kind === 'terminal') return <TerminalGroup key={t.viewKey || t.id} root={t} active={active} />;
            if (t.kind === 'sftp') return <SftpView key={t.id} tab={t} active={active} />;
            return <HomeView key={t.id} active={active} />;
          })}
        </div>
      </main>
      <Dialogs />
      <Toasts />
    </div>
  );
}
