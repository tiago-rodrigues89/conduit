'use strict';
// Host key verification. Keys are checked against the user's OpenSSH
// ~/.ssh/known_hosts (read only) and Conduit's own trust store.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./store');

function fingerprint(key) {
  return 'SHA256:' + crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
}

function keyType(key) {
  try {
    const len = key.readUInt32BE(0);
    return key.subarray(4, 4 + len).toString('ascii');
  } catch {
    return 'unknown';
  }
}

function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function hostMatches(field, candidates) {
  if (field.startsWith('|1|')) {
    const [, , salt, hash] = field.split('|');
    if (!salt || !hash) return false;
    const saltBuf = Buffer.from(salt, 'base64');
    return candidates.some(
      (c) => crypto.createHmac('sha1', saltBuf).update(c).digest('base64') === hash
    );
  }
  let matched = false;
  for (const pattern of field.split(',')) {
    const negate = pattern.startsWith('!');
    const re = globToRegex(negate ? pattern.slice(1) : pattern);
    if (candidates.some((c) => re.test(c))) {
      if (negate) return false;
      matched = true;
    }
  }
  return matched;
}

function checkOpenSSH(host, port, key) {
  const file = path.join(os.homedir(), '.ssh', 'known_hosts');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return 'unknown';
  }
  const candidates = port === 22 ? [host] : [`[${host}]:${port}`];
  const type = keyType(key);
  const b64 = key.toString('base64');
  let result = 'unknown';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0].startsWith('@')) {
      if (parts[0] === '@revoked' && parts[3] === b64) return 'revoked';
      continue;
    }
    const [hosts, ktype, kdata] = parts;
    if (!hosts || !kdata || !hostMatches(hosts, candidates)) continue;
    if (kdata === b64) return 'match';
    if (ktype === type) result = 'mismatch';
  }
  return result;
}

function storeKey(host, port) {
  return `${host}:${port}`;
}

/**
 * @returns {{status: 'trusted'|'unknown'|'changed'|'revoked', fingerprint: string, type: string, previous?: string}}
 */
function verify(host, port, key) {
  const fp = fingerprint(key);
  const type = keyType(key);
  const known = store.readJson('knownHosts', {});
  const entry = known[storeKey(host, port)];
  const openssh = checkOpenSSH(host, port, key);

  if (openssh === 'revoked') return { status: 'revoked', fingerprint: fp, type };
  if (entry && entry.key === key.toString('base64')) return { status: 'trusted', fingerprint: fp, type };
  if (openssh === 'match') return { status: 'trusted', fingerprint: fp, type };
  if (entry && entry.type === type) {
    return { status: 'changed', fingerprint: fp, type, previous: entry.fingerprint };
  }
  if (openssh === 'mismatch') return { status: 'changed', fingerprint: fp, type, previous: '(from ~/.ssh/known_hosts)' };
  return { status: 'unknown', fingerprint: fp, type };
}

function trust(host, port, key) {
  const known = store.readJson('knownHosts', {});
  known[storeKey(host, port)] = {
    type: keyType(key),
    key: key.toString('base64'),
    fingerprint: fingerprint(key),
    added: new Date().toISOString(),
  };
  store.writeJson('knownHosts', known);
}

module.exports = { verify, trust, fingerprint };
