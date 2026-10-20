import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Eye,
  EyeOff,
  FilePlus,
  FolderPlus,
  FolderSync,
  House,
  Maximize2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  cdInTerminal,
  chooseAndUpload,
  copyText,
  remoteDelete,
  remoteDownload,
  remoteEdit,
  remoteNewFile,
  remoteNewFolder,
  remotePermissions,
  remoteRename,
  remoteUpload,
} from '../lib/fileops';
import { joinLocal, joinRemote, parentRemote } from '../lib/format';
import type { FileEntry, Listing } from '../lib/types';
import { setFilesState, toast, updateSettings, useApp } from '../store/app';
import { FileList, isDirLike, type DragPayload } from './FileList';

interface Props {
  stateKey: string;
  connId: string;
  compact?: boolean;
  /** working directory reported by the terminal (for "follow") */
  cwd?: string;
  canFollow?: boolean;
  terminalTabId?: string;
  /** dual-pane view: where downloads go */
  localDir?: string;
  onOpenBig?: () => void;
  title?: React.ReactNode;
  /** the first listing failed (e.g. sudo refused) */
  onFatalError?: (message: string) => void;
  /** "Browse as root" — offered when a folder cannot be opened and in the menu */
  rootAction?: { label: string; run: () => void };
}

export function RemotePane({ stateKey, connId, compact, cwd, canFollow, terminalTabId, localDir, onOpenBig, title, onFatalError, rootAction }: Props) {
  const showHidden = useApp((s) => s.settings.showHidden);
  const doubleClick = useApp((s) => s.settings.doubleClick);
  const saved = useApp((s) => s.files[stateKey]);
  const follow = canFollow ? (saved?.follow ?? useApp.getState().settings.followFolder) : false;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pathInput, setPathInput] = useState('');
  const [blocked, setBlocked] = useState<{ path: string; message: string } | null>(null);
  const reqId = useRef(0);
  const requested = useRef('');
  const listingRef = useRef(listing);
  listingRef.current = listing;

  const load = useCallback(
    async (path: string, keepSelection = false) => {
      const id = ++reqId.current;
      requested.current = path;
      setLoading(true);
      try {
        const res = await api.sftp.list(connId, path);
        if (id !== reqId.current) return;
        setListing(res);
        setPathInput(res.path);
        setError(null);
        setBlocked(null);
        if (!keepSelection) setSelected(new Set());
        setFilesState(stateKey, { path: res.path });
      } catch (err: any) {
        if (id !== reqId.current) return;
        if (listingRef.current) {
          if (/permission denied/i.test(err.message)) setBlocked({ path, message: err.message });
          else toast('error', `${path}: ${err.message}`);
        } else {
          setError(err.message);
          onFatalError?.(err.message);
        }
        setPathInput(listingRef.current?.path || path);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [connId, stateKey]
  );

  const refresh = () => listing && load(listing.path, true);

  // initial folder: remembered path, the terminal's folder, or home
  useEffect(() => {
    setListing(null);
    setError(null);
    const start = (follow && cwd) || useApp.getState().files[stateKey]?.path || '~';
    load(start);
  }, [connId]);

  // follow the terminal's working directory
  useEffect(() => {
    if (follow && cwd && cwd !== requested.current && cwd !== listingRef.current?.path) load(cwd);
  }, [cwd, follow]);

  // refresh when a transfer or an edit changed this folder
  useEffect(
    () =>
      api.on('fs:changed', (ev: { side: string; connId: string; dir: string }) => {
        const cur = listingRef.current;
        if (ev.side === 'remote' && ev.connId === connId && cur && ev.dir.replace(/\/+$/, '') === cur.path.replace(/\/+$/, '')) {
          load(cur.path, true);
        }
      }),
    [connId, load]
  );

  const entries = useMemo(
    () => (listing ? listing.entries.filter((e) => showHidden || !e.name.startsWith('.')) : []),
    [listing, showHidden]
  );
  const existing = useMemo(() => new Set(listing?.entries.map((e) => e.name)), [listing]);
  const dir = listing?.path || '';
  const selEntries = () => entries.filter((e) => selected.has(e.name));

  const open = (entry: FileEntry) => {
    if (isDirLike(entry)) return load(joinRemote(dir, entry.name));
    if (doubleClick === 'download' && !localDir) return remoteDownload(connId, dir, [entry.name]);
    if (localDir) return remoteDownload(connId, dir, [entry.name], localDir);
    remoteEdit(connId, dir, entry);
  };

  const after = (p: Promise<boolean>) =>
    p.then((changed) => {
      if (changed) refresh();
    });

  const contextMenu = async (entry: FileEntry | null) => {
    const sel = entry ? selEntries() : [];
    const names = sel.map((e) => e.name);
    const one = sel.length === 1 ? sel[0] : null;
    const items = entry
      ? [
          ...(one && isDirLike(one)
            ? [{ id: 'open', label: 'Open' }]
            : one
              ? [
                  { id: 'edit', label: 'Open / Edit' },
                  {
                    id: 'open-with',
                    label: 'Open With',
                    submenu: [
                      { id: 'with:TextEdit', label: 'TextEdit' },
                      { id: 'with:Visual Studio Code', label: 'Visual Studio Code' },
                      { id: 'with:Sublime Text', label: 'Sublime Text' },
                      { id: 'with:BBEdit', label: 'BBEdit' },
                    ],
                  },
                ]
              : []),
          { id: 'download', label: localDir ? 'Download to Local Folder' : 'Download' },
          { id: 'download-to', label: 'Download To…' },
          { type: 'separator' as const },
          { id: 'rename', label: 'Rename…', enabled: !!one, accelerator: 'F2' },
          { id: 'perms', label: 'Permissions…' },
          { id: 'delete', label: 'Delete', accelerator: 'Cmd+Backspace' },
          { type: 'separator' as const },
          { id: 'copy-path', label: 'Copy Path' },
          ...(one && isDirLike(one) && terminalTabId ? [{ id: 'cd', label: 'Go Here in Terminal' }] : []),
        ]
      : [
          { id: 'new-folder', label: 'New Folder…' },
          { id: 'new-file', label: 'New File…' },
          { id: 'upload', label: 'Upload Files…' },
          { type: 'separator' as const },
          { id: 'refresh', label: 'Refresh' },
          { id: 'hidden', label: 'Show Hidden Files', checked: showHidden },
          { id: 'copy-path', label: 'Copy Folder Path' },
          ...(terminalTabId ? [{ id: 'cd', label: 'Go Here in Terminal' }] : []),
          ...(rootAction ? [{ type: 'separator' as const }, { id: 'as-root', label: `${rootAction.label}…` }] : []),
        ];
    const choice = await api.popupMenu(items);
    if (!choice) return;
    if (choice.startsWith('with:') && one) return remoteEdit(connId, dir, one, choice.slice(5));
    switch (choice) {
      case 'open':
        return one && open(one);
      case 'edit':
        return one && remoteEdit(connId, dir, one);
      case 'download':
        return remoteDownload(connId, dir, names, localDir);
      case 'download-to': {
        const res = await api.openDialog({ title: 'Download to…', directory: true, buttonLabel: 'Download here' });
        if (res?.[0]) remoteDownload(connId, dir, names, res[0]);
        return;
      }
      case 'rename':
        return one && after(remoteRename(connId, dir, one));
      case 'perms':
        return after(remotePermissions(connId, dir, sel));
      case 'delete':
        return after(remoteDelete(connId, dir, names));
      case 'copy-path':
        return copyText(one ? joinRemote(dir, one.name) : names.length ? names.map((n) => joinRemote(dir, n)).join('\n') : dir, 'Path copied');
      case 'cd':
        return cdInTerminal(terminalTabId, one ? joinRemote(dir, one.name) : dir);
      case 'new-folder':
        return after(remoteNewFolder(connId, dir));
      case 'new-file':
        return after(remoteNewFile(connId, dir));
      case 'upload':
        return chooseAndUpload(connId, dir, existing);
      case 'refresh':
        return refresh();
      case 'hidden':
        return updateSettings({ showHidden: !showHidden });
      case 'as-root':
        return rootAction?.run();
    }
  };

  const onKeyAction = (action: 'delete' | 'parent' | 'rename' | 'refresh') => {
    if (action === 'parent') return load(parentRemote(dir));
    if (action === 'delete') return after(remoteDelete(connId, dir, [...selected]));
    if (action === 'rename') {
      const one = selEntries()[0];
      if (one) after(remoteRename(connId, dir, one));
    }
  };

  const dropTarget = (target?: FileEntry) => (target ? joinRemote(dir, target.name) : dir);

  return (
    <div className={`pane remote-pane${compact ? ' compact' : ''}`}>
      {title && <div className="pane-title">{title}</div>}
      <div className="pane-toolbar">
        <button className="icon-btn sm" title="Parent folder (⌘↑)" onClick={() => load(parentRemote(dir))} disabled={!dir || dir === '/'}>
          <ArrowUp size={15} />
        </button>
        <button className="icon-btn sm" title="Home folder" onClick={() => load('~')}>
          <House size={15} />
        </button>
        <button className="icon-btn sm" title="Refresh" onClick={refresh}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
        <span className="toolbar-sep" />
        <button className="icon-btn sm" title="New folder" onClick={() => after(remoteNewFolder(connId, dir))}>
          <FolderPlus size={15} />
        </button>
        {!compact && (
          <button className="icon-btn sm" title="New file" onClick={() => after(remoteNewFile(connId, dir))}>
            <FilePlus size={15} />
          </button>
        )}
        <button className="icon-btn sm" title="Upload files" onClick={() => chooseAndUpload(connId, dir, existing)}>
          <Upload size={15} />
        </button>
        <span className="toolbar-flex" />
        {canFollow && (
          <button
            className={`icon-btn sm${follow ? ' on' : ''}`}
            title={follow ? 'Follows the terminal folder — click to stop' : 'Not following the terminal — click to follow it'}
            onClick={() => {
              setFilesState(stateKey, { follow: !follow });
              if (!follow && cwd) load(cwd);
            }}
          >
            <FolderSync size={15} />
          </button>
        )}
        <button
          className={`icon-btn sm${showHidden ? ' on' : ''}`}
          title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
          onClick={() => updateSettings({ showHidden: !showHidden })}
        >
          {showHidden ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        {onOpenBig && (
          <button className="icon-btn sm" title="Open in SFTP browser (⇧⌘O)" onClick={onOpenBig}>
            <Maximize2 size={14} />
          </button>
        )}
      </div>
      <form
        className="pane-path"
        onSubmit={(e) => {
          e.preventDefault();
          if (pathInput.trim()) load(pathInput.trim());
        }}
      >
        <input
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          spellCheck={false}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Escape' && (setPathInput(dir), (e.target as HTMLInputElement).blur())}
        />
      </form>
      {blocked && (
        <div className="pane-bar warn">
          <span>
            No permission for <b>{blocked.path}</b>
          </span>
          {rootAction && (
            <button className="link-btn" onClick={rootAction.run}>
              {rootAction.label}
            </button>
          )}
          <button className="link-btn muted-link" onClick={() => setBlocked(null)}>
            Dismiss
          </button>
        </div>
      )}
      {canFollow && !follow && cwd && dir && cwd !== dir && (
        <div className="pane-bar">
          <span>
            Terminal is in <b>{cwd}</b>
          </span>
          <button className="link-btn" onClick={() => load(cwd)}>
            Go there
          </button>
          <button
            className="link-btn"
            onClick={() => {
              setFilesState(stateKey, { follow: true });
              load(cwd);
            }}
          >
            Follow
          </button>
        </div>
      )}
      <FileList
        entries={entries}
        selected={selected}
        onSelect={setSelected}
        onOpen={open}
        onContextMenu={(entry) => contextMenu(entry)}
        onKeyAction={onKeyAction}
        compact={compact}
        showOwner={!compact}
        loading={loading && !listing}
        error={error}
        pathForFile={api.pathForFile}
        dragPayload={(names): DragPayload => ({ side: 'remote', connId, dir, names })}
        acceptInternal={(p) => p.side === 'local'}
        onDropPaths={(paths, target) => remoteUpload(connId, dropTarget(target), paths, target ? undefined : existing)}
        onDropInternal={(p, target) =>
          remoteUpload(connId, dropTarget(target), p.names.map((n) => joinLocal(p.dir, n)), target ? undefined : existing)
        }
      />
    </div>
  );
}
