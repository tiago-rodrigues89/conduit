import { useEffect, useMemo, useState } from 'react';
import { PanelRightClose, RefreshCw, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { uid } from '../lib/defaults';
import { terminals } from '../lib/terminals';
import type { TerminalTab } from '../lib/types';
import { openDialog, toast, updateSettings, useApp } from '../store/app';
import { Segmented } from './ui';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** Turns bash/zsh history files into commands (newest last). */
export function parseHistory(text: string): string[] {
  const out: string[] = [];
  let cur: string | null = null;
  for (let line of text.split('\n')) {
    if (/^#\d{9,}$/.test(line)) continue; // bash timestamps
    const ext = line.match(/^: \d+:\d+;(.*)$/); // zsh extended history
    if (ext && cur === null) line = ext[1];
    cur = cur === null ? line : `${cur}\n${line}`;
    if (cur.endsWith('\\')) {
      cur = cur.slice(0, -1);
      continue;
    }
    if (cur.trim()) out.push(cur);
    cur = null;
  }
  return out;
}

async function loadServerHistory(tab: TerminalTab): Promise<string[]> {
  const read = (file: string) =>
    (tab.mode === 'ssh' && tab.connId ? api.sftp.readTail(tab.connId, file) : api.fs.readTail(file)).then(parseHistory, () => []);
  const [bash, zsh] = await Promise.all([read('~/.bash_history'), read('~/.zsh_history')]);
  return [...bash, ...zsh];
}

export function HistoryPanel({ tab }: { tab: TerminalTab }) {
  const session = useApp((s) => s.history[tab.id]) || [];
  const [view, setView] = useState<'session' | 'server'>('session');
  const [query, setQuery] = useState('');
  const [server, setServer] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const canLoad = (tab.mode === 'ssh' && tab.status === 'connected' && !!tab.connId) || tab.mode === 'local';

  const refresh = () => {
    if (!canLoad) return;
    setLoading(true);
    loadServerHistory(tab)
      .then(setServer)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setServer(null);
    if (view === 'server') refresh();
  }, [tab.id, tab.connId, view]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list =
      view === 'session'
        ? [...session].reverse().map((h) => ({ cmd: h.cmd, at: h.at as number | undefined }))
        : (() => {
            // newest first, each command once
            const seen = new Set<string>();
            const out: { cmd: string; at?: number }[] = [];
            for (let i = (server || []).length - 1; i >= 0; i--) {
              const cmd = server![i];
              if (seen.has(cmd)) continue;
              seen.add(cmd);
              out.push({ cmd });
            }
            return out;
          })();
    return q ? list.filter((r) => r.cmd.toLowerCase().includes(q)) : list;
  }, [view, session, server, query]);

  const send = (cmd: string, run: boolean) => {
    const term = terminals.get(tab.id);
    if (!term || tab.status !== 'connected') return toast('info', 'The terminal is not connected');
    const text = cmd.replace(/\n/g, '\r');
    term.sendInput(run ? `${text}\r` : text);
    term.focus();
  };

  const menu = async (cmd: string) => {
    const choice = await api.popupMenu([
      { id: 'run', label: 'Run' },
      { id: 'insert', label: 'Insert Without Running' },
      { type: 'separator' },
      { id: 'copy', label: 'Copy' },
      { id: 'snippet', label: 'Save as Snippet…' },
    ]);
    if (choice === 'run') send(cmd, true);
    if (choice === 'insert') send(cmd, false);
    if (choice === 'copy') api.clipboard.write(cmd).then(() => toast('success', 'Copied'));
    if (choice === 'snippet') openDialog({ type: 'snippet', isNew: true, snippet: { id: uid(), name: cmd.split('\n')[0].slice(0, 40), command: cmd, run: true } });
  };

  return (
    <aside className="history-panel">
      <div className="history-head">
        <span className="history-title">History</span>
        {view === 'server' && (
          <button className="icon-btn sm" title="Reload" onClick={refresh} disabled={!canLoad}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        )}
        <button className="icon-btn sm" title="Hide history (⇧⌘Y)" onClick={() => updateSettings({ historyPanel: false })}>
          <PanelRightClose size={15} />
        </button>
      </div>
      <div className="history-tools">
        <Segmented
          small
          value={view}
          onChange={setView}
          options={[
            { value: 'session', label: `This session${session.length ? ` · ${session.length}` : ''}` },
            { value: 'server', label: tab.mode === 'local' ? 'This Mac' : 'Server' },
          ]}
        />
        <div className="panel-search history-search">
          <Search size={13} className="panel-search-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter" spellCheck={false} />
          {query && (
            <button className="icon-btn xs" onClick={() => setQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="history-list">
        {rows.map((r, i) => (
          <div
            key={`${i}:${r.cmd}`}
            className="history-row"
            title={`${r.cmd}\n\nClick to insert · double-click to run`}
            onClick={() => send(r.cmd, false)}
            onDoubleClick={() => send(r.cmd, true)}
            onContextMenu={(e) => {
              e.preventDefault();
              menu(r.cmd);
            }}
          >
            <span className="history-cmd mono">{r.cmd.split('\n')[0]}</span>
            {r.at && <span className="history-time">{timeFmt.format(r.at)}</span>}
          </div>
        ))}
        {!rows.length && (
          <div className="history-empty">
            {query
              ? 'Nothing matches.'
              : view === 'session'
                ? 'Commands you run in this tab appear here.'
                : loading
                  ? 'Loading…'
                  : canLoad
                    ? 'No shell history found (~/.bash_history, ~/.zsh_history).'
                    : 'Connect to read the server’s history.'}
          </div>
        )}
      </div>
      <div className="history-foot">Click inserts · double-click runs</div>
    </aside>
  );
}
