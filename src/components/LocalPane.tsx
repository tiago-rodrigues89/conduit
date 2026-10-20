import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Eye, EyeOff, FolderPlus, House, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { copyText, localNewFolder, localRename, localTrash, remoteDownload, remoteUpload } from '../lib/fileops';
import { joinLocal } from '../lib/format';
import type { FileEntry, Listing } from '../lib/types';
import { setFilesState, toast, updateSettings, useApp } from '../store/app';
import { FileList, isDirLike, type DragPayload } from './FileList';

interface Props {
  stateKey: string;
  /** upload target */
  remote?: { connId: string; dir: string };
  onPathChange?: (path: string) => void;
  title?: React.ReactNode;
}

function parentLocal(p: string) {
  if (p === '/') return '/';
  const idx = p.replace(/\/+$/, '').lastIndexOf('/');
  return idx <= 0 ? '/' : p.slice(0, idx);
}

export function LocalPane({ stateKey, remote, onPathChange, title }: Props) {
  const showHidden = useApp((s) => s.settings.showHidden);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pathInput, setPathInput] = useState('');
  const listingRef = useRef(listing);
  listingRef.current = listing;

  const load = useCallback(
    async (path: string, keep = false) => {
      setLoading(true);
      try {
        const res = await api.fs.list(path);
        setListing(res);
        setPathInput(res.path);
        setError(null);
        if (!keep) setSelected(new Set());
        setFilesState(stateKey, { path: res.path });
        onPathChange?.(res.path);
      } catch (err: any) {
        if (listingRef.current) toast('error', err.message);
        else setError(err.message);
        setPathInput(listingRef.current?.path || path);
      } finally {
        setLoading(false);
      }
    },
    [stateKey, onPathChange]
  );

  const refresh = () => listing && load(listing.path, true);

  useEffect(() => {
    load(useApp.getState().files[stateKey]?.path || useApp.getState().settings.downloadDir || '~');
  }, []);

  useEffect(
    () =>
      api.on('fs:changed', (ev: { side: string; dir: string }) => {
        const cur = listingRef.current;
        if (ev.side === 'local' && cur && ev.dir.replace(/\/+$/, '') === cur.path.replace(/\/+$/, '')) load(cur.path, true);
      }),
    [load]
  );

  const entries = useMemo(
    () => (listing ? listing.entries.filter((e) => showHidden || !e.name.startsWith('.')) : []),
    [listing, showHidden]
  );
  const dir = listing?.path || '';
  const selEntries = () => entries.filter((e) => selected.has(e.name));
  const after = (p: Promise<boolean>) =>
    p.then((changed) => {
      if (changed) refresh();
    });

  const open = (entry: FileEntry) => {
    if (isDirLike(entry)) load(joinLocal(dir, entry.name));
    else api.fs.open(joinLocal(dir, entry.name)).catch((err) => toast('error', err.message));
  };

  const upload = (names: string[]) => {
    if (!remote) return;
    remoteUpload(remote.connId, remote.dir, names.map((n) => joinLocal(dir, n)));
  };

  const contextMenu = async (entry: FileEntry | null) => {
    const sel = entry ? selEntries() : [];
    const one = sel.length === 1 ? sel[0] : null;
    const items = entry
      ? [
          { id: 'open', label: 'Open' },
          ...(remote ? [{ id: 'upload', label: 'Upload to Server' }] : []),
          { type: 'separator' as const },
          { id: 'rename', label: 'Rename…', enabled: !!one },
          { id: 'trash', label: 'Move to Trash' },
          { type: 'separator' as const },
          { id: 'reveal', label: 'Show in Finder' },
          { id: 'copy-path', label: 'Copy Path' },
        ]
      : [
          { id: 'new-folder', label: 'New Folder…' },
          { id: 'refresh', label: 'Refresh' },
          { id: 'hidden', label: 'Show Hidden Files', checked: showHidden },
          { id: 'reveal-dir', label: 'Open in Finder' },
        ];
    const choice = await api.popupMenu(items);
    switch (choice) {
      case 'open':
        return sel.forEach(open);
      case 'upload':
        return upload(sel.map((e) => e.name));
      case 'rename':
        return one && after(localRename(dir, one));
      case 'trash':
        return after(localTrash(dir, sel.map((e) => e.name)));
      case 'reveal':
        return api.fs.reveal(joinLocal(dir, sel[0].name));
      case 'copy-path':
        return copyText(sel.map((e) => joinLocal(dir, e.name)).join('\n'), 'Path copied');
      case 'new-folder':
        return after(localNewFolder(dir));
      case 'refresh':
        return refresh();
      case 'hidden':
        return updateSettings({ showHidden: !showHidden });
      case 'reveal-dir':
        return api.fs.open(dir);
    }
  };

  const targetDir = (target?: FileEntry) => (target ? joinLocal(dir, target.name) : dir);

  return (
    <div className="pane local-pane">
      {title && <div className="pane-title">{title}</div>}
      <div className="pane-toolbar">
        <button className="icon-btn sm" title="Parent folder (⌘↑)" onClick={() => load(parentLocal(dir))} disabled={dir === '/'}>
          <ArrowUp size={15} />
        </button>
        <button className="icon-btn sm" title="Home folder" onClick={() => load('~')}>
          <House size={15} />
        </button>
        <button className="icon-btn sm" title="Refresh" onClick={refresh}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
        <span className="toolbar-sep" />
        <button className="icon-btn sm" title="New folder" onClick={() => after(localNewFolder(dir))}>
          <FolderPlus size={15} />
        </button>
        <span className="toolbar-flex" />
        <button
          className={`icon-btn sm${showHidden ? ' on' : ''}`}
          title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
          onClick={() => updateSettings({ showHidden: !showHidden })}
        >
          {showHidden ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
      <form
        className="pane-path"
        onSubmit={(e) => {
          e.preventDefault();
          if (pathInput.trim()) load(pathInput.trim());
        }}
      >
        <input value={pathInput} onChange={(e) => setPathInput(e.target.value)} spellCheck={false} onFocus={(e) => e.target.select()} />
      </form>
      <FileList
        entries={entries}
        selected={selected}
        onSelect={setSelected}
        onOpen={open}
        onContextMenu={(entry) => contextMenu(entry)}
        onKeyAction={(a) => {
          if (a === 'parent') load(parentLocal(dir));
          if (a === 'delete') after(localTrash(dir, [...selected]));
          if (a === 'rename' && selEntries()[0]) after(localRename(dir, selEntries()[0]));
        }}
        loading={loading && !listing}
        error={error}
        pathForFile={api.pathForFile}
        dragPayload={(names): DragPayload => ({ side: 'local', dir, names })}
        acceptInternal={(p) => p.side === 'remote'}
        onDropInternal={(p, target) => {
          if (p.connId) remoteDownload(p.connId, p.dir, p.names, targetDir(target));
        }}
      />
    </div>
  );
}

