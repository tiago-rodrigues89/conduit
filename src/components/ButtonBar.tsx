import { useRef, useState } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import { uid } from '../lib/defaults';
import { terminals } from '../lib/terminals';
import type { ButtonBar as Bar, CommandButton, TerminalTab } from '../lib/types';
import { confirm, inputDialog, openDialog, saveButtonBars, sendToTerminals, sessionById, toast, updateSettings, useApp } from '../store/app';

const BTN_MIME = 'application/x-conduit-button';

/** Text a button types: its lines, each followed by Enter when asked. */
export function buttonText(b: CommandButton) {
  const lines = b.text.replace(/\r\n?/g, '\n').split('\n');
  return lines.join('\r') + (b.enter ? '\r' : '');
}

export function pressButton(b: CommandButton, opts: { allPanes?: boolean; focusId?: string } = {}) {
  const target = opts.allPanes ? 'tab' : b.target;
  const n = sendToTerminals(buttonText(b), target);
  if (!n) toast('info', 'No connected terminal to send to');
  else if (target !== 'pane') toast('info', `“${b.label}” sent to ${n} terminal${n === 1 ? '' : 's'}`);
  if (opts.focusId) terminals.get(opts.focusId)?.focus();
}

/** The bar a terminal uses: picked in the bar menu, else the session's bar, else the first. */
function barFor(bars: Bar[], tab: TerminalTab, chosen: string | null) {
  const pick = (id: string | null | undefined) => (id ? bars.find((b) => b.id === id) : undefined);
  return pick(chosen) || pick(sessionById(tab.sessionId)?.buttonBar) || bars[0];
}

