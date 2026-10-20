import { ArrowDown, ArrowUp, Clock, Columns2, Cpu, FileText, FolderSync, HardDrive, Highlighter, Maximize2, MemoryStick, PanelRight, PencilLine, Radio, Server, Waypoints } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatBytes } from '../lib/format';
import type { TerminalTab } from '../lib/types';
import { sessionTarget } from '../lib/sessionTypes';
import { setCompose, sessionById, toggleZoomPane, updateSettings, useApp } from '../store/app';
import { api } from '../lib/api';
import { shortPath, stopLog } from '../lib/logging';
import { terminals } from '../lib/terminals';
import type { ServerStats } from '../lib/types';

interface Props {
  /** the focused terminal of the tab */
  tab: TerminalTab;
  /** number of panes in the tab */
  panes: number;
  zoomed: boolean;
}

const STATUS_LABEL: Record<TerminalTab['status'], string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  closed: 'Disconnected',
  error: 'Failed',
};

function label(tab: TerminalTab) {
  const session = sessionById(tab.sessionId);
  if (tab.mode === 'ssh') {
    const spec = tab.spec;
    return `${spec?.username ? spec.username + '@' : ''}${spec?.host}${spec && spec.port !== 22 ? ':' + spec.port : ''}`;
  }
  if (tab.mode === 'telnet') return `telnet · ${session ? sessionTarget(session) : ''}`;
  if (tab.mode === 'serial') return session ? sessionTarget(session) : 'Serial';
  if (session?.type === 'command' || session?.type === 'ssm') return sessionTarget(session);
  return 'Local shell';
}

export function StatusBar({ tab, panes, zoomed }: Props) {
  const broadcast = useApp((s) => s.broadcast);
  const ui = useApp((s) => s.termUi[tab.id]);
  const composeOpen = useApp((s) => s.compose.open);
  const size = { cols: ui?.cols || 0, rows: ui?.rows || 0 };
  const highlight = ui?.highlight ?? true;
  const term = () => terminals.get(tab.id);
  const stats = useApp((s) => (tab.connId && s.settings.monitoring ? s.stats[tab.connId] : undefined));
  const historyOpen = useApp((s) => s.settings.historyPanel);
  const defaultSize = useApp((s) => s.settings.fontSize);
  const fontSize = ui?.fontSize ?? defaultSize;
  const logMenu = async () => {
    if (!tab.logFile) return;
    const choice = await api.popupMenu([
      { label: shortPath(tab.logFile), enabled: false },
      { type: 'separator' },
      { id: 'show', label: 'Show in Finder' },
      { id: 'open', label: 'Open Log' },
      { type: 'separator' },
      { id: 'stop', label: 'Stop Logging' },
    ]);
    if (choice === 'show') api.fs.reveal(tab.logFile);
    if (choice === 'open') api.fs.open(tab.logFile);
    if (choice === 'stop') stopLog(tab.id, true);
  };
  const spec = tab.spec;
  const tunnels = spec?.forwards?.filter((f) => f.enabled !== false).length || 0;

  return (
    <div className="statusbar">
      <div className="statusbar-left">
        <span className={`status-dot ${tab.status}`} />
        <span className="statusbar-strong">{label(tab)}</span>
        <span className="statusbar-muted status-label">{STATUS_LABEL[tab.status]}</span>
        {tab.shellUser && tab.loginUser && tab.shellUser !== tab.loginUser && (
          <span className={`statusbar-chip ${tab.shellUser === 'root' ? 'danger' : 'warn'}`} title={`The terminal runs as ${tab.shellUser} (sudo/su)`}>
            as {tab.shellUser}
          </span>
        )}
        {spec?.jump && <span className="statusbar-muted">via {spec.jump.host}</span>}
        {tab.cwd && (
          <span className="statusbar-cwd" title={tab.integrated ? 'Folder is followed by the Files panel' : undefined}>
            {tab.integrated && <FolderSync size={12} />}
            {tab.cwd}
          </span>
        )}
      </div>
      {stats && tab.status === 'connected' && tab.connId && <Monitor stats={stats} connId={tab.connId} />}
      <div className="statusbar-right">
        {tunnels > 0 && tab.status === 'connected' && (
          <span className="statusbar-chip" title="Port forwarding active">
            <Waypoints size={12} /> {tunnels} tunnel{tunnels > 1 ? 's' : ''}
          </span>
        )}
        {broadcast && (
          <span className="statusbar-chip warn" title="Typing is sent to every connected terminal (⇧⌘B)">
            <Radio size={12} /> Broadcast
          </span>
        )}
        {tab.logFile && (
          <button className="statusbar-chip btn rec" onClick={logMenu} title={`Logging to ${shortPath(tab.logFile)}`}>
            <FileText size={12} /> Log
          </button>
        )}
        {panes > 1 && (
          <button className={`statusbar-chip btn${zoomed ? ' on' : ''}`} onClick={() => toggleZoomPane(tab.id)} title={zoomed ? 'Show all panes (⇧⌘↩)' : 'Maximize this pane (⇧⌘↩)'}>
            {zoomed ? <Maximize2 size={12} /> : <Columns2 size={12} />} {panes} panes
          </button>
        )}
        <button className={`statusbar-chip btn hl-chip${highlight ? ' on' : ''}`} onClick={() => term()?.toggleHighlight()} title="Syntax highlighting (⇧⌘H)">
          <Highlighter size={12} /> <span className="chip-text">Highlight</span>
        </button>
        {fontSize !== defaultSize && (
          <button className="statusbar-chip btn" onClick={() => term()?.zoom('reset')} title="Reset text size (⌘0)">
            {Math.round((fontSize / defaultSize) * 100)}%
          </button>
        )}
        <span className="statusbar-muted mono size-label">
          {size.cols}×{size.rows}
        </span>
        <button
          className={`statusbar-chip btn compose-chip${composeOpen ? ' on' : ''}`}
          onClick={() => setCompose({ open: !composeOpen })}
          title="Compose a command and send it to one or more terminals (⇧⌘E)"
        >
          <PencilLine size={12} /> <span className="chip-text">Compose</span>
        </button>
        <button
          className={`statusbar-chip btn${historyOpen ? ' on' : ''}`}
          onClick={() => updateSettings({ historyPanel: !historyOpen })}
          title="Command history (⇧⌘Y)"
        >
          <PanelRight size={12} /> <span className="chip-text">History</span>
        </button>
      </div>
    </div>
  );
}

