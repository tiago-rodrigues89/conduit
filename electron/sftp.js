'use strict';
// Remote file operations, the transfer queue and "edit remote file locally".

const { app, shell } = require('electron');
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const posix = path.posix;

const p = (fn) => new Promise((resolve, reject) => fn((err, v) => (err ? reject(err) : resolve(v))));

function modeString(mode, type) {
  const t = type === 'dir' ? 'd' : type === 'link' ? 'l' : '-';
  const bits = 'rwxrwxrwx';
  let out = '';
  for (let i = 0; i < 9; i++) out += mode & (1 << (8 - i)) ? bits[i] : '-';
  return t + out;
}

function friendly(err) {
  if (!err) return 'Unknown error';
  if (err.code === 2) return 'No such file or directory';
  if (err.code === 3) return 'Permission denied';
  if (err.code === 4 && /exist/i.test(err.message || '')) return 'File already exists';
  return err.message || String(err);
}

function wrapError(err) {
  const e = new Error(friendly(err));
  e.code = err && err.code;
  return e;
}

class SftpManager {
  constructor({ ssh, send }) {
    this.ssh = ssh;
    this.send = send;
    this.jobs = new Map();
    this.queue = [];
    this.running = 0;
    this.edits = new Map();
    ssh.on('closed', (connId) => this._onConnClosed(connId));
  }

  /**
   * Channels are addressed by a key: the connection id, optionally followed by
   * "|as:<user>" to browse through `sudo -u <user> sftp-server` (Files panel
   * following the terminal into a root shell).
   */
  _conn(key) {
    const { connId } = parseKey(key);
    const conn = this.ssh.conns.get(connId);
    if (!conn || conn.closed) throw new Error('Not connected');
    return conn;
  }

  /** Channel opens are serialised per connection (the sudo variant patches ssh2 briefly). */
  _locked(conn, fn) {
    const run = (conn.sftpOpenLock || Promise.resolve()).catch(() => {}).then(fn);
    conn.sftpOpenLock = run.catch(() => {});
    return run;
  }

  _openChannel(conn, asUser) {
    if (asUser) return this._openSudoChannel(conn, asUser);
    return this._locked(
      conn,
      () =>
        new Promise((resolve, reject) =>
          conn.client.sftp((err, sftp) => (err ? reject(new Error(`SFTP is not available on this server (${err.message})`)) : resolve(sftp)))
        )
    );
  }

  _execSftp(conn, command, password) {
    return this._locked(
      conn,
      () =>
        new Promise((resolve, reject) => {
          // ssh2 opens SFTP with a "subsystem" request; for one call we send an
          // "exec" of sftp-server through sudo instead (optionally with the
          // sudo password as the first line of input).
          const proto = conn.client._protocol;
          const original = proto.subsystem;
          proto.subsystem = function (id, name, wantReply) {
            proto.subsystem = original;
            const r = proto.exec(id, command, wantReply);
            if (password) proto.channelData(id, Buffer.from(password + '\n'));
            return r;
          };
          try {
            conn.client.sftp((err, sftp) => {
              proto.subsystem = original;
              if (err) reject(err);
              else resolve(sftp);
            });
          } catch (err) {
            proto.subsystem = original;
            reject(err);
          }
        })
    );
  }

