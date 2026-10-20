import { api } from './api';
import { newSession } from './defaults';
import type { SessionItem } from './types';
import { confirm, ensureFolderPath, saveItem, toast, useApp } from '../store/app';

function findSame(parentId: string | null, host: string, port: number, username: string, name: string) {
  return useApp
    .getState()
    .items.find(
      (i): i is SessionItem =>
        i.kind === 'session' && i.parentId === parentId && i.host === host && i.port === port && i.username === username && i.name === name
    );
}

export async function importFromSshConfig() {
  let hosts;
  try {
    hosts = await api.importer.sshConfig();
  } catch (err: any) {
    return toast('error', `Could not read ~/.ssh/config: ${err.message}`);
  }
  if (!hosts.length) return toast('info', 'No hosts found in ~/.ssh/config');
  const ok = await confirm({
    title: `Import ${hosts.length} host${hosts.length > 1 ? 's' : ''}?`,
    message: 'Hosts from ~/.ssh/config are added to a folder named “SSH config”. Existing entries are skipped.',
    detail: hosts.slice(0, 12).map((h) => `${h.name}  →  ${h.username ? h.username + '@' : ''}${h.host}${h.port !== 22 ? ':' + h.port : ''}`).join('\n') + (hosts.length > 12 ? '\n…' : ''),
    confirmLabel: 'Import',
  });
  if (!ok) return;
  const folderId = ensureFolderPath(['SSH config']);
  const byAlias = new Map<string, SessionItem>();
  let added = 0;
  for (const h of hosts) {
    const existing = findSame(folderId, h.host, h.port, h.username, h.name);
    if (existing) {
      byAlias.set(h.name, existing);
      continue;
    }
    const s = newSession({ name: h.name, host: h.host, port: h.port, username: h.username, keyPath: h.keyPath, parentId: folderId });
    saveItem(s);
    byAlias.set(h.name, s);
    added++;
  }
  // ProxyJump: link to the imported alias, or create a session for user@host:port
  for (const h of hosts) {
    if (!h.jump) continue;
    const s = byAlias.get(h.name);
    if (!s || s.jumpHostId) continue;
    let jump = byAlias.get(h.jump);
    if (!jump) {
      const m = h.jump.match(/^(?:([^@]+)@)?([^:]+)(?::(\d+))?$/);
      if (!m) continue;
      jump = findSame(folderId, m[2], Number(m[3]) || 22, m[1] || '', m[2]) || newSession({ name: m[2], host: m[2], port: Number(m[3]) || 22, username: m[1] || '', parentId: folderId });
      saveItem(jump);
      byAlias.set(h.jump, jump);
    }
    saveItem({ ...useApp.getState().items.find((i) => i.id === s.id)!, jumpHostId: jump.id } as SessionItem);
  }
  toast('success', added ? `Imported ${added} session${added > 1 ? 's' : ''} from ~/.ssh/config` : 'Everything was already imported');
}

export async function importFromMobaXterm() {
  let res;
  try {
    res = await api.importer.mobaxterm();
  } catch (err: any) {
    return toast('error', `Could not read the file: ${err.message}`);
  }
  if (!res) return;
  const skippedText = Object.entries(res.skipped)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  if (!res.sessions.length) return toast('info', `No supported sessions found${skippedText ? ` (skipped ${skippedText})` : ''}`);
  const ok = await confirm({
    title: `Import ${res.sessions.length} MobaXterm session${res.sessions.length > 1 ? 's' : ''}?`,
    message: `Sessions keep their folders inside a new “MobaXterm” folder.${skippedText ? ` Not supported and skipped: ${skippedText}.` : ''}`,
    detail:
      res.sessions
        .slice(0, 12)
        .map((s) => `${[...s.folder, s.name].join(' / ')}  →  ${s.username ? s.username + '@' : ''}${s.host}`)
        .join('\n') + (res.sessions.length > 12 ? '\n…' : ''),
    confirmLabel: 'Import',
  });
  if (!ok) return;
  let added = 0;
  for (const m of res.sessions) {
    const folderId = ensureFolderPath(['MobaXterm', ...m.folder]);
    if (findSame(folderId, m.host, m.port, m.username, m.name)) continue;
    let jumpHostId = '';
    if (m.gateway) {
      const gwName = `${m.gateway.host} (gateway)`;
      const gw =
        findSame(folderId, m.gateway.host, m.gateway.port, m.gateway.username, gwName) ||
        newSession({ name: gwName, host: m.gateway.host, port: m.gateway.port, username: m.gateway.username, parentId: folderId });
      saveItem(gw);
      jumpHostId = gw.id;
    }
    saveItem(
      newSession({
        type: m.type || 'ssh',
        name: m.name,
        host: m.host,
        port: m.port,
        username: m.username,
        keyPath: m.keyPath,
        initCommand: m.initCommand,
        jumpHostId,
        parentId: folderId,
      })
    );
    added++;
  }
  toast('success', added ? `Imported ${added} MobaXterm session${added > 1 ? 's' : ''}` : 'Everything was already imported');
}
