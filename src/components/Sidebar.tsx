import { FolderTree, PanelLeftClose, ScrollText, Server } from 'lucide-react';
import { chooseSidebarPanel, updateSettings, useApp, type SidebarPanel } from '../store/app';
import { FilesPanel } from './FilesPanel';
import { SessionTree } from './SessionTree';
import { SnippetsPanel } from './SnippetsPanel';

const PANELS: { id: SidebarPanel; label: string; icon: typeof Server }[] = [
  { id: 'sessions', label: 'Sessions', icon: Server },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'snippets', label: 'Snippets', icon: ScrollText },
];

export function Sidebar() {
  const panel = useApp((s) => s.sidebarPanel);
  const width = useApp((s) => s.settings.sidebarWidth);
  const filesAvailable = useApp((s) => {
    const t = s.tabs.find((x) => x.id === s.activeTabId);
    return !!t && (t.kind === 'terminal' ? t.mode === 'ssh' && t.status === 'connected' : t.kind === 'sftp' && t.status === 'connected');
  });

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    let next = startW;
    const move = (ev: MouseEvent) => {
      next = Math.min(560, Math.max(210, startW + ev.clientX - startX));
      document.documentElement.style.setProperty('--sidebar-w', `${next}px`);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
      updateSettings({ sidebarWidth: next });
    };
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top drag">
        <span className="traffic-space" />
        <button className="icon-btn sm no-drag" title="Hide sidebar (⌘B)" onClick={() => updateSettings({ sidebarVisible: false })}>
          <PanelLeftClose size={16} />
        </button>
      </div>
      <div className="segmented sidebar-tabs">
        {PANELS.map((p) => (
          <button
            key={p.id}
            className={`segment${panel === p.id ? ' active' : ''}`}
            onClick={() => chooseSidebarPanel(p.id)}
          >
            <p.icon size={14} />
            <span>{p.label}</span>
            {p.id === 'files' && filesAvailable && panel !== 'files' && <span className="segment-dot" />}
          </button>
        ))}
      </div>
      <div className="sidebar-content">
        {panel === 'sessions' && <SessionTree />}
        {panel === 'files' && <FilesPanel />}
        {panel === 'snippets' && <SnippetsPanel />}
      </div>
      <div className="sidebar-resizer" onMouseDown={startResize} />
    </aside>
  );
}
