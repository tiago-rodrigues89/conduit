'use strict';
// Session logging: writes what a terminal shows to a text file. Plain mode
// turns the terminal stream into readable lines (colors and cursor codes
// removed, overwritten text resolved); raw mode keeps the bytes as they came.

const fs = require('fs');
const path = require('path');
const { resolveDir } = require('./localfs');

const TOKEN_RE = /\x1b\[([0-9;?]*)[ -/]*([@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1bP[\s\S]*?\x1b\\|\x1b[()*+][0-9A-Za-z]|\x1b[^[\]P]|\r|\n|\x08|[^\x1b\r\n\x08]+/g;
const CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f]/g;
const COMPLETE_ESC_RE = /^(?:\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1bP[\s\S]*?\x1b\\|\x1b[()*+][0-9A-Za-z]|\x1b[^[\]P()*+])/;

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function safeName(s) {
  return String(s || '').replace(/[\/\\:*?"<>|\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'session';
}

function fileName(pattern, meta) {
  const d = new Date();
  const values = {
    session: meta.session,
    host: meta.host,
    user: meta.user,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`,
  };
  const base = String(pattern || '{session}_{date}_{time}').replace(/\{(\w+)\}/g, (m, k) => (k in values ? safeName(values[k] || '') : m));
  return safeName(base).replace(/\.log$/i, '');
}

class LogFile {
  constructor(file, opts) {
    this.file = file;
    this.raw = !!opts.raw;
    this.timestamps = !!opts.timestamps;
    this.stream = fs.createWriteStream(file, { flags: 'a', mode: 0o600 });
    this.stream.on('error', () => {});
    this.cur = '';
    this.col = 0;
    this.lineStarted = null;
    this.carry = '';
  }

  header(text) {
    this.stream.write(`${text}\n`);
  }

  write(data) {
    if (this.raw) {
      this.stream.write(data);
      return;
    }
    // an escape sequence can be split across two chunks: keep the start for later
    data = this.carry + data;
    this.carry = '';
    const esc = data.lastIndexOf('\x1b');
    if (esc !== -1 && data.length - esc < 4096 && !COMPLETE_ESC_RE.test(data.slice(esc))) {
      this.carry = data.slice(esc);
      data = data.slice(0, esc);
    }
    let out = '';
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(data))) {
      const tok = m[0];
      if (tok === '\n') {
        out += this._emit();
      } else if (tok === '\r') {
        this.col = 0;
      } else if (tok === '\x08') {
        this.col = Math.max(0, this.col - 1);
      } else if (tok[0] === '\x1b') {
        if (m[2]) this._csi(m[1], m[2]);
      } else {
        this._text(tok.replace(CONTROL_RE, (c) => (c === '\t' ? '\t' : '')));
      }
    }
    if (out) this.stream.write(out);
  }

  _text(t) {
    if (!t) return;
    if (!this.lineStarted) this.lineStarted = new Date();
    if (this.col > this.cur.length) this.cur += ' '.repeat(this.col - this.cur.length);
    this.cur = this.cur.slice(0, this.col) + t + this.cur.slice(this.col + t.length);
    this.col += t.length;
  }

  _csi(params, final) {
    const n = Number(params.split(';')[0]) || 0;
    switch (final) {
      case 'K': // erase in line
        if (n === 0) this.cur = this.cur.slice(0, this.col);
        else if (n === 2) this.cur = '';
        break;
      case 'C': // cursor forward
        this.col += n || 1;
        break;
      case 'D': // cursor back
        this.col = Math.max(0, this.col - (n || 1));
        break;
      case 'G': // cursor to column
        this.col = Math.max(0, (n || 1) - 1);
        break;
      case 'J': // erase in display
        if (n === 2 || n === 3) this.cur = '';
        break;
    }
  }

  _emit() {
    const line = this.cur.replace(/\s+$/, '');
    const prefix = this.timestamps ? `[${stamp(this.lineStarted || new Date())}] ` : '';
    this.cur = '';
    this.col = 0;
    this.lineStarted = null;
    return `${prefix}${line}\n`;
  }

  close(footer) {
    if (!this.raw && this.cur.trim()) this.stream.write(this._emit());
    if (footer) this.stream.write(`${this.raw ? '\r\n' : ''}${footer}\n`);
    this.stream.end();
  }
}

class SessionLogger {
  constructor() {
    this.logs = new Map(); // termId -> LogFile
  }

  /** Starts a new log file for a terminal; returns its path. */
  start(termId, opts) {
    this.stop(termId);
    const dir = resolveDir(opts.dir || '~/Documents/Conduit Logs');
    fs.mkdirSync(dir, { recursive: true });
    const base = fileName(opts.name, opts);
    let file = path.join(dir, `${base}.log`);
    for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${base}-${i}.log`);
    const log = new LogFile(file, opts);
    const who = opts.user ? `${opts.user}@${opts.host}` : opts.host;
    log.header(`# Conduit session log · ${opts.session}${who ? ` (${who})` : ''} · started ${stamp()}`);
    this.logs.set(termId, log);
    return file;
  }

  write(termId, data) {
    const log = this.logs.get(termId);
    if (log) log.write(data);
  }

  stop(termId) {
    const log = this.logs.get(termId);
    if (!log) return;
    this.logs.delete(termId);
    log.close(`# ended ${stamp()}`);
  }

  stopAll() {
    for (const id of [...this.logs.keys()]) this.stop(id);
  }
}

module.exports = { SessionLogger, LogFile, fileName };
