import { useEffect, useState } from 'react';
import { FolderOpen, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { uid } from '../../lib/defaults';
import type { Credential } from '../../lib/types';
import { closeDialog, saveCredential, useApp, type Dialog } from '../../store/app';
import { Field, Modal, PasswordInput } from '../ui';

/** Create or edit a saved login (username + password and/or key). */
export function CredentialDialog({ d }: { d: Extract<Dialog, { type: 'credential' }> }) {
  const existing = useApp.getState().credentials.find((c) => c.id === d.credentialId);
  const [c, setC] = useState<Credential>(() => existing || { id: uid(), name: '', username: '', keyPath: '', notes: '' });
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [flags, setFlags] = useState({ password: false, passphrase: false });
  const [forget, setForget] = useState(false);

  useEffect(() => {
    if (existing) api.secrets.flags(`cred:${existing.id}`).then(setFlags).catch(() => {});
  }, []);

  const valid = c.name.trim() && c.username.trim();
  const save = async () => {
    if (!valid) return;
    const item = { ...c, name: c.name.trim(), username: c.username.trim() };
    saveCredential(item);
    const patch: { password?: string | null; passphrase?: string | null } = {};
    if (password) patch.password = password;
    else if (forget) patch.password = null;
    if (passphrase) patch.passphrase = passphrase;
    if (Object.keys(patch).length) await api.secrets.set(`cred:${item.id}`, patch).catch(() => {});
    closeDialog(d.id);
    d.onSaved?.(item.id);
  };

  const browseKey = async () => {
    const res = await api.openDialog({ title: 'Choose a private key', defaultPath: '~/.ssh', buttonLabel: 'Use key' });
    if (res?.[0]) setC({ ...c, keyPath: res[0].replace(useApp.getState().info?.home || '\u0000', '~') });
  };

  return (
    <Modal
      title={existing ? `Edit “${existing.name}”` : 'New credential'}
      icon={<KeyRound size={18} />}
      onClose={() => closeDialog(d.id)}
      width={480}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="field-hint block">A saved login you can pick in any session. Changing it here updates every session that uses it.</p>
        <Field label="Name">
          <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Name of this login" autoFocus spellCheck={false} />
        </Field>
        <Field label="Username">
          <input value={c.username} onChange={(e) => setC({ ...c, username: e.target.value })} placeholder="Username" spellCheck={false} />
        </Field>
        <Field
          label="Password"
          hint={
            flags.password && !forget ? (
              <>
                A password is saved.{' '}
                <button type="button" className="link-btn" onClick={() => setForget(true)}>
                  Forget it
                </button>
              </>
            ) : forget ? (
              'The saved password will be removed.'
            ) : (
              'Stored encrypted with a key in the macOS Keychain.'
            )
          }
        >
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={flags.password && !forget ? '••••••••  (saved — type to replace)' : ''}
            reveal={existing && flags.password && !forget ? () => api.secrets.reveal(`cred:${existing.id}`) : undefined}
          />
        </Field>
        <Field label="Private key" hint="Optional, for key-based logins.">
          <div className="input-with-btn">
            <input value={c.keyPath} onChange={(e) => setC({ ...c, keyPath: e.target.value })} placeholder="~/.ssh/id_ed25519" spellCheck={false} />
            <button type="button" className="btn" onClick={browseKey}>
              <FolderOpen size={14} /> Browse
            </button>
          </div>
        </Field>
        {c.keyPath && (
          <Field label="Key passphrase" hint={flags.passphrase ? 'A passphrase is saved.' : 'Only for encrypted keys.'}>
            <PasswordInput value={passphrase} onChange={setPassphrase} placeholder={flags.passphrase ? '••••••••  (saved)' : ''} />
          </Field>
        )}
        <Field label="Notes">
          <input value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} placeholder="Optional" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
