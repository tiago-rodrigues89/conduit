'use strict';
// Sync between Macs without an account: an encrypted file in a folder the
// user picks (iCloud Drive, Dropbox, a network share). Every record
// (session, folder, saved login, snippet, button bar, trigger, workspace and
// optionally saved passwords) carries the time it last changed; the newest
// version wins. Deleted records leave a tombstone so they stay deleted.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const store = require('./store');
const { resolveDir } = require('./localfs');
const { encryptJson, decryptJson } = require('./vault');

const FILE_NAME = 'Conduit Sync.conduitsync';
const PASSPHRASE_ID = 'sync:passphrase';
const TOMB_TTL = 120 * 24 * 3600 * 1000;
// fields that only describe this Mac's view and never count as a change
const VOLATILE = { item: ['lastUsed', 'expanded'] };

const COLLECTIONS = [
  { prefix: 'item', read: (d) => (d.sessions && d.sessions.items) || [] },
  { prefix: 'cred', read: (d) => d.credentials || [] },
  { prefix: 'snip', read: (d) => d.snippets || [] },
  { prefix: 'bar', read: (d) => (d.automation && d.automation.buttonBars) || [] },
  { prefix: 'trig', read: (d) => (d.automation && d.automation.triggers) || [] },
  { prefix: 'ws', read: (d) => (d.automation && d.automation.workspaces) || [] },
];

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

function hashOf(prefix, data) {
  const copy = { ...data };
  for (const f of VOLATILE[prefix] || []) delete copy[f];
  return crypto.createHash('sha256').update(canonical(copy)).digest('base64');
}

/** Same content, ignoring view state like expanded folders. */
function sameRecord(key, a, b) {
  if (!a || !b || a.at !== b.at) return false;
  return hashOf(key.split(':')[0], a.data) === hashOf(key.split(':')[0], b.data);
}

class SyncEngine {
  constructor({ send }) {
    this.send = send;
    this.config = { enabled: false, dir: '', includeSecrets: false };
    this.timer = null;
    this.watcher = null;
    this.poll = null;
    this.running = null;
    this.lastWriteMtime = 0;
    this.status = { state: 'off' };
  }

  // ---- configuration ---------------------------------------------------------------------

  configure(cfg) {
    const next = { enabled: !!cfg.enabled, dir: String(cfg.dir || ''), includeSecrets: !!cfg.includeSecrets };
    const changed = next.enabled !== this.config.enabled || next.dir !== this.config.dir || next.includeSecrets !== this.config.includeSecrets;
    this.config = next;
    this._watch();
    if (!next.enabled) return this._setStatus({ state: 'off' });
    if (changed) this.schedule(500);
    return this.status;
  }

  hasPassphrase() {
    return !!store.getSecret(PASSPHRASE_ID).password;
  }

  setPassphrase(passphrase) {
    store.setSecret(PASSPHRASE_ID, { password: passphrase || null });
    if (this.config.enabled) this.schedule(300);
  }

  /** Suggested folder: iCloud Drive/Conduit when iCloud Drive is set up. */
  defaultDir() {
    const icloud = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
    return fs.existsSync(icloud) ? path.join(icloud, 'Conduit') : '';
  }

  getStatus() {
    return { ...this.status, hasPassphrase: this.hasPassphrase(), file: this._file() };
  }

  // ---- triggers ------------------------------------------------------------------------------

