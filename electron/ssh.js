'use strict';
// SSH connection manager: connections (incl. jump hosts), interactive shells,
// authentication prompts, host key checks, port forwarding and the optional
// "follow terminal folder" shell integration.

const { Client, utils } = require('ssh2');
const constants = require('ssh2/lib/protocol/constants');
const { EventEmitter } = require('events');
const { StringDecoder } = require('string_decoder');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const knownHosts = require('./knownhosts');
const store = require('./store');
const shellint = require('./shellint');

const LEGACY_ALGORITHMS = {
  kex: constants.SUPPORTED_KEX,
  cipher: constants.SUPPORTED_CIPHER,
  serverHostKey: constants.SUPPORTED_SERVER_HOST_KEY,
  hmac: constants.SUPPORTED_MAC,
};

// Shell integration (see shellint.js): typed into bash/zsh once after login.
// Its echo is hidden; the marker tells us when it has run.
const READY_MARKER = '\x1b]6973;ready\x07';
const OSC7_RE = /\x1b\]7;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]|\x1b[=>]/g;
const PROMPT_TAIL_RE = /[$#%>❯➜λ»›→]\s*$/;

// Passwords typed during this app session, so reconnects and new tabs do not
// ask again. Never written to disk unless the user ticks "save".
const passwordCache = new Map();

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function credentialFor(session) {
  if (!session.credentialId) return null;
  const list = store.readJson('credentials', []);
  return (Array.isArray(list) ? list : []).find((c) => c.id === session.credentialId) || null;
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function cancelledError() {
  const e = new Error('Authentication cancelled');
  e.cancelled = true;
  return e;
}

function friendlyError(err, host, port) {
  const code = err && err.code;
  if (code === 'ECONNREFUSED') return new Error(`Connection refused by ${host}:${port}`);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new Error(`Host not found: ${host}`);
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return new Error(`Host unreachable: ${host}`);
  if (code === 'ETIMEDOUT' || /timed out/i.test(err.message)) return new Error(`Connection to ${host}:${port} timed out`);
  if (code === 'ECONNRESET') return new Error('Connection reset by peer');
  if (/verification failed/i.test(err.message)) return new Error('Host key was not accepted');
  if (err.level === 'client-authentication') return new Error('Authentication failed');
  if (/handshake failed|no matching/i.test(err.message)) {
    return new Error(`${err.message}. Enabling "legacy algorithms" in the session settings may help with older devices.`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

class Conn {
  constructor(session) {
    this.id = crypto.randomUUID();
    this.session = session;
    this.client = null;
    this.jump = null;
    this.holders = new Set();
    this.sftpP = null;
    this.servers = [];
    this.remoteForwards = [];
    this.closed = false;
    this.label = `${session.username || ''}@${session.host}`;
  }
}

class SshManager extends EventEmitter {
  /**
   * @param {{send: Function, ask: Function, output: import('./output').TermOutput}} deps
   */
  constructor({ send, ask, output }) {
    super();
    this.send = send;
    this.ask = ask;
    this.output = output;
    this.conns = new Map(); // connId -> Conn
    this.holders = new Map(); // holderId -> Conn
    this.shells = new Map(); // termId -> shell state
  }

  log(holderId, level, text) {
    if (holderId) this.send('ssh:log', holderId, level, text);
  }

  activeCount() {
    return this.conns.size;
  }

  // ---------------------------------------------------------------------------
  // public API

  async connect({ holderId, session, shell }) {
    await this.detach({ holderId });
    const conn = await this._open(session, holderId, 0);
    this.conns.set(conn.id, conn);
    conn.holders.add(holderId);
    this.holders.set(holderId, conn);
    this._startForwards(conn, holderId);
    if (shell) {
      try {
        await this._openShell(conn, holderId, shell);
      } catch (err) {
        await this.detach({ holderId });
        throw err;
      }
    }
    return { connId: conn.id };
  }

  /** Opens another shell on an open connection (split panes), without logging in again. */
  async openShell({ holderId, connId, shell }) {
    await this.detach({ holderId });
    const conn = this.conns.get(connId);
    if (!conn || conn.closed || conn.closing) throw new Error('This connection is no longer open');
    conn.holders.add(holderId);
    this.holders.set(holderId, conn);
    try {
      await this._openShell(conn, holderId, shell);
    } catch (err) {
      await this.detach({ holderId });
      throw err;
    }
    return { connId: conn.id };
  }

  attach({ holderId, connId }) {
    const conn = this.conns.get(connId);
    if (!conn || conn.closed) throw new Error('This connection is no longer open');
    conn.holders.add(holderId);
    this.holders.set(holderId, conn);
    return { connId };
  }

  async detach({ holderId }) {
    const sh = this.shells.get(holderId);
    if (sh) {
      sh.detached = true;
      this.shells.delete(holderId);
      this.output.unregister(holderId);
      try { sh.stream.close(); } catch { /* ignore */ }
    }
    const conn = this.holders.get(holderId);
    if (!conn) return;
    this.holders.delete(holderId);
    conn.holders.delete(holderId);
    if (conn.holders.size === 0) this._end(conn);
  }

  write(termId, data) {
    const sh = this.shells.get(termId);
    if (!sh) return;
    sh.lastInputAt = Date.now();
    const integ = sh.integ;
    if (integ && integ.phase !== 'done') {
      if (integ.phase === 'wait') {
        integ.userTyped = true;
      } else if (integ.phase === 'pre') {
        integ.queued.push(data);
        return;
      } else if (integ.phase === 'post') {
        this._integDone(sh);
      }
    }
    sh.stream.write(data);
  }

  resize(termId, cols, rows) {
    const sh = this.shells.get(termId);
    if (sh && cols > 0 && rows > 0) {
      try { sh.stream.setWindow(rows, cols, 0, 0); } catch { /* ignore */ }
    }
  }

  connFor(holderId) {
    return this.holders.get(holderId) || null;
  }

  closeAll() {
    for (const conn of this.conns.values()) this._end(conn);
  }

  exec(connId, command, timeout = 15000) {
    const conn = this.conns.get(connId);
    if (!conn) return Promise.reject(new Error('Not connected'));
    return this._exec(conn, command, timeout);
  }

  // ---------------------------------------------------------------------------
  // connecting & authentication

  async _open(session, holderId, depth) {
    const host = String(session.host || '').trim();
    const port = Number(session.port) || 22;
    if (!host) throw new Error('No host given');
    const cred = credentialFor(session);
    let username = String(session.username || (cred && cred.username) || '').trim();
    if (!username) {
      const res = await this.ask('prompt', {
        holderId,
        title: 'Login',
        message: `Username for ${host}`,
        fields: [{ label: 'Username', secret: false }],
      });
      if (!res || !res.values[0]) throw cancelledError();
      username = res.values[0].trim();
    }

    let sock;
    let jump = null;
    if (session.jump) {
      if (depth >= 4) throw new Error('Too many nested jump hosts');
      this.log(holderId, 'info', `Connecting through jump host ${session.jump.host}`);
      jump = await this._open(session.jump, holderId, depth + 1);
      try {
        sock = await new Promise((resolve, reject) =>
          jump.client.forwardOut('127.0.0.1', 0, host, port, (err, stream) => (err ? reject(err) : resolve(stream)))
        );
      } catch (err) {
        jump.client.end();
        throw new Error(`Jump host could not reach ${host}:${port} (${err.message})`);
      }
    }

    this.log(holderId, 'info', `Connecting to ${host}:${port}`);
    const conn = new Conn({ ...session, username });
    conn.jump = jump;
    const client = (conn.client = new Client());
    const auth = this._authContext(session, username, host, port, holderId);

    await new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { client.end(); } catch { /* ignore */ }
        if (jump) jump.client.end();
        reject(err);
      };
      client.once('ready', () => {
        settled = true;
        resolve();
      });
      client.on('error', (err) => {
        if (!settled) {
          if (auth.cancelled) fail(cancelledError());
          else if (err.level === 'client-authentication') {
            fail(new Error(`Authentication failed for ${username}@${host}${auth.tried.size ? ` (tried ${[...auth.tried].join(', ')})` : ''}`));
          } else fail(friendlyError(err, host, port));
        } else {
          conn.lastError = friendlyError(err, host, port).message;
        }
      });
      client.on('close', () => {
        if (!settled) fail(new Error('Connection closed by remote host'));
        else this._closed(conn);
      });
      client.on('banner', (message) => {
        if (message && message.trim()) this.send('ssh:banner', holderId, message);
      });
      client.on('tcp connection', (info, accept, rejectConn) => this._onRemoteForward(conn, info, accept, rejectConn));

      const keepalive = Number(session.keepAlive);
      try {
        client.connect({
          host,
          port,
          sock,
          username,
          readyTimeout: 25000,
          keepaliveInterval: (Number.isFinite(keepalive) && keepalive >= 0 ? keepalive : 30) * 1000,
          keepaliveCountMax: 4,
          tryKeyboard: true,
          algorithms: session.legacyAlgorithms ? LEGACY_ALGORITHMS : undefined,
          hostVerifier: (key, verify) => {
            this._verifyHost(host, port, key, holderId).then(verify, () => verify(false));
          },
          authHandler: (methodsLeft, partial, next) => {
            this._nextAuth(auth, methodsLeft).then(next, () => next(false));
          },
        });
      } catch (err) {
        fail(err);
      }
    });

    auth.onSuccess();
    this.log(holderId, 'ok', `Authenticated as ${username}${auth.method ? ` (${auth.method})` : ''}`);
    return conn;
  }

  async _verifyHost(host, port, key, holderId) {
    const res = knownHosts.verify(host, port, key);
    if (res.status === 'trusted') return true;
    if (res.status === 'revoked') {
      this.log(holderId, 'error', `Host key for ${host} is marked as revoked in ~/.ssh/known_hosts`);
      return false;
    }
    const answer = await this.ask('hostkey', { holderId, host, port, ...res });
    if (answer === 'trust') knownHosts.trust(host, port, key);
    return answer === 'trust' || answer === 'once';
  }

  _authContext(session, username, host, port, holderId) {
    // a saved login (credential) replaces the session's own password/key
    const cred = credentialFor(session);
    const secretId = cred ? `cred:${cred.id}` : session.id;
    const secrets = secretId ? store.getSecret(secretId) : {};
    if (cred && cred.keyPath && !session.keyPath) session = { ...session, keyPath: cred.keyPath };
    const cacheKey = `${username}@${host}:${port}`;
    const method = session.authMethod || 'auto';
    const queue = [];
    const agentSock = process.env.SSH_AUTH_SOCK;
    if ((method === 'auto' || method === 'agent') && agentSock && fs.existsSync(agentSock)) {
      queue.push({ type: 'agent' });
    }
    if (method === 'auto' || method === 'key') {
      if (session.keyPath) {
        queue.push({ type: 'publickey', path: expandHome(session.keyPath), explicit: true });
      } else if (method === 'auto') {
        for (const name of ['id_ed25519', 'id_ecdsa', 'id_rsa']) {
          const p = path.join(os.homedir(), '.ssh', name);
          if (fs.existsSync(p)) queue.push({ type: 'publickey', path: p });
        }
      }
    }
    if (method === 'auto' || method === 'password') {
      queue.push({ type: 'keyboard-interactive' });
      queue.push({ type: 'password' });
    }

    const ctx = {
      session,
      username,
      host,
      port,
      holderId,
      queue,
      secrets,
      knownPassword: session.password || secrets.password || passwordCache.get(cacheKey),
      knownPasswordUsed: false,
      passwordTries: 0,
      kiRounds: 0,
      kiAttempts: 0,
      kiPrompted: false,
      lastKiPrompt: null,
      usedPassword: null,
      savePassword: false,
      usedPassphrase: null,
      savePassphrase: false,
      cancelled: false,
      method: null,
      tried: new Set(),
    };
    ctx.onSuccess = () => {
      if (ctx.usedPassword) {
        passwordCache.set(cacheKey, ctx.usedPassword);
        if (ctx.savePassword && secretId) store.setSecret(secretId, { password: ctx.usedPassword });
      }
      if (ctx.usedPassphrase && ctx.savePassphrase && secretId) {
        store.setSecret(secretId, { passphrase: ctx.usedPassphrase });
      }
    };
    return ctx;
  }

  async _nextAuth(ctx, methodsLeft) {
    const allowed = (type) => !methodsLeft || methodsLeft.includes(type === 'agent' ? 'publickey' : type);
    while (ctx.queue.length && !ctx.cancelled) {
      const m = ctx.queue[0];
      if (!allowed(m.type)) {
        ctx.queue.shift();
        continue;
      }
      switch (m.type) {
        case 'agent':
          ctx.queue.shift();
          ctx.method = 'agent';
          ctx.tried.add('agent');
          return { type: 'agent', username: ctx.username, agent: process.env.SSH_AUTH_SOCK };

        case 'publickey': {
          ctx.queue.shift();
          const key = await this._loadKey(ctx, m);
          if (!key) continue;
          ctx.method = `key ${path.basename(m.path)}`;
          ctx.tried.add('publickey');
          return { type: 'publickey', username: ctx.username, key: key.data, passphrase: key.passphrase };
        }

        case 'keyboard-interactive':
          // retried like OpenSSH (3 tries) as long as the server keeps asking questions
          if (ctx.kiAttempts >= 3 || (ctx.kiAttempts > 0 && !ctx.kiPrompted)) {
            ctx.queue.shift();
            continue;
          }
          ctx.kiAttempts++;
          ctx.kiPrompted = false;
          ctx.method = 'keyboard-interactive';
          ctx.tried.add('keyboard-interactive');
          return {
            type: 'keyboard-interactive',
            username: ctx.username,
            prompt: (name, instructions, lang, prompts, finish) => {
              this._kiPrompt(ctx, name, instructions, prompts).then(
                (answers) => finish(answers || []),
                () => finish([])
              );
            },
          };

        case 'password': {
          if (ctx.passwordTries >= 3) {
            ctx.queue.shift();
            continue;
          }
          ctx.passwordTries++;
          let password;
          if (ctx.knownPassword && !ctx.knownPasswordUsed) {
            ctx.knownPasswordUsed = true;
            password = ctx.knownPassword;
          } else {
            const res = await this.ask('prompt', {
              holderId: ctx.holderId,
              title: 'Password',
              message: `${ctx.username}@${ctx.host}`,
              fields: [{ label: 'Password', secret: true }],
              allowSave: !!(ctx.session.id || ctx.session.credentialId),
              error: ctx.usedPassword ? 'Permission denied, please try again.' : undefined,
            });
            if (!res) {
              ctx.cancelled = true;
              return false;
            }
            password = res.values[0];
            ctx.savePassword = !!res.save;
          }
          ctx.usedPassword = password;
          ctx.method = 'password';
          ctx.tried.add('password');
          return { type: 'password', username: ctx.username, password };
        }

        default:
          ctx.queue.shift();
      }
    }
    return false;
  }

  async _loadKey(ctx, m) {
    let data;
    try {
      data = fs.readFileSync(m.path);
    } catch (err) {
      if (m.explicit) this.log(ctx.holderId, 'warn', `Cannot read key ${m.path}: ${err.message}`);
      return null;
    }
    let passphrase = ctx.secrets.passphrase;
    let parsed = utils.parseKey(data, passphrase);
    let tries = 0;
    while (parsed instanceof Error && /encrypt|passphrase|decrypt/i.test(parsed.message) && tries < 3) {
      const res = await this.ask('prompt', {
        holderId: ctx.holderId,
        title: 'Key passphrase',
        message: `Passphrase for ${m.path.replace(os.homedir(), '~')}`,
        fields: [{ label: 'Passphrase', secret: true }],
        allowSave: !!(ctx.session.id || ctx.session.credentialId),
        error: tries > 0 || passphrase ? 'Wrong passphrase, please try again.' : undefined,
      });
      if (!res) return null; // skip this key, try the next method
      passphrase = res.values[0];
      ctx.savePassphrase = !!res.save;
      tries++;
      parsed = utils.parseKey(data, passphrase);
    }
    if (parsed instanceof Error) {
      if (m.explicit) this.log(ctx.holderId, 'warn', `Cannot use key ${path.basename(m.path)}: ${parsed.message}`);
      return null;
    }
    if (passphrase && tries > 0) ctx.usedPassphrase = passphrase;
    return { data, passphrase };
  }

  async _kiPrompt(ctx, name, instructions, prompts) {
    ctx.kiRounds++;
    if (ctx.kiRounds > 8 || ctx.cancelled) return null;
    if (prompts.length) ctx.kiPrompted = true;
    const isPassword = prompts.length === 1 && !prompts[0].echo && /pass(word|code|phrase)?/i.test(prompts[0].prompt);
    if (isPassword && ctx.knownPassword && !ctx.knownPasswordUsed) {
      ctx.knownPasswordUsed = true;
      ctx.usedPassword = ctx.knownPassword;
      ctx.lastKiPrompt = prompts[0].prompt;
      return [ctx.knownPassword];
    }
    const repeated = prompts.length === 1 && prompts[0].prompt === ctx.lastKiPrompt;
    ctx.lastKiPrompt = prompts.length === 1 ? prompts[0].prompt : null;
    const res = await this.ask('prompt', {
      holderId: ctx.holderId,
      title: name || (isPassword ? 'Password' : 'Authentication'),
      message: (instructions || '').trim() || `${ctx.username}@${ctx.host}`,
      fields: prompts.map((p) => ({ label: p.prompt.trim().replace(/:$/, ''), secret: !p.echo })),
      allowSave: isPassword && !!(ctx.session.id || ctx.session.credentialId),
      error: repeated ? 'Access denied, please try again.' : undefined,
    });
    if (!res) {
      ctx.cancelled = true;
      return null;
    }
    if (isPassword) {
      ctx.usedPassword = res.values[0];
      ctx.savePassword = !!res.save;
    }
    return res.values;
  }

  // ---------------------------------------------------------------------------
  // shells

  async _openShell(conn, termId, opts) {
    const cols = Math.max(2, opts.cols | 0 || 80);
    const rows = Math.max(2, opts.rows | 0 || 24);
    const stream = await new Promise((resolve, reject) => {
      conn.client.shell(
        { term: 'xterm-256color', cols, rows, width: 0, height: 0 },
        { env: { COLORTERM: 'truecolor', TERM_PROGRAM: 'Conduit' } },
        (err, s) => (err ? reject(err) : resolve(s))
      );
    });
    const sh = {
      termId,
      conn,
      stream,
      opts,
      decoder: new StringDecoder('utf8'),
      integ: null,
      detached: false,
    };
    this.shells.set(termId, sh);
    this.output.register(termId, { pause: () => stream.pause(), resume: () => stream.resume() });

    const onData = (buf) => this._onShellData(sh, sh.decoder.write(buf));
    stream.on('data', onData);
    stream.stderr.on('data', onData);
    stream.on('close', () => {
      if (sh.integ) this._clearIntegTimers(sh.integ);
      if (sh.detached) return;
      this.output.flush();
      // Give the connection a moment to report whether it dropped.
      setTimeout(() => {
        if (sh.detached) return;
        this.shells.delete(termId);
        this.output.unregister(termId);
        const lost = conn.closed && !conn.closing;
        this.send('term:exit', termId, {
          reason: lost ? 'lost' : 'exit',
          message: lost ? conn.lastError || 'Connection lost' : undefined,
        });
        this.detach({ holderId: termId });
      }, 60);
    });

    this._setupIntegration(sh);
  }

  _onShellData(sh, text) {
    if (!text) return;
    // remember whether the shell enabled bracketed paste for its prompt
    const on = text.lastIndexOf('\x1b[?2004h');
    const off = text.lastIndexOf('\x1b[?2004l');
    if (on !== -1 || off !== -1) sh.bracketed = on > off;
    const integ = sh.integ;
    if (!integ || integ.phase === 'done') {
      this.output.push(sh.termId, text);
      return;
    }
    if (integ.phase === 'wait') {
      this.output.push(sh.termId, text);
      integ.tail = (integ.tail + text).slice(-400);
      clearTimeout(integ.quietTimer);
      integ.quietTimer = setTimeout(() => this._maybeInject(sh), 350);
      return;
    }
    if (integ.phase === 'pre') {
      integ.buf += text;
      const idx = integ.buf.indexOf(READY_MARKER);
      if (idx === -1) return;
      const rest = integ.buf.slice(idx + READY_MARKER.length);
      integ.buf = '';
      integ.phase = 'post';
      clearTimeout(integ.hardTimer);
      integ.hardTimer = setTimeout(() => this._integDone(sh), 1000);
      this._swallowPost(sh, rest);
      return;
    }
    if (integ.phase === 'post') this._swallowPost(sh, text);
  }

  // After the hook ran the shell prints its prompt again. The old prompt is
  // still on screen, so the reprint is dropped, keeping only OSC 7 reports.
  _swallowPost(sh, text) {
    const integ = sh.integ;
    if (sh.opts.prompt && sh.opts.prompt !== 'shell') {
      // the prompt style changed: replace the old prompt line with the new prompt
      if (!integ.revealed) {
        integ.revealed = true;
        this.output.push(sh.termId, '\r\x1b[2K');
      }
      this.output.push(sh.termId, text);
    } else {
      // same prompt as before: keep the screen as it is, only pass OSC 7 on
      const osc = text.match(OSC7_RE);
      if (osc) this.output.push(sh.termId, osc.join(''));
    }
    clearTimeout(integ.quietTimer);
    integ.quietTimer = setTimeout(() => this._integDone(sh), 150);
  }

  _setupIntegration(sh) {
    if (!sh.opts.integrate) {
      sh.integ = { phase: 'done' };
      setTimeout(() => this._afterReady(sh), 0);
      return;
    }
    const integ = (sh.integ = {
      phase: 'wait',
      buf: '',
      tail: '',
      queued: [],
      bracketed: false,
      userTyped: false,
      quietTimer: null,
      hardTimer: null,
      eligible: null,
    });
    integ.eligible = this._exec(sh.conn, 'echo "$SHELL"', 5000)
      .then((out) => {
        const m = out.trim().split('\n').pop().trim().match(/(?:^|\/)(bash|zsh)$/);
        return m ? m[1] : null;
      })
      .catch(() => null);
    integ.hardTimer = setTimeout(() => {
      if (integ.phase === 'wait') this._integDone(sh);
    }, 10000);
  }

  async _maybeInject(sh) {
    const integ = sh.integ;
    if (!integ || integ.phase !== 'wait') return;
    if (integ.userTyped) return this._integDone(sh);
    const tail = integ.tail.replace(ANSI_RE, '').split(/\r?\n|\r/).pop();
    if (!PROMPT_TAIL_RE.test(tail)) return; // no prompt yet, keep waiting
    const shell = await integ.eligible;
    if (integ.phase !== 'wait' || sh.detached) return;
    if (!shell || integ.userTyped) return this._integDone(sh);
    integ.phase = 'pre';
    clearTimeout(integ.hardTimer);
    integ.hardTimer = setTimeout(() => this._integAbort(sh), 4000);
    const line = shellint.injectLine(shell, sh.opts.prompt || 'shell');
    // a bracketed paste is inserted in one go, even with heavy zsh plugins
    this._typeHook(sh, line);
  }

  _integAbort(sh) {
    const integ = sh.integ;
    if (integ.phase === 'pre' && integ.buf) this.output.push(sh.termId, integ.buf);
    integ.buf = '';
    this._integDone(sh);
  }

  _clearIntegTimers(integ) {
    clearTimeout(integ.quietTimer);
    clearTimeout(integ.hardTimer);
  }

  _integDone(sh) {
    const integ = sh.integ;
    if (!integ || integ.phase === 'done') return;
    const wasActive = integ.phase === 'pre' || integ.phase === 'post';
    integ.phase = 'done';
    this._clearIntegTimers(integ);
    if (wasActive) this.send('term:integrated', sh.termId);
    for (const data of integ.queued) sh.stream.write(data);
    integ.queued = [];
    if (!integ.nested) this._afterReady(sh);
  }

  _typeHook(sh, line) {
    // a bracketed paste is inserted in one go, even with heavy zsh plugins
    sh.stream.write(sh.bracketed ? `\x1b[200~${line}\x1b[201~\r` : `${line}\r`);
  }


  _afterReady(sh) {
    if (sh.detached) return;
    this.send('term:ready', sh.termId);
    const cmds = [];
    if (sh.opts.startDir) cmds.push(`cd ${shellQuote(sh.opts.startDir)}`);
    if (sh.opts.initCommand) {
      for (const line of String(sh.opts.initCommand).split('\n')) if (line.trim()) cmds.push(line);
    }
    for (const cmd of cmds) sh.stream.write(cmd + '\n');
  }

  _exec(conn, command, timeout) {
    return new Promise((resolve, reject) => {
      let out = '';
      let done = false;
      const timer = setTimeout(() => {
        done = true;
        reject(new Error('Command timed out'));
      }, timeout);
      conn.client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          if (!done) reject(err);
          return;
        }
        stream.on('data', (d) => (out += d.toString('utf8')));
        stream.stderr.on('data', () => {});
        stream.on('close', (code) => {
          clearTimeout(timer);
          if (done) return;
          if (code && code !== 0) reject(Object.assign(new Error(`Exit code ${code}`), { output: out }));
          else resolve(out);
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // port forwarding

  _startForwards(conn, holderId) {
    for (const f of conn.session.forwards || []) {
      if (f.enabled === false) continue;
      const bindHost = f.bindHost || '127.0.0.1';
      const bindPort = Number(f.bindPort);
      const label =
        f.type === 'dynamic'
          ? `SOCKS proxy on ${bindHost}:${bindPort}`
          : f.type === 'remote'
            ? `Remote ${bindHost}:${bindPort} → ${f.destHost}:${f.destPort}`
            : `${bindHost}:${bindPort} → ${f.destHost}:${f.destPort}`;
      if (f.type === 'remote') {
        conn.client.forwardIn(bindHost, bindPort, (err) => {
          if (err) this.log(holderId, 'warn', `Tunnel failed: ${label} (${err.message})`);
          else {
            conn.remoteForwards.push(f);
            this.log(holderId, 'ok', `Tunnel open: ${label}`);
          }
        });
        continue;
      }
      const server = f.type === 'dynamic' ? this._socksServer(conn) : this._localServer(conn, f);
      server.on('error', (err) => this.log(holderId, 'warn', `Tunnel failed: ${label} (${err.message})`));
      server.listen(bindPort, bindHost, () => this.log(holderId, 'ok', `Tunnel open: ${label}`));
      conn.servers.push(server);
    }
  }

  _pipe(sock, stream) {
    sock.on('error', () => stream.destroy());
    stream.on('error', () => sock.destroy());
    sock.pipe(stream).pipe(sock);
  }

  _localServer(conn, f) {
    return net.createServer((sock) => {
      conn.client.forwardOut(
        sock.remoteAddress || '127.0.0.1',
        sock.remotePort || 0,
        f.destHost,
        Number(f.destPort),
        (err, stream) => (err ? sock.destroy() : this._pipe(sock, stream))
      );
    });
  }

  _socksServer(conn) {
    const reply = (code) => Buffer.from([5, code, 0, 1, 0, 0, 0, 0, 0, 0]);
    return net.createServer((sock) => {
      sock.on('error', () => {});
      sock.once('data', (greeting) => {
        if (greeting[0] !== 5) return sock.destroy();
        sock.write(Buffer.from([5, 0]));
        sock.once('data', (req) => {
          if (req[0] !== 5 || req[1] !== 1) return sock.end(reply(7));
          let host;
          let offset;
          if (req[3] === 1) {
            host = Array.from(req.subarray(4, 8)).join('.');
            offset = 8;
          } else if (req[3] === 3) {
            host = req.subarray(5, 5 + req[4]).toString();
            offset = 5 + req[4];
          } else if (req[3] === 4) {
            const parts = [];
            for (let i = 0; i < 16; i += 2) parts.push(req.readUInt16BE(4 + i).toString(16));
            host = parts.join(':');
            offset = 20;
          } else return sock.end(reply(8));
          const port = req.readUInt16BE(offset);
          conn.client.forwardOut('127.0.0.1', 0, host, port, (err, stream) => {
            if (err) return sock.end(reply(5));
            sock.write(reply(0));
            this._pipe(sock, stream);
          });
        });
      });
    });
  }

  _onRemoteForward(conn, info, accept, rejectConn) {
    const f = conn.remoteForwards.find((x) => Number(x.bindPort) === info.destPort);
    if (!f) return rejectConn();
    const stream = accept();
    const sock = net.connect(Number(f.destPort), f.destHost || '127.0.0.1');
    this._pipe(sock, stream);
  }

  // ---------------------------------------------------------------------------
  // teardown

  _end(conn) {
    if (conn.closed) return;
    conn.closing = true;
    for (const s of conn.servers) s.close();
    try { conn.client.end(); } catch { /* ignore */ }
  }

  _closed(conn) {
    if (conn.closed) return;
    conn.closed = true;
    this.conns.delete(conn.id);
    for (const s of conn.servers) s.close();
    conn.servers = [];
    if (conn.jump) conn.jump.client.end();
    for (const holderId of conn.holders) {
      if (!this.shells.has(holderId)) this.holders.delete(holderId);
    }
    this.send('conn:closed', conn.id, conn.closing ? null : conn.lastError || 'Connection lost');
    this.emit('closed', conn.id);
  }
}

module.exports = { SshManager, expandHome, friendlyError };
