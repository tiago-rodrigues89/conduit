import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FileArchive, FolderOpen, LayoutGrid, Lock, Plus, Trash } from 'lucide-react';
import { api, type BackupInfo, type BackupSummary } from '../../lib/api';
import { uid } from '../../lib/defaults';
import { shortPath } from '../../lib/logging';
import { typeInfo } from '../../lib/sessionTypes';
import type { CommandButton, SessionItem, Workspace, WorkspaceEntry } from '../../lib/types';
import {
  applyStoreData,
  closeDialog,
  entriesFromTabs,
  flushPersist,
  folderPath,
  openWorkspace,
  saveButtonBars,
  saveWorkspace,
  toast,
  updateSettings,
  useApp,
  type Dialog,
} from '../../store/app';
import { Field, Modal, PasswordInput, Segmented, Toggle } from '../ui';
import { ColorSwatches } from './FolderDialog';

type Of<T extends Dialog['type']> = Extract<Dialog, { type: T }>;

// ---- button bar button ---------------------------------------------------------------------

export function ButtonDialog({ d }: { d: Of<'button'> }) {
  const bars = useApp((s) => s.buttonBars);
  const bar = bars.find((b) => b.id === d.barId);
  const existing = bar?.buttons.find((b) => b.id === d.buttonId);
  const [b, setB] = useState<CommandButton>(existing || { id: uid(), label: '', text: '', enter: true, color: '', target: 'pane' });
  const valid = b.label.trim() && b.text.trim();
  const save = () => {
    if (!valid || !bar) return;
    const btn = { ...b, label: b.label.trim() };
    const buttons = existing ? bar.buttons.map((x) => (x.id === b.id ? btn : x)) : [...bar.buttons, btn];
    saveButtonBars(bars.map((x) => (x.id === bar.id ? { ...x, buttons } : x)));
    closeDialog(d.id);
  };
  return (
    <Modal
      title={existing ? 'Edit button' : `New button in “${bar?.name || 'Buttons'}”`}
      onClose={() => closeDialog(d.id)}
      width={500}
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
      <Field label="Label">
        <input value={b.label} onChange={(e) => setB({ ...b, label: e.target.value })} placeholder="Restart nginx" autoFocus />
      </Field>
      <Field label="Text to send" hint="Several lines are typed one after the other.">
        <textarea
          className="mono"
          rows={4}
          value={b.text}
          onChange={(e) => setB({ ...b, text: e.target.value })}
          placeholder="sudo systemctl restart nginx"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) save();
          }}
        />
      </Field>
      <Toggle checked={b.enter} onChange={(enter) => setB({ ...b, enter })} label="Press Enter after each line" hint="Off: the text is only inserted, so you can edit it before running." />
      <Field label="Send to">
        <Segmented
          value={b.target}
          onChange={(target) => setB({ ...b, target })}
          options={[
            { value: 'pane', label: 'This terminal', title: '⌥-click sends to all panes of the tab' },
            { value: 'tab', label: 'All panes of the tab' },
            { value: 'all', label: 'All connected' },
          ]}
        />
      </Field>
      <Field label="Color">
        <ColorSwatches value={b.color} onChange={(color) => setB({ ...b, color })} />
      </Field>
    </Modal>
  );
}

// ---- workspace -------------------------------------------------------------------------------

const PLACEMENTS: { value: WorkspaceEntry['placement']; label: string }[] = [
  { value: 'tab', label: 'New tab' },
  { value: 'right', label: 'Split right' },
  { value: 'down', label: 'Split below' },
];

