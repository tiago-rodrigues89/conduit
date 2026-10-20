import { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive, LoaderCircle, RotateCw, Server } from 'lucide-react';
import { api } from '../lib/api';
import { terminals, type TabEvent } from '../lib/terminals';
import type { SftpTab } from '../lib/types';
import { reconnectTab, updateTab, useApp } from '../store/app';
import { LocalPane } from './LocalPane';
import { RemotePane } from './RemotePane';
import { TransferList } from './TransferList';

/** FileZilla-style dual-pane browser: this Mac on the left, the server on the right. */
export function SftpView({ tab, active }: { tab: SftpTab; active: boolean }) {
  const remoteDir = useApp((s) => s.files[`${tab.id}:remote`]?.path || '');
  const [localDir, setLocalDir] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [split, setSplit] = useState(0.5);
  const lastGen = useRef(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(
    () =>
      terminals.subscribe(tab.id, (e: TabEvent) => {
        if (e.type === 'log') setLog((l) => [...l.slice(-6), e.text]);
      }),
    [tab.id]
  );

  // connect, or borrow the connection of the terminal tab it was opened from
  useEffect(() => {
    if (lastGen.current === tab.generation) return;
    lastGen.current = tab.generation;
    const gen = tab.generation;
    setLog([]);
    (async () => {
      const t = tabRef.current;
      try {
        let connId: string;
        if (t.sourceTabId && t.connId) {
          connId = (await api.ssh.attach(t.id, t.connId)).connId;
        } else {
          connId = (await api.ssh.connect({ holderId: t.id, session: t.spec! })).connId;
        }
        if (tabRef.current.generation !== gen) return;
        updateTab(t.id, { status: 'connected', connId, error: undefined });
      } catch (err: any) {
        if (tabRef.current.generation !== gen) return;
        updateTab(t.id, { status: 'error', connId: undefined, error: err.cancelled ? 'Cancelled' : err.message });
      }
    })();
  }, [tab.generation]);

  useEffect(
    () =>
      api.on('conn:closed', (connId: string, reason: string | null) => {
        const t = tabRef.current;
        if (t.connId === connId) updateTab(t.id, { status: 'closed', connId: undefined, error: reason || 'Connection closed' });
      }),
    []
  );

  const onPathChange = useCallback((p: string) => setLocalDir(p), []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const body = bodyRef.current!;
    const rect = body.getBoundingClientRect();
    const move = (ev: MouseEvent) => setSplit(Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width)));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const spec = tab.spec;
  const host = spec ? `${spec.username ? spec.username + '@' : ''}${spec.host}` : '';

  return (
    <div className="sftp-view" style={{ display: active ? 'flex' : 'none' }}>
      <div className="sftp-body" ref={bodyRef}>
        <div className="sftp-col" style={{ width: `${split * 100}%` }}>
          <LocalPane
            stateKey={`${tab.id}:local`}
            remote={tab.connId && remoteDir ? { connId: tab.connId, dir: remoteDir } : undefined}
            onPathChange={onPathChange}
            title={
              <>
                <HardDrive size={14} /> This Mac
              </>
            }
          />
        </div>
        <div className="sftp-divider" onMouseDown={startDrag} />
        <div className="sftp-col" style={{ width: `${(1 - split) * 100}%` }}>
          {tab.status === 'connected' && tab.connId ? (
            <RemotePane
              key={tab.connId}
              stateKey={`${tab.id}:remote`}
              connId={tab.connId}
              localDir={localDir}
              title={
                <>
                  <Server size={14} /> {host}
                </>
              }
            />
          ) : (
            <div className="pane">
              <div className="pane-title">
                <Server size={14} /> {host}
              </div>
              <div className="panel-empty">
                {tab.status === 'connecting' ? (
                  <>
                    <LoaderCircle size={22} className="spin" />
                    <p>Connecting…</p>
                    {log.map((l, i) => (
                      <p key={i} className="muted small">
                        {l}
                      </p>
                    ))}
                  </>
                ) : (
                  <>
                    <p className={tab.status === 'error' ? 'error-text' : ''}>{tab.error || 'Disconnected'}</p>
                    <button className="btn" onClick={() => reconnectTab(tab.id)}>
                      <RotateCw size={14} /> Reconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="sftp-transfers">
        <TransferList connId={tab.connId} />
      </div>
    </div>
  );
}
