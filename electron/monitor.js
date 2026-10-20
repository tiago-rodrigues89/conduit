'use strict';
// Server monitoring for the status bar (like MobaXterm): one long-running
// exec channel per connection prints a small sample every few seconds.
// Linux reads /proc; other systems report what they can (OS, disk, load).

const INTERVAL = 3;

const SCRIPT = `
LC_ALL=C; export LC_ALL
if [ -r /etc/os-release ]; then os=$(. /etc/os-release; echo "$PRETTY_NAME")
elif command -v sw_vers >/dev/null 2>&1; then os="$(sw_vers -productName) $(sw_vers -productVersion)"
fi
[ -n "$os" ] || os=$(uname -s)
echo "O $os"
echo "K $(uname -sr)"
echo "H $(hostname 2>/dev/null)"
echo "Z $(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null)"
while :; do
  [ -r /proc/stat ] && echo "C $(head -1 /proc/stat)"
  [ -r /proc/meminfo ] && echo "M $(awk '/^(MemTotal|MemAvailable|MemFree|Buffers|Cached|SwapTotal|SwapFree):/{printf "%s=%s ", $1, $2}' /proc/meminfo)"
  echo "D $(df -Pk / 2>/dev/null | awk 'NR==2{print $2, $3}')"
  [ -r /proc/net/dev ] && echo "N $(awk -F'[: ]+' 'NR>2 && $2!="lo"{rx+=$3; tx+=$11} END{print rx+0, tx+0}' /proc/net/dev)"
  if [ -r /proc/uptime ]; then echo "U $(cut -d' ' -f1 /proc/uptime)"; fi
  if [ -r /proc/loadavg ]; then echo "L $(cut -d' ' -f1-3 /proc/loadavg)"; else echo "L $(uptime 2>/dev/null | sed 's/.*average[s]*: *//; s/,/ /g')"; fi
  echo "E"
  sleep ${INTERVAL} || exit
done
`;

class Monitor {
  constructor({ ssh, send }) {
    this.ssh = ssh;
    this.send = send;
    this.active = new Map(); // connId -> { stream, prev }
    ssh.on('closed', (connId) => this.stop(connId));
  }

  start(connId) {
    if (this.active.has(connId)) return;
    const conn = this.ssh.conns.get(connId);
    if (!conn || conn.closed) return;
    const state = { stream: null, prev: null, info: {}, buf: '', sample: {} };
    this.active.set(connId, state);
    const b64 = Buffer.from(SCRIPT).toString('base64');
    conn.client.exec(`echo ${b64} | base64 -d | sh`, (err, stream) => {
      if (err || !this.active.has(connId)) {
        this.active.delete(connId);
        return;
      }
      state.stream = stream;
      stream.stderr.on('data', () => {});
      stream.on('data', (d) => {
        state.buf += d.toString('utf8');
        let nl;
        while ((nl = state.buf.indexOf('\n')) !== -1) {
          this._line(connId, state, state.buf.slice(0, nl));
          state.buf = state.buf.slice(nl + 1);
        }
      });
      stream.on('close', () => {
        if (this.active.get(connId) === state) this.active.delete(connId);
      });
    });
  }

  stop(connId) {
    const state = this.active.get(connId);
    if (!state) return;
    this.active.delete(connId);
    try { state.stream && state.stream.close(); } catch { /* ignore */ }
  }

  _line(connId, state, line) {
    const tag = line[0];
    const v = line.slice(2).trim();
    const s = state.sample;
    switch (tag) {
      case 'O': state.info.os = v; break;
      case 'K': state.info.kernel = v; break;
      case 'H': state.info.hostname = v; break;
      case 'Z': state.info.cores = Number(v) || undefined; break;
      case 'C': {
        const n = v.split(/\s+/).slice(1).map(Number);
        const idle = (n[3] || 0) + (n[4] || 0);
        const total = n.slice(0, 8).reduce((a, b) => a + (b || 0), 0);
        s.cpuRaw = { idle, total };
        break;
      }
      case 'M': {
        const m = Object.fromEntries(v.split(/\s+/).filter(Boolean).map((kv) => kv.replace(':', '').split('=')).map(([k, x]) => [k, Number(x) * 1024]));
        const total = m.MemTotal;
        const avail = m.MemAvailable ?? (m.MemFree || 0) + (m.Buffers || 0) + (m.Cached || 0);
        if (total) s.mem = { total, used: Math.max(0, total - avail) };
        if (m.SwapTotal) s.swap = { total: m.SwapTotal, used: m.SwapTotal - (m.SwapFree || 0) };
        break;
      }
      case 'D': {
        const [total, used] = v.split(/\s+/).map(Number);
        if (total) s.disk = { total: total * 1024, used: used * 1024 };
        break;
      }
      case 'N': {
        const [rx, tx] = v.split(/\s+/).map(Number);
        s.netRaw = { rx, tx, at: Date.now() };
        break;
      }
      case 'U': s.uptime = Math.round(Number(v)) || undefined; break;
      case 'L': {
        const l = v.split(/\s+/).map(Number).filter((x) => !Number.isNaN(x));
        if (l.length) s.load = l.slice(0, 3);
        break;
      }
      case 'E': this._emit(connId, state); break;
    }
  }

  _emit(connId, state) {
    const s = state.sample;
    const prev = state.prev;
    const out = { ...state.info, mem: s.mem, swap: s.swap, disk: s.disk, uptime: s.uptime, load: s.load };
    if (prev && s.cpuRaw && prev.cpuRaw) {
      const dt = s.cpuRaw.total - prev.cpuRaw.total;
      const di = s.cpuRaw.idle - prev.cpuRaw.idle;
      if (dt > 0) out.cpu = Math.min(100, Math.max(0, (1 - di / dt) * 100));
    }
    if (prev && s.netRaw && prev.netRaw) {
      const sec = (s.netRaw.at - prev.netRaw.at) / 1000;
      if (sec > 0) {
        out.rx = Math.max(0, (s.netRaw.rx - prev.netRaw.rx) / sec);
        out.tx = Math.max(0, (s.netRaw.tx - prev.netRaw.tx) / sec);
      }
    }
    state.prev = { cpuRaw: s.cpuRaw, netRaw: s.netRaw };
    state.sample = {};
    this.send('monitor:update', connId, out);
  }
}

module.exports = { Monitor };
