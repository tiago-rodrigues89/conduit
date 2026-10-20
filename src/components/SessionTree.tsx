import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, FolderOpen, Plus, Search, UsersRound, X } from 'lucide-react';
import { api, type MenuItem } from '../lib/api';
import { parseQuickConnect, uid } from '../lib/defaults';
import { copyText } from '../lib/fileops';
import { dnd } from '../lib/dnd';
import { iconFor } from '../lib/icons';
import { importFromMobaXterm, importFromSshConfig } from '../lib/importflow';
import { sessionTarget, typeInfo } from '../lib/sessionTypes';
import type { FolderItem, SessionItem, TreeItem } from '../lib/types';
import {
  childrenOf,
  confirm,
  descendants,
  duplicateSession,
  folderPath,
  moveItem,
  openDialog,
  openSession,
  openSftp,
  removeItems,
  saveWorkspace,
  toast,
  setAllFolders,
  patchItem,
  useApp,
} from '../store/app';
import { quickConnect } from './HomeView';

const TREE_MIME = 'application/x-conduit-tree';
const ROOT = '__root';

type DropPos = { id: string; pos: 'before' | 'after' | 'into' } | null;

export function newSessionDialog(parentId: string | null = null) {
  openDialog({ type: 'session', parentId });
}

export function newFolderDialog(parentId: string | null = null) {
  openDialog({ type: 'folder', parentId });
}

const importMenu: MenuItem[] = [
  { id: 'ssh-config', label: 'From ~/.ssh/config' },
  { id: 'moba', label: 'From MobaXterm Sessions…' },
];

function runImport(choice: string | null) {
  if (choice === 'ssh-config') importFromSshConfig();
  if (choice === 'moba') importFromMobaXterm();
}

export async function addMenu(parentId: string | null = null) {
  const choice = await api.popupMenu([
    { id: 'session', label: 'New Session…', accelerator: 'Cmd+N' },
    { id: 'folder', label: 'New Folder…' },
    { type: 'separator' },
    { id: 'import', label: 'Import', submenu: importMenu },
  ]);
  if (choice === 'session') newSessionDialog(parentId);
  else if (choice === 'folder') newFolderDialog(parentId);
  else runImport(choice);
}

/** "Move to" submenu: every folder the item may move into, plus the top level. */
function moveTargets(item: TreeItem, items: TreeItem[]): MenuItem[] {
  const blocked = new Set(item.kind === 'folder' ? [item.id, ...descendants(item.id, items)] : []);
  const folders = items
    .filter((i): i is FolderItem => i.kind === 'folder' && !blocked.has(i.id))
    .map((f) => ({ id: `move:${f.id}`, label: folderPath(f.id), enabled: f.id !== item.parentId }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ id: `move:${ROOT}`, label: 'User sessions (top level)', enabled: item.parentId !== null }, ...(folders.length ? [{ type: 'separator' as const }] : []), ...folders];
}

function handleMove(choice: string | null, item: TreeItem) {
  if (!choice?.startsWith('move:')) return false;
  const target = choice.slice(5);
  moveItem(item.id, target === ROOT ? null : target, 'into');
  return true;
}

export function SessionIcon({ s, size = 15 }: { s: SessionItem; size?: number }) {
  const info = typeInfo(s.type);
  const Icon = iconFor(s.icon, info.icon);
  return <Icon size={size} />;
}

