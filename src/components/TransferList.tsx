import { ArrowDownToLine, ArrowUpFromLine, Check, CircleX, FolderOpen, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatBytes, formatSpeed } from '../lib/format';
import type { TransferJob } from '../lib/types';
import { clearFinishedTransfers, useApp } from '../store/app';

const finished = (j: TransferJob) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled';

export function TransferList({ connId, compact }: { connId?: string; compact?: boolean }) {
  const all = useApp((s) => s.transfers);
  const jobs = Object.values(all)
    .filter((j) => !connId || j.connId.split('|')[0] === connId)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (!jobs.length) return compact ? null : <div className="transfers-empty">Transfers appear here. Drag files between the panes to copy them.</div>;
  const visible = compact ? jobs.filter((j) => !finished(j) || Date.now() - (j.finishedAt || 0) < 8000).slice(0, 4) : jobs;
  if (!visible.length) return null;

  return (
    <div className={`transfers${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="transfers-head">
          <span>Transfers</span>
          <button className="link-btn" onClick={() => clearFinishedTransfers(connId)}>
            Clear finished
          </button>
        </div>
      )}
      <div className="transfers-list">
        {visible.map((j) => {
          const pct = j.totalBytes ? Math.min(100, (j.doneBytes / j.totalBytes) * 100) : j.status === 'done' ? 100 : 0;
          const Icon = j.direction === 'upload' ? ArrowUpFromLine : ArrowDownToLine;
          return (
            <div key={j.id} className={`transfer ${j.status}`}>
              <Icon size={14} className="transfer-icon" />
              <div className="transfer-main">
                <div className="transfer-line">
                  <span className="transfer-name" title={j.sources.join('\n')}>
                    {j.label}
                  </span>
                  <span className="transfer-meta">
                    {j.status === 'running' && (
                      <>
                        {formatBytes(j.doneBytes)} / {formatBytes(j.totalBytes)}
                        {!compact && j.speed > 0 && <> · {formatSpeed(j.speed)}</>}
                      </>
                    )}
                    {j.status === 'queued' && 'Queued'}
                    {j.status === 'scanning' && 'Preparing…'}
                    {j.status === 'done' && (j.files > 1 ? `${j.files} files · ${formatBytes(j.totalBytes)}` : formatBytes(j.totalBytes))}
                    {j.status === 'cancelled' && 'Cancelled'}
                    {j.status === 'error' && <span title={j.error || ''}>{j.error || 'Failed'}</span>}
                  </span>
                </div>
                {!finished(j) && (
                  <div className="progress">
                    <div className={`progress-bar${j.status !== 'running' ? ' indeterminate' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {!compact && j.status === 'running' && j.files > 1 && (
                  <div className="transfer-sub">
                    {j.filesDone}/{j.files} · {j.current}
                  </div>
                )}
              </div>
              {finished(j) ? (
                j.status === 'done' ? (
                  j.direction === 'download' ? (
                    <button className="icon-btn xs" title="Show in Finder" onClick={() => api.fs.open(j.targetDir)}>
                      <FolderOpen size={13} />
                    </button>
                  ) : (
                    <Check size={14} className="transfer-ok" />
                  )
                ) : j.status === 'error' ? (
                  <CircleX size={14} className="transfer-err" />
                ) : null
              ) : (
                <button className="icon-btn xs" title="Cancel" onClick={() => api.transfer.cancel(j.id)}>
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
