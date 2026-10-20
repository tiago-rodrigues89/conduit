'use strict';
// Minimal Telnet client (RFC 854) with the options terminals need:
// echo, suppress-go-ahead, binary, terminal type and window size (NAWS).

const net = require('net');
const { StringDecoder } = require('string_decoder');

const IAC = 255, DONT = 254, DO = 253, WONT = 252, WILL = 251, SB = 250, SE = 240;
const OPT = { BINARY: 0, ECHO: 1, SGA: 3, TTYPE: 24, NAWS: 31 };
const WE_DO = new Set([OPT.TTYPE, OPT.NAWS, OPT.SGA, OPT.BINARY]); // options we perform
const THEY_DO = new Set([OPT.ECHO, OPT.SGA, OPT.BINARY]); // options we accept from the server

class TelnetSession {
  constructor(termId, sock, { send, output }, size) {
    this.termId = termId;
    this.sock = sock;
    this.send = send;
    this.output = output;
    this.cols = size.cols;
    this.rows = size.rows;
    this.decoder = new StringDecoder('utf8');
    this.state = 'data';
    this.cmd = 0;
    this.sb = [];
    this.local = new Set(); // options enabled on our side
    this.remote = new Set(); // options enabled on the server side
    this.settled = false; // after a moment without WILL ECHO we echo locally
  }

  start() {
    // offer what we support right away; most servers wait for the client
    this.negotiate(WILL, OPT.TTYPE);
    this.negotiate(WILL, OPT.NAWS);
    this.negotiate(DO, OPT.SGA);
    this.negotiate(DO, OPT.ECHO);
    setTimeout(() => (this.settled = true), 1200);
  }

  raw(bytes) {
    if (!this.sock.destroyed) this.sock.write(Buffer.from(bytes));
  }

  negotiate(verb, opt) {
    if (verb === WILL) this.local.add(opt);
    if (verb === WONT) this.local.delete(opt);
    if (verb === DO) this.remote.add(opt);
    if (verb === DONT) this.remote.delete(opt);
    this.raw([IAC, verb, opt]);
    if (verb === WILL && opt === OPT.NAWS) this.sendSize();
  }

  sendSize() {
    if (!this.local.has(OPT.NAWS)) return;
    const bytes = [IAC, SB, OPT.NAWS];
    for (const v of [this.cols >> 8, this.cols & 255, this.rows >> 8, this.rows & 255]) {
      bytes.push(v);
      if (v === IAC) bytes.push(IAC);
    }
    bytes.push(IAC, SE);
    this.raw(bytes);
  }

  onCommand(verb, opt) {
    if (verb === DO) {
      if (WE_DO.has(opt)) {
        if (!this.local.has(opt)) this.negotiate(WILL, opt);
        else if (opt === OPT.NAWS) this.sendSize();
      } else this.raw([IAC, WONT, opt]);
    } else if (verb === DONT) {
      if (this.local.has(opt)) this.negotiate(WONT, opt);
    } else if (verb === WILL) {
      if (THEY_DO.has(opt)) {
        if (!this.remote.has(opt)) this.negotiate(DO, opt);
      } else this.raw([IAC, DONT, opt]);
    } else if (verb === WONT) {
      if (this.remote.has(opt)) this.negotiate(DONT, opt);
    }
  }

  onSubnegotiation(sb) {
    if (sb[0] === OPT.TTYPE && sb[1] === 1) {
      this.raw([IAC, SB, OPT.TTYPE, 0, ...Buffer.from('XTERM-256COLOR'), IAC, SE]);
    }
  }

  onData(buf) {
    const out = [];
    for (const b of buf) {
      switch (this.state) {
        case 'data':
          if (b === IAC) this.state = 'iac';
          else out.push(b);
          break;
        case 'iac':
          if (b === IAC) {
            out.push(IAC);
            this.state = 'data';
          } else if (b === WILL || b === WONT || b === DO || b === DONT) {
            this.cmd = b;
            this.state = 'opt';
          } else if (b === SB) {
            this.sb = [];
            this.state = 'sb';
          } else this.state = 'data';
          break;
        case 'opt':
          this.onCommand(this.cmd, b);
          this.state = 'data';
          break;
        case 'sb':
          if (b === IAC) this.state = 'sb-iac';
          else this.sb.push(b);
          break;
        case 'sb-iac':
          if (b === SE) {
            this.onSubnegotiation(this.sb);
            this.state = 'data';
          } else {
            if (b === IAC) this.sb.push(IAC);
            this.state = 'sb';
          }
          break;
      }
    }
    if (out.length) this.output.push(this.termId, this.decoder.write(Buffer.from(out)));
  }

  write(data) {
    if (this.settled && !this.remote.has(OPT.ECHO)) {
      // the server does not echo: show what is typed (like PuTTY's "auto" echo)
      const shown = data.replace(/\x7f/g, '\b \b').replace(/\r(?!\n)/g, '\r\n').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
      if (shown) this.output.push(this.termId, shown);
    }
    const binary = this.local.has(OPT.BINARY);
    // Enter: Telnet "new line" is CR LF unless both sides agreed on binary mode
    const text = binary ? data : data.replace(/\r(?!\n)/g, '\r\n');
    const bytes = [];
    for (const b of Buffer.from(text, 'utf8')) {
      bytes.push(b);
      if (b === IAC) bytes.push(IAC);
    }
    this.raw(bytes);
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.sendSize();
  }
}

class TelnetSessions {
  constructor({ send, output }) {
    this.send = send;
    this.output = output;
    this.sessions = new Map();
  }

  has(termId) {
    return this.sessions.has(termId);
  }

  open({ termId, host, port, cols, rows }) {
    this.close(termId);
    const { friendlyError } = require('./ssh');
    return new Promise((resolve, reject) => {
      const sock = net.connect({ host, port: Number(port) || 23 });
      const session = new TelnetSession(termId, sock, this, { cols: cols || 80, rows: rows || 24 });
      let connected = false;
      sock.setTimeout(15000, () => {
        if (!connected) sock.destroy(Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }));
      });
      sock.once('connect', () => {
        connected = true;
        sock.setTimeout(0);
        sock.setNoDelay(true);
        this.sessions.set(termId, session);
        this.output.register(termId, { pause: () => sock.pause(), resume: () => sock.resume() });
        session.start();
        resolve({ ok: true });
      });
      sock.on('data', (buf) => session.onData(buf));
      sock.on('error', (err) => {
        if (!connected) reject(friendlyError(err, host, port));
        else session.lastError = err.message;
      });
      sock.on('close', () => {
        if (!connected || this.sessions.get(termId) !== session) return;
        this.sessions.delete(termId);
        this.output.unregister(termId);
        this.send('term:exit', termId, {
          reason: session.lastError ? 'lost' : 'exit',
          message: session.lastError || 'Connection closed by foreign host',
        });
      });
    });
  }

  write(termId, data) {
    this.sessions.get(termId)?.write(data);
  }

  resize(termId, cols, rows) {
    this.sessions.get(termId)?.resize(cols, rows);
  }

  close(termId) {
    const s = this.sessions.get(termId);
    if (!s) return;
    this.sessions.delete(termId);
    this.output.unregister(termId);
    s.sock.destroy();
  }

  closeAll() {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }

  activeCount() {
    return this.sessions.size;
  }
}

module.exports = { TelnetSessions };
