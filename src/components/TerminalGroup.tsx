import { useRef, useState } from 'react';
import { dnd } from '../lib/dnd';
import { dividers, paneRects, resizeAt, type Divider, type Rect } from '../lib/panes';
import { typeInfo } from '../lib/sessionTypes';
import type { TerminalTab } from '../lib/types';
import { canMoveIntoSplit, moveTabIntoSplit, openSession, panesOf, sessionById, updateTab, useApp } from '../store/app';

type Side = 'left' | 'right' | 'top' | 'bottom';
interface DropZone {
  paneId: string;
  side: Side;
  label: string;
}

/** The half of a pane a drop lands in. */
function zoneRect(r: Rect, side: Side): Rect {
  if (side === 'left') return { ...r, w: r.w / 2 };
  if (side === 'right') return { ...r, x: r.x + r.w / 2, w: r.w / 2 };
  if (side === 'top') return { ...r, h: r.h / 2 };
  return { ...r, y: r.y + r.h / 2, h: r.h / 2 };
}
import { ButtonBar } from './ButtonBar';
import { ComposeBar } from './ComposeBar';
import { HistoryPanel } from './HistoryPanel';
import { StatusBar } from './StatusBar';
import { TerminalView } from './TerminalView';

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** A terminal tab: one terminal or several split panes, with the bars below. */
export function TerminalGroup({ root, active }: { root: TerminalTab; active: boolean }) {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const remembered = useApp((s) => s.focusedPane[root.id]);
  const historyPanel = useApp((s) => s.settings.historyPanel);
  const buttonBarVisible = useApp((s) => s.settings.buttonBarVisible);
  const composeOpen = useApp((s) => s.compose.open);
  const areaRef = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<DropZone | null>(null);

  const panes = panesOf(root.id, tabs);
  const ids = panes.map((p) => p.id);
  const focusedId = ids.includes(activeTabId) ? activeTabId : remembered && ids.includes(remembered) ? remembered : root.id;
  const focused = panes.find((p) => p.id === focusedId) || root;
  const zoomed = root.zoomedPane && ids.includes(root.zoomedPane) ? root.zoomedPane : undefined;
  const split = panes.length > 1 && !zoomed;
  const rects = root.layout ? paneRects(root.layout) : { [root.id]: FULL };

  // drag a session from the sidebar (or a tab from the tab bar) onto a pane to split it
  const dragLabel = () => {
    const d = dnd.get();
    if (!d) return null;
    if (d.kind === 'session') {
      const s = sessionById(d.id);
      return s && typeInfo(s.type).opens === 'terminal' ? `Open “${s.name}” here` : null;
    }
    if (!canMoveIntoSplit(d.id, root.id)) return null;
    const t = useApp.getState().tabs.find((x) => x.id === d.id);
    return t ? `Move “${t.title}” here` : null;
  };
  /** The pane and its half under the pointer. */
  const zoneAt = (e: React.DragEvent): DropZone | null => {
    const label = dragLabel();
    if (!label || zoomed) return null;
    const el = (e.target as HTMLElement).closest('[data-pane]') as HTMLElement | null;
    const paneId = el?.dataset.pane;
    if (!el || !paneId) return null;
    const r = el.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    // the nearest edge wins
    const dist: [Side, number][] = [
      ['left', fx],
      ['right', 1 - fx],
      ['top', fy],
      ['bottom', 1 - fy],
    ];
    const side = dist.sort((a, b) => a[1] - b[1])[0][0];
    return { paneId, side, label };
  };
  const onDragOver = (e: React.DragEvent) => {
    const zone = zoneAt(e);
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!drop || drop.paneId !== zone.paneId || drop.side !== zone.side || drop.label !== zone.label) setDrop(zone);
  };
  const onDrop = (e: React.DragEvent) => {
    const d = dnd.get();
    const zone = zoneAt(e) || drop;
    setDrop(null);
    if (!d || !zone) return;
    e.preventDefault();
    const dir = zone.side === 'left' || zone.side === 'right' ? 'row' : 'col';
    const before = zone.side === 'left' || zone.side === 'top';
    if (d.kind === 'session') openSession(d.id, { split: dir, beside: zone.paneId, before });
    else moveTabIntoSplit(d.id, zone.paneId, dir, before);
    dnd.end();
  };

  return (
    <div className="terminal-view" style={{ display: active ? 'flex' : 'none' }}>
      <div className="terminal-row">
        <div
          className={`pane-area${split ? ' split' : ''}`}
          ref={areaRef}
          onDragOver={onDragOver}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
          }}
          onDrop={onDrop}
        >
          {panes.map((p) => (
            <TerminalView
              key={p.id}
              tab={p}
              visible={active && (!zoomed || zoomed === p.id)}
              focused={active && p.id === focusedId}
              split={split}
              rect={zoomed ? FULL : rects[p.id] || FULL}
            />
          ))}
          {split &&
            root.layout &&
            dividers(root.layout).map((d) => <PaneDivider key={`${d.path.join('.')}:${d.index}`} d={d} rootId={root.id} areaRef={areaRef} />)}
          {drop && rects[drop.paneId] && (
            <div
              className="pane-drop"
              style={(() => {
                const z = zoneRect(rects[drop.paneId], drop.side);
                return { left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` };
              })()}
            >
              <span>{drop.label}</span>
            </div>
          )}
        </div>
        {historyPanel && active && <HistoryPanel tab={focused} />}
      </div>
      {buttonBarVisible && <ButtonBar tab={focused} />}
      {composeOpen && active && <ComposeBar tab={focused} />}
      <StatusBar tab={focused} panes={panes.length} zoomed={!!zoomed} />
    </div>
  );
}

function PaneDivider({ d, rootId, areaRef }: { d: Divider; rootId: string; areaRef: React.RefObject<HTMLDivElement | null> }) {
  const row = d.dir === 'row';
  const style: React.CSSProperties = row
    ? { left: `${(d.area.x + d.at * d.area.w) * 100}%`, top: `${d.area.y * 100}%`, height: `${d.area.h * 100}%` }
    : { top: `${(d.area.y + d.at * d.area.h) * 100}%`, left: `${d.area.x * 100}%`, width: `${d.area.w * 100}%` };

  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    const move = (ev: MouseEvent) => {
      const root = useApp.getState().tabs.find((t) => t.id === rootId);
      if (!root || root.kind !== 'terminal' || !root.layout) return;
      const frac = row
        ? ((ev.clientX - box.left) / box.width - d.area.x) / d.area.w
        : ((ev.clientY - box.top) / box.height - d.area.y) / d.area.h;
      updateTab(rootId, { layout: resizeAt(root.layout, d.path, d.index, frac) });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing', 'resizing-row', 'resizing-col');
    };
    document.body.classList.add('resizing', row ? 'resizing-row' : 'resizing-col');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return <div className={`pane-divider ${row ? 'row' : 'col'}`} style={style} onMouseDown={start} title="Drag to resize" />;
}
