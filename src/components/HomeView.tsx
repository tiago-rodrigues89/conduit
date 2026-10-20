import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CloudUpload, FileArchive, FileInput, FolderTree, Import, KeyRound, Laptop, LayoutGrid, Pencil, Pin, Plus, Settings, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { newSession, parseQuickConnect } from '../lib/defaults';
import { relativeTime } from '../lib/format';
import { iconFor } from '../lib/icons';
import { importFromMobaXterm, importFromSshConfig } from '../lib/importflow';
import { sessionTarget, typeInfo } from '../lib/sessionTypes';
import type { SessionItem, Workspace } from '../lib/types';
import {
  folderPath,
  openDialog,
  openLocal,
  openQuickConnect,
  openSession,
  openSftp,
  openWorkspace,
  patchItem,
  saveItem,
  toast,
  useApp,
} from '../store/app';
import { Logo } from './Logo';

export function quickConnect(input: string, save = false) {
  const parsed = parseQuickConnect(input);
  if (!parsed) {
    toast('error', 'Enter a host like user@server or user@10.0.0.5:2222');
    return false;
  }
  const name = parsed.host;
  if (save) {
    const s = newSession({ name, ...parsed });
    saveItem(s);
    openSession(s.id);
  } else {
    openQuickConnect({
      name,
      ...parsed,
      authMethod: 'auto',
      keyPath: '',
      legacyAlgorithms: false,
      keepAlive: useApp.getState().settings.keepAlive,
      forwards: [],
    });
  }
  return true;
}

type Result =
  | { kind: 'session'; s: SessionItem }
  | { kind: 'workspace'; w: Workspace }
  | { kind: 'quick'; target: string }
  | { kind: 'action'; id: string; label: string; hint?: string; icon: typeof Plus; run: () => void };

const ACTIONS: Extract<Result, { kind: 'action' }>[] = [
  { kind: 'action', id: 'new', label: 'New session', hint: '⌘N', icon: Plus, run: () => openDialog({ type: 'session' }) },
  { kind: 'action', id: 'local', label: 'Local shell on this Mac', hint: '⌘T', icon: Laptop, run: () => openLocal() },
  { kind: 'action', id: 'ssh-config', label: 'Import ~/.ssh/config', icon: FileInput, run: () => importFromSshConfig() },
  { kind: 'action', id: 'moba', label: 'Import MobaXterm sessions', icon: Import, run: () => importFromMobaXterm() },
  { kind: 'action', id: 'logins', label: 'Saved logins', icon: KeyRound, run: () => openDialog({ type: 'settings', section: 'logins' }) },
  { kind: 'action', id: 'workspace', label: 'Save open tabs as workspace', icon: LayoutGrid, run: () => openDialog({ type: 'workspace', fromTabs: true }) },
  { kind: 'action', id: 'triggers', label: 'Triggers', icon: Zap, run: () => openDialog({ type: 'settings', section: 'triggers' }) },
  { kind: 'action', id: 'export', label: 'Export backup', icon: FileArchive, run: () => openDialog({ type: 'backup', mode: 'export' }) },
  { kind: 'action', id: 'import-backup', label: 'Import backup', icon: FileArchive, run: () => openDialog({ type: 'backup', mode: 'import' }) },
  { kind: 'action', id: 'sync', label: 'Sync with other Macs', icon: CloudUpload, run: () => openDialog({ type: 'settings', section: 'sync' }) },
  { kind: 'action', id: 'settings', label: 'Settings', hint: '⌘,', icon: Settings, run: () => openDialog({ type: 'settings' }) },
];
const ACTION_WORDS: Record<string, string> = {
  new: 'new session create add',
  local: 'local shell terminal mac zsh',
  'ssh-config': 'import ssh config',
  moba: 'import mobaxterm moba',
  logins: 'logins credentials passwords users',
  workspace: 'workspace save tabs layout',
  triggers: 'triggers automation notify',
  export: 'export backup',
  'import-backup': 'import backup restore',
  sync: 'sync icloud macs dropbox',
  settings: 'settings preferences theme font',
};

/** 3 = starts with, 2 = contains, 1 = letters in order, 0 = no match */
function score(text: string, q: string) {
  const t = text.toLowerCase();
  if (!t) return 0;
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  let i = 0;
  for (const c of t) if (c === q[i]) i++;
  return i === q.length ? 1 : 0;
}

function greeting(user?: string) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = user ? user.charAt(0).toUpperCase() + user.slice(1) : '';
  return name ? `${part}, ${name}` : part;
}