export function WorkspaceDialog({ d }: { d: Of<'workspace'> }) {
  const items = useApp((s) => s.items);
  const workspaces = useApp((s) => s.workspaces);
  const existing = workspaces.find((w) => w.id === d.workspaceId);
  const [ws, setWs] = useState<Workspace>(
    () => existing || { id: uid(), name: '', openOnLaunch: false, entries: d.fromTabs ? entriesFromTabs() : [] }
  );
  const sessions = useMemo(
    () =>
      items
        .filter((i): i is SessionItem => i.kind === 'session' && typeInfo(i.type).opens !== 'external')
        .map((s) => ({ id: s.id, label: `${folderPath(s.parentId) ? folderPath(s.parentId) + ' / ' : ''}${s.name}`, type: s.type }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [items]
  );
  const setEntry = (id: string, patch: Partial<WorkspaceEntry>) => setWs((w) => ({ ...w, entries: w.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const move = (i: number, dir: -1 | 1) =>
    setWs((w) => {
      const entries = [...w.entries];
      [entries[i], entries[i + dir]] = [entries[i + dir], entries[i]];
      return { ...w, entries };
    });
  const valid = ws.name.trim() && ws.entries.length > 0;
  const save = (open: boolean) => {
    if (!valid) return;
    const entries = ws.entries.map((e, i) => (i === 0 ? { ...e, placement: 'tab' as const } : e));
    saveWorkspace({ ...ws, name: ws.name.trim(), entries });
    closeDialog(d.id);
    if (open) openWorkspace(ws.id);
    else toast('success', `Workspace “${ws.name.trim()}” saved`);
  };
  const splittable = (i: number) => {
    if (i === 0) return false;
    const prev = ws.entries[i - 1];
    const type = prev.sessionId ? sessions.find((s) => s.id === prev.sessionId)?.type : 'local';
    return type !== 'sftp';
  };

  return (
    <Modal
      title={existing ? `Edit workspace “${existing.name}”` : 'New workspace'}
      icon={<LayoutGrid size={18} />}
      onClose={() => closeDialog(d.id)}
      width={640}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn" disabled={!valid} onClick={() => save(false)}>
            Save
          </button>
          <button className="btn primary" disabled={!valid} onClick={() => save(true)}>
            Save & open
          </button>
        </>
      }
    >
      <p className="field-hint block">
        A workspace opens a set of sessions in one go — each in its own tab or split next to the one before.
      </p>
      <Field label="Name">
        <input value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} placeholder="Morning checks" autoFocus />
      </Field>
      <Field group label="Sessions">
        <div className="ws-entries">
          {ws.entries.map((e, i) => (
            <div key={e.id} className="ws-entry">
              <span className="ws-entry-n">{i + 1}</span>
              <select value={e.sessionId} onChange={(ev) => setEntry(e.id, { sessionId: ev.target.value })}>
                <option value="">Local shell (this Mac)</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
                {e.sessionId && !sessions.some((s) => s.id === e.sessionId) && <option value={e.sessionId}>(deleted session)</option>}
              </select>
              <select
                className="ws-place"
                value={i === 0 ? 'tab' : e.placement}
                disabled={i === 0}
                onChange={(ev) => setEntry(e.id, { placement: ev.target.value as WorkspaceEntry['placement'] })}
              >
                {PLACEMENTS.filter((p) => p.value === 'tab' || splittable(i)).map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button className="icon-btn sm" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={13} />
              </button>
              <button className="icon-btn sm" title="Move down" disabled={i === ws.entries.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={13} />
              </button>
              <button className="icon-btn sm" title="Remove" onClick={() => setWs({ ...ws, entries: ws.entries.filter((x) => x.id !== e.id) })}>
                <Trash size={13} />
              </button>
            </div>
          ))}
          <div className="row-actions">
            <button
              className="btn sm"
              onClick={() => setWs({ ...ws, entries: [...ws.entries, { id: uid(), sessionId: sessions[0]?.id || '', placement: 'tab' }] })}
            >
              <Plus size={14} /> Add session
            </button>
            {!d.fromTabs && (
              <button className="btn sm" onClick={() => setWs({ ...ws, entries: entriesFromTabs() })} title="Replace the list with the tabs open now">
                Use open tabs
              </button>
            )}
          </div>
        </div>
      </Field>
      <Toggle
        checked={ws.openOnLaunch}
        onChange={(openOnLaunch) => setWs({ ...ws, openOnLaunch })}
        label="Open when Conduit starts"
        hint="The sessions connect automatically every time you open Conduit."
      />
    </Modal>
  );
}

// ---- backup export / import ---------------------------------------------------------------

function SummaryLine({ s }: { s: BackupSummary }) {
  const parts = [
    [s.sessions, 'session'],
    [s.folders, 'folder'],
    [s.credentials, 'saved login'],
    [s.snippets, 'snippet'],
    [s.buttonBars, 'button bar'],
    [s.triggers, 'trigger'],
    [s.workspaces, 'workspace'],
    [s.secrets, 'saved password'],
  ] as const;
  return (
    <span>
      {parts
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}${n === 1 ? '' : 's'}`)
        .join(' · ') || 'Nothing'}
      {s.settings ? ' · settings' : ''}
    </span>
  );
}

export function BackupDialog({ d }: { d: Of<'backup'> }) {
  return d.mode === 'export' ? <ExportBackup d={d} /> : <ImportBackup d={d} />;
}

function ExportBackup({ d }: { d: Of<'backup'> }) {
  const [includeSettings, setIncludeSettings] = useState(true);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const problem = includeSecrets ? (pass.length < 8 ? 'Use at least 8 characters' : pass !== pass2 ? 'The passphrases do not match' : null) : null;

  const run = async () => {
    if (problem) return;
    setBusy(true);
    try {
      await flushPersist();
      const file = await api.backup.export({ includeSettings, includeSecrets, passphrase: includeSecrets ? pass : undefined });
      if (file) {
        closeDialog(d.id);
        toast('success', `Backup saved to ${shortPath(file)}`, { label: 'Show in Finder', run: () => api.fs.reveal(file) });
      }
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Export backup"
      icon={<FileArchive size={18} />}
      onClose={() => closeDialog(d.id)}
      width={520}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!!problem || busy} onClick={run}>
            Export…
          </button>
        </>
      }
    >
      <p className="field-hint block">
        Saves sessions, folders, saved logins, snippets, button bars, triggers and workspaces into one file — to move to another Mac or
        keep a copy.
      </p>
      <Toggle checked={includeSettings} onChange={setIncludeSettings} label="Include settings" hint="Theme, fonts, highlighting rules and other preferences." />
      <Toggle
        checked={includeSecrets}
        onChange={setIncludeSecrets}
        label="Include saved passwords"
        hint="The whole file is then encrypted with a passphrase you choose. Without it the passwords cannot be read."
      />
      {includeSecrets && (
        <div className="row">
          <Field label="Passphrase">
            <PasswordInput value={pass} onChange={setPass} placeholder="at least 8 characters" />
          </Field>
          <Field label="Repeat">
            <PasswordInput value={pass2} onChange={setPass2} />
          </Field>
        </div>
      )}
      {includeSecrets && problem && (pass || pass2) && <p className="form-error">{problem}</p>}
    </Modal>
  );
}

function ImportBackup({ d }: { d: Of<'backup'> }) {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [settings, setSettings] = useState(false);
  const [secrets, setSecrets] = useState(true);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setError('');
    try {
      const res = await api.backup.choose();
      if (!res) return;
      setInfo(res);
      setSummary(res.encrypted ? null : res.summary);
      setPass('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const unlock = async () => {
    if (!info) return;
    setError('');
    try {
      setSummary(await api.backup.read(info.file, pass));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const run = async () => {
    if (!info || !summary) return;
    setBusy(true);
    try {
      await flushPersist();
      const res = await api.backup.apply(info.file, info.encrypted ? pass : undefined, { mode, settings, secrets });
      applyStoreData(res.data);
      if (settings && res.data.settings) updateSettings({});
      closeDialog(d.id);
      toast('success', `Backup imported${res.secrets ? ` with ${res.secrets} saved password${res.secrets === 1 ? '' : 's'}` : ''}. Your previous data was copied to ${shortPath(res.backupDir)}`, {
        label: 'Show',
        run: () => api.fs.reveal(res.backupDir),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Import backup"
      icon={<FileArchive size={18} />}
      onClose={() => closeDialog(d.id)}
      width={540}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!summary || busy} onClick={run}>
            Import
          </button>
        </>
      }
    >
      <div className="backup-file">
        <button className="btn" onClick={choose}>
          <FolderOpen size={14} /> {info ? 'Choose another file…' : 'Choose backup file…'}
        </button>
        {info && (
          <span className="backup-file-name" title={info.file}>
            {info.encrypted && <Lock size={12} />} {shortPath(info.file)}
          </span>
        )}
      </div>
      {info && (
        <p className="field-hint block">
          Made {info.created ? new Date(info.created).toLocaleString() : 'with Conduit'}
          {info.app ? ` with Conduit ${info.app}` : ''}.
        </p>
      )}
      {info?.encrypted && !summary && (
        <Field label="Passphrase of the backup">
          <div className="input-with-btn">
            <PasswordInput value={pass} onChange={setPass} autoFocus />
            <button className="btn" onClick={unlock} disabled={!pass}>
              Unlock
            </button>
          </div>
        </Field>
      )}
      {summary && (
        <>
          <div className="backup-summary">
            <SummaryLine s={summary} />
          </div>
          <Field label="How">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: 'Add to my sessions' },
                { value: 'replace', label: 'Replace everything' },
              ]}
            />
          </Field>
          <p className="field-hint block">
            {mode === 'merge'
              ? 'Entries from the backup are added; entries that exist in both are updated from the backup.'
              : 'Your sessions, saved logins, snippets, buttons, triggers and workspaces are replaced by the backup.'}{' '}
            A copy of your current data is kept in Conduit’s folder first.
          </p>
          {summary.settings && <Toggle checked={settings} onChange={setSettings} label="Also import settings" />}
          {summary.secrets > 0 && <Toggle checked={secrets} onChange={setSecrets} label={`Import ${summary.secrets} saved password${summary.secrets === 1 ? '' : 's'}`} />}
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
