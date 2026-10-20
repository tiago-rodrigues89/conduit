import { flushPersist, toast } from '../store/app';
import { api } from './api';
import { shortPath } from './logging';

/** Writes the SSH sessions as an OpenSSH config file. */
export async function exportSshConfig() {
  try {
    await flushPersist();
    const res = await api.backup.sshConfig();
    if (res) toast('success', `Exported ${res.count} SSH session${res.count === 1 ? '' : 's'} to ${shortPath(res.file)}`, { label: 'Show in Finder', run: () => api.fs.reveal(res.file) });
  } catch (err: any) {
    toast('error', err.message);
  }
}