function level(pct: number) {
  return pct >= 90 ? 'high' : pct >= 70 ? 'mid' : 'low';
}

function Meter({ pct }: { pct: number }) {
  return (
    <span className={`mon-meter ${level(pct)}`}>
      <i style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
    </span>
  );
}

function duration(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

const short = (n: number) => formatBytes(n).replace(' ', '');

/** "Red Hat Enterprise Linux 9.8 (Plow)" -> "RHEL 9.8" for the compact bar. */
function shortOs(os: string) {
  return os
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/^Red Hat Enterprise Linux( Server)?/i, 'RHEL')
    .replace(/^SUSE Linux Enterprise Server/i, 'SLES')
    .replace(/^Debian GNU\/Linux/i, 'Debian')
    .replace(/ LTS$/, '')
    .trim();
}

/** CPU, memory, disk, network and uptime of the server (MobaXterm-style). */
function Monitor({ stats: s, connId }: { stats: ServerStats; connId: string }) {
  const [card, setCard] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const memPct = s.mem ? (s.mem.used / s.mem.total) * 100 : 0;
  const diskPct = s.disk ? (s.disk.used / s.disk.total) * 100 : 0;
  return (
    <div
      ref={ref}
      className="statusbar-monitor"
      onMouseEnter={() => setCard(ref.current?.getBoundingClientRect() || null)}
      onMouseLeave={() => setCard(null)}
    >
      {s.os && (
        <span className="mon mon-os-chip">
          <Server size={12} />
          <span className="mon-os">{shortOs(s.os)}</span>
        </span>
      )}
      {s.cpu !== undefined ? (
        <span className="mon">
          <Cpu size={12} />
          <span className="mon-val">{Math.round(s.cpu)}%</span>
          <Meter pct={s.cpu} />
        </span>
      ) : (
        s.load && (
          <span className="mon">
            <Cpu size={12} />
            <span className="mon-val">{s.load[0].toFixed(2)}</span>
          </span>
        )
      )}
      {s.mem && (
        <span className="mon">
          <MemoryStick size={12} />
          <span className="mon-val">
            {short(s.mem.used)}
            <span className="mon-total">/{short(s.mem.total)}</span>
          </span>
          <Meter pct={memPct} />
        </span>
      )}
      {s.disk && (
        <span className="mon">
          <HardDrive size={12} />
          <span className="mon-val">{Math.round(diskPct)}%</span>
          <Meter pct={diskPct} />
        </span>
      )}
      {s.rx !== undefined && s.tx !== undefined && (
        <span className="mon mon-net">
          <ArrowDown size={11} />
          <span className="mon-val">{short(s.rx)}/s</span>
          <ArrowUp size={11} />
          <span className="mon-val">{short(s.tx)}/s</span>
        </span>
      )}
      {s.uptime !== undefined && (
        <span className="mon mon-uptime">
          <Clock size={12} />
          <span className="mon-val">{duration(s.uptime)}</span>
        </span>
      )}
      {card && createPortal(<MonitorCard stats={s} connId={connId} anchor={card} />, document.body)}
    </div>
  );
}