export function SessionTree() {
  const items = useApp((s) => s.items);
  const tabs = useApp((s) => s.tabs);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropPos>(null);
  const [rootOpen, setRootOpen] = useState(true);
  const dragId = useRef<string | null>(null);

  const liveSessions = useMemo(() => {
    const m = new Map<string, 'connected' | 'connecting'>();
    for (const t of tabs) {
      if ((t.kind === 'terminal' || t.kind === 'sftp') && t.sessionId && (t.status === 'connected' || t.status === 'connecting')) {
        if (m.get(t.sessionId) !== 'connected') m.set(t.sessionId, t.status);
      }
    }
    return m;
  }, [tabs]);

  const sessionCount = items.filter((i) => i.kind === 'session').length;
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    return items
      .filter((i): i is SessionItem => i.kind === 'session')
      .filter((s) => [s.name, s.host, s.username, s.notes, typeInfo(s.type).label].some((v) => v && v.toLowerCase().includes(q)))
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }, [items, q]);
  const quickTarget = q && /[@.:]|^[\w-]+$/.test(query.trim()) && !/\s/.test(query.trim()) ? parseQuickConnect(query) : null;

  const sessionMenu = async (s: SessionItem) => {
    setSelected(s.id);
    const info = typeInfo(s.type);
    const isSsh = s.type === 'ssh';
    const st = useApp.getState();
    const canSplit = info.opens === 'terminal' && st.tabs.some((t) => t.id === st.activeTabId && t.kind === 'terminal');
    const choice = await api.popupMenu([
      { id: 'connect', label: info.opens === 'external' ? `Open in ${s.type === 'rdp' ? 'Windows App' : 'Screen Sharing'}` : info.opens === 'sftp' ? 'Open SFTP Browser' : 'Connect' },
      ...(info.opens === 'terminal'
        ? [
            {
              id: 'split',
              label: 'Open in Split Pane',
              enabled: canSplit,
              submenu: [
                { id: 'split-right', label: 'Right of the Current Terminal' },
                { id: 'split-down', label: 'Below the Current Terminal' },
              ],
            },
          ]
        : []),
      ...(isSsh ? [{ id: 'sftp', label: 'Open SFTP Browser' }] : []),
      { type: 'separator' },
      { id: 'edit', label: 'Edit…' },
      { id: 'duplicate', label: 'Duplicate' },
      { id: 'pin', label: s.pinned ? 'Unpin from Home' : 'Pin to Home' },
      { id: 'move', label: 'Move To', submenu: moveTargets(s, items) },
      { type: 'separator' },
      ...(isSsh ? [{ id: 'copy-ssh', label: 'Copy ssh Command' }] : []),
      ...(info.network ? [{ id: 'copy-host', label: 'Copy Host' }] : []),
      { type: 'separator' },
      { id: 'delete', label: 'Delete' },
    ]);
    if (handleMove(choice, s)) return;
    switch (choice) {
      case 'connect':
        return openSession(s.id);
      case 'split-right':
      case 'split-down':
        return openSession(s.id, { split: choice === 'split-right' ? 'row' : 'col' });
      case 'sftp':
        return openSftp({ sessionId: s.id });
      case 'edit':
        return openDialog({ type: 'session', sessionId: s.id });
      case 'duplicate':
        return duplicateSession(s.id);
      case 'pin':
        return patchItem(s.id, { pinned: !s.pinned });
      case 'copy-ssh':
        return copyText(`ssh ${s.port !== 22 ? `-p ${s.port} ` : ''}${s.username ? s.username + '@' : ''}${s.host}`, 'Command copied');
      case 'copy-host':
        return copyText(s.host, 'Host copied');
      case 'delete':
        if (await confirm({ title: `Delete “${s.name}”?`, message: 'The session and its saved password are removed.', confirmLabel: 'Delete', danger: true }))
          removeItems([s.id]);
    }
  };

  const folderMenu = async (f: FolderItem) => {
    setSelected(f.id);
    const sessions = descendants(f.id)
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is SessionItem => !!i && i.kind === 'session' && typeInfo(i.type).opens === 'terminal');
    const choice = await api.popupMenu([
      { id: 'new-session', label: 'New Session Here…' },
      { id: 'new-folder', label: 'New Subfolder…' },
      { type: 'separator' },
      { id: 'open-all', label: `Connect All (${sessions.length})`, enabled: sessions.length > 0 && sessions.length <= 20 },
      { id: 'open-split', label: `Connect All in One Tab, Split (${sessions.length})`, enabled: sessions.length > 1 && sessions.length <= 9 },
      { id: 'workspace', label: 'Save as Workspace…', enabled: sessions.length > 0 },
      { type: 'separator' },
      { id: 'edit', label: 'Edit Folder…' },
      { id: 'move', label: 'Move To', submenu: moveTargets(f, items) },
      { id: 'delete', label: 'Delete' },
    ]);
    if (handleMove(choice, f)) return;
    switch (choice) {
      case 'new-session':
        return newSessionDialog(f.id);
      case 'new-folder':
        return newFolderDialog(f.id);
      case 'open-all':
        return sessions.forEach((s) => openSession(s.id));
      case 'open-split': {
        // a grid: two columns, each further pane below the one before in its column
        const ids: string[] = [];
        sessions.forEach((s, i) => {
          if (i === 0) ids.push(openSession(s.id) as string);
          else {
            const beside = i === 1 ? ids[0] : ids[i - 2];
            useApp.setState({ activeTabId: beside });
            ids.push(openSession(s.id, { split: i === 1 ? 'row' : 'col' }) as string);
          }
        });
        return;
      }
      case 'workspace': {
        const id = uid();
        saveWorkspace({ id, name: f.name, openOnLaunch: false, entries: sessions.map((s) => ({ id: uid(), sessionId: s.id, placement: 'tab' as const })) });
        toast('success', `Workspace “${f.name}” saved`);
        return openDialog({ type: 'workspace', workspaceId: id });
      }
      case 'edit':
        return openDialog({ type: 'folder', folderId: f.id });
      case 'delete': {
        const count = descendants(f.id).length;
        const ok = await confirm({
          title: `Delete folder “${f.name}”?`,
          message: count ? `The folder and the ${count} item${count > 1 ? 's' : ''} inside it are removed.` : 'The folder is empty.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (ok) removeItems([f.id]);
      }
    }
  };

  const rootMenu = async () => {
    setSelected(ROOT);
    const choice = await api.popupMenu([
      { id: 'session', label: 'New Session…', accelerator: 'Cmd+N' },
      { id: 'folder', label: 'New Folder…' },
      { type: 'separator' },
      { id: 'import', label: 'Import', submenu: importMenu },
      { type: 'separator' },
      { id: 'expand', label: 'Expand All Folders' },
      { id: 'collapse', label: 'Collapse All Folders' },
    ]);
    if (choice === 'session') newSessionDialog(null);
    else if (choice === 'folder') newFolderDialog(null);
    else if (choice === 'expand') setAllFolders(true);
    else if (choice === 'collapse') setAllFolders(false);
    else runImport(choice);
  };

  const onDragOver = (e: React.DragEvent, item: TreeItem) => {
    if (!e.dataTransfer.types.includes(TREE_MIME) || dragId.current === item.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    let pos: 'before' | 'after' | 'into';
    if (item.kind === 'folder') pos = y < 0.28 ? 'before' : y > 0.72 && !item.expanded ? 'after' : 'into';
    else pos = y < 0.5 ? 'before' : 'after';
    setDrop((d) => (d && d.id === item.id && d.pos === pos ? d : { id: item.id, pos }));
  };

  const doDrop = (e: React.DragEvent, targetId: string | null, pos: 'before' | 'after' | 'into') => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData(TREE_MIME);
    setDrop(null);
    if (id) moveItem(id, targetId, pos);
  };

  const renderItem = (item: TreeItem, depth: number): React.ReactNode => {
    const isFolder = item.kind === 'folder';
    const dropCls = drop && drop.id === item.id ? ` drop-${drop.pos}` : '';
    const row = (
      <div
        key={item.id}
        className={`tree-row${selected === item.id ? ' selected' : ''}${dropCls}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        draggable
        onDragStart={(e) => {
          dragId.current = item.id;
          e.dataTransfer.setData(TREE_MIME, item.id);
          e.dataTransfer.effectAllowed = 'move';
          // a session can also be dropped onto a terminal to open it as a split pane
          if (item.kind === 'session') dnd.start({ kind: 'session', id: item.id });
        }}
        onDragEnd={() => {
          dragId.current = null;
          setDrop(null);
          dnd.end();
        }}
        onDragOver={(e) => onDragOver(e, item)}
        onDrop={(e) => drop && doDrop(e, drop.id, drop.pos)}
        onClick={() => {
          setSelected(item.id);
          if (isFolder) patchItem(item.id, { expanded: !item.expanded });
        }}
        onDoubleClick={() => !isFolder && openSession(item.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isFolder) folderMenu(item);
          else sessionMenu(item);
        }}
        title={
          !isFolder
            ? `${typeInfo(item.type).label} · ${item.username && typeInfo(item.type).network ? item.username + '@' : ''}${sessionTarget(item)}${item.notes ? '\n\n' + item.notes : ''}`
            : undefined
        }
      >
        {isFolder ? <FolderRow f={item} count={childrenOf(item.id, items).length} /> : <SessionRow s={item} live={liveSessions.get(item.id)} />}
      </div>
    );
    if (isFolder && item.expanded) {
      return [row, ...childrenOf(item.id, items).map((k) => renderItem(k, depth + 1))];
    }
    return row;
  };

  const roots = childrenOf(null, items);

  return (
    <div className="session-tree">
      <div className="panel-search">
        <Search size={14} className="panel-search-icon" />
        <input
          value={query}
          placeholder="Search or quick connect…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
            if (e.key === 'Enter') {
              if (matches?.[0]) openSession(matches[0].id);
              else if (quickTarget && quickConnect(query)) setQuery('');
              if (matches?.[0]) setQuery('');
            }
          }}
          spellCheck={false}
        />
        {query && (
          <button className="icon-btn xs" onClick={() => setQuery('')}>
            <X size={13} />
          </button>
        )}
        <button className="icon-btn sm" title="New session or folder" onClick={() => addMenu(null)}>
          <Plus size={16} />
        </button>
      </div>
      <div
        className="tree-body"
        onContextMenu={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tree-empty')) {
            e.preventDefault();
            rootMenu();
          }
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(TREE_MIME)) return;
          e.preventDefault();
          setDrop({ id: ROOT, pos: 'into' });
        }}
        onDrop={(e) => doDrop(e, null, 'into')}
        onKeyDown={(e) => {
          const it = items.find((i) => i.id === selected);
          if (!it) return;
          if (e.key === 'Enter' && it.kind === 'session') openSession(it.id);
          if (e.key === 'Backspace' && e.metaKey) it.kind === 'session' ? sessionMenu(it) : folderMenu(it);
        }}
        tabIndex={0}
      >
        {matches ? (
          <>
            {quickTarget && (
              <div className="tree-row search-hit quick" onClick={() => quickConnect(query) && setQuery('')}>
                <span className="tree-session-icon accent">
                  <ArrowRight size={15} />
                </span>
                <span className="tree-hit-text">
                  <span className="tree-name">Connect to {query.trim()}</span>
                  <span className="tree-sub">Quick connect over SSH{matches.length ? '' : ' · press ↩'}</span>
                </span>
              </div>
            )}
            {matches.map((s) => (
              <div
                key={s.id}
                className={`tree-row search-hit${selected === s.id ? ' selected' : ''}`}
                onClick={() => setSelected(s.id)}
                onDoubleClick={() => openSession(s.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  sessionMenu(s);
                }}
              >
                <span className="tree-session-icon" style={{ color: s.color || typeInfo(s.type).color }}>
                  <SessionIcon s={s} />
                </span>
                <span className="tree-hit-text">
                  <span className="tree-name">{s.name || s.host}</span>
                  <span className="tree-sub">
                    {typeInfo(s.type).label} · {sessionTarget(s)}
                    {s.parentId ? ` · ${folderPath(s.parentId)}` : ''}
                  </span>
                </span>
              </div>
            ))}
            {!matches.length && !quickTarget && <div className="panel-hint">No sessions match “{query}”.</div>}
          </>
        ) : (
          <>
            <div
              className={`tree-row tree-root${selected === ROOT ? ' selected' : ''}${drop?.id === ROOT ? ' drop-into' : ''}`}
              onClick={() => {
                setSelected(ROOT);
                setRootOpen((o) => !o);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                rootMenu();
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(TREE_MIME)) return;
                e.preventDefault();
                e.stopPropagation();
                setDrop({ id: ROOT, pos: 'into' });
              }}
              onDrop={(e) => doDrop(e, null, 'into')}
            >
              <ChevronRight size={13} className={`chev${rootOpen ? ' open' : ''}`} />
              <UsersRound size={15} className="tree-icon root" />
              <span className="tree-name">User sessions</span>
              <span className="tree-count">{sessionCount || ''}</span>
            </div>
            {rootOpen && roots.map((r) => renderItem(r, 1))}
            {rootOpen && !roots.length && (
              <div className="tree-empty">
                <p>
                  No sessions yet. <b>Right-click</b> “User sessions” to create sessions and folders, or import them.
                </p>
                <div className="tree-empty-actions">
                  <button className="btn primary sm" onClick={() => newSessionDialog(null)}>
                    <Plus size={14} /> New session
                  </button>
                  <button className="btn sm" onClick={() => addMenu(null)}>
                    More…
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FolderRow({ f, count }: { f: FolderItem; count: number }) {
  const Icon = f.icon ? iconFor(f.icon) : f.expanded ? FolderOpen : iconFor('folder');
  return (
    <>
      <ChevronRight size={13} className={`chev${f.expanded ? ' open' : ''}`} />
      <span className="tree-icon folder" style={f.color ? { color: f.color } : undefined}>
        <Icon size={15} />
      </span>
      <span className="tree-name">{f.name}</span>
      <span className="tree-count">{count || ''}</span>
    </>
  );
}

function SessionRow({ s, live }: { s: SessionItem; live?: 'connected' | 'connecting' }) {
  return (
    <>
      <span className="chev-space" />
      <span className="tree-session-icon" style={{ color: s.color || typeInfo(s.type).color }}>
        <SessionIcon s={s} />
        {live && <span className={`live-dot ${live}`} />}
      </span>
      <span className="tree-name">{s.name || s.host}</span>
      <span className="tree-host">{sessionTarget(s)}</span>
    </>
  );
}
