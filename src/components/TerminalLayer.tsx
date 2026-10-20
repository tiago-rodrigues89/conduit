import { useRef, useState } from 'react';
import { dnd } from '../lib/dnd';
import { dividers, paneRects, resizeAt, type Divider, type Rect } from '../lib/panes';
import { typeInfo } from '../lib/sessionTypes';
import type { TerminalTab } from '../lib/types';
import { canMoveIntoSplit, moveTabIntoSplit, openSession, panesOf, rootOf, sessionById, updateTab, useApp } from '../store/app';
import { TerminalView } from './TerminalView';

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const GAP = 1;

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

/**
 * Every terminal of every tab, in one layer that never changes its children's
 * parent: a terminal moved into or out of a split keeps its shell and screen.
 * Each terminal is placed over the terminal area of the tab it belongs to.
 */
export function TerminalLayer() {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const focusedPanes = useApp((s) => s.focusedPane);
  const area = useApp((s) => s.paneArea);
  const layerRef = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<DropZone | null>(null);
  // terminals keep the position they were first rendered at: moving DOM nodes
  // around would reset their scroll position
  const order = useRef(new Map<string, number>());

  const activeRoot = rootOf(activeTabId, tabs);
  const terms = tabs.filter((t): t is TerminalTab => t.kind === 'terminal');
  for (const t of terms) if (!order.current.has(t.id)) order.current.set(t.id, order.current.size);
  for (const id of [...order.current.keys()]) if (!terms.some((t) => t.id === id)) order.current.delete(id);
  const sorted = [...terms].sort((a, b) => order.current.get(a.id)! - order.current.get(b.id)!);

  const root = terms.find((t) => t.id === activeRoot);
  const groupIds = root ? panesOf(root.id, tabs).map((p) => p.id) : [];
  const zoomed = root?.zoomedPane && groupIds.includes(root.zoomedPane) ? root.zoomedPane : undefined;
  const split = groupIds.length > 1 && !zoomed;
  const rects: Record<string, Rect> = root?.layout ? paneRects(root.layout) : root ? { [root.id]: FULL } : {};
  const remembered = focusedPanes[activeRoot];
  const focusedId = groupIds.includes(activeTabId) ? activeTabId : remembered && groupIds.includes(remembered) ? remembered : activeRoot;

  /** Pixel box of a fraction of the terminal area. */
  const box = (r: Rect) => ({
    left: area.x + r.x * area.w + (r.x > 0 ? GAP : 0),
    top: area.y + r.y * area.h + (r.y > 0 ? GAP : 0),
    width: r.w * area.w - (r.x > 0 ? GAP : 0),
    height: r.h * area.h - (r.y > 0 ? GAP : 0),
  });

  // ---- drag a session (sidebar) or a tab (tab bar) onto a pane to split it -------------
  const dragLabel = () => {
    const d = dnd.get();
    if (!d) return null;
    if (d.kind === 'session') {
      const s = sessionById(d.id);
      return s && typeInfo(s.type).opens === 'terminal' ? `Open “${s.name}” here` : null;
    }
    if (!canMoveIntoSplit(d.id, activeRoot)) return null;
    const t = useApp.getState().tabs.find((x) => x.id === d.id);
    return t ? `Move “${t.title}” here` : null;
  };
  const zoneAt = (e: React.DragEvent): DropZone | null => {
    const label = dragLabel();
    if (!label || zoomed) return null;
    const el = (e.target as HTMLElement).closest('[data-pane]') as HTMLElement | null;
    const paneId = el?.dataset.pane;
    if (!el || !paneId || !groupIds.includes(paneId)) return null;
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
    <div
      ref={layerRef}
      className="term-layer"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null);
      }}
      onDrop={onDrop}
    >
      {split && <div className="pane-gaps" style={box(FULL)} />}
      {sorted.map((t) => {
        const inGroup = groupIds.includes(t.id);
        const r = inGroup ? (zoomed ? FULL : rects[t.id] || FULL) : FULL;
        return (
          <TerminalView
            key={t.id}
            tab={t}
            visible={inGroup && area.w > 0 && (!zoomed || zoomed === t.id)}
            focused={inGroup && t.id === focusedId}
            split={inGroup && split}
            box={box(r)}
          />
        );
      })}
      {split &&
        root?.layout &&
        dividers(root.layout).map((d) => <PaneDivider key={`${d.path.join('.')}:${d.index}`} d={d} rootId={root.id} area={area} layerRef={layerRef} />)}
      {drop && rects[drop.paneId] && (
        <div className="pane-drop" style={box(zoneRect(rects[drop.paneId], drop.side))}>
          <span>{drop.label}</span>
        </div>
      )}
    </div>
  );
}

function PaneDivider({
  d,
  rootId,
  area,
  layerRef,
}: {
  d: Divider;
  rootId: string;
  area: { x: number; y: number; w: number; h: number };
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const row = d.dir === 'row';
  const style: React.CSSProperties = row
    ? { left: area.x + (d.area.x + d.at * d.area.w) * area.w, top: area.y + d.area.y * area.h, height: d.area.h * area.h }
    : { top: area.y + (d.area.y + d.at * d.area.h) * area.h, left: area.x + d.area.x * area.w, width: d.area.w * area.w };

  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    const layer = layerRef.current?.getBoundingClientRect();
    if (!layer) return;
    const move = (ev: MouseEvent) => {
      const root = useApp.getState().tabs.find((t) => t.id === rootId);
      if (!root || root.kind !== 'terminal' || !root.layout) return;
      const frac = row
        ? ((ev.clientX - layer.left - area.x) / area.w - d.area.x) / d.area.w
        : ((ev.clientY - layer.top - area.y) / area.h - d.area.y) / d.area.h;
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
