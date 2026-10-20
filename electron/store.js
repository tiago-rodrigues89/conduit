'use strict';
// Persistence for sessions, settings, snippets and secrets.
// Everything lives in the app's userData folder as small JSON files.
// Secrets (passwords / key passphrases) are encrypted with Electron's
// safeStorage, which on macOS is backed by a key stored in the Keychain.

const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const FILES = {
  sessions: 'sessions.json',
  settings: 'settings.json',
  snippets: 'snippets.json',
  credentials: 'credentials.json',
  automation: 'automation.json',
  knownHosts: 'known_hosts.json',
  windowState: 'window-state.json',
  secrets: 'secrets.json',
  syncMeta: 'sync-meta.json',
};

function filePath(key) {
  return path.join(app.getPath('userData'), FILES[key]);
}

function readJson(key, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(key), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(key, data) {
  const target = filePath(key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, target);
}

// ---- public data (renderer owns the shape) ---------------------------------

const PUBLIC_KEYS = new Set(['sessions', 'settings', 'snippets', 'credentials', 'automation']);

function loadAll() {
  return {
    sessions: readJson('sessions', null),
    settings: readJson('settings', null),
    snippets: readJson('snippets', null),
    credentials: readJson('credentials', null),
    automation: readJson('automation', null),
  };
}

function save(key, data) {
  if (!PUBLIC_KEYS.has(key)) throw new Error(`Unknown store key: ${key}`);
  writeJson(key, data);
}

// ---- secrets -----------------------------------------------------------------

let secretsCache = null;

function secrets() {
  if (!secretsCache) secretsCache = readJson('secrets', {});
  return secretsCache;
}

function encrypt(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available');
  return safeStorage.encryptString(value).toString('base64');
}

function decrypt(value) {
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return undefined;
  }
}

/** Update secrets for a session. `undefined` leaves a field alone, `null` removes it. */
function setSecret(id, patch) {
  const all = secrets();
  const entry = { ...(all[id] || {}) };
  for (const field of ['password', 'passphrase']) {
    if (patch[field] === undefined) continue;
    if (patch[field] === null || patch[field] === '') delete entry[field];
    else entry[field] = encrypt(String(patch[field]));
  }
  if (Object.keys(entry).length) all[id] = entry;
  else delete all[id];
  writeJson('secrets', all);
}

function getSecret(id) {
  const entry = id ? secrets()[id] : null;
  if (!entry) return {};
  return {
    password: entry.password ? decrypt(entry.password) : undefined,
    passphrase: entry.passphrase ? decrypt(entry.passphrase) : undefined,
  };
}

function secretFlags(id) {
  const entry = secrets()[id] || {};
  return { password: !!entry.password, passphrase: !!entry.passphrase };
}

function deleteSecret(id) {
  const all = secrets();
  if (all[id]) {
    delete all[id];
    writeJson('secrets', all);
  }
}

/** Ids that have saved secrets (sessions, saved logins, ...). */
function secretIds() {
  return Object.keys(secrets());
}

/** The encrypted form of a secret, to notice changes without decrypting. */
function rawSecret(id) {
  return secrets()[id] ? JSON.stringify(secrets()[id]) : '';
}

/** Copies the data files into a dated backup folder; returns its path. */
function backupFiles(label = 'backup') {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name = `${label}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const dir = path.join(app.getPath('userData'), name);
  fs.mkdirSync(dir, { recursive: true });
  for (const key of ['sessions', 'settings', 'snippets', 'credentials', 'automation', 'knownHosts', 'secrets']) {
    const src = filePath(key);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, FILES[key]));
  }
  return dir;
}

module.exports = {
  secretIds,
  rawSecret,
  backupFiles,
  readJson,
  writeJson,
  loadAll,
  save,
  setSecret,
  getSecret,
  secretFlags,
  deleteSecret,
};