/** SecureCRT-style strip of one-click command buttons under the terminal. */
export function ButtonBar({ tab }: { tab: TerminalTab }) {
  const bars = useApp((s) => s.buttonBars);
  useApp((s) => s.items); // a session's bar can change
  const [chosen, setChosen] = useState<string | null>(null);
  const [dropBefore, setDropBefore] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  const bar = barFor(bars, tab, chosen);

  const updateBar = (id: string, patch: Partial<Bar>) => saveButtonBars(bars.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const barMenu = async () => {
    const choice = await api.popupMenu([
      ...bars.map((b) => ({ id: `bar:${b.id}`, label: b.name, checked: b.id === bar?.id })),
      { type: 'separator' },
      { id: 'new', label: 'New Button Bar…' },
      ...(bar ? [{ id: 'rename', label: `Rename “${bar.name}”…` }, { id: 'delete', label: `Delete “${bar.name}”`, enabled: bars.length > 0 }] : []),
      { type: 'separator' },
      { id: 'hide', label: 'Hide Button Bar' },
    ]);
    if (!choice) return;
    if (choice.startsWith('bar:')) return setChosen(choice.slice(4));
    if (choice === 'hide') return updateSettings({ buttonBarVisible: false });
    if (choice === 'new') {
      const name = await inputDialog({ title: 'New button bar', label: 'Name', placeholder: 'Cisco IOS', confirmLabel: 'Create' });
      if (!name?.trim()) return;
      const nb: Bar = { id: uid(), name: name.trim(), buttons: [] };
      saveButtonBars([...bars, nb]);
      setChosen(nb.id);
      return;
    }
    if (!bar) return;
    if (choice === 'rename') {
      const name = await inputDialog({ title: 'Rename button bar', label: 'Name', value: bar.name, confirmLabel: 'Rename' });
      if (name?.trim()) updateBar(bar.id, { name: name.trim() });
    }
    if (choice === 'delete') {
      const ok = await confirm({
        title: `Delete “${bar.name}”?`,
        message: bar.buttons.length ? `Its ${bar.buttons.length} button${bar.buttons.length === 1 ? '' : 's'} are removed too.` : 'The empty bar is removed.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (ok) {
        saveButtonBars(bars.filter((b) => b.id !== bar.id));
        setChosen(null);
      }
    }
  };

  const buttonMenu = async (b: CommandButton) => {
    if (!bar) return;
    const idx = bar.buttons.findIndex((x) => x.id === b.id);
    const choice = await api.popupMenu([
      { id: 'send', label: 'Send' },
      { id: 'send-tab', label: 'Send to All Panes of This Tab' },
      { id: 'send-all', label: 'Send to All Connected Terminals' },
      { type: 'separator' },
      { id: 'edit', label: 'Edit…' },
      { id: 'dup', label: 'Duplicate' },
      { id: 'left', label: 'Move Left', enabled: idx > 0 },
      { id: 'right', label: 'Move Right', enabled: idx < bar.buttons.length - 1 },
      { type: 'separator' },
      { id: 'delete', label: 'Delete' },
    ]);
    const list = [...bar.buttons];
    switch (choice) {
      case 'send':
        return pressButton({ ...b, target: 'pane' }, { focusId: tab.id });
      case 'send-tab':
        return pressButton({ ...b, target: 'tab' }, { focusId: tab.id });
      case 'send-all':
        return pressButton({ ...b, target: 'all' }, { focusId: tab.id });
      case 'edit':
        return openDialog({ type: 'button', barId: bar.id, buttonId: b.id });
      case 'dup':
        list.splice(idx + 1, 0, { ...b, id: uid(), label: `${b.label} copy` });
        return updateBar(bar.id, { buttons: list });
      case 'left':
      case 'right': {
        const to = choice === 'left' ? idx - 1 : idx + 1;
        [list[idx], list[to]] = [list[to], list[idx]];
        return updateBar(bar.id, { buttons: list });
      }
      case 'delete':
        return updateBar(bar.id, { buttons: list.filter((x) => x.id !== b.id) });
    }
  };

  const drop = (beforeId: string | null) => {
    const id = dragging.current;
    setDropBefore(null);
    if (!bar || !id || id === beforeId) return;
    const moving = bar.buttons.find((x) => x.id === id);
    if (!moving) return;
    const list = bar.buttons.filter((x) => x.id !== id);
    const at = beforeId ? list.findIndex((x) => x.id === beforeId) : list.length;
    list.splice(at < 0 ? list.length : at, 0, moving);
    updateBar(bar.id, { buttons: list });
  };

  return (
    <div className="button-bar">
      <button className="bb-menu" onClick={barMenu} title="Switch or manage button bars">
        {bar ? bar.name : 'Buttons'}
        <ChevronDown size={12} />
      </button>
      <div
        className="bb-buttons"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(BTN_MIME)) e.preventDefault();
        }}
        onDrop={() => drop(dropBefore)}
      >
        {bar?.buttons.map((b) => (
          <button
            key={b.id}
            className={`bb-btn${dropBefore === b.id ? ' drop-before' : ''}`}
            style={b.color ? ({ '--bb': b.color } as React.CSSProperties) : undefined}
            draggable
            onDragStart={(e) => {
              dragging.current = b.id;
              e.dataTransfer.setData(BTN_MIME, b.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              dragging.current = null;
              setDropBefore(null);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(BTN_MIME)) return;
              e.preventDefault();
              e.stopPropagation();
              setDropBefore(b.id);
            }}
            onDrop={(e) => {
              e.stopPropagation();
              drop(b.id);
            }}
            onClick={(e) => pressButton(b, { allPanes: e.altKey, focusId: tab.id })}
            onContextMenu={(e) => {
              e.preventDefault();
              buttonMenu(b);
            }}
            title={`${b.text}${b.enter ? '  ⏎' : ''}\n\n${b.target === 'pane' ? 'Click: this terminal · ⌥-click: all panes of the tab' : b.target === 'tab' ? 'Sends to all panes of the tab' : 'Sends to every connected terminal'}`}
          >
            {b.color && <i className="bb-dot" />}
            {b.label}
            {b.target !== 'pane' && <span className="bb-target">{b.target === 'tab' ? 'tab' : 'all'}</span>}
          </button>
        ))}
        {bar && (
          <button className="bb-add" title="Add a button" onClick={() => openDialog({ type: 'button', barId: bar.id })}>
            <Plus size={13} />
            {!bar.buttons.length && <span>Add button</span>}
          </button>
        )}
        {!bar && (
          <button
            className="bb-add"
            onClick={() => {
              const nb: Bar = { id: uid(), name: 'Buttons', buttons: [] };
              saveButtonBars([nb]);
              openDialog({ type: 'button', barId: nb.id });
            }}
          >
            <Plus size={13} /> <span>Add button</span>
          </button>
        )}
      </div>
      <button className="icon-btn xs bb-hide" title="Hide the button bar (View → Button Bar)" onClick={() => updateSettings({ buttonBarVisible: false })}>
        <X size={12} />
      </button>
    </div>
  );
}
