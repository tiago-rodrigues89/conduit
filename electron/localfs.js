'use strict';
// Local file system access for the dual-pane file browser.

const { shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { modeString } = require('./sftp');

function resolveDir(dir) {
  if (!dir || dir === '~') return os.homedir();
  if (dir.startsWith('~/')) return path.join(os.homedir(), dir.slice(2));
  return path.resolve(dir);
}

async function list(dir) {
  const abs = resolveDir(dir);
  const names = await fs.promises.readdir(abs);
  const entries = await Promise.all(
    names.map(async (name) => {
      const full = path.join(abs, name);
      try {
        const lst = await fs.promises.lstat(full);
        const isLink = lst.isSymbolicLink();
        const st = isLink ? await fs.promises.stat(full).catch(() => lst) : lst;
        const type = isLink ? 'link' : st.isDirectory() ? 'dir' : 'file';
        return {
          name,
          type,
          linkDir: isLink && st.isDirectory(),
          size: st.isDirectory() ? 0 : st.size,
          mtime: st.mtimeMs,
          mode: st.mode & 0o7777,
          perms: modeString(st.mode, type),
        };
      } catch {
        return null;
      }
    })
  );
  return { path: abs, entries: entries.filter(Boolean) };
}

async function mkdir(target) {
  await fs.promises.mkdir(resolveDir(target));
}

async function touch(target) {
  await fs.promises.writeFile(resolveDir(target), '', { flag: 'wx' });
}

async function rename(from, to) {
  const dest = resolveDir(to);
  if (fs.existsSync(dest)) throw new Error('A file with that name already exists');
  await fs.promises.rename(resolveDir(from), dest);
}

async function trash(targets) {
  for (const t of targets) await shell.trashItem(resolveDir(t));
}

async function open(target) {
  const err = await shell.openPath(resolveDir(target));
  if (err) throw new Error(err);
}

function reveal(target) {
  shell.showItemInFolder(resolveDir(target));
}

/** Last `maxBytes` of a local text file (shell history of local tabs). */
async function readTail(target, maxBytes = 512 * 1024) {
  const file = resolveDir(target);
  const st = await fs.promises.stat(file);
  const length = Math.min(st.size, maxBytes);
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, st.size - length);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}

module.exports = { list, mkdir, touch, rename, trash, open, reveal, resolveDir, readTail };
