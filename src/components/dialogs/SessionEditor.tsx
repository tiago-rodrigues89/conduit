import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Bot, FolderOpen, KeyRound, Plus, RefreshCw, Settings2, SlidersHorizontal, SquareTerminal, Trash, Waypoints } from 'lucide-react';
import { api } from '../../lib/api';
import { newSession, uid } from '../../lib/defaults';
import { iconFor, ICON_NAMES } from '../../lib/icons';
import { TEMPLATES, typeInfo, type Template } from '../../lib/sessionTypes';
import { allThemes, getTheme } from '../../lib/themes';
import type { AuthMethod, Forward, LoginStep, PromptStyle, SessionItem, TriState } from '../../lib/types';
import { closeDialog, folderPath, openDialog, openSession, saveItem, sessionById, useApp, type Dialog } from '../../store/app';
import { Field, Modal, PasswordInput, Segmented, Toggle } from '../ui';
import { ColorSwatches, IconGrid } from './FolderDialog';

type Section = 'general' | 'auth' | 'terminal' | 'automation' | 'tunnels' | 'advanced';

const SECTION_META: Record<Section, { label: string; icon: typeof Settings2 }> = {
  general: { label: 'General', icon: SquareTerminal },
  auth: { label: 'Authentication', icon: KeyRound },
  terminal: { label: 'Terminal', icon: SlidersHorizontal },
  automation: { label: 'Automation', icon: Bot },
  tunnels: { label: 'Tunnels', icon: Waypoints },
  advanced: { label: 'Advanced', icon: Settings2 },
};

