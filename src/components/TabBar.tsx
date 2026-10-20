import { useRef, useState } from 'react';
import { Columns2, FolderTree, House, LoaderCircle, PanelLeft, Plus, Radio, Settings, SquareTerminal, X } from 'lucide-react';
import { api } from '../lib/api';
import { typeInfo } from '../lib/sessionTypes';
import { dnd } from '../lib/dnd';
import type { Tab, TerminalTab } from '../lib/types';
import {
  activateTab,
  closeTab,
  duplicateTab,
  inputDialog,
  moveTab,
  openDialog,
  openLocal,
  openSession,
  openSftp,
  panesOf,
  reconnectTab,
  rootOf,
  sessionById,
  rootTabs,
  splitPane,
  unsplitTab,
  separatePanes,
  canMoveIntoSplit,
  moveTabIntoSplit,
  updateSettings,
  updateTab,
  useApp,
} from '../store/app';

const TAB_MIME = 'application/x-conduit-tab';

function TabIcon({ tab, status, split }: { tab: Tab; status: string; split: boolean }) {
  if (tab.kind === 'home') return <House size={14} />;
  if (status === 'connecting') return <LoaderCircle size={14} className="spin" />;
  const Icon = tab.kind === 'sftp' ? FolderTree : split ? Columns2 : SquareTerminal;
  return <Icon size={14} />;
}

/** Status of a tab with split panes: connecting if one is, closed only when all are. */
function groupStatus(panes: TerminalTab[]) {
  if (panes.some((p) => p.status === 'connecting')) return 'connecting';
  if (panes.some((p) => p.status === 'connected')) return 'connected';
  return panes.some((p) => p.status === 'error') ? 'error' : 'closed';
}

export async function newTabMenu() {
  const { items } = useApp.getState();
  const recent = items
    .filter((i) => i.kind === 'session' && i.lastUsed)
    .sort((a: any, b: any) => b.lastUsed - a.lastUsed)
    .slice(0, 8);
  const choice = await api.popupMenu([
    { id: 'local', label: 'Local Terminal', accelerator: 'Cmd+T' },
    { id: 'quick', label: 'Quick Connect…', accelerator: 'Cmd+L' },
    { id: 'new', label: 'New Session…', accelerator: 'Cmd+N' },
    ...(recent.length
      ? [{ type: 'separator' as const }, ...recent.map((s) => ({ id: `s:${s.id}`, label: s.name || (s as any).host }))]
      : []),
  ]);
  if (choice === 'local') openLocal();
  if (choice === 'quick') openDialog({ type: 'quick-connect' });
  if (choice === 'new') openDialog({ type: 'session' });
  if (choice?.startsWith('s:')) openSession(choice.slice(2));
}