  async _openSudoChannel(conn, asUser) {
    if (!/^[a-z_][a-z0-9_.-]*\$?$/i.test(asUser)) throw new Error(`Invalid user name: ${asUser}`);
    const find =
      'for p in /usr/lib/openssh/sftp-server /usr/libexec/openssh/sftp-server /usr/lib/ssh/sftp-server ' +
      '/usr/libexec/sftp-server /usr/lib/sftp-server /usr/sbin/sftp-server /usr/local/libexec/sftp-server; ' +
      'do [ -x "$p" ] && break; p=; done; [ -n "$p" ] || { echo "sftp-server not found" >&2; exit 127; }; ';
    const cmd = (withPassword) =>
      `sh -c '${find}exec sudo ${withPassword ? '-S -p ""' : '-n'} -u ${asUser} "$p"'`;
    const explain = (err) => {
      if (err && err.code === 127) return new Error('sudo or sftp-server is not available on this server');
      return null;
    };

    if (!conn.sudoNeedsPassword) {
      try {
        return await this._execSftp(conn, cmd(false));
      } catch (err) {
        const known = explain(err);
        if (known) throw known;
        conn.sudoNeedsPassword = true;
      }
    }
    // sudo wants a password: use the one typed earlier for this connection, else ask
    const candidates = [conn.sudoPassword].filter(Boolean);
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      let password = candidates.shift();
      if (!password) {
        const res = await this.ssh.ask('prompt', {
          title: 'sudo password',
          message: `To show files as ${asUser}, sudo on ${conn.session.host} needs the password of ${conn.session.username || 'your user'}.`,
          fields: [{ label: 'Password', secret: true }],
          error: lastError ? 'Sorry, that did not work. Please try again.' : undefined,
        });
        if (!res) throw Object.assign(new Error(`Files are shown as ${conn.session.username || 'your user'} (sudo cancelled)`), { cancelled: true });
        password = res.values[0];
      }
      try {
        const sftp = await this._execSftp(conn, cmd(true), password);
        conn.sudoPassword = password;
        return sftp;
      } catch (err) {
        const known = explain(err);
        if (known) throw known;
        lastError = err;
      }
    }
    throw new Error(`sudo refused to open files as ${asUser}`);
  }

  async _sftp(key) {
    const conn = this._conn(key);
    const { asUser } = parseKey(key);
    const slot = asUser || '';
    if (!conn.sftpChannels) conn.sftpChannels = new Map();
    let p = conn.sftpChannels.get(slot);
    if (!p) {
      p = this._openChannel(conn, asUser).then((s) => {
        s.on('close', () => {
          if (conn.sftpChannels.get(slot) === p) conn.sftpChannels.delete(slot);
        });
        return s;
      });
      p.catch(() => {
        if (conn.sftpChannels.get(slot) === p) conn.sftpChannels.delete(slot);
      });
      conn.sftpChannels.set(slot, p);
    }
    return p;
  }

  async _call(connId, fn) {
    const sftp = await this._sftp(connId);
    try {
      return await fn(sftp);
    } catch (err) {
      throw wrapError(err);
    }
  }

  // ---------------------------------------------------------------------------
  // browsing & file operations

  home(connId) {
    return this._call(connId, (s) => p((cb) => s.realpath('.', cb)));
  }

  list(connId, dir) {
    return this._call(connId, async (sftp) => {
      let target = dir || '.';
      if (target === '~') target = '.';
      else if (target.startsWith('~/')) target = `./${target.slice(2)}`;
      const abs = await p((cb) => sftp.realpath(target, cb));
      const raw = await p((cb) => sftp.readdir(abs, cb));
      const entries = await Promise.all(
        raw
          .filter((it) => it.filename !== '.' && it.filename !== '..')
          .map(async (it) => {
            const a = it.attrs;
            const isLink = a.isSymbolicLink();
            const type = a.isDirectory() ? 'dir' : isLink ? 'link' : 'file';
            let linkDir = false;
            let size = a.size;
            if (isLink) {
              try {
                const st = await p((cb) => sftp.stat(posix.join(abs, it.filename), cb));
                linkDir = st.isDirectory();
                size = linkDir ? 0 : st.size;
              } catch {
                /* broken link */
              }
            }
            const parts = (it.longname || '').split(/\s+/);
            return {
              name: it.filename,
              type,
              linkDir,
              size,
              mtime: (a.mtime || 0) * 1000,
              mode: a.mode & 0o7777,
              perms: modeString(a.mode, type),
              owner: parts.length > 4 ? parts[2] : String(a.uid ?? ''),
              group: parts.length > 4 ? parts[3] : String(a.gid ?? ''),
            };
          })
      );
      return { path: abs, entries };
    });
  }

  stat(connId, target) {
    return this._call(connId, async (s) => {
      const st = await p((cb) => s.stat(target, cb));
      return { type: st.isDirectory() ? 'dir' : 'file', size: st.size, mode: st.mode & 0o7777, mtime: st.mtime * 1000 };
    });
  }

  /** Last `maxBytes` of a text file (for shell history). '~/' paths are relative to home. */
  readTail(connId, target, maxBytes = 512 * 1024) {
    return this._call(connId, async (s) => {
      const file = target.startsWith('~/') ? `./${target.slice(2)}` : target;
      const st = await p((cb) => s.stat(file, cb));
      const length = Math.min(st.size, maxBytes);
      const handle = await p((cb) => s.open(file, 'r', cb));
      try {
        const buf = Buffer.alloc(length);
        let off = 0;
        while (off < length) {
          const n = await new Promise((resolve, reject) =>
            s.read(handle, buf, off, length - off, st.size - length + off, (err, bytes) => (err ? reject(err) : resolve(bytes)))
          );
          if (!n) break;
          off += n;
        }
        return buf.subarray(0, off).toString('utf8');
      } finally {
        await p((cb) => s.close(handle, cb)).catch(() => {});
      }
    });
  }

  mkdir(connId, target) {
    return this._call(connId, (s) => p((cb) => s.mkdir(target, cb)));
  }

  touch(connId, target) {
    return this._call(connId, async (s) => {
      const handle = await p((cb) => s.open(target, 'wx', cb));
      await p((cb) => s.close(handle, cb));
    });
  }

  rename(connId, from, to) {
    return this._call(connId, (s) => p((cb) => s.rename(from, to, cb)));
  }

  chmod(connId, targets, mode, recursive) {
    return this._call(connId, async (s) => {
      const apply = async (t) => {
        const st = await p((cb) => s.lstat(t, cb));
        if (st.isSymbolicLink()) return;
        await p((cb) => s.chmod(t, mode, cb));
        if (recursive && st.isDirectory()) {
          const items = await p((cb) => s.readdir(t, cb));
          for (const it of items) {
            if (it.filename !== '.' && it.filename !== '..') await apply(posix.join(t, it.filename));
          }
        }
      };
      for (const t of targets) await apply(t);
    });
  }

  remove(connId, targets) {
    return this._call(connId, async (s) => {
      const rm = async (t) => {
        const st = await p((cb) => s.lstat(t, cb));
        if (st.isDirectory()) {
          const items = (await p((cb) => s.readdir(t, cb))).filter((it) => it.filename !== '.' && it.filename !== '..');
          for (let i = 0; i < items.length; i += 16) {
            await Promise.all(items.slice(i, i + 16).map((it) => rm(posix.join(t, it.filename))));
          }
          await p((cb) => s.rmdir(t, cb));
        } else {
          await p((cb) => s.unlink(t, cb));
        }
      };
      for (const t of targets) await rm(t);
    });
  }

  // ---------------------------------------------------------------------------
  // transfers

  start({ connId, direction, sources, targetDir, conflict }) {
    this._conn(connId);
    const id = crypto.randomUUID();
    const first = direction === 'upload' ? path.basename(sources[0]) : posix.basename(sources[0]);
    const job = {
      id,
      connId,
      direction,
      sources,
      targetDir,
      conflict: conflict || 'overwrite',
      label: sources.length > 1 ? `${first} and ${sources.length - 1} more` : first,
      status: 'queued',
      totalBytes: 0,
      doneBytes: 0,
      files: 0,
      filesDone: 0,
      current: '',
      speed: 0,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    };
    this.jobs.set(id, job);
    this.queue.push(job);
    this._emit(job, true);
    this._pump();
    return id;
  }

  cancel(id) {
    const job = this.jobs.get(id);
    if (!job || ['done', 'error', 'cancelled'].includes(job.status)) return;
    job.cancelled = true;
    if (job.status === 'queued') {
      this.queue = this.queue.filter((j) => j !== job);
      job.status = 'cancelled';
      this._emit(job, true);
    } else if (job.sftp) {
      try { job.sftp.end(); } catch { /* ignore */ }
    }
  }

  clearFinished() {
    for (const [id, job] of this.jobs) {
      if (['done', 'error', 'cancelled'].includes(job.status)) this.jobs.delete(id);
    }
  }

  _pump() {
    while (this.running < 3 && this.queue.length) {
      const job = this.queue.shift();
      this.running++;
      this._run(job)
        .catch((err) => {
          if (job.cancelled) job.status = 'cancelled';
          else {
            job.status = 'error';
            job.error = friendly(err);
          }
        })
        .finally(() => {
          this.running--;
          job.finishedAt = Date.now();
          if (job.sftp) {
            try { job.sftp.end(); } catch { /* ignore */ }
            job.sftp = null;
          }
          this._emit(job, true);
          this.send('fs:changed', {
            side: job.direction === 'upload' ? 'remote' : 'local',
            connId: job.connId,
            dir: job.targetDir,
          });
          this._pump();
        });
    }
  }

  _publicJob(job) {
    const { sftp, cancelled, lastEmit, lastBytes, lastTime, ...rest } = job;
    return rest;
  }

  _emit(job, force) {
    const now = Date.now();
    if (!force && job.lastEmit && now - job.lastEmit < 150) return;
    if (job.lastTime) {
      const dt = (now - job.lastTime) / 1000;
      if (dt > 0.2) {
        const inst = (job.doneBytes - job.lastBytes) / dt;
        job.speed = job.speed ? job.speed * 0.6 + inst * 0.4 : inst;
        job.lastBytes = job.doneBytes;
        job.lastTime = now;
      }
    } else {
      job.lastBytes = job.doneBytes;
      job.lastTime = now;
    }
    job.lastEmit = now;
    this.send('transfer:update', this._publicJob(job));
  }

  async _run(job) {
    const conn = this._conn(job.connId);
    const sftp = (job.sftp = await this._openChannel(conn, parseKey(job.connId).asUser));
    job.status = 'scanning';
    this._emit(job, true);

    const plan = [];
    if (job.direction === 'upload') {
      const scan = (src, dst) => {
        const st = fs.statSync(src);
        if (st.isDirectory()) {
          plan.push({ dir: true, dst });
          for (const name of fs.readdirSync(src)) {
            if (name === '.DS_Store') continue;
            scan(path.join(src, name), posix.join(dst, name));
          }
        } else plan.push({ src, dst, size: st.size, mode: st.mode & 0o777 });
      };
      for (const src of job.sources) scan(src, posix.join(job.targetDir, path.basename(src)));
    } else {
      const scan = async (src, dst) => {
        const st = await p((cb) => sftp.stat(src, cb));
        if (st.isDirectory()) {
          plan.push({ dir: true, dst });
          const items = await p((cb) => sftp.readdir(src, cb));
          for (const it of items) {
            if (it.filename === '.' || it.filename === '..') continue;
            await scan(posix.join(src, it.filename), path.join(dst, it.filename));
          }
        } else plan.push({ src, dst, size: st.size });
      };
      for (const src of job.sources) await scan(src, path.join(job.targetDir, posix.basename(src)));
    }

    job.files = plan.filter((x) => !x.dir).length;
    job.totalBytes = plan.reduce((n, x) => n + (x.size || 0), 0);
    job.status = 'running';
    this._emit(job, true);

    for (const item of plan) {
      if (job.cancelled) break;
      if (item.dir) {
        if (job.direction === 'upload') {
          const exists = await p((cb) => sftp.stat(item.dst, cb)).then(() => true, () => false);
          if (!exists) await p((cb) => sftp.mkdir(item.dst, cb));
        } else {
          fs.mkdirSync(item.dst, { recursive: true });
        }
        continue;
      }
      if (job.conflict === 'skip') {
        const exists =
          job.direction === 'upload'
            ? await p((cb) => sftp.stat(item.dst, cb)).then(() => true, () => false)
            : fs.existsSync(item.dst);
        if (exists) {
          job.doneBytes += item.size;
          job.filesDone++;
          continue;
        }
      }
      job.current = path.basename(item.dst);
      const base = job.doneBytes;
      const step = (transferred) => {
        job.doneBytes = base + transferred;
        this._emit(job);
      };
      const opts = { concurrency: 64, chunkSize: 32768, step };
      try {
        if (job.direction === 'upload') {
          await p((cb) => sftp.fastPut(item.src, item.dst, { ...opts, mode: item.mode }, cb));
        } else {
          await p((cb) => sftp.fastGet(item.src, item.dst, opts, cb));
        }
      } catch (err) {
        if (job.cancelled) {
          if (job.direction === 'download') fs.rmSync(item.dst, { force: true });
          break;
        }
        throw err;
      }
      job.doneBytes = base + item.size;
      job.filesDone++;
      this._emit(job);
    }
    job.current = '';
    job.status = job.cancelled ? 'cancelled' : 'done';
  }

  // ---------------------------------------------------------------------------
  // edit remote files with a local app; saved changes are uploaded back

  async edit({ connId, remotePath, appName }) {
    const sftp = await this._sftp(connId);
    const base = posix.basename(remotePath);
    const key = `${connId}:${remotePath}`;
    const dir = path.join(app.getPath('temp'), 'conduit-edit', crypto.createHash('sha1').update(key).digest('hex').slice(0, 12));
    fs.mkdirSync(dir, { recursive: true });
    const local = path.join(dir, base);
    try {
      await p((cb) => sftp.fastGet(remotePath, local, cb));
    } catch (err) {
      throw wrapError(err);
    }

    const old = this.edits.get(key);
    if (old) old.watcher.close();
    const entry = { key, connId, remotePath, local, base, hash: hashFile(local), timer: null, watcher: null };
    entry.watcher = fs.watch(dir, (event, fname) => {
      if (fname && fname !== base) return;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => this._syncEdit(entry), 400);
    });
    this.edits.set(key, entry);

    if (appName) {
      await new Promise((resolve, reject) =>
        execFile('open', ['-a', appName, local], (err) => (err ? reject(new Error(`Could not open with ${appName}`)) : resolve()))
      );
    } else {
      const err = await shell.openPath(local);
      if (err) throw new Error(err);
    }
    return { local };
  }

  async _syncEdit(entry) {
    if (!fs.existsSync(entry.local)) return;
    const hash = hashFile(entry.local);
    if (!hash || hash === entry.hash) return;
    entry.hash = hash;
    try {
      const sftp = await this._sftp(entry.connId);
      await p((cb) => sftp.fastPut(entry.local, entry.remotePath, cb));
      this.send('toast', { kind: 'success', text: `Saved ${entry.base} to server` });
      this.send('fs:changed', { side: 'remote', connId: entry.connId, dir: posix.dirname(entry.remotePath) });
    } catch (err) {
      this.send('toast', { kind: 'error', text: `Could not upload ${entry.base}: ${friendly(err)}` });
    }
  }

  _onConnClosed(connId) {
    for (const [key, entry] of this.edits) {
      if (parseKey(entry.connId).connId === connId) {
        entry.watcher.close();
        this.edits.delete(key);
      }
    }
  }

  dispose() {
    for (const entry of this.edits.values()) entry.watcher.close();
    this.edits.clear();
    try {
      fs.rmSync(path.join(app.getPath('temp'), 'conduit-edit'), { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

function parseKey(key) {
  const [connId, mode] = String(key).split('|');
  return { connId, asUser: mode && mode.startsWith('as:') ? mode.slice(3) : null };
}

function hashFile(file) {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

module.exports = { SftpManager, modeString };
