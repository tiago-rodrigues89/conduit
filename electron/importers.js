'use strict';
// Importers for OpenSSH client config (~/.ssh/config) and MobaXterm session
// exports (.mxtsessions / MobaXterm.ini). They return plain session
// descriptions; the renderer turns them into folders and sessions.

const fs = require('fs');
const os = require('os');
const path = require('path');

function expandHome(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function globMatch(pattern, value) {
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i'
  );
  return re.test(value);
}

function expandInclude(pattern) {
  let full = expandHome(pattern);
  if (!path.isAbsolute(full)) full = path.join(os.homedir(), '.ssh', full);
  if (!/[*?]/.test(path.basename(full))) return fs.existsSync(full) ? [full] : [];
  const dir = path.dirname(full);
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => globMatch(path.basename(full), n))
      .sort()
      .map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

function parseSshConfigFile(file, blocks, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+?)\s*(?:=\s*|\s+)(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].replace(/^"(.*)"$/, '$1').trim();
    if (key === 'include') {
      for (const part of value.split(/\s+/)) {
        for (const f of expandInclude(part)) parseSshConfigFile(f, blocks, seen);
      }
      continue;
    }
    if (key === 'host') {
      current = { patterns: value.split(/\s+/), opts: {} };
      blocks.push(current);
      continue;
    }
    if (key === 'match') {
      current = null;
      continue;
    }
    if (!current) {
      current = { patterns: ['*'], opts: {} };
      blocks.push(current);
    }
    if (current.opts[key] === undefined) current.opts[key] = value;
  }
}

function importSshConfig(file) {
  const blocks = [];
  parseSshConfigFile(file || path.join(os.homedir(), '.ssh', 'config'), blocks, new Set());
  const results = [];
  for (const block of blocks) {
    for (const alias of block.patterns) {
      if (/[*?!]/.test(alias)) continue;
      // First value wins, including values from later matching wildcard blocks.
      const opts = {};
      for (const b of blocks) {
        const matches = b.patterns.some((pt) => !pt.startsWith('!') && globMatch(pt, alias));
        const negated = b.patterns.some((pt) => pt.startsWith('!') && globMatch(pt.slice(1), alias));
        if (!matches || negated) continue;
        for (const [k, v] of Object.entries(b.opts)) if (opts[k] === undefined) opts[k] = v;
      }
      results.push({
        name: alias,
        host: (opts.hostname || alias).replace(/%h/g, alias),
        port: opts.port ? Number(opts.port) : 22,
        username: opts.user || '',
        keyPath: opts.identityfile ? opts.identityfile.split(/\s+/)[0] : '',
        jump: opts.proxyjump && opts.proxyjump !== 'none' ? opts.proxyjump.split(',')[0] : '',
        forwardAgent: /^yes$/i.test(opts.forwardagent || ''),
      });
    }
  }
  const seenNames = new Set();
  return results.filter((r) => (seenNames.has(r.name) ? false : seenNames.add(r.name)));
}

// ---- MobaXterm ---------------------------------------------------------------

// Session type numbers as they appear after the icon number, e.g. "#109#0%host…"
const MOBA_TYPES = {
  0: 'SSH', 1: 'Telnet', 2: 'Rsh', 3: 'Xdmcp', 4: 'RDP', 5: 'VNC', 6: 'FTP', 7: 'SFTP',
  8: 'Serial', 9: 'File', 10: 'Shell', 11: 'Browser', 12: 'Mosh', 13: 'S3', 14: 'WSL',
};
const MOBA_SSH = 0;
// MobaXterm type number -> Conduit session type (with its default port)
const MOBA_IMPORT = {
  0: ['ssh', 22],
  1: ['telnet', 23],
  4: ['rdp', 3389],
  5: ['vnc', 5900],
  7: ['sftp', 22],
};

function mobaDecode(s) {
  return String(s || '')
    .replace(/__DIEZE__/g, '#')
    .replace(/__PTVIRG__/g, ';')
    .replace(/__PIPE__/g, '|')
    .replace(/__DBLQUO__/g, '"')
    .replace(/__PERCENT__/g, '%')
    .trim();
}

function mobaKeyPath(raw) {
  const v = mobaDecode(raw);
  if (!v) return '';
  if (/^_ProfileDir_/i.test(v)) return '~' + v.replace(/^_ProfileDir_/i, '').replace(/\\/g, '/');
  // Windows paths cannot be used directly; assume the key was copied to ~/.ssh.
  return `~/.ssh/${v.split(/[\\/]/).pop()}`;
}

function importMobaXterm(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) buf = buf.subarray(3);
  let text = buf.toString('utf8');
  if (text.includes('�')) text = buf.toString('latin1');

  const sessions = [];
  const skipped = {};
  let section = null;
  let folder = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      section = sec[1];
      folder = [];
      continue;
    }
    if (!section || !/^Bookmarks/i.test(section)) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    if (key === 'SubRep') {
      folder = value.split('\\').map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (key === 'ImgNum' || !value.startsWith('#')) continue;
    const parts = value.split('#');
    const fields = (parts[2] || '').split('%');
    const type = Number(fields[0]);
    if (!MOBA_IMPORT[type]) {
      const name = MOBA_TYPES[type] || `type ${fields[0]}`;
      skipped[name] = (skipped[name] || 0) + 1;
      continue;
    }
    const host = mobaDecode(fields[1]);
    if (!host) continue;
    const [kind, defaultPort] = MOBA_IMPORT[type];
    const session = {
      type: kind,
      name: mobaDecode(key),
      folder,
      host,
      port: Number(fields[2]) || defaultPort,
      username: mobaDecode(fields[3]),
      initCommand: type === MOBA_SSH ? mobaDecode(fields[7]) : '',
      keyPath: type === MOBA_SSH ? mobaKeyPath(fields[14]) : '',
    };
    const gwHost = type === MOBA_SSH ? mobaDecode(fields[8]) : '';
    if (gwHost) {
      session.gateway = {
        host: gwHost,
        port: Number(fields[9]) || 22,
        username: mobaDecode(fields[10]),
      };
    }
    sessions.push(session);
  }
  return { sessions, skipped };
}

module.exports = { importSshConfig, importMobaXterm };
