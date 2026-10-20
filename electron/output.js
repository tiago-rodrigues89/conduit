'use strict';
// Batches terminal output into few IPC messages and applies simple flow
// control: when the renderer falls behind (e.g. `cat` of a huge file), the
// source stream is paused until the renderer acknowledges what it has drawn.

const HIGH_WATER = 2 * 1024 * 1024;
const LOW_WATER = 256 * 1024;
const FLUSH_MS = 4;

class TermOutput {
  /**
   * @param {Function} send IPC sender
   * @param {(termId: string, data: string) => void} [tap] sees all output (session logging)
   */
  constructor(send, tap) {
    this.send = send;
    this.tap = tap;
    this.pending = new Map();
    this.flow = new Map();
    this.timer = null;
  }

  register(termId, { pause, resume }) {
    this.flow.set(termId, { unacked: 0, paused: false, pause, resume });
  }

  unregister(termId) {
    this.flush();
    this.flow.delete(termId);
  }

  push(termId, data) {
    if (!data) return;
    if (this.tap) this.tap(termId, data);
    const prev = this.pending.get(termId);
    this.pending.set(termId, prev ? prev + data : data);
    const f = this.flow.get(termId);
    if (f) {
      f.unacked += data.length;
      if (!f.paused && f.unacked > HIGH_WATER) {
        f.paused = true;
        try { f.pause(); } catch { /* stream already gone */ }
      }
    }
    if (!this.timer) this.timer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const [termId, data] of this.pending) this.send('term:data', termId, data);
    this.pending.clear();
  }

  ack(termId, chars) {
    const f = this.flow.get(termId);
    if (!f) return;
    f.unacked = Math.max(0, f.unacked - chars);
    if (f.paused && f.unacked < LOW_WATER) {
      f.paused = false;
      try { f.resume(); } catch { /* stream already gone */ }
    }
  }
}

module.exports = { TermOutput };
