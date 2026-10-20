import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { terminals } from '../lib/terminals';
import type { TerminalTab } from '../lib/types';
import { panesOf, rootOf, rootTabs, setCompose, targetTerminals, toast, useApp, type ComposeTarget } from '../store/app';

const history: string[] = [];

function targetLabel(target: ComposeTarget, n: number) {
  if (target === 'pane') return 'This terminal';
  if (target === 'tab') return `All panes of this tab · ${n}`;
  if (target === 'all') return `All connected · ${n}`;
  return `${n} selected`;
}

/**
 * A slim line under the terminal to write a command first and then send it
 * to one, several or all terminals (Enter sends, ⇧↩ adds a line, Esc closes).
 */
export function ComposeBar({ tab }: { tab: TerminalTab }) {
  const target = useApp((s) => s.compose.target);
  const tabs = useApp((s) => s.tabs);
  const [text, setText] = useState('');
  const [pos, setPos] = useState(-1);
  const ref = useRef<HTMLTextAreaElement>(null);
  const count = targetTerminals(target).length;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // grow with the text, up to six lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 6 * 18 + 10)}px`;
  }, [text]);

  const close = () => {
    setCompose({ open: false });
    terminals.get(tab.id)?.focus();
  };

  const send = () => {
    if (!text.trim()) return;
    const n = targetTerminals(target);
    if (!n.length) return toast('info', 'No connected terminal to send to');
    const data = text.replace(/\r\n?/g, '\n').split('\n').join('\r') + '\r';
    for (const t of n) terminals.get(t.id)?.sendInput(data);
    if (history[history.length - 1] !== text) history.push(text);
    if (history.length > 100) history.shift();
    setText('');
    setPos(-1);
    if (n.length > 1) toast('info', `Sent to ${n.length} terminals`);
  };

  const pickTarget = async () => {
    const all = useApp.getState().tabs;
    const connected = (t: (typeof all)[number]) => t.kind === 'terminal' && t.status === 'connected';
    const selected = Array.isArray(target) ? target : targetTerminals(target).map((t) => t.id);
    const groups = rootTabs(all).filter((r) => r.kind === 'terminal');
    const picks = groups.flatMap((r) =>
      panesOf(r.id, all)
        .filter(connected)
        .map((p) => ({
          id: `t:${p.id}`,
          label: `${p.title}${p.paneOf ? `  ·  pane in ${r.title}` : ''}`,
          checked: Array.isArray(target) && selected.includes(p.id),
        }))
    );
    const choice = await api.popupMenu([
      { id: 'pane', label: 'This terminal', checked: target === 'pane' },
      { id: 'tab', label: 'All panes of this tab', checked: target === 'tab', enabled: panesOf(rootOf(tab.id), all).length > 1 },
      { id: 'all', label: 'All connected terminals', checked: target === 'all' },
      ...(picks.length ? [{ type: 'separator' as const }, { label: 'Pick terminals:', enabled: false }, ...picks] : []),
    ]);
    if (!choice) return;
    if (choice === 'pane' || choice === 'tab' || choice === 'all') setCompose({ target: choice });
    else if (choice.startsWith('t:')) {
      const id = choice.slice(2);
      const list = Array.isArray(target) ? target : [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      setCompose({ target: next.length ? next : 'pane' });
    }
    ref.current?.focus();
  };

  // a picked terminal that closed falls out of the list
  useEffect(() => {
    if (!Array.isArray(target)) return;
    const live = target.filter((id) => tabs.some((t) => t.id === id));
    if (live.length !== target.length) setCompose({ target: live.length ? live : 'pane' });
  }, [tabs]);

  return (
    <div className="compose-bar">
      <button className={`compose-target${target !== 'pane' ? ' multi' : ''}`} onClick={pickTarget} title="Where the command goes">
        {targetLabel(target, count)}
        <ChevronDown size={12} />
      </button>
      <textarea
        ref={ref}
        className="compose-input mono"
        rows={1}
        value={text}
        placeholder="Write a command, ↩ sends · ⇧↩ new line · ↑ previous"
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setPos(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !text.includes('\n') && history.length) {
            e.preventDefault();
            const next = e.key === 'ArrowUp' ? (pos === -1 ? history.length - 1 : Math.max(0, pos - 1)) : pos === -1 ? -1 : pos + 1;
            if (next === -1 || next >= history.length) {
              setPos(-1);
              setText('');
            } else {
              setPos(next);
              setText(history[next]);
            }
          }
        }}
      />
      <button className="icon-btn sm compose-send" title="Send (↩)" onClick={send} disabled={!text.trim()}>
        <Send size={14} />
      </button>
      <button className="icon-btn sm" title="Close (Esc)" onClick={close}>
        <X size={14} />
      </button>
    </div>
  );
}
