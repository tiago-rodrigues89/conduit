import { useLayoutEffect, useRef } from 'react';
import type { TerminalTab } from '../lib/types';
import { panesOf, useApp } from '../store/app';
import { ButtonBar } from './ButtonBar';
import { ComposeBar } from './ComposeBar';
import { HistoryPanel } from './HistoryPanel';
import { StatusBar } from './StatusBar';

/**
 * The frame of a terminal tab: history panel, button bar, compose bar and
 * status bar around an empty area. The terminals themselves live in the
 * TerminalLayer and are placed over that area, so moving a terminal between
 * tabs (split / unsplit) never restarts it.
 */
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

  // report where the terminal area is, so the terminal layer can place the panes
  useLayoutEffect(() => {
    if (!active) return;
    const el = areaRef.current;
    const views = el?.closest('.views');
    if (!el || !views) return;
    const measure = () => {
      const a = el.getBoundingClientRect();
      const v = views.getBoundingClientRect();
      const next = { x: Math.round(a.left - v.left), y: Math.round(a.top - v.top), w: Math.round(a.width), h: Math.round(a.height) };
      const cur = useApp.getState().paneArea;
      if (cur.x !== next.x || cur.y !== next.y || cur.w !== next.w || cur.h !== next.h) useApp.setState({ paneArea: next });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(views);
    return () => ro.disconnect();
  }, [active]);

  return (
    <div className="terminal-view" style={{ display: active ? 'flex' : 'none' }}>
      <div className="terminal-row">
        <div className={`pane-area${panes.length > 1 && !zoomed ? ' split' : ''}`} ref={areaRef} />
        {historyPanel && active && <HistoryPanel tab={focused} />}
      </div>
      {buttonBarVisible && <ButtonBar tab={focused} />}
      {composeOpen && active && <ComposeBar tab={focused} />}
      <StatusBar tab={focused} panes={panes.length} zoomed={!!zoomed} />
    </div>
  );
}