const TRI: { value: TriState; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

const BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

export function SessionEditor({ d }: { d: Extract<Dialog, { type: 'session' }> }) {
  const existing = d.sessionId ? sessionById(d.sessionId) : undefined;
  const settings = useApp.getState().settings;
  const [draft, setDraft] = useState<SessionItem | null>(() =>
    existing ? existing : d.draft?.type ? newSession({ parentId: d.parentId ?? null, keepAlive: settings.keepAlive, ...d.draft }) : null
  );

  if (!draft) {
    return (
      <SessionWizard
        onClose={() => closeDialog(d.id)}
        onPick={(tpl) =>
          setDraft(newSession({ parentId: d.parentId ?? null, keepAlive: settings.keepAlive, ...tpl.defaults, type: tpl.type, ...d.draft }))
        }
      />
    );
  }
  return <SessionForm key={draft.id + draft.type} d={d} initial={draft} isNew={!existing} onBack={existing ? undefined : () => setDraft(null)} />;
}

function SessionWizard({ onPick, onClose }: { onPick: (t: Template) => void; onClose: () => void }) {
  return (
    <Modal title="New session" onClose={onClose} width={760} closeOnBackdrop>
      <p className="dialog-message muted">What do you want to connect to?</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="template-card" onClick={() => onPick(t)} style={{ '--tpl': t.color } as React.CSSProperties}>
            <span className="template-icon">
              <t.icon size={22} />
            </span>
            <span className="template-label">{t.label}</span>
            <span className="template-desc">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function SessionForm({ d, initial, isNew, onBack }: { d: Dialog & { type: 'session' }; initial: SessionItem; isNew: boolean; onBack?: () => void }) {
  const items = useApp((s) => s.items);
  const settings = useApp((s) => s.settings);
  const info = typeInfo(initial.type);
  const [s, setS] = useState<SessionItem>(initial);
  const [section, setSection] = useState<Section>((d.section as Section) || 'general');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [flags, setFlags] = useState({ password: false, passphrase: false });
  const [clear, setClear] = useState({ password: false, passphrase: false });
  const [touched, setTouched] = useState(false);
  const [shells, setShells] = useState<{ default: string; shells: string[] }>({ default: '', shells: [] });
  const [devices, setDevices] = useState<string[]>([]);
  const credentials = useApp((st) => st.credentials);
  const cred = credentials.find((c) => c.id === s.credentialId);
  const [credFlags, setCredFlags] = useState({ password: false, passphrase: false });
  useEffect(() => {
    if (cred) api.secrets.flags(`cred:${cred.id}`).then(setCredFlags).catch(() => {});
  }, [cred?.id, credentials]);

  useEffect(() => {
    if (!isNew) api.secrets.flags(s.id).then(setFlags).catch(() => {});
    if (s.type === 'local' || s.type === 'command') api.term.shells().then(setShells).catch(() => {});
    if (s.type === 'serial') refreshDevices();
  }, []);

  const refreshDevices = () =>
    api.term
      .serialDevices()
      .then((list) => {
        setDevices(list);
        setS((x) => (x.serialDevice ? x : { ...x, serialDevice: list.find((l) => !/Bluetooth|debug/i.test(l)) || '' }));
      })
      .catch(() => {});

  const set = <K extends keyof SessionItem>(k: K, v: SessionItem[K]) => setS((x) => ({ ...x, [k]: v }));
  const folders = useMemo(
    () => items.filter((i) => i.kind === 'folder').map((f) => ({ id: f.id, label: folderPath(f.id) })).sort((a, b) => a.label.localeCompare(b.label)),
    [items]
  );
  const jumpCandidates = items.filter((i): i is SessionItem => i.kind === 'session' && i.id !== s.id && i.type === 'ssh');

  const problem = (() => {
    if (info.network && !s.host.trim()) return 'A host name or IP address is required';
    if (s.type === 'serial' && !s.serialDevice) return 'Choose a serial device';
    if (s.type === 'command' && !s.command.trim()) return 'Enter the command to run';
    if (s.type === 'ssm' && !s.awsInstanceId.trim()) return 'Enter the EC2 instance ID';
    return null;
  })();

  const save = async (connect: boolean) => {
    setTouched(true);
    if (problem) {
      setSection('general');
      return;
    }
    const item: SessionItem = {
      ...s,
      host: s.host.trim(),
      username: s.username.trim(),
      name: s.name.trim() || s.host.trim() || (s.type === 'ssm' ? s.awsInstanceId.trim() : '') || info.label,
      port: Number(s.port) || Number(info.defaults.port) || 0,
    };
    saveItem(item);
    const patch: { password?: string | null; passphrase?: string | null } = {};
    if (password) patch.password = password;
    else if (clear.password) patch.password = null;
    if (passphrase) patch.passphrase = passphrase;
    else if (clear.passphrase) patch.passphrase = null;
    if (Object.keys(patch).length) await api.secrets.set(item.id, patch).catch(() => {});
    closeDialog(d.id);
    if (connect) openSession(item.id);
  };

  const updateForward = (id: string, patch: Partial<Forward>) => set('forwards', s.forwards.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const buttonBars = useApp((st) => st.buttonBars);
  const steps = s.loginScript || [];
  const updateStep = (id: string, patch: Partial<LoginStep>) => set('loginScript', steps.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const moveStep = (i: number, dir: -1 | 1) => {
    const list = [...steps];
    [list[i], list[i + dir]] = [list[i + dir], list[i]];
    set('loginScript', list);
  };
  const home = useApp.getState().info?.home || '\u0000';

  const browse = async (key: 'keyPath' | 'startDir', directory: boolean) => {
    const res = await api.openDialog({
      title: directory ? 'Choose a folder' : 'Choose a private key',
      directory,
      defaultPath: directory ? '~' : '~/.ssh',
      buttonLabel: directory ? 'Choose' : 'Use key',
    });
    if (res?.[0]) set(key, res[0].replace(home, '~'));
  };

  const TypeIcon = iconFor(s.icon, info.icon);
  const openLabel = info.opens === 'external' ? 'Save & open' : info.opens === 'sftp' ? 'Save & open' : 'Save & connect';

  return (
    <Modal
      title={isNew ? `New ${info.label} session` : `Edit “${initial.name}”`}
      icon={<TypeIcon size={18} style={{ color: s.color || info.color }} />}
      onClose={() => closeDialog(d.id)}
      width={740}
      className="modal-tall"
      footer={
        <>
          {onBack && (
            <button className="btn" onClick={onBack}>
              <ArrowLeft size={14} /> Templates
            </button>
          )}
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn" onClick={() => save(false)}>
            Save
          </button>
          <button className="btn primary" onClick={() => save(true)}>
            {openLabel}
          </button>
        </>
      }
    >
      <form
        className="split-form"
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <nav className="split-nav">
          {info.sections.map((id) => {
            const meta = SECTION_META[id];
            return (
              <button type="button" key={id} className={`split-nav-item${section === id ? ' active' : ''}`} onClick={() => setSection(id)}>
                <meta.icon size={15} />
                {meta.label}
                {id === 'tunnels' && s.forwards.length > 0 && <span className="nav-count">{s.forwards.length}</span>}
              </button>
            );
          })}
        </nav>
        <div className="split-body">
          {section === 'general' && (
            <>
              {touched && problem && <div className="banner error">{problem}</div>}

              {info.network && (
                <div className="row">
                  <Field label="Host">
                    <input value={s.host} onChange={(e) => set('host', e.target.value)} placeholder="server.example.com or 10.0.0.5" spellCheck={false} autoFocus />
                  </Field>
                  <Field label="Port">
                    <input className="port" type="number" min={1} max={65535} value={s.port || ''} onChange={(e) => set('port', Number(e.target.value))} />
                  </Field>
                </div>
              )}

              {(s.type === 'ssh' || s.type === 'sftp' || s.type === 'rdp' || s.type === 'vnc') && (
                <Field
                  label="Login"
                  hint={
                    cred
                      ? `Logs in as ${cred.username}${credFlags.password ? ' with the saved password' : ''}. Changes to “${cred.name}” apply to every session using it.`
                      : 'Use a saved login to share one username & password between many sessions.'
                  }
                >
                  <div className="input-with-btn">
                    <select
                      value={s.credentialId}
                      onChange={(e) => {
                        if (e.target.value === '__new') openDialog({ type: 'credential', onSaved: (id) => set('credentialId', id) });
                        else set('credentialId', e.target.value);
                      }}
                    >
                      <option value="">Username & password of this session</option>
                      {credentials.length > 0 && (
                        <optgroup label="Saved logins">
                          {credentials.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.username})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="__new">New saved login…</option>
                    </select>
                    {cred && (
                      <button type="button" className="btn" onClick={() => openDialog({ type: 'credential', credentialId: cred.id })}>
                        Edit
                      </button>
                    )}
                  </div>
                </Field>
              )}

              {(s.type === 'ssh' || s.type === 'sftp' || s.type === 'rdp' || s.type === 'vnc') && cred && s.type !== 'rdp' && (
                <Field label="Display name">
                  <input value={s.name} onChange={(e) => set('name', e.target.value)} placeholder={s.host || 'My server'} />
                </Field>
              )}

              {(s.type === 'ssh' || s.type === 'sftp' || s.type === 'rdp' || s.type === 'vnc') && !cred && (
                <div className="row">
                  <Field
                    label="Username"
                    hint={
                      s.icon === 'aws' && s.type === 'ssh'
                        ? 'Amazon Linux: ec2-user · Ubuntu: ubuntu · Debian: admin'
                        : s.type === 'ssh' || s.type === 'sftp'
                          ? 'Leave empty to be asked when connecting'
                          : 'Optional'
                    }
                  >
                    <input value={s.username} onChange={(e) => set('username', e.target.value)} placeholder={s.type === 'rdp' ? 'Administrator' : 'root'} spellCheck={false} />
                  </Field>
                  {s.type === 'rdp' ? (
                    <Field label="Domain" hint="Optional">
                      <input value={s.rdpDomain} onChange={(e) => set('rdpDomain', e.target.value)} placeholder="CORP" spellCheck={false} />
                    </Field>
                  ) : (
                    <Field label="Display name">
                      <input value={s.name} onChange={(e) => set('name', e.target.value)} placeholder={s.host || 'My server'} />
                    </Field>
                  )}
                </div>
              )}

              {(s.type === 'telnet' || s.type === 'rdp' || s.type === 'local' || s.type === 'command' || s.type === 'serial' || s.type === 'ssm') && (
                <Field label="Display name">
                  <input
                    value={s.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder={s.host || (s.type === 'local' ? 'My Mac' : s.type === 'serial' ? 'Switch console' : info.label)}
                    autoFocus={!info.network}
                  />
                </Field>
              )}

              {s.type === 'rdp' && cred && (
                <Field label="Domain" hint="Optional">
                  <input value={s.rdpDomain} onChange={(e) => set('rdpDomain', e.target.value)} placeholder="CORP" spellCheck={false} />
                </Field>
              )}

              {s.icon === 'aws' && s.type === 'ssh' && (
                <p className="field-hint block">Choose the key pair (.pem) you downloaded when you launched the instance under Authentication.</p>
              )}

              {s.type === 'rdp' && (
                <>
                  <Toggle checked={s.rdpFullscreen} onChange={(v) => set('rdpFullscreen', v)} label="Full screen" />
                  <p className="field-hint block">Opens in Microsoft’s free Windows App, which asks for the password.</p>
                </>
              )}
              {s.type === 'vnc' && <p className="field-hint block">Opens in macOS Screen Sharing, which asks for the password.</p>}

              {(s.type === 'local' || s.type === 'command') && (
                <div className="row">
                  {s.type === 'local' && (
                    <Field label="Shell">
                      <select value={s.shell} onChange={(e) => set('shell', e.target.value)}>
                        <option value="">Login shell{shells.default ? ` (${shells.default})` : ''}</option>
                        {shells.shells.map((sh) => (
                          <option key={sh} value={sh}>
                            {sh}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <Field label="Start in folder">
                    <div className="input-with-btn">
                      <input value={s.startDir} onChange={(e) => set('startDir', e.target.value)} placeholder="~" spellCheck={false} />
                      <button type="button" className="btn" onClick={() => browse('startDir', true)}>
                        <FolderOpen size={14} />
                      </button>
                    </div>
                  </Field>
                </div>
              )}

              {s.type === 'command' && (
                <Field label="Command" hint="Runs in your login shell, e.g. docker exec -it web sh · kubectl exec -it pod -- bash · mosh server">
                  <textarea className="mono" rows={3} value={s.command} onChange={(e) => set('command', e.target.value)} placeholder="docker exec -it my-container sh" spellCheck={false} />
                </Field>
              )}

              {s.type === 'ssm' && (
                <>
                  <Field label="Instance ID">
                    <input className="mono" value={s.awsInstanceId} onChange={(e) => set('awsInstanceId', e.target.value)} placeholder="i-0123456789abcdef0" spellCheck={false} autoFocus />
                  </Field>
                  <div className="row">
                    <Field label="Region" hint="Optional">
                      <input value={s.awsRegion} onChange={(e) => set('awsRegion', e.target.value)} placeholder="eu-central-1" spellCheck={false} />
                    </Field>
                    <Field label="AWS profile" hint="Optional">
                      <input value={s.awsProfile} onChange={(e) => set('awsProfile', e.target.value)} placeholder="default" spellCheck={false} />
                    </Field>
                  </div>
                  <p className="field-hint block">
                    Needs the AWS CLI and the Session Manager plugin: <code>brew install awscli session-manager-plugin</code>
                  </p>
                </>
              )}

              {s.type === 'serial' && (
                <>
                  <Field label="Device">
                    <div className="input-with-btn">
                      <select value={s.serialDevice} onChange={(e) => set('serialDevice', e.target.value)}>
                        {!devices.includes(s.serialDevice) && <option value={s.serialDevice}>{s.serialDevice || '— No device found —'}</option>}
                        {devices.map((dev) => (
                          <option key={dev} value={dev}>
                            {dev}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn" title="Search again" onClick={refreshDevices}>
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </Field>
                  <p className="field-hint block">Plug in the USB-serial adapter or console cable, then refresh. Devices appear as /dev/cu.usbserial-…</p>
                  <div className="row">
                    <Field label="Speed (baud)">
                      <select value={s.baudRate} onChange={(e) => set('baudRate', Number(e.target.value))}>
                        {BAUD_RATES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Data bits">
                      <select value={s.dataBits} onChange={(e) => set('dataBits', Number(e.target.value))}>
                        {[8, 7, 6, 5].map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Parity">
                      <select value={s.parity} onChange={(e) => set('parity', e.target.value as SessionItem['parity'])}>
                        <option value="none">None</option>
                        <option value="even">Even</option>
                        <option value="odd">Odd</option>
                      </select>
                    </Field>
                    <Field label="Stop bits">
                      <select value={s.stopBits} onChange={(e) => set('stopBits', Number(e.target.value))}>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Flow control">
                    <Segmented
                      small
                      value={s.flowControl}
                      onChange={(v) => set('flowControl', v)}
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'rtscts', label: 'RTS/CTS' },
                        { value: 'xonxoff', label: 'XON/XOFF' },
                      ]}
                    />
                  </Field>
                </>
              )}

              <div className="row">
                <Field label="Folder">
                  <select value={s.parentId || ''} onChange={(e) => set('parentId', e.target.value || null)}>
                    <option value="">User sessions</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        User sessions / {f.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Color">
                  <ColorSwatches value={s.color} onChange={(c) => set('color', c)} />
                </Field>
              </div>
              <Field label="Icon">
                <IconGrid
                  value={s.icon || '__type'}
                  color={s.color || info.color}
                  include={['__type', ...ICON_NAMES.filter((n) => n !== 'folder')]}
                  typeIcon={info.icon}
                  onChange={(icon) => set('icon', icon === '__type' ? '' : icon)}
                />
              </Field>
              <Field label="Notes">
                <textarea rows={2} value={s.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering" />
              </Field>
            </>
          )}

          {section === 'auth' && (
            <>
              {cred && (
                <div className="cred-banner">
                  <span>
                    Uses the saved login <b>{cred.name}</b> — {cred.username}
                    {credFlags.password ? ' · password saved' : ' · password asked when connecting'}
                    {cred.keyPath ? ` · key ${cred.keyPath}` : ''}
                  </span>
                  <button type="button" className="btn sm" onClick={() => openDialog({ type: 'credential', credentialId: cred.id })}>
                    Edit login
                  </button>
                </div>
              )}
              <Field label="Method">
                <Segmented<AuthMethod>
                  value={s.authMethod}
                  onChange={(v) => set('authMethod', v)}
                  options={[
                    { value: 'auto', label: 'Automatic' },
                    { value: 'password', label: 'Password' },
                    { value: 'key', label: 'Private key' },
                    { value: 'agent', label: 'SSH agent' },
                  ]}
                />
              </Field>
              <p className="field-hint block">
                {s.authMethod === 'auto' && 'Tries the SSH agent, then your key (or ~/.ssh/id_ed25519, id_ecdsa, id_rsa), then asks for a password — like the ssh command.'}
                {s.authMethod === 'password' && 'Logs in with a password. Leave it empty to be asked each time.'}
                {s.authMethod === 'key' && 'Logs in with the private key file below.'}
                {s.authMethod === 'agent' && 'Uses the keys loaded in ssh-agent (ssh-add).'}
              </p>
              {!cred && (s.authMethod === 'auto' || s.authMethod === 'password') && (
                <Field
                  label="Password"
                  hint={
                    flags.password && !clear.password ? (
                      <>
                        A password is saved in your Keychain.{' '}
                        <button type="button" className="link-btn" onClick={() => setClear((c) => ({ ...c, password: true }))}>
                          Forget it
                        </button>
                      </>
                    ) : clear.password ? (
                      'The saved password will be removed.'
                    ) : (
                      'Stored encrypted with a key in the macOS Keychain. Optional.'
                    )
                  }
                >
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    reveal={flags.password && !clear.password ? () => api.secrets.reveal(s.id) : undefined}
                    placeholder={flags.password && !clear.password ? '••••••••  (saved — type to replace)' : 'Ask when connecting'}
                  />
                </Field>
              )}
              {!cred && (s.authMethod === 'auto' || s.authMethod === 'key') && (
                <>
                  <Field label="Private key" hint={s.authMethod === 'auto' ? 'Optional — your default keys are tried otherwise.' : undefined}>
                    <div className="input-with-btn">
                      <input value={s.keyPath} onChange={(e) => set('keyPath', e.target.value)} placeholder="~/.ssh/id_ed25519" spellCheck={false} />
                      <button type="button" className="btn" onClick={() => browse('keyPath', false)}>
                        <FolderOpen size={14} /> Browse
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Key passphrase"
                    hint={
                      flags.passphrase && !clear.passphrase ? (
                        <>
                          A passphrase is saved.{' '}
                          <button type="button" className="link-btn" onClick={() => setClear((c) => ({ ...c, passphrase: true }))}>
                            Forget it
                          </button>
                        </>
                      ) : (
                        'Only needed for encrypted keys. Asked when connecting if empty.'
                      )
                    }
                  >
                    <PasswordInput
                      value={passphrase}
                      onChange={setPassphrase}
                      placeholder={flags.passphrase && !clear.passphrase ? '••••••••  (saved)' : ''}
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {section === 'terminal' && (
            <>
              <Field label="Color theme" hint="Give production servers a distinct look, e.g. Ember.">
                <div className="theme-picker small">
                  <button type="button" className={`theme-chip${!s.theme ? ' active' : ''}`} onClick={() => set('theme', '')}>
                    <ThemeSwatch id={settings.theme} />
                    <span>Default</span>
                  </button>
                  {allThemes().map((t) => (
                    <button type="button" key={t.id} className={`theme-chip${s.theme === t.id ? ' active' : ''}`} onClick={() => set('theme', t.id)}>
                      <ThemeSwatch id={t.id} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </Field>
              {(s.type === 'ssh' || s.type === 'local') && (
                <Field label="Prompt" hint={s.type === 'ssh' ? 'Applied to bash and zsh on the server for this session only.' : undefined}>
                  <Segmented<PromptStyle | ''>
                    small
                    value={s.promptStyle}
                    onChange={(v) => set('promptStyle', v)}
                    options={[
                      { value: '', label: 'Default' },
                      { value: 'conduit', label: 'Conduit' },
                      { value: 'frame', label: 'Frame' },
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'shell', label: 'Shell’s own' },
                    ]}
                  />
                </Field>
              )}
              <div className="row">
                <Field label="Syntax highlighting">
                  <Segmented<TriState> small value={s.highlight} onChange={(v) => set('highlight', v)} options={TRI} />
                </Field>
                {s.type === 'ssh' && (
                  <Field label="Files panel follows terminal folder">
                    <Segmented<TriState> small value={s.followFolder} onChange={(v) => set('followFolder', v)} options={TRI} />
                  </Field>
                )}
              </div>
              {s.type === 'ssh' && (
                <>
                  <Field label="Start in folder" hint="Runs cd into this folder after login.">
                    <input value={s.startDir} onChange={(e) => set('startDir', e.target.value)} placeholder="/var/www" spellCheck={false} />
                  </Field>
                  <Field label="Commands after login" hint="One command per line, e.g. sudo -i or tmux attach.">
                    <textarea className="mono" rows={3} value={s.initCommand} onChange={(e) => set('initCommand', e.target.value)} spellCheck={false} />
                  </Field>
                </>
              )}
            </>
          )}

          {section === 'automation' && (
            <>
              <Field group label="Login script" hint="Runs once after connecting: waits for each text, then types the answer and presses Enter. Empty “wait for” sends right away.">
                <div className="login-steps">
                  {steps.map((st, i) => (
                    <div key={st.id} className="login-step">
                      <span className="login-step-n">{i + 1}</span>
                      <input
                        className="mono"
                        value={st.expect}
                        onChange={(e) => updateStep(st.id, { expect: e.target.value })}
                        placeholder="wait for, e.g. Username:"
                        spellCheck={false}
                      />
                      <span className="login-step-arrow">→</span>
                      <input
                        className="mono"
                        value={st.send}
                        onChange={(e) => updateStep(st.id, { send: e.target.value })}
                        placeholder="type, e.g. terminal length 0"
                        spellCheck={false}
                      />
                      <button type="button" className="icon-btn sm" title="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" className="icon-btn sm" title="Move down" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" className="icon-btn sm" title="Remove" onClick={() => set('loginScript', steps.filter((x) => x.id !== st.id))}>
                        <Trash size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn sm" onClick={() => set('loginScript', [...steps, { id: uid(), expect: '', send: '' }])}>
                    <Plus size={14} /> Add step
                  </button>
                </div>
              </Field>
              <p className="field-hint block">
                Steps are stored as plain text in the session — don’t put passwords here; use the saved password or a saved login instead.
              </p>
              <div className="row">
                <Field label="Button bar">
                  <select value={s.buttonBar} onChange={(e) => set('buttonBar', e.target.value)}>
                    <option value="">Default{buttonBars[0] ? ` (${buttonBars[0].name})` : ''}</option>
                    {buttonBars.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Log output to a file" hint={`Default: ${settings.logAuto ? 'on' : 'off'} (Settings → Logging)`}>
                  <Segmented<TriState> small value={s.logging} onChange={(v) => set('logging', v)} options={TRI} />
                </Field>
              </div>
            </>
          )}

          {section === 'tunnels' && (
            <>
              <p className="field-hint block">
                Port forwards open automatically while the session is connected. <b>Local</b> makes a server port reachable on this Mac,
                <b> Remote</b> exposes a port of this Mac on the server, <b>SOCKS</b> creates a proxy that routes through the server.
              </p>
              <div className="forwards">
                {s.forwards.map((f) => (
                  <div key={f.id} className={`forward${f.enabled ? '' : ' disabled'}`}>
                    <input type="checkbox" checked={f.enabled} onChange={(e) => updateForward(f.id, { enabled: e.target.checked })} title="Enabled" />
                    <select value={f.type} onChange={(e) => updateForward(f.id, { type: e.target.value as Forward['type'] })}>
                      <option value="local">Local</option>
                      <option value="remote">Remote</option>
                      <option value="dynamic">SOCKS</option>
                    </select>
                    <input
                      className="fw-host"
                      value={f.bindHost}
                      onChange={(e) => updateForward(f.id, { bindHost: e.target.value })}
                      placeholder="127.0.0.1"
                      title={f.type === 'remote' ? 'Bind address on the server' : 'Bind address on this Mac'}
                    />
                    <span className="fw-colon">:</span>
                    <input className="fw-port" type="number" value={f.bindPort || ''} onChange={(e) => updateForward(f.id, { bindPort: Number(e.target.value) })} placeholder="8080" />
                    {f.type !== 'dynamic' ? (
                      <>
                        <span className="fw-arrow">→</span>
                        <input
                          className="fw-host"
                          value={f.destHost}
                          onChange={(e) => updateForward(f.id, { destHost: e.target.value })}
                          placeholder={f.type === 'remote' ? '127.0.0.1' : 'localhost'}
                          title={f.type === 'remote' ? 'Destination as seen from this Mac' : 'Destination as seen from the server'}
                        />
                        <span className="fw-colon">:</span>
                        <input className="fw-port" type="number" value={f.destPort || ''} onChange={(e) => updateForward(f.id, { destPort: Number(e.target.value) })} placeholder="80" />
                      </>
                    ) : (
                      <span className="fw-socks muted">SOCKS5 proxy</span>
                    )}
                    <button type="button" className="icon-btn sm" title="Remove" onClick={() => set('forwards', s.forwards.filter((x) => x.id !== f.id))}>
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn sm"
                onClick={() =>
                  set('forwards', [...s.forwards, { id: uid(), type: 'local', bindHost: '127.0.0.1', bindPort: 0, destHost: 'localhost', destPort: 0, enabled: true }])
                }
              >
                <Plus size={14} /> Add tunnel
              </button>
            </>
          )}

          {section === 'advanced' && (
            <>
              <Field label="Jump host (ProxyJump)" hint="Connect through another saved SSH session first, e.g. a bastion host.">
                <select value={s.jumpHostId} onChange={(e) => set('jumpHostId', e.target.value)}>
                  <option value="">— Direct connection —</option>
                  {jumpCandidates.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({j.username ? j.username + '@' : ''}
                      {j.host})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Keep-alive interval (seconds)" hint="Prevents idle connections from being dropped. 0 disables it.">
                <input className="port" type="number" min={0} value={s.keepAlive} onChange={(e) => set('keepAlive', Number(e.target.value))} />
              </Field>
              <Toggle
                checked={s.legacyAlgorithms}
                onChange={(v) => set('legacyAlgorithms', v)}
                label="Allow legacy algorithms"
                hint="Enables older ciphers and key exchanges (SHA-1, CBC) for old switches, routers and appliances."
              />
            </>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function ThemeSwatch({ id }: { id: string }) {
  const t = getTheme(id).colors;
  return (
    <span className="theme-swatch" style={{ background: t.background }}>
      {[t.red, t.green, t.yellow, t.blue, t.magenta].map((c, i) => (
        <i key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