  /** Local data was saved: sync a few seconds later. */
  localChanged() {
    if (this.config.enabled) this.schedule(3000);
  }

  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow().catch(() => {}), ms);
  }

  _file() {
    return this.config.dir ? path.join(resolveDir(this.config.dir), FILE_NAME) : '';
  }

  _watch() {
    if (this.watcher) {
      try { this.watcher.close(); } catch { /* ignore */ }
      this.watcher = null;
    }
    clearInterval(this.poll);
    this.poll = null;
    if (!this.config.enabled || !this.config.dir) return;
    const dir = resolveDir(this.config.dir);
    try {
      fs.mkdirSync(dir, { recursive: true });
      this.watcher = fs.watch(dir, (_ev, name) => {
        if (!name || String(name).includes('Conduit Sync')) this._remoteMaybeChanged();
      });
      this.watcher.on('error', () => {});
    } catch {
      /* folder not reachable right now; the poll below retries */
    }
    // iCloud and network shares do not always report changes: check now and then
    this.poll = setInterval(() => this._remoteMaybeChanged(), 60000);
  }

  _remoteMaybeChanged() {
    let mtime = 0;
    try {
      mtime = fs.statSync(this._file()).mtimeMs;
    } catch {
      return;
    }
    if (Math.abs(mtime - this.lastWriteMtime) > 1) this.schedule(1500);
  }

  _setStatus(st) {
    this.status = { ...st };
    this.send('sync:status', this.getStatus());
    return this.status;
  }

  // ---- sync ------------------------------------------------------------------------------------

  async syncNow() {
    if (this.running) return this.running;
    this.running = this._sync().finally(() => (this.running = null));
    return this.running;
  }

  async _sync() {
    if (!this.config.enabled) return this._setStatus({ state: 'off' });
    const file = this._file();
    if (!file) return this._setStatus({ state: 'error', message: 'Choose a sync folder' });
    const passphrase = store.getSecret(PASSPHRASE_ID).password;
    if (!passphrase) return this._setStatus({ state: 'error', message: 'Set a sync passphrase' });
    this._setStatus({ ...this.status, state: 'syncing' });
    try {
      const dir = path.dirname(file);
      fs.mkdirSync(dir, { recursive: true });
      await this._ensureDownloaded(file);

      const meta = store.readJson('syncMeta', null) || { records: {}, tombs: {} };
      const local = this._snapshot(meta);

      // the sync file, plus copies iCloud/Dropbox made when two Macs wrote at once
      const remotes = [];
      let salt;
      const conflicts = [];
      for (const name of fs.readdirSync(dir)) {
        if (!/^Conduit Sync.*\.conduitsync$/.test(name)) continue;
        const full = path.join(dir, name);
        const env = JSON.parse(fs.readFileSync(full, 'utf8'));
        if (env.format !== 'conduit-sync') continue;
        remotes.push(decryptJson(env, passphrase));
        if (name === FILE_NAME) salt = env.kdf && env.kdf.salt;
        else conflicts.push(full);
      }

      const merged = { records: { ...local.records }, tombs: { ...local.tombs } };
      for (const r of remotes) mergeInto(merged, r);
      pruneTombs(merged);

      this._applyLocal(local, merged, meta);
      const remoteNeedsWrite = !remotes.length || remotes.length > 1 || differs(remotes[0], merged);
      if (remoteNeedsWrite) {
        const env = { format: 'conduit-sync', version: 1, updated: new Date().toISOString(), device: os.hostname(), ...encryptJson(merged, passphrase, salt) };
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(env), { mode: 0o600 });
        fs.renameSync(tmp, file);
        this.lastWriteMtime = fs.statSync(file).mtimeMs;
        const { shell } = require('electron');
        for (const c of conflicts) await shell.trashItem(c).catch(() => {});
      } else {
        try {
          this.lastWriteMtime = fs.statSync(file).mtimeMs;
        } catch { /* ignore */ }
      }
      return this._setStatus({ state: 'idle', lastSync: Date.now() });
    } catch (err) {
      const message = err.code === 'BAD_PASSPHRASE' ? 'Wrong passphrase for the sync file in this folder' : err.message;
      return this._setStatus({ state: 'error', message, lastSync: this.status.lastSync });
    }
  }

  async _ensureDownloaded(file) {
    // iCloud keeps files it has not downloaded yet as ".name.icloud" placeholders
    const placeholder = path.join(path.dirname(file), `.${path.basename(file)}.icloud`);
    if (fs.existsSync(file) || !fs.existsSync(placeholder)) return;
    await new Promise((resolve) => execFile('/usr/bin/brctl', ['download', file], () => resolve()));
    for (let i = 0; i < 20 && !fs.existsSync(file); i++) await new Promise((r) => setTimeout(r, 500));
    if (!fs.existsSync(file)) throw new Error('Waiting for iCloud to download the sync file');
  }

  /** This Mac's records with the time each last changed (tracked in sync-meta.json). */
  _snapshot(meta) {
    const now = Date.now();
    const data = {
      sessions: store.readJson('sessions', null),
      credentials: store.readJson('credentials', null),
      snippets: store.readJson('snippets', null),
      automation: store.readJson('automation', null),
    };
    const records = {};
    const seen = new Set();
    for (const c of COLLECTIONS) {
      for (const rec of c.read(data)) {
        if (!rec || !rec.id) continue;
        const key = `${c.prefix}:${rec.id}`;
        const hash = hashOf(c.prefix, rec);
        const known = meta.records[key];
        const at = known && known.hash === hash ? known.at : now;
        records[key] = { data: rec, at };
        seen.add(key);
        meta.records[key] = { hash, at };
      }
    }
    if (this.config.includeSecrets) {
      for (const id of store.secretIds()) {
        if (id.startsWith('sync:')) continue;
        const key = `secret:${id}`;
        const hash = crypto.createHash('sha256').update(store.rawSecret(id)).digest('base64');
        const known = meta.records[key];
        const at = known && known.hash === hash ? known.at : now;
        const s = store.getSecret(id);
        records[key] = { data: { password: s.password || null, passphrase: s.passphrase || null }, at };
        seen.add(key);
        meta.records[key] = { hash, at };
      }
    }
    const tombs = { ...(meta.tombs || {}) };
    for (const key of Object.keys(meta.records)) {
      if (seen.has(key)) continue;
      if (key.startsWith('secret:') && !this.config.includeSecrets) continue;
      // gone since the last sync: deleted on this Mac
      tombs[key] = Math.max(tombs[key] || 0, now);
      delete meta.records[key];
    }
    for (const key of seen) if (tombs[key] && tombs[key] < records[key].at) delete tombs[key];
    meta.tombs = tombs;
    return { data, records, tombs };
  }

  /** Writes what changed elsewhere into this Mac's files and tells the window. */
  _applyLocal(local, merged, meta) {
    const changed = new Set();
    const keys = new Set([...Object.keys(local.records), ...Object.keys(merged.records)]);
    for (const key of keys) {
      const a = local.records[key];
      const b = merged.records[key];
      if (!sameRecord(key, a, b)) changed.add(key.split(':')[0]);
    }
    const out = {};
    if (['item', 'cred', 'snip', 'bar', 'trig', 'ws'].some((p) => changed.has(p))) {
      const pick = (prefix, current) => {
        const order = current.map((r) => `${prefix}:${r.id}`);
        for (const key of Object.keys(merged.records)) if (key.startsWith(`${prefix}:`) && !order.includes(key)) order.push(key);
        const byId = new Map(current.map((r) => [r.id, r]));
        return order
          .filter((key) => merged.records[key])
          .map((key) => {
            const rec = { ...merged.records[key].data };
            const mine = byId.get(rec.id);
            // keep this Mac's own view state (expanded folders, recently used)
            if (mine) for (const f of VOLATILE[prefix] || []) if (f in mine) rec[f] = mine[f];
            return rec;
          });
      };
      const cur = local.data;
      const automation = cur.automation || { version: 1 };
      if (changed.has('item')) out.sessions = { version: 1, items: pick('item', (cur.sessions && cur.sessions.items) || []) };
      if (changed.has('cred')) out.credentials = pick('cred', cur.credentials || []);
      if (changed.has('snip')) out.snippets = pick('snip', cur.snippets || []);
      if (changed.has('bar') || changed.has('trig') || changed.has('ws')) {
        out.automation = {
          ...automation,
          version: 1,
          buttonBars: pick('bar', automation.buttonBars || []),
          triggers: pick('trig', automation.triggers || []),
          workspaces: pick('ws', automation.workspaces || []),
        };
      }
      for (const [key, value] of Object.entries(out)) store.save(key, value);
    }
    if (changed.has('secret') && this.config.includeSecrets) {
      for (const key of Object.keys(merged.records)) {
        if (!key.startsWith('secret:')) continue;
        const a = local.records[key];
        const b = merged.records[key];
        if (a && canonical(a.data) === canonical(b.data)) continue;
        store.setSecret(key.slice(7), { password: b.data.password || null, passphrase: b.data.passphrase || null });
      }
      for (const key of Object.keys(local.records)) {
        if (key.startsWith('secret:') && !merged.records[key]) store.deleteSecret(key.slice(7));
      }
    }
    // remember the merged state so it does not count as a local change next time
    const records = {};
    for (const [key, r] of Object.entries(merged.records)) {
      if (key.startsWith('secret:')) {
        if (!this.config.includeSecrets) continue;
        records[key] = { hash: crypto.createHash('sha256').update(store.rawSecret(key.slice(7))).digest('base64'), at: r.at };
      } else records[key] = { hash: hashOf(key.split(':')[0], r.data), at: r.at };
    }
    if (!this.config.includeSecrets) for (const [key, v] of Object.entries(meta.records)) if (key.startsWith('secret:')) records[key] = v;
    store.writeJson('syncMeta', { records, tombs: merged.tombs });
    if (Object.keys(out).length) this.send('store:external', out);
  }
}

function mergeInto(target, remote) {
  for (const [key, r] of Object.entries(remote.records || {})) {
    const mine = target.records[key];
    if (!mine || r.at > mine.at) target.records[key] = r;
  }
  for (const [key, at] of Object.entries(remote.tombs || {})) target.tombs[key] = Math.max(target.tombs[key] || 0, at);
  for (const [key, at] of Object.entries(target.tombs)) {
    if (target.records[key] && target.records[key].at <= at) delete target.records[key];
  }
}

function pruneTombs(merged) {
  const cutoff = Date.now() - TOMB_TTL;
  for (const [key, at] of Object.entries(merged.tombs)) if (at < cutoff) delete merged.tombs[key];
}

function differs(a, b) {
  const ra = a.records || {};
  const keys = new Set([...Object.keys(ra), ...Object.keys(b.records)]);
  for (const key of keys) if (!sameRecord(key, ra[key], b.records[key])) return true;
  return canonical(a.tombs || {}) !== canonical(b.tombs);
}

module.exports = { SyncEngine, FILE_NAME, mergeInto };
