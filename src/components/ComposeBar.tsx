import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Send, X } from 'lucide-react';
import { terminals } from '../lib/terminals';
import type { TerminalTab } from '../lib/types';
import { panesOf, rootOf, rootTabs, setCompose, targetTerminals, toast, useApp, type ComposeTarget } from '../store/app';

const history: string[] = [];

function targetLabel(target: ComposeTarget, picked: TerminalTab[]) {
  if (target === 'pane') return 'This terminal';
  if (target === 'tab') return `All panes of this tab · ${picked.length}`;
  if (target === 'all') return `All connected · ${picked.length}`;
  if (picked.length === 1) return picked[0].title;
  return `${picked.length} terminals`;
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
  const [picker, setPicker] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const picked = targetTerminals(target);

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

  const closePicker = () => {
    setPicker(false);
    ref.current?.focus();
  };

  // the picker stays open while terminals are ticked; a click outside or Esc closes it
  useEffect(() => {
    if (!picker) return;
    const down = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPicker(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePicker();
      }
    };
    window.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [picker]);

  const choose = (t: 'pane' | 'tab' | 'all') => {
    setCompose({ target: t });
    closePicker();
  };

  const toggle = (id: string) => {
    const list = Array.isArray(target) ? target : [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    setCompose({ target: next.length ? next : 'pane' });
  };

  const groups = rootTabs(tabs)
    .filter((r) => r.kind === 'terminal')
    .map((r) => ({ root: r, panes: panesOf(r.id, tabs).filter((p) => p.status === 'connected') }))
    .filter((g) => g.panes.length);
  const connectedCount = groups.reduce((n, g) => n + g.panes.length, 0);
  const splitTab = panesOf(rootOf(tab.id), tabs).length > 1;

  // a picked terminal that closed falls out of the list
  useEffect(() => {
    if (!Array.isArray(target)) return;
    const live = target.filter((id) => tabs.some((t) => t.id === id));
    if (live.length !== target.length) setCompose({ target: live.length ? live : 'pane' });
  }, [tabs]);

  return (
    <div className="compose-bar">
      <div className="compose-picker-wrap" ref={pickerRef}>
        <button className={`compose-target${target !== 'pane' ? ' multi' : ''}`} onClick={() => setPicker((v) => !v)} title="Where the command goes">
          {targetLabel(target, picked)}
          <ChevronDown size={12} />
        </button>
        {picker && (
          <div className="compose-picker" role="menu">
            <button className="cp-row" onClick={() => choose('pane')}>
              <span className="cp-check">{target === 'pane' && <Check size={13} />}</span>
              This terminal
            </button>
            <button className="cp-row" onClick={() => choose('tab')} disabled={!splitTab}>
              <span className="cp-check">{target === 'tab' && <Check size={13} />}</span>
              All panes of this tab
            </button>
            <button className="cp-row" onClick={() => choose('all')}>
              <span className="cp-check">{target === 'all' && <Check size={13} />}</span>
              All connected terminals
              <span className="cp-count">{connectedCount}</span>
            </button>
            {groups.length > 0 && (
              <>
                <div className="cp-sep" />
                <div className="cp-head">
                  Pick terminals
                  {Array.isArray(target) && (
                    <button className="link-btn" onClick={() => setCompose({ target: 'pane' })}>
                      Clear
                    </button>
                  )}
                </div>
                {groups.map((g) =>
                  g.panes.map((p) => {
                    const on = Array.isArray(target) && target.includes(p.id);
                    return (
                      <button key={p.id} className={`cp-row pick${on ? ' on' : ''}`} onClick={() => toggle(p.id)}>
                        <span className={`cp-box${on ? ' on' : ''}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                        {p.color && <i className="cp-dot" style={{ background: p.color }} />}
                        <span className="cp-name">{p.title}</span>
                        {p.paneOf && <span className="cp-sub">pane in {g.root.title}</span>}
                        {p.id === tab.id && <span className="cp-sub">this one</span>}
                      </button>
                    );
                  })
                )}
                <div className="cp-foot">
                  <span>{Array.isArray(target) ? `${picked.length} selected` : 'Tick as many as you like'}</span>
                  <button className="btn sm primary" onClick={closePicker}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
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
