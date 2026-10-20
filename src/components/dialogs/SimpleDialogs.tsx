import { useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldAlert, ShieldQuestion, SquareTerminal } from 'lucide-react';
import { api } from '../../lib/api';
import { uid } from '../../lib/defaults';
import type { HostKeyPayload, PromptPayload, Snippet } from '../../lib/types';
import { closeDialog, saveSnippet, useApp, type Dialog } from '../../store/app';
import { quickConnect } from '../HomeView';
import { Field, Modal, PasswordInput, Toggle } from '../ui';

type Of<T extends Dialog['type']> = Extract<Dialog, { type: T }>;

export function ConfirmDialog({ d }: { d: Of<'confirm'> }) {
  const done = (v: 'confirm' | 'cancel' | 'extra') => {
    closeDialog(d.id);
    d.resolve(v);
  };
  return (
    <Modal
      title={d.title}
      onClose={() => done('cancel')}
      width={420}
      footer={
        <>
          {d.extraLabel && (
            <button className="btn" onClick={() => done('extra')}>
              {d.extraLabel}
            </button>
          )}
          <span className="flex" />
          <button className="btn" onClick={() => done('cancel')}>
            {d.cancelLabel || 'Cancel'}
          </button>
          <button className={`btn ${d.danger ? 'danger' : 'primary'}`} data-autofocus onClick={() => done('confirm')}>
            {d.confirmLabel || 'OK'}
          </button>
        </>
      }
    >
      <p className="dialog-message">{d.message}</p>
      {d.detail && <pre className="dialog-detail">{d.detail}</pre>}
    </Modal>
  );
}

export function InputDialog({ d }: { d: Of<'input'> }) {
  const [value, setValue] = useState(d.value || '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (d.selectBase && d.value) {
      const dot = d.value.lastIndexOf('.');
      el.setSelectionRange(0, dot > 0 ? dot : d.value.length);
    } else el.select();
  }, []);
  const done = (v: string | null) => {
    closeDialog(d.id);
    d.resolve(v);
  };
  return (
    <Modal
      title={d.title}
      onClose={() => done(null)}
      width={400}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => done(null)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!value.trim()} onClick={() => done(value)}>
            {d.confirmLabel || 'OK'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) done(value);
        }}
      >
        <Field label={d.label}>
          <input ref={ref} value={value} placeholder={d.placeholder} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        </Field>
      </form>
    </Modal>
  );
}

function tabTitle(holderId?: string) {
  if (!holderId) return '';
  return useApp.getState().tabs.find((t) => t.id === holderId)?.title || '';
}

