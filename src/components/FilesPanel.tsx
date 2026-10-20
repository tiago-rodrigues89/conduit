import { FolderTree, Laptop, LoaderCircle, ShieldCheck, Unplug } from 'lucide-react';
import { openSftp, setFilesState, useApp } from '../store/app';
import { RemotePane } from './RemotePane';
import { TransferList } from './TransferList';

/** Sidebar file browser that follows the active SSH tab (MobaXterm style). */
export function FilesPanel() {
  const tab = useApp((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const files = useApp((s) => s.files);

  if (!tab || tab.kind === 'home') {
    return (
      <div className="panel-empty">
        <FolderTree size={28} strokeWidth={1.4} />
        <p>Connect to a server to browse its files here.</p>
      </div>
    );
  }
  if (tab.kind === 'terminal' && tab.mode !== 'ssh') {
    return (
      <div className="panel-empty">
        <Laptop size={28} strokeWidth={1.4} />
        <p>
          {tab.mode === 'local'
            ? 'This tab runs on your Mac. Open an SSH or SFTP session to browse remote files.'
            : 'Files are available for SSH and SFTP sessions.'}
        </p>
      </div>
    );
  }
  if (tab.status === 'connecting') {
    return (
      <div className="panel-empty">
        <LoaderCircle size={22} className="spin" />
        <p>Connecting…</p>
      </div>
    );
  }
  if (tab.status !== 'connected' || !tab.connId) {
    return (
      <div className="panel-empty">
        <Unplug size={28} strokeWidth={1.4} />
        <p>Not connected.</p>
      </div>
    );
  }

  const isTerminal = tab.kind === 'terminal';
  // The panel browses as the login user, or as root via sudo when the user
  // chose "Browse as root" (asks for the sudo password unless NOPASSWD)
  const state = files[tab.id];
  let asUser = state?.asUser || '';
  const failed = state?.sudoError && state.sudoError.user === asUser ? state.sudoError : null;
  if (failed) asUser = '';
  const key = asUser ? `${tab.connId}|as:${asUser}` : tab.connId;
  const loginUser = (isTerminal && tab.loginUser) || tab.spec?.username || 'your user';

  return (
    <div className="files-panel">
      {asUser && (
        <div className="pane-bar root">
          <ShieldCheck size={13} />
          <span>
            Files as <b>{asUser}</b> (sudo)
          </span>
          <button className="link-btn" onClick={() => setFilesState(tab.id, { asUser: '' })}>
            Show as {loginUser}
          </button>
        </div>
      )}
      {failed && (
        <div className="pane-bar warn">
          <span>
            Files stay as {loginUser}: {failed.message}
          </span>
          <button className="link-btn" onClick={() => setFilesState(tab.id, { sudoError: undefined, asUser: failed.user })}>
            Try again
          </button>
        </div>
      )}
      <RemotePane
        key={`${tab.id}:${key}`}
        stateKey={tab.kind === 'sftp' ? `${tab.id}:remote` : tab.id}
        connId={key}
        compact
        cwd={isTerminal ? tab.cwd : undefined}
        canFollow={isTerminal}
        terminalTabId={isTerminal ? tab.id : undefined}
        onOpenBig={isTerminal ? () => openSftp({ fromTabId: tab.id }) : undefined}
        onFatalError={(message) => {
          if (asUser) setFilesState(tab.id, { sudoError: { user: asUser, message } });
        }}
        rootAction={asUser === 'root' ? undefined : { label: 'Browse as root (sudo)', run: () => setFilesState(tab.id, { asUser: 'root', sudoError: undefined }) }}
      />
      <TransferList connId={tab.connId} compact />
    </div>
  );
}
