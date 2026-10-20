import { useRef } from 'react';
import { dividers, paneRects, resizeAt, type Divider, type Rect } from '../lib/panes';
import type { TerminalTab } from '../lib/types';
import { panesOf, updateTab, useApp } from '../store/app';
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

  const panes = panesOf(root.id, tabs);
  const ids = panes.map((p) => p.id);
  const focusedId = ids.includes(activeTabId) ? activeTabId : remembered && ids.includes(remembered) ? remembered : root.id;
  const focused = panes.find((p) => p.id === focusedId) || root;
  const zoomed = root.zoomedPane && ids.includes(root.zoomedPane) ? root.zoomedPane : undefined;
  const split = panes.length > 1 && !zoomed;
  const rects = root.layout ? paneRects(root.layout) : { [root.id]: FULL };

  return (
    <div className="terminal-view" style={{ display: active ? 'flex' : 'none' }}>
      <div className="terminal-row">
        <div className={`pane-area${split ? ' split' : ''}`} ref={areaRef}>
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
