// File operations with their UI flows (prompts, confirmations, toasts), shared
// by the sidebar Files panel and the dual-pane SFTP browser.

import { api } from './api';
import { joinLocal, joinRemote, shellQuote } from './format';
import { terminals } from './terminals';
import type { FileEntry } from './types';
import { confirm, confirmDialog, inputDialog, permissionsDialog, toast, useApp } from '../store/app';

const fail = (err: any) => {
  toast('error', err?.message || String(err));
  return false;
};

const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() || p;

// ---- remote ----------------------------------------------------------------------------

export async function remoteNewFolder(connId: string, dir: string) {
  const name = await inputDialog({ title: 'New folder', label: 'Folder name', placeholder: 'untitled folder', confirmLabel: 'Create' });
  if (!name) return false;
  try {
    await api.sftp.mkdir(connId, joinRemote(dir, name.trim()));
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function remoteNewFile(connId: string, dir: string) {
  const name = await inputDialog({ title: 'New file', label: 'File name', placeholder: 'notes.txt', confirmLabel: 'Create' });
  if (!name) return false;
  try {
    await api.sftp.touch(connId, joinRemote(dir, name.trim()));
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function remoteRename(connId: string, dir: string, entry: FileEntry) {
  const name = await inputDialog({ title: 'Rename', label: 'New name', value: entry.name, confirmLabel: 'Rename', selectBase: true });
  if (!name || name === entry.name) return false;
  try {
    await api.sftp.rename(connId, joinRemote(dir, entry.name), joinRemote(dir, name.trim()));
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function remoteDelete(connId: string, dir: string, names: string[]) {
  const ok = await confirm({
    title: names.length === 1 ? `Delete “${names[0]}”?` : `Delete ${names.length} items?`,
    message: 'Files are deleted permanently on the server. Folders are deleted with everything inside.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.sftp.remove(connId, names.map((n) => joinRemote(dir, n)));
    toast('success', names.length === 1 ? `Deleted ${names[0]}` : `Deleted ${names.length} items`);
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function remotePermissions(connId: string, dir: string, entries: FileEntry[]) {
  if (!entries.length) return false;
  const res = await permissionsDialog(
    entries.map((e) => e.name),
    entries[0].mode & 0o777,
    entries.some((e) => e.type === 'dir')
  );
  if (!res) return false;
  try {
    await api.sftp.chmod(connId, entries.map((e) => joinRemote(dir, e.name)), res.mode, res.recursive);
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function remoteEdit(connId: string, dir: string, entry: FileEntry, appName?: string) {
  if (entry.size > 50 * 1024 * 1024) {
    const ok = await confirm({
      title: 'Open a large file?',
      message: `“${entry.name}” is ${Math.round(entry.size / 1024 / 1024)} MB and will be downloaded first.`,
      confirmLabel: 'Open',
    });
    if (!ok) return;
  }
  try {
    await api.sftp.edit(connId, joinRemote(dir, entry.name), appName ?? (useApp.getState().settings.editorApp || undefined));
    toast('info', `Opened ${entry.name} — saved changes are uploaded automatically`);
  } catch (err) {
    fail(err);
  }
}

export async function downloadDir(): Promise<string | null> {
  const { settings, info } = useApp.getState();
  if (settings.askDownloadDir) {
    const res = await api.openDialog({ title: 'Download to…', directory: true, buttonLabel: 'Download here', defaultPath: settings.downloadDir || info?.downloads });
    return res?.[0] || null;
  }
  return settings.downloadDir || info?.downloads || null;
}

export async function remoteDownload(connId: string, dir: string, names: string[], targetDir?: string, conflict: 'overwrite' | 'skip' = 'overwrite') {
  const target = targetDir || (await downloadDir());
  if (!target || !names.length) return;
  try {
    await api.transfer.start({ connId, direction: 'download', sources: names.map((n) => joinRemote(dir, n)), targetDir: target, conflict });
  } catch (err) {
    fail(err);
  }
}

/** Uploads local paths, asking first when names already exist in the target folder. */
export async function remoteUpload(connId: string, dir: string, localPaths: string[], existing?: Set<string>) {
  if (!localPaths.length) return;
  let conflict: 'overwrite' | 'skip' = 'overwrite';
  const clashes = existing ? localPaths.map(basename).filter((n) => existing.has(n)) : [];
  if (clashes.length) {
    const choice = await confirmDialog({
      title: clashes.length === 1 ? `“${clashes[0]}” already exists` : `${clashes.length} items already exist`,
      message: `Replace the existing ${clashes.length === 1 ? 'item' : 'items'} in ${dir}?`,
      confirmLabel: 'Replace',
      extraLabel: 'Skip existing',
    });
    if (choice === 'cancel') return;
    conflict = choice === 'extra' ? 'skip' : 'overwrite';
  }
  try {
    await api.transfer.start({ connId, direction: 'upload', sources: localPaths, targetDir: dir, conflict });
  } catch (err) {
    fail(err);
  }
}

export async function chooseAndUpload(connId: string, dir: string, existing?: Set<string>) {
  const paths = await api.openDialog({ title: `Upload to ${dir}`, multiple: true, buttonLabel: 'Upload' });
  if (paths?.length) await remoteUpload(connId, dir, paths, existing);
}

export function cdInTerminal(tabId: string | undefined, path: string) {
  const t = terminals.get(tabId);
  if (!t) return;
  t.sendInput(`cd ${shellQuote(path)}\r`);
  t.focus();
}

export function copyText(text: string, what = 'Copied') {
  api.clipboard.write(text).then(() => toast('success', what));
}

// ---- local --------------------------------------------------------------------------------

export async function localNewFolder(dir: string) {
  const name = await inputDialog({ title: 'New folder', label: 'Folder name', placeholder: 'untitled folder', confirmLabel: 'Create' });
  if (!name) return false;
  try {
    await api.fs.mkdir(joinLocal(dir, name.trim()));
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function localRename(dir: string, entry: FileEntry) {
  const name = await inputDialog({ title: 'Rename', label: 'New name', value: entry.name, confirmLabel: 'Rename', selectBase: true });
  if (!name || name === entry.name) return false;
  try {
    await api.fs.rename(joinLocal(dir, entry.name), joinLocal(dir, name.trim()));
    return true;
  } catch (err) {
    return fail(err);
  }
}

export async function localTrash(dir: string, names: string[]) {
  const ok = await confirm({
    title: names.length === 1 ? `Move “${names[0]}” to the Trash?` : `Move ${names.length} items to the Trash?`,
    message: 'You can restore them from the Trash in Finder.',
    confirmLabel: 'Move to Trash',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.fs.trash(names.map((n) => joinLocal(dir, n)));
    return true;
  } catch (err) {
    return fail(err);
  }
}