export function AskPromptDialog({ d, payload }: { d: Dialog & { type: 'ask' }; payload: PromptPayload }) {
  const [values, setValues] = useState<string[]>(payload.fields.map(() => ''));
  const [save, setSave] = useState(false);
  const done = (result: { values: string[]; save: boolean } | null) => {
    closeDialog(d.id);
    api.answer(d.askId, result);
  };
  const source = tabTitle(payload.holderId);
  return (
    <Modal
      title={payload.title}
      icon={<KeyRound size={18} />}
      onClose={() => done(null)}
      width={420}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => done(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => done({ values, save })}>
            Continue
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          done({ values, save });
        }}
      >
        <p className="dialog-message">
          {payload.message}
          {source && source !== payload.message && <span className="muted"> · {source}</span>}
        </p>
        {payload.error && <div className="banner error">{payload.error}</div>}
        {payload.fields.map((f, i) => (
          <Field key={i} label={f.label}>
            {f.secret ? (
              <PasswordInput
                autoFocus={i === 0}
                value={values[i]}
                onChange={(v) => setValues((vals) => vals.map((x, j) => (j === i ? v : x)))}
              />
            ) : (
              <input
                type="text"
                autoFocus={i === 0}
                value={values[i]}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </Field>
        ))}
        {payload.allowSave && (
          <label className="check-row">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
            Save in Keychain
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function HostKeyDialog({ d, payload }: { d: Dialog & { type: 'ask' }; payload: HostKeyPayload }) {
  const done = (answer: 'trust' | 'once' | null) => {
    closeDialog(d.id);
    api.answer(d.askId, answer);
  };
  const changed = payload.status === 'changed';
  const where = `${payload.host}${payload.port !== 22 ? ':' + payload.port : ''}`;
  return (
    <Modal
      title={changed ? 'Host key has changed!' : 'New server'}
      icon={changed ? <ShieldAlert size={18} className="danger-text" /> : <ShieldQuestion size={18} />}
      onClose={() => done(null)}
      width={500}
      className={changed ? 'modal-danger' : ''}
      footer={
        changed ? (
          <>
            <button className="btn danger" onClick={() => done('trust')}>
              Trust new key
            </button>
            <span className="flex" />
            <button className="btn primary" data-autofocus onClick={() => done(null)}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => done('once')}>
              Connect once
            </button>
            <span className="flex" />
            <button className="btn" onClick={() => done(null)}>
              Cancel
            </button>
            <button className="btn primary" data-autofocus onClick={() => done('trust')}>
              Trust & connect
            </button>
          </>
        )
      }
    >
      {changed ? (
        <p className="dialog-message">
          The key presented by <b>{where}</b> does not match the one saved earlier. This can happen after a server was reinstalled — or
          someone could be intercepting the connection. Only continue if you know why the key changed.
        </p>
      ) : (
        <p className="dialog-message">
          This is the first connection to <b>{where}</b>. Check that the fingerprint matches the server before trusting it.
        </p>
      )}
      <div className="kv">
        <span>Key type</span>
        <code>{payload.type}</code>
        <span>Fingerprint</span>
        <code className="fingerprint">{payload.fingerprint}</code>
        {changed && payload.previous && (
          <>
            <span>Previously</span>
            <code className="fingerprint muted">{payload.previous}</code>
          </>
        )}
      </div>
    </Modal>
  );
}

const PERM_BITS = [
  ['Owner', 0o400, 0o200, 0o100],
  ['Group', 0o040, 0o020, 0o010],
  ['Others', 0o004, 0o002, 0o001],
] as const;

export function PermissionsDialog({ d }: { d: Of<'permissions'> }) {
  const [mode, setMode] = useState(d.mode & 0o777);
  const [octal, setOctal] = useState((d.mode & 0o777).toString(8).padStart(3, '0'));
  const [recursive, setRecursive] = useState(false);
  const done = (v: { mode: number; recursive: boolean } | null) => {
    closeDialog(d.id);
    d.resolve(v);
  };
  const setBits = (m: number) => {
    setMode(m);
    setOctal(m.toString(8).padStart(3, '0'));
  };
  return (
    <Modal
      title="Permissions"
      onClose={() => done(null)}
      width={400}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => done(null)}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => done({ mode, recursive })}>
            Apply
          </button>
        </>
      }
    >
      <p className="dialog-message ellipsis">{d.names.length === 1 ? d.names[0] : `${d.names.length} items`}</p>
      <div className="perm-grid">
        <span />
        <span>Read</span>
        <span>Write</span>
        <span>Execute</span>
        {PERM_BITS.map(([who, ...bits]) => (
          <div key={who} className="perm-row">
            <span>{who}</span>
            {bits.map((bit) => (
              <input key={bit} type="checkbox" checked={!!(mode & bit)} onChange={(e) => setBits(e.target.checked ? mode | bit : mode & ~bit)} />
            ))}
          </div>
        ))}
      </div>
      <Field label="Numeric" inline>
        <input
          className="mono"
          style={{ width: 80 }}
          value={octal}
          maxLength={4}
          onChange={(e) => {
            setOctal(e.target.value);
            if (/^[0-7]{3,4}$/.test(e.target.value)) setMode(parseInt(e.target.value, 8) & 0o777);
          }}
        />
      </Field>
      {d.isDir && (
        <label className="check-row">
          <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
          Apply to everything inside folders
        </label>
      )}
    </Modal>
  );
}

export function QuickConnectDialog({ d }: { d: Of<'quick-connect'> }) {
  const [value, setValue] = useState('');
  const [save, setSave] = useState(false);
  const submit = () => {
    if (quickConnect(value, save)) closeDialog(d.id);
  };
  return (
    <Modal
      title="Quick connect"
      icon={<SquareTerminal size={18} />}
      onClose={() => closeDialog(d.id)}
      width={460}
      closeOnBackdrop
      footer={
        <>
          <label className="check-row tight">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save as session
          </label>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!value.trim()} onClick={submit}>
            Connect
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field hint="Examples: root@10.0.0.5 · deploy@web01:2222 · ssh admin@nas -p 2200">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="user@host:port" spellCheck={false} autoFocus />
        </Field>
      </form>
    </Modal>
  );
}

export function SnippetDialog({ d }: { d: Of<'snippet'> }) {
  const [s, setS] = useState<Snippet>(d.snippet || { id: uid(), name: '', command: '', run: true });
  const valid = s.name.trim() && s.command.trim();
  const save = () => {
    if (!valid) return;
    saveSnippet({ ...s, name: s.name.trim() });
    closeDialog(d.id);
  };
  return (
    <Modal
      title={d.snippet && !d.isNew ? 'Edit snippet' : 'New snippet'}
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
      <Field label="Name">
        <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Restart nginx" autoFocus />
      </Field>
      <Field label="Command" hint="Multiple lines are sent one after another.">
        <textarea
          className="mono"
          rows={4}
          value={s.command}
          onChange={(e) => setS({ ...s, command: e.target.value })}
          placeholder="sudo systemctl restart nginx"
          spellCheck={false}
        />
      </Field>
      <Toggle checked={s.run} onChange={(run) => setS({ ...s, run })} label="Run immediately" hint="Press Enter after inserting the command" />
    </Modal>
  );
}
