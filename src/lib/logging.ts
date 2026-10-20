// Session logging: the main process writes a terminal's output to a file.
// Off unless turned on in Settings → Logging or per session.

import { toast, updateTab, useApp } from '../store/app';
import { api } from './api';
import { DEFAULT_LOG_DIR } from './defaults';
import type { SessionItem, TerminalTab } from './types';

export function logEnabledFor(session: SessionItem | undefined) {
  if (session?.logging === 'on') return true;
  if (session?.logging === 'off') return false;
  return useApp.getState().settings.logAuto;
}

export function shortPath(p: string) {
  const home = useApp.getState().info?.home;
  return home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

export async function startLog(t: TerminalTab, session: SessionItem | undefined, manual = false) {
  const s = useApp.getState().settings;
  try {
    const file = await api.log.start(t.id, {
      dir: s.logDir || DEFAULT_LOG_DIR,
      name: s.logName || '{session}_{date}_{time}',
      timestamps: s.logTimestamps,
      raw: s.logRaw,
      session: session?.name || t.title,
      host: t.spec?.host || session?.host || (t.mode === 'local' ? 'local' : t.mode),
      user: t.spec?.username || session?.username || '',
    });
    updateTab(t.id, { logFile: file });
    if (manual) toast('success', `Logging to ${shortPath(file)}`, { label: 'Show in Finder', run: () => api.fs.reveal(file) });
  } catch (err: any) {
    toast('error', `Could not start the log: ${err.message}`);
  }
}

export function stopLog(id: string, manual = false) {
  const t = useApp.getState().tabs.find((x) => x.id === id);
  if (!t || t.kind !== 'terminal' || !t.logFile) return;
  api.log.stop(id).catch(() => {});
  updateTab(id, { logFile: undefined });
  if (manual) toast('info', 'Logging stopped');
}