function Spark({ values, max, color }: { values: (number | undefined)[]; max?: number; color: string }) {
  const pts = values.map((v) => v ?? 0);
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 120 28" />;
  const top = Math.max(max ?? 0, ...pts, 1);
  const step = 120 / (pts.length - 1);
  const line = pts.map((v, i) => `${(i * step).toFixed(1)},${(27 - (v / top) * 25).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 120 28" preserveAspectRatio="none">
      <polygon points={`0,28 ${line} 120,28`} fill={color} opacity="0.14" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className={`card-bar ${level(pct)}`}>
      <i style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </span>
  );
}

/** Detail card shown while hovering the monitor in the status bar. */
function MonitorCard({ stats: s, connId, anchor }: { stats: ServerStats; connId: string; anchor: DOMRect }) {
  const hist = useApp((st) => st.statsHistory[connId]) || [];
  const memPct = s.mem ? (s.mem.used / s.mem.total) * 100 : 0;
  const diskPct = s.disk ? (s.disk.used / s.disk.total) * 100 : 0;
  const width = 360;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, anchor.right - width));
  return (
    <div className="monitor-card" style={{ left, bottom: window.innerHeight - anchor.top + 8, width }}>
      <div className="mc-head">
        <Server size={16} />
        <div>
          <div className="mc-os">{s.os || 'Server'}</div>
          <div className="mc-sub">
            {[s.hostname, s.kernel, s.cores ? `${s.cores} cores` : '', s.uptime !== undefined ? `up ${duration(s.uptime)}` : '']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>
      {(s.cpu !== undefined || s.load) && (
        <div className="mc-row">
          <div className="mc-label">
            <Cpu size={13} /> CPU
          </div>
          <div className="mc-main">
            <div className="mc-value">
              {s.cpu !== undefined ? `${s.cpu.toFixed(1)}%` : '—'}
              {s.load && <span className="mc-dim">load {s.load.map((l) => l.toFixed(2)).join(' · ')}</span>}
            </div>
            <Spark values={hist.map((h) => h.cpu)} max={100} color="var(--accent)" />
          </div>
        </div>
      )}
      {s.mem && (
        <div className="mc-row">
          <div className="mc-label">
            <MemoryStick size={13} /> Memory
          </div>
          <div className="mc-main">
            <div className="mc-value">
              {formatBytes(s.mem.used)} <span className="mc-dim">of {formatBytes(s.mem.total)} · {Math.round(memPct)}%</span>
            </div>
            <Bar pct={memPct} />
            {s.swap && s.swap.total > 0 && (
              <div className="mc-dim small-line">
                Swap {formatBytes(s.swap.used)} of {formatBytes(s.swap.total)}
              </div>
            )}
          </div>
        </div>
      )}
      {s.disk && (
        <div className="mc-row">
          <div className="mc-label">
            <HardDrive size={13} /> Disk /
          </div>
          <div className="mc-main">
            <div className="mc-value">
              {formatBytes(s.disk.used)}{' '}
              <span className="mc-dim">
                of {formatBytes(s.disk.total)} · {formatBytes(s.disk.total - s.disk.used)} free
              </span>
            </div>
            <Bar pct={diskPct} />
          </div>
        </div>
      )}
      {s.rx !== undefined && s.tx !== undefined && (
        <div className="mc-row">
          <div className="mc-label">
            <ArrowDown size={13} /> Network
          </div>
          <div className="mc-main">
            <div className="mc-value">
              ↓ {formatBytes(s.rx)}/s <span className="mc-dim">↑ {formatBytes(s.tx)}/s</span>
            </div>
            <Spark values={hist.map((h) => (h.rx || 0) + (h.tx || 0))} color="var(--ansi-cyan)" />
          </div>
        </div>
      )}
      <div className="mc-foot">Updated every 3 seconds · last {Math.max(1, Math.round((hist.length * 3) / 60))} min shown</div>
    </div>
  );
}
