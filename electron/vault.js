'use strict';
// Passphrase encryption for backups and the sync file: scrypt + AES-256-GCM.

const crypto = require('crypto');

const KDF = { name: 'scrypt', N: 32768, r: 8, p: 1 };
const keyCache = new Map();

function deriveKey(passphrase, salt, kdf = KDF) {
  const cacheKey = crypto.createHash('sha256').update(salt).update('\0').update(passphrase).digest('hex');
  const hit = keyCache.get(cacheKey);
  if (hit) return hit;
  const key = crypto.scryptSync(String(passphrase), salt, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 128 * 1024 * 1024 });
  keyCache.set(cacheKey, key);
  return key;
}

/** Encrypts a JSON value. Pass `salt` (base64) to reuse a key derived before. */
function encryptJson(value, passphrase, salt) {
  const saltBuf = salt ? Buffer.from(salt, 'base64') : crypto.randomBytes(16);
  const key = deriveKey(passphrase, saltBuf);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    kdf: { ...KDF, salt: saltBuf.toString('base64') },
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    payload: payload.toString('base64'),
  };
}

function decryptJson(env, passphrase) {
  if (!env || !env.kdf || !env.payload) throw new Error('The file is not encrypted the way Conduit expects');
  const key = deriveKey(passphrase, Buffer.from(env.kdf.salt, 'base64'), env.kdf);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
    const text = Buffer.concat([decipher.update(Buffer.from(env.payload, 'base64')), decipher.final()]).toString('utf8');
    return JSON.parse(text);
  } catch {
    const e = new Error('Wrong passphrase');
    e.code = 'BAD_PASSPHRASE';
    throw e;
  }
}

module.exports = { encryptJson, decryptJson };
