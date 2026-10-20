import { CornerDownLeft, Plus, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { terminals } from '../lib/terminals';
import type { Snippet } from '../lib/types';
import { confirm, openDialog, removeSnippet, toast, useApp } from '../store/app';

export function runSnippet(s: Snippet, run = s.run) {
  const { activeTabId, tabs } = useApp.getState();
  const tab = tabs.find((t) => t.id === activeTabId);
  const term = terminals.get(activeTabId);
  if (!tab || tab.kind !== 'terminal' || tab.status !== 'connected' || !term) {
    toast('info', 'Open a connected terminal first');
    return;
  }
  const text = s.command.replace(/\r?\n/g, '\r');
  term.sendInput(run ? text + '\r' : text);
  term.focus();
}

export function SnippetsPanel() {
  const snippets = useApp((s) => s.snippets);

  const menu = async (s: Snippet) => {
    const choice = await api.popupMenu([
      { id: 'run', label: 'Run' },
      { id: 'insert', label: 'Insert Without Running' },
      { type: 'separator' },
      { id: 'edit', label: 'Edit…' },
      { id: 'delete', label: 'Delete' },
    ]);
    if (choice === 'run') runSnippet(s, true);
    if (choice === 'insert') runSnippet(s, false);
    if (choice === 'edit') openDialog({ type: 'snippet', snippet: s });
    if (choice === 'delete' && (await confirm({ title: `Delete “${s.name}”?`, message: 'The snippet is removed.', confirmLabel: 'Delete', danger: true })))
      removeSnippet(s.id);
  };

  return (
    <div className="snippets-panel">
      <div className="panel-header-row">
        <span className="panel-label">Snippets</span>
        <button className="icon-btn sm" title="New snippet" onClick={() => openDialog({ type: 'snippet' })}>
          <Plus size={16} />
        </button>
      </div>
      {snippets.length ? (
        <div className="snippet-list">
          {snippets.map((s) => (
            <div
              key={s.id}
              className="snippet"
              onClick={() => runSnippet(s)}
              onContextMenu={(e) => {
                e.preventDefault();
                menu(s);
              }}
              title={s.run ? 'Click to run in the active terminal' : 'Click to insert into the active terminal'}
            >
              <div className="snippet-name">
                {s.name}
                {s.run && <CornerDownLeft size={11} className="snippet-run" />}
              </div>
              <div className="snippet-cmd mono">{s.command}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-empty">
          <ScrollText size={28} strokeWidth={1.4} />
          <p>Save commands you use often and send them to the active terminal with one click.</p>
        </div>
      )}
    </div>
  );
}
