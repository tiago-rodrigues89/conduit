'use strict';
// Export/import of everything Conduit stores (a ".conduit" backup file), and
// export of SSH sessions as an OpenSSH config file.

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { encryptJson, decryptJson } = require('./vault');

const COLLECTIONS = ['sessions', 'credentials', 'snippets', 'automation', 'settings'];

function localData() {
  const all = store.loadAll();
  return {
    sessions: all.sessions || { version: 1, items: [] },
    credentials: all.credentials || [],
    snippets: all.snippets || [],
    automation: all.automation || { version: 1, buttonBars: [], triggers: [], workspaces: [] },
    settings: all.settings || {},
  };
}

function allSecrets() {
  const out = {};
  for (const id of store.secretIds()) {
    if (id.startsWith('sync:')) continue;
    const s = store.getSecret(id);
    if (s.password || s.passphrase) out[id] = { password: s.password || null, passphrase: s.passphrase || null };
  }
  return out;
}

function summary(data) {
  const items = (data.sessions && data.sessions.items) || [];
  const a = data.automation || {};
  return {
    sessions: items.filter((i) => i.kind === 'session').length,
    folders: items.filter((i) => i.kind === 'folder').length,
    credentials: (data.credentials || []).length,
    snippets: (data.snippets || []).length,
    buttonBars: (a.buttonBars || []).length,
    triggers: (a.triggers || []).length,
    workspaces: (a.workspaces || []).length,
    secrets: data.secrets ? Object.keys(data.secrets).length : 0,
    settings: !!(data.settings && Object.keys(data.settings).length),
  };
}

/** Builds the backup file content. Secrets are only included with a passphrase. */
function buildBackup({ includeSecrets, includeSettings, passphrase, version }) {
  const data = localData();
  if (!includeSettings) delete data.settings;
  if (includeSecrets) {
    if (!passphrase) throw new Error('A passphrase is needed to include passwords');
    data.secrets = allSecrets();
  }
  const head = { format: 'conduit-backup', version: 1, app: version, created: new Date().toISOString(), summary: summary(data) };
  if (passphrase) return { ...head, encrypted: true, ...encryptJson(data, passphrase) };
  return { ...head, encrypted: false, data };
}

function readBackupFile(file) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error('This is not a Conduit backup file');
  }
  if (doc.format !== 'conduit-backup') throw new Error('This is not a Conduit backup file');
  return doc;
}

function openBackup(file, passphrase) {
  const doc = readBackupFile(file);
  if (!doc.encrypted) return { doc, data: doc.data };
  if (!passphrase) return { doc, data: null };
  return { doc, data: decryptJson(doc, passphrase) };
}

function mergeById(current, incoming) {
  const map = new Map((current || []).map((x) => [x.id, x]));
  for (const x of incoming || []) map.set(x.id, x);
  return [...map.values()];
}

/**
 * Applies a backup. 'merge' adds and updates entries by id; 'replace' swaps
 * everything. The current files are copied to a backup folder first.
 */
function applyBackup(data, { mode, settings, secrets }) {
  const backupDir = store.backupFiles('before-import');
  const cur = localData();
  const next = {};
  const items = (data.sessions && data.sessions.items) || [];
  if (mode === 'replace') {
    next.sessions = { version: 1, items };
    next.credentials = data.credentials || [];
    next.snippets = data.snippets || [];
    next.automation = { version: 1, buttonBars: [], triggers: [], workspaces: [], ...(data.automation || {}) };
  } else {
    next.sessions = { version: 1, items: mergeById(cur.sessions.items, items) };
    next.credentials = mergeById(cur.credentials, data.credentials);
    next.snippets = mergeById(cur.snippets, data.snippets);
    const a = data.automation || {};
    next.automation = {
      version: 1,
      buttonBars: mergeById(cur.automation.buttonBars, a.buttonBars),
      triggers: mergeById(cur.automation.triggers, a.triggers),
      workspaces: mergeById(cur.automation.workspaces, a.workspaces),
    };
  }
  if (settings && data.settings) next.settings = { ...cur.settings, ...data.settings };
  for (const key of COLLECTIONS) if (next[key]) store.save(key, next[key]);
  let secretCount = 0;
  if (secrets && data.secrets) {
    for (const [id, s] of Object.entries(data.secrets)) {
      if (id.startsWith('sync:')) continue;
      store.setSecret(id, { password: s.password || null, passphrase: s.passphrase || null });
      secretCount++;
    }
  }
  return { data: next, backupDir, secrets: secretCount };
}

// ---- OpenSSH config ------------------------------------------------------------------------

function sshConfig() {
  const { sessions, credentials } = localData();
  const items = sessions.items || [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const creds = new Map((credentials || []).map((c) => [c.id, c]));
  const ssh = items.filter((i) => i.kind === 'session' && i.type === 'ssh' && i.host);
  const used = new Set();
  const alias = new Map();
  for (const s of ssh) {
    let base = String(s.name || s.host).trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._@-]/g, '') || s.host;
    let a = base;
    for (let n = 2; used.has(a.toLowerCase()); n++) a = `${base}-${n}`;
    used.add(a.toLowerCase());
    alias.set(s.id, a);
  }
  const folderPath = (id) => {
    const parts = [];
    let cur = id ? byId.get(id) : null;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return parts.join(' / ');
  };
  const lines = [`# Exported from Conduit on ${new Date().toISOString().slice(0, 10)}`, '# Passwords are not part of this file.', ''];
  for (const s of ssh) {
    const cred = s.credentialId ? creds.get(s.credentialId) : null;
    const user = s.username || (cred && cred.username) || '';
    const key = s.keyPath || (cred && cred.keyPath) || '';
    const folder = folderPath(s.parentId);
    if (folder) lines.push(`# ${folder}`);
    lines.push(`Host ${alias.get(s.id)}`);
    lines.push(`  HostName ${s.host}`);
    if (Number(s.port) && Number(s.port) !== 22) lines.push(`  Port ${s.port}`);
    if (user) lines.push(`  User ${user}`);
    if (key) lines.push(`  IdentityFile ${/\s/.test(key) ? `"${key}"` : key}`);
    if (s.jumpHostId && alias.has(s.jumpHostId)) lines.push(`  ProxyJump ${alias.get(s.jumpHostId)}`);
    for (const f of s.forwards || []) {
      if (f.enabled === false || !f.bindPort) continue;
      const bind = `${f.bindHost || '127.0.0.1'}:${f.bindPort}`;
      if (f.type === 'dynamic') lines.push(`  DynamicForward ${bind}`);
      else lines.push(`  ${f.type === 'remote' ? 'RemoteForward' : 'LocalForward'} ${bind} ${f.destHost || 'localhost'}:${f.destPort}`);
    }
    if (Number(s.keepAlive) > 0) lines.push(`  ServerAliveInterval ${s.keepAlive}`);
    if (s.legacyAlgorithms) lines.push('  # needs legacy algorithms (old device)');
    lines.push('');
  }
  return { text: lines.join('\n'), count: ssh.length };
}

function writeFile(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

module.exports = { buildBackup, openBackup, applyBackup, summary, sshConfig, writeFile, localData, allSecrets };