export function HomeView({ active }: { active: boolean }) {
  const items = useApp((s) => s.items);
  const tabs = useApp((s) => s.tabs);
  const workspaces = useApp((s) => s.workspaces);
  const info = useApp((s) => s.info);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active && !useApp.getState().dialogs.length) setTimeout(() => inputRef.current?.focus(), 30);
  }, [active]);

  const sessions = useMemo(() => items.filter((i): i is SessionItem => i.kind === 'session'), [items]);
  const live = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tabs) if ((t.kind === 'terminal' || t.kind === 'sftp') && t.sessionId && t.status === 'connected') m.set(t.sessionId, (m.get(t.sessionId) || 0) + 1);
    return m;
  }, [tabs]);
  const openCount = tabs.filter((t) => (t.kind === 'terminal' || t.kind === 'sftp') && t.status === 'connected').length;

  const pinned = sessions.filter((s) => s.pinned);
  const recent = sessions
    .filter((s) => s.lastUsed && !s.pinned)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, 8);

  const query = q.trim().toLowerCase();
  const results: Result[] = useMemo(() => {
    if (!query) return [...workspaces.map((w) => ({ kind: 'workspace' as const, w })), ...[...pinned, ...recent].map((s) => ({ kind: 'session' as const, s }))];
    const ws = workspaces.filter((w) => score(w.name, query) >= 1).map((w) => ({ kind: 'workspace' as const, w }));
    const found = sessions
      .map((s) => {
        const sc = Math.max(
          score(s.name, query) * 2,
          score(s.host, query),
          score(`${s.username}@${s.host}`, query),
          score(typeInfo(s.type).label, query) * 0.5,
          s.parentId ? score(folderPath(s.parentId), query) * 0.5 : 0
        );
        return { s, sc: sc + (s.lastUsed ? Math.min(0.9, s.lastUsed / Date.now()) * 0.1 : 0) };
      })
      .filter((x) => x.sc >= 1)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 8)
      .map(({ s }) => ({ kind: 'session' as const, s }));
    const out: Result[] = [...ws, ...found];
    if (/[@.:]/.test(q.trim()) && !/\s/.test(q.trim()) && parseQuickConnect(q)) out.push({ kind: 'quick', target: q.trim() });
    for (const a of ACTIONS) if (score(`${a.label} ${ACTION_WORDS[a.id]}`, query) >= 2) out.push(a);
    return out;
  }, [query, sessions, items, workspaces]);

  useEffect(() => setSel(0), [query]);

  const run = (r: Result | undefined) => {
    if (!r) {
      if (q.trim() && parseQuickConnect(q)) quickConnect(q) && setQ('');
      return;
    }
    if (r.kind === 'session') openSession(r.s.id);
    else if (r.kind === 'workspace') openWorkspace(r.w.id);
    else if (r.kind === 'quick') quickConnect(r.target);
    else r.run();
    setQ('');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[sel]);
    } else if (e.key === 'Escape') {
      setQ('');
    }
  };

  const importMenu = async () => {
    const choice = await api.popupMenu([
      { id: 'ssh', label: 'From ~/.ssh/config' },
      { id: 'moba', label: 'From MobaXterm Sessions…' },
    ]);
    if (choice === 'ssh') importFromSshConfig();
    if (choice === 'moba') importFromMobaXterm();
  };

  const row = (r: Result, i: number) => {
    const isSel = i === sel;
    const common = {
      className: `launch-row${isSel ? ' selected' : ''}`,
      onMouseMove: () => setSel(i),
      onClick: () => run(r),
    };
    if (r.kind === 'session') {
      const s = r.s;
      const info2 = typeInfo(s.type);
      const Icon = iconFor(s.icon, info2.icon);
      const n = live.get(s.id);
      return (
        <div key={s.id} {...common}>
          <span className="launch-icon" style={{ color: s.color || info2.color }}>
            <Icon size={16} />
          </span>
          <span className="launch-name">{s.name || s.host}</span>
          <span className="launch-target">
            {s.username && info2.network ? `${s.username}@` : ''}
            {sessionTarget(s)}
          </span>
          <span className="launch-meta">
            {n ? <span className="launch-live">● {n > 1 ? `${n} open` : 'open'}</span> : s.parentId ? folderPath(s.parentId) : info2.label}
          </span>
          <span className="launch-when">{s.lastUsed ? relativeTime(s.lastUsed) : ''}</span>
          <span className="launch-actions" onClick={(e) => e.stopPropagation()}>
            {s.type === 'ssh' && (
              <button className="icon-btn xs" title="Open SFTP browser" onClick={() => openSftp({ sessionId: s.id })}>
                <FolderTree size={13} />
              </button>
            )}
            <button className="icon-btn xs" title={s.pinned ? 'Unpin' : 'Pin to Home'} onClick={() => patchItem(s.id, { pinned: !s.pinned })}>
              <Pin size={13} className={s.pinned ? 'pinned' : ''} />
            </button>
            <button className="icon-btn xs" title="Edit" onClick={() => openDialog({ type: 'session', sessionId: s.id })}>
              <Pencil size={13} />
            </button>
          </span>
        </div>
      );
    }
    if (r.kind === 'workspace') {
      const w = r.w;
      const names = w.entries.map((e) => (e.sessionId ? sessions.find((x) => x.id === e.sessionId)?.name : 'Local shell')).filter(Boolean);
      return (
        <div key={w.id} {...common}>
          <span className="launch-icon accent">
            <LayoutGrid size={16} />
          </span>
          <span className="launch-name">{w.name}</span>
          <span className="launch-target">{names.join(' · ')}</span>
          <span className="launch-meta">{w.openOnLaunch ? 'opens at start' : `${w.entries.length} session${w.entries.length === 1 ? '' : 's'}`}</span>
          <span className="launch-when" />
          <span className="launch-actions" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn xs" title="Edit workspace" onClick={() => openDialog({ type: 'workspace', workspaceId: w.id })}>
              <Pencil size={13} />
            </button>
          </span>
        </div>
      );
    }
    if (r.kind === 'quick') {
      return (
        <div key="quick" {...common}>
          <span className="launch-icon accent">
            <ArrowRight size={16} />
          </span>
          <span className="launch-name">Connect to {r.target}</span>
          <span className="launch-target">SSH quick connect</span>
          <span className="launch-meta" />
          <span className="launch-when">↵</span>
          <span />
        </div>
      );
    }
    return (
      <div key={r.id} {...common}>
        <span className="launch-icon muted">
          <r.icon size={16} />
        </span>
        <span className="launch-name">{r.label}</span>
        <span className="launch-target" />
        <span className="launch-meta" />
        <span className="launch-when">{r.hint ? <kbd>{r.hint}</kbd> : ''}</span>
        <span />
      </div>
    );
  };

  const sessionCount = sessions.length;

  return (
    <div className="home" style={{ display: active ? 'flex' : 'none' }} onMouseDown={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
      <div className="home-inner">
        <div className="home-top">
          <Logo size={34} />
          <div>
            <h1>{greeting(info?.user)}</h1>
            <p>
              {openCount ? `${openCount} connected · ` : ''}
              {sessionCount} saved session{sessionCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="launcher" onClick={() => inputRef.current?.focus()}>
          <span className="launcher-prompt">❯</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search sessions, type user@host, or an action…"
            spellCheck={false}
          />
          <span className="launcher-keys">
            <kbd>↑↓</kbd> <kbd>↵</kbd>
          </span>
        </div>

        <div className="launcher-actions">
          <button className="ghost-btn" onClick={() => openDialog({ type: 'session' })}>
            <Plus size={14} /> New session
          </button>
          <button className="ghost-btn" onClick={() => openLocal()}>
            <Laptop size={14} /> Local shell
          </button>
          <button className="ghost-btn" onClick={importMenu}>
            <Import size={14} /> Import
          </button>
        </div>

        {query ? (
          <div className="launch-list">
            {results.length ? results.map(row) : <div className="launch-empty">Nothing found. Press ↵ to try it as a host.</div>}
          </div>
        ) : (
          <>
            {workspaces.length > 0 && (
              <>
                <div className="launch-head">Workspaces</div>
                <div className="launch-list">{workspaces.map((w, i) => row({ kind: 'workspace', w }, i))}</div>
              </>
            )}
            {pinned.length > 0 && (
              <>
                <div className="launch-head">Pinned</div>
                <div className="launch-list">{pinned.map((s, i) => row({ kind: 'session', s }, i + workspaces.length))}</div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <div className="launch-head">Recent</div>
                <div className="launch-list">{recent.map((s, i) => row({ kind: 'session', s }, i + workspaces.length + pinned.length))}</div>
              </>
            )}
            {!pinned.length && !recent.length && !workspaces.length && (
              <div className="launch-welcome">
                {sessionCount
                  ? 'Type to find a session — or double-click one in the sidebar.'
                  : 'No sessions yet. Create one, import your ~/.ssh/config or MobaXterm sessions, or just type user@host above.'}
              </div>
            )}
          </>
        )}
      </div>
      <div className="home-foot">
        <span>
          <kbd>⌘T</kbd> local shell
        </span>
        <span>
          <kbd>⌘N</kbd> new session
        </span>
        <span>
          <kbd>⇧⌘O</kbd> SFTP browser
        </span>
        <span>
          <kbd>⌘D</kbd> split
        </span>
        <span>
          <kbd>⇧⌘Y</kbd> history
        </span>
        <span>select copies · right-click pastes</span>
      </div>
    </div>
  );
}