export function TabBar() {
  const allTabs = useApp((s) => s.tabs);
  const tabs = rootTabs(allTabs);
  const activeTabId = useApp((s) => rootOf(s.activeTabId, s.tabs));
  const sidebarVisible = useApp((s) => s.settings.sidebarVisible);
  const broadcast = useApp((s) => s.broadcast);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const dragging = useRef<string | null>(null);
  // the tab shown before a press: dragging a tab must not switch away from it
  const shownBefore = useRef<string | null>(null);
  // hovering a tab for a moment while dragging switches to it
  const spring = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const stopSpring = () => {
    if (spring.current) clearTimeout(spring.current.timer);
    spring.current = null;
  };
  const resetDrag = () => {
    setDropIndex(null);
    setMergeTarget(null);
    stopSpring();
  };
  /** What a drop on a tab does: merge into it (its middle) or reorder (its edges). */
  const dropMode = (e: React.DragEvent, tab: Tab, i: number): { merge: boolean; index: number | null } | null => {
    const d = dnd.get();
    if (!d) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const canMerge =
      tab.kind === 'terminal' &&
      (d.kind === 'tab'
        ? canMoveIntoSplit(d.id, tab.id)
        : (() => {
            const sess = sessionById(d.id);
            return !!sess && typeInfo(sess.type).opens === 'terminal';
          })());
    if (canMerge && (d.kind === 'session' || (fx > 0.25 && fx < 0.75))) return { merge: true, index: null };
    return { merge: false, index: d.kind === 'tab' ? (fx < 0.5 ? i : i + 1) : null };
  };
  const doDrop = (merge: string | null, index: number | null) => {
    const d = dnd.get();
    if (d && merge) {
      // dropped on the middle of a tab: both side by side in that tab
      activateTab(merge);
      if (d.kind === 'tab') moveTabIntoSplit(d.id, besideIn(merge), 'row');
      else openSession(d.id, { split: 'row', beside: besideIn(merge) });
    } else if (d?.kind === 'tab' && index !== null) {
      const from = tabs.findIndex((t) => t.id === d.id);
      moveTab(d.id, from < index ? index - 1 : index);
    }
    resetDrag();
    dnd.end();
  };

  /** The pane of a tab a dropped tab or session goes next to. */
  const besideIn = (rootId: string) => {
    const f = useApp.getState().focusedPane[rootId];
    return f && panesOf(rootId).some((p) => p.id === f) ? f : rootId;
  };

  const tabMenu = async (tab: Tab) => {
    const idx = tabs.findIndex((t) => t.id === tab.id);
    const isConn = tab.kind !== 'home';
    const choice = await api.popupMenu([
      ...(isConn
        ? [
            { id: 'reconnect', label: 'Reconnect', enabled: !(tab.kind === 'terminal' && tab.mode === 'local' && tab.status === 'connected') },
            { id: 'duplicate', label: 'Duplicate' },
            ...(tab.kind === 'terminal'
              ? [
                  { id: 'split-right', label: 'Split Right' },
                  { id: 'split-down', label: 'Split Down' },
                  ...(panesOf(tab.id).length > 1
                    ? [
                        { id: 'separate', label: 'Unsplit: Every Pane Back to Its Own Tab', accelerator: 'Cmd+Alt+U' },
                        { id: 'unsplit', label: `Close Other Panes (keep the one you are in)`, accelerator: 'Cmd+Alt+W' },
                      ]
                    : []),
                ]
              : []),
            ...(tab.kind === 'terminal' && tab.mode === 'ssh'
              ? [{ id: 'sftp', label: 'Open SFTP Browser', enabled: tab.status === 'connected' }]
              : []),
            { id: 'rename', label: 'Rename Tab…' },
            { type: 'separator' as const },
          ]
        : []),
      { id: 'close', label: 'Close Tab', accelerator: 'Cmd+W' },
      { id: 'close-others', label: 'Close Other Tabs', enabled: tabs.length > 1 },
      { id: 'close-right', label: 'Close Tabs to the Right', enabled: idx < tabs.length - 1 },
    ]);
    switch (choice) {
      case 'reconnect':
        return reconnectTab(tab.id);
      case 'duplicate':
        return duplicateTab(tab.id);
      case 'separate':
        return separatePanes(besideIn(tab.id));
      case 'unsplit': {
        const focus = useApp.getState().focusedPane[tab.id] || tab.id;
        return unsplitTab(panesOf(tab.id).some((p) => p.id === focus) ? focus : tab.id);
      }
      case 'split-right':
      case 'split-down': {
        const focus = useApp.getState().focusedPane[tab.id] || tab.id;
        return splitPane(panesOf(tab.id).some((p) => p.id === focus) ? focus : tab.id, choice === 'split-right' ? 'row' : 'col');
      }
      case 'sftp':
        return openSftp({ fromTabId: tab.id });
      case 'rename': {
        const name = await inputDialog({ title: 'Rename tab', label: 'Tab title', value: tab.title, confirmLabel: 'Rename' });
        if (name?.trim()) updateTab(tab.id, { title: name.trim() });
        return;
      }
      case 'close':
        return closeTab(tab.id);
      case 'close-others':
        for (const t of tabs) if (t.id !== tab.id) await closeTab(t.id);
        return;
      case 'close-right':
        for (const t of tabs.slice(idx + 1)) await closeTab(t.id);
        return;
    }
  };

  return (
    <div className={`tabbar drag${sidebarVisible ? '' : ' no-sidebar'}`}>
      {!sidebarVisible && (
        <>
          <span className="traffic-space" />
          <button className="icon-btn sm no-drag" title="Show sidebar (⌘B)" onClick={() => updateSettings({ sidebarVisible: true })}>
            <PanelLeft size={16} />
          </button>
        </>
      )}
      <div
        className="tabs"
        onDragOver={(e) => {
          if (!dnd.get()) return;
          e.preventDefault();
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) resetDrag();
        }}
        onDrop={(e) => {
          e.preventDefault();
          doDrop(mergeTarget, dropIndex);
        }}
      >
        {tabs.map((tab, i) => {
          const color = tab.kind !== 'home' ? tab.color : undefined;
          const panes = tab.kind === 'terminal' ? panesOf(tab.id, allTabs) : [];
          const status = tab.kind === 'home' ? 'connected' : panes.length > 1 ? groupStatus(panes) : tab.status;
          const attention = panes.some((p) => p.attention);
          return (
            <div
              key={tab.id}
              className={`tab${tab.id === activeTabId ? ' active' : ''} status-${status}${dropIndex === i ? ' drop-before' : ''}${
                dropIndex === tabs.length && i === tabs.length - 1 ? ' drop-after' : ''
              }${mergeTarget === tab.id ? ' merge-target' : ''}`}
              draggable
              onDragStart={(e) => {
                dragging.current = tab.id;
                e.dataTransfer.setData(TAB_MIME, tab.id);
                dnd.start({ kind: 'tab', id: tab.id });
                e.dataTransfer.effectAllowed = 'move';
                // stay on the tab you were looking at, so the dragged one can be dropped onto it
                const before = shownBefore.current;
                if (before && before !== tab.id && useApp.getState().tabs.some((t) => t.id === before)) activateTab(before);
              }}
              onDragEnd={() => {
                dragging.current = null;
                resetDrag();
                dnd.end();
              }}
              onDragOver={(e) => {
                const mode = dropMode(e, tab, i);
                if (!mode) return;
                e.preventDefault();
                e.stopPropagation();
                // the middle of a tab merges, its edges reorder
                const merge = mode.merge ? tab.id : null;
                if (mergeTarget !== merge) setMergeTarget(merge);
                if (dropIndex !== mode.index) setDropIndex(mode.index);
                if (tab.id !== activeTabId && spring.current?.id !== tab.id) {
                  stopSpring();
                  spring.current = { id: tab.id, timer: setTimeout(() => activateTab(tab.id), 650) };
                }
              }}
              onDrop={(e) => {
                const mode = dropMode(e, tab, i);
                if (!mode) return;
                e.preventDefault();
                e.stopPropagation();
                doDrop(mode.merge ? tab.id : null, mode.index);
              }}
              onMouseDown={(e) => {
                shownBefore.current = useApp.getState().tabs.some((t) => t.id === activeTabId) ? activeTabId : null;
                if (e.button === 0) activateTab(tab.id);
              }}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(tab.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                tabMenu(tab);
              }}
              title={tab.kind === 'terminal' && tab.spec ? `${tab.spec.username ? tab.spec.username + '@' : ''}${tab.spec.host}` : tab.title}
            >
              {color && <span className="tab-color" style={{ background: color }} />}
              <span className="tab-icon">
                <TabIcon tab={tab} status={status} split={panes.length > 1} />
              </span>
              <span className="tab-title">{tab.title}</span>
              {panes.length > 1 && <span className="tab-count">{panes.length}</span>}
              {attention && <span className="tab-attention" title="A trigger fired in this tab" />}
              {(status === 'closed' || status === 'error') && <span className="tab-badge">{status === 'error' ? 'failed' : 'closed'}</span>}
              <button
                className="tab-close"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        <button className="icon-btn sm tab-add" title="New tab" onClick={newTabMenu}>
          <Plus size={16} />
        </button>
      </div>
      <div className="tabbar-right no-drag">
        {broadcast && (
          <button className="pill warn" title="Broadcast input is on — click to turn off (⇧⌘B)" onClick={() => useApp.setState({ broadcast: false })}>
            <Radio size={13} /> Broadcast
          </button>
        )}
        <button className="icon-btn sm" title="Settings (⌘,)" onClick={() => openDialog({ type: 'settings' })}>
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
