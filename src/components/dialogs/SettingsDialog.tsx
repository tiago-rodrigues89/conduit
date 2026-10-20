import { useEffect, useMemo, useState } from 'react';
import {
  CloudUpload,
  FileText,
  FolderOpen,
  FolderTree,
  KeyRound,
  LayoutGrid,
  Pencil,
  Play,
  Sparkles,
  Highlighter as HighlighterIcon,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  SquareTerminal,
  Trash,
  Zap,
} from 'lucide-react';
import { api } from '../../lib/api';
import { DEFAULT_LOG_DIR, uid } from '../../lib/defaults';
import { exportSshConfig } from '../../lib/backup';
import { fontStack, installedFonts } from '../../lib/fonts';
import { ansiToSpans, DEFAULT_RULES, Highlighter, HIGHLIGHT_COLORS, PREVIEW_TEXT } from '../../lib/highlight';
import { getTheme, THEMES } from '../../lib/themes';
import type { HighlightRule, PromptStyle, Settings, Trigger } from '../../lib/types';
import {
  closeDialog,
  confirm,
  openDialog,
  openWorkspace,
  removeCredential,
  removeWorkspace,
  saveTriggers,
  toast,
  updateSettings,
  useApp,
  type Dialog,
} from '../../store/app';
import { Field, Modal, PasswordInput, Segmented, Toggle } from '../ui';

type Section = 'appearance' | 'terminal' | 'prompt' | 'highlight' | 'triggers' | 'logging' | 'files' | 'logins' | 'workspaces' | 'sync' | 'general';

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { id: 'prompt', label: 'Prompt', icon: Sparkles },
  { id: 'highlight', label: 'Highlighting', icon: HighlighterIcon },
  { id: 'triggers', label: 'Triggers', icon: Zap },
  { id: 'logging', label: 'Logging', icon: FileText },
  { id: 'files', label: 'Files & SFTP', icon: FolderTree },
  { id: 'logins', label: 'Saved logins', icon: KeyRound },
  { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid },
  { id: 'sync', label: 'Sync & backup', icon: CloudUpload },
  { id: 'general', label: 'General', icon: Monitor },
];

export function SettingsDialog({ d }: { d: Extract<Dialog, { type: 'settings' }> }) {
  const s = useApp((st) => st.settings);
  const [section, setSection] = useState<Section>((d.section as Section) || 'appearance');
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <Modal title="Settings" onClose={() => closeDialog(d.id)} width={820} className="modal-tall" closeOnBackdrop autoFocus={false}>
      <div className="split-form">
        <nav className="split-nav">
          {SECTIONS.map((sec) => (
            <button key={sec.id} className={`split-nav-item${section === sec.id ? ' active' : ''}`} onClick={() => setSection(sec.id)}>
              <sec.icon size={15} />
              {sec.label}
            </button>
          ))}
        </nav>
        <div className="split-body">
          {section === 'appearance' && <Appearance s={s} set={set} />}
          {section === 'terminal' && <TerminalSettings s={s} set={set} />}
          {section === 'prompt' && <PromptSettings s={s} set={set} />}
          {section === 'highlight' && <HighlightSettings s={s} set={set} />}
          {section === 'triggers' && <TriggerSettings />}
          {section === 'logging' && <LoggingSettings s={s} set={set} />}
          {section === 'files' && <FileSettings s={s} set={set} />}
          {section === 'workspaces' && <WorkspaceSettings />}
          {section === 'sync' && <SyncSettings s={s} set={set} />}
          {section === 'logins' && <LoginSettings />}
          {section === 'general' && <GeneralSettings s={s} set={set} />}
        </div>
      </div>
    </Modal>
  );
}

type P = { s: Settings; set: (p: Partial<Settings>) => void };

function TerminalPreview({ s }: { s: Settings }) {
  const t = getTheme(s.theme).colors;
  const c = (k: keyof typeof t) => ({ color: t[k] });
  return (
    <div
      className="term-preview"
      style={{ background: t.background, color: t.foreground, fontFamily: fontStack(s.fontFamily), fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, fontWeight: s.fontWeight }}
    >
      <div>
        <span style={c('green')}>tiago@web-01</span>:<span style={c('blue')}>~/app</span>$ ls -la
      </div>
      <div>
        <span style={c('blue')}>drwxr-xr-x</span> config <span style={c('green')}>deploy.sh</span> <span style={c('yellow')}>backup.tar.gz</span>{' '}
        <span style={c('magenta')}>logo.png</span>
      </div>
      <div>
        <span style={{ ...c('red'), fontWeight: 700 }}>ERROR</span> connection refused · <span style={c('cyan')}>2026-10-16 09:41</span>
      </div>
      <div>
        <span style={c('green')}>tiago@web-01</span>:<span style={c('blue')}>~/app</span>$ <span className="preview-cursor" style={{ background: t.cursor }} />
      </div>
    </div>
  );
}

function Appearance({ s, set }: P) {
  const fonts = useMemo(() => installedFonts(), []);
  const customFont = !fonts.includes(s.fontFamily);
  return (
    <>
      <TerminalPreview s={s} />
      <Field label="Theme">
        <div className="theme-picker">
          {THEMES.map((t) => (
            <button key={t.id} className={`theme-card${s.theme === t.id ? ' active' : ''}`} onClick={() => set({ theme: t.id })}>
              <span className="theme-card-preview" style={{ background: t.colors.background, color: t.colors.foreground }}>
                <span style={{ color: t.colors.green }}>$</span> ls
                <span className="theme-card-dots">
                  {[t.colors.red, t.colors.green, t.colors.yellow, t.colors.blue, t.colors.magenta, t.colors.cyan].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </span>
              </span>
              <span className="theme-card-name">{t.name}</span>
            </button>
          ))}
        </div>
      </Field>
      <div className="row">
        <Field label="Font">
          <select value={customFont ? '__custom' : s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value === '__custom' ? 'Menlo' : e.target.value })}>
            {fonts.map((f) => (
              <option key={f} value={f}>
                {f}
                {f === 'JetBrains Mono' ? ' (built in)' : ''}
              </option>
            ))}
            <option value="__custom">Other…</option>
          </select>
        </Field>
        {customFont && (
          <Field label="Font family name">
            <input value={s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} spellCheck={false} />
          </Field>
        )}
        <Field label="Size">
          <input className="port" type="number" min={8} max={32} value={s.fontSize} onChange={(e) => set({ fontSize: Math.min(32, Math.max(8, Number(e.target.value) || 13)) })} />
        </Field>
      </div>
      <div className="row">
        <Field label={`Line height · ${s.lineHeight.toFixed(2)}`}>
          <input type="range" min={1} max={1.8} step={0.05} value={s.lineHeight} onChange={(e) => set({ lineHeight: Number(e.target.value) })} />
        </Field>
        <Field label={`Letter spacing · ${s.letterSpacing}px`}>
          <input type="range" min={-1} max={3} step={0.5} value={s.letterSpacing} onChange={(e) => set({ letterSpacing: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="row">
        <Field label="Font weight">
          <Segmented
            small
            value={String(s.fontWeight)}
            onChange={(v) => set({ fontWeight: Number(v) })}
            options={[
              { value: '300', label: 'Light' },
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
            ]}
          />
        </Field>
        <Field label="Cursor">
          <Segmented
            small
            value={s.cursorStyle}
            onChange={(v) => set({ cursorStyle: v })}
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'block', label: 'Block' },
              { value: 'underline', label: 'Underline' },
            ]}
          />
        </Field>
      </div>
      <Toggle checked={s.cursorBlink} onChange={(v) => set({ cursorBlink: v })} label="Blinking cursor" />
      <Field label={`Padding around the terminal · ${s.padding}px`}>
        <input type="range" min={0} max={32} step={2} value={s.padding} onChange={(e) => set({ padding: Number(e.target.value) })} />
      </Field>
      <Toggle
        checked={s.translucentSidebar}
        onChange={(v) => set({ translucentSidebar: v })}
        label="Translucent sidebar"
        hint="Lets the desktop shine through the sidebar like Finder."
      />
    </>
  );
}

function TerminalSettings({ s, set }: P) {
  return (
    <>
      <Toggle
        checked={s.monitoring}
        onChange={(v) => set({ monitoring: v })}
        label="Server monitoring in the status bar"
        hint="Shows the OS, CPU, memory, disk, network and uptime of SSH servers, updated every 3 seconds."
      />
      <Toggle checked={s.copyOnSelect} onChange={(v) => set({ copyOnSelect: v })} label="Copy on select" hint="Selected text goes to the clipboard immediately, like MobaXterm and PuTTY." />
      <Field label="Right click">
        <Segmented
          value={s.rightClick}
          onChange={(v) => set({ rightClick: v })}
          options={[
            { value: 'paste', label: 'Paste' },
            { value: 'menu', label: 'Context menu' },
          ]}
        />
      </Field>
      <p className="field-hint block">
        {s.rightClick === 'paste' ? 'Hold ⌃ Control or ⇧ Shift while right-clicking to get the context menu.' : 'Use ⌘V to paste.'}
      </p>
      <Toggle checked={s.pasteWarning} onChange={(v) => set({ pasteWarning: v })} label="Confirm before pasting multiple lines" hint="Protects against accidentally running several commands at once." />
      <Toggle
        checked={s.optionAsMeta}
        onChange={(v) => set({ optionAsMeta: v })}
        label="Use ⌥ Option as Meta key"
        hint="Needed for Emacs-style shortcuts. Keep it off if you type characters like @ | [ ] { } with Option."
      />
      <Field label="Scrollback lines">
        <select value={s.scrollback} onChange={(e) => set({ scrollback: Number(e.target.value) })}>
          {[5000, 10000, 20000, 50000, 100000].map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString()}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Bell">
        <Segmented
          value={s.bell}
          onChange={(v) => set({ bell: v })}
          options={[
            { value: 'visual', label: 'Flash' },
            { value: 'off', label: 'Off' },
          ]}
        />
      </Field>
    </>
  );
}

function PromptPreview({ style, s }: { style: PromptStyle; s: Settings }) {
  const t = getTheme(s.theme).colors;
  const c = (color: string, bold = false) => ({ color, fontWeight: bold ? 700 : undefined });
  const style_ = { background: t.background, color: t.foreground, fontFamily: fontStack(s.fontFamily) };
  const out = <div style={{ color: t.foreground, opacity: 0.75 }}>✓ built in 1.4s</div>;
  const who = (
    <>
      <span style={c(t.blue, true)}>user</span>
      <span style={c(t.brightBlack)}>@server</span>
    </>
  );
  if (style === 'shell') {
    return (
      <div className="prompt-preview" style={style_}>
        <div>[user@server app]$ npm run build</div>
        {out}
        <div>[user@server app]$ </div>
      </div>
    );
  }
  if (style === 'minimal') {
    return (
      <div className="prompt-preview" style={style_}>
        <div>
          {who} <span style={c(t.cyan, true)}>srv/app</span> <span style={c(t.magenta)}>main</span> <span style={c(t.green)}>❯</span> npm run build
        </div>
        {out}
        <div>
          {who} <span style={c(t.cyan, true)}>srv/app</span> <span style={c(t.magenta)}>main</span> <span style={c(t.green)}>❯</span>
        </div>
      </div>
    );
  }
  const frame = style === 'frame';
  const f = (txt: string) => (frame ? <span style={c(t.brightBlack)}>{txt}</span> : null);
  return (
    <div className="prompt-preview" style={style_}>
      <div>
        {f('╭─ ')}
        {who}  <span style={c(t.cyan, true)}>/srv/app</span>  <span style={c(t.magenta)}>⎇ main</span>
      </div>
      <div>
        {f('╰─')}
        <span style={c(t.green)}>❯</span> npm run build
      </div>
      {out}
      <div>&nbsp;</div>
      <div>
        {f('╭─ ')}
        {who}  <span style={c(t.cyan, true)}>/srv/app</span>  <span style={c(t.magenta)}>⎇ main</span>  <span style={c(t.yellow)}>↻ 12s</span>{'  '}
        <span style={c(t.red)}>✘ 1</span>
      </div>
      <div>
        {f('╰─')}
        <span style={c(t.red)}>❯</span>
      </div>
    </div>
  );
}

function PromptSettings({ s, set }: P) {
  const styles: { id: PromptStyle; name: string; desc: string }[] = [
    { id: 'conduit', name: 'Conduit', desc: 'Who and where on one line, your command on the line below. Shows the git branch, slow commands and errors.' },
    { id: 'frame', name: 'Frame', desc: 'The same with a thin line that ties both lines together.' },
    { id: 'minimal', name: 'Minimal', desc: 'Everything on one compact line.' },
    { id: 'shell', name: 'Shell’s own', desc: 'Keep the prompt from your shell config untouched.' },
  ];
  return (
    <>
      <p className="field-hint block">
        The prompt is the line in front of your commands. Conduit’s prompts show who you are and where you are, and turn red when a
        command fails. The user name turns red as root. Changes apply to new tabs.
      </p>
      <div className="prompt-cards">
        {styles.map((st) => (
          <button key={st.id} className={`prompt-card${s.promptStyle === st.id ? ' active' : ''}`} onClick={() => set({ promptStyle: st.id })}>
            <PromptPreview style={st.id} s={s} />
            <span className="prompt-card-text">
              <b>{st.name}</b>
              <span>{st.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <Toggle
        checked={s.promptOnServers}
        onChange={(v) => set({ promptOnServers: v })}
        label="Use it on SSH servers too"
        hint="For bash and zsh. Applied for the current login only, nothing is changed on the server. Each session can override this."
      />
    </>
  );
}

function LoginSettings() {
  const credentials = useApp((st) => st.credentials);
  const items = useApp((st) => st.items);
  const usage = (id: string) => items.filter((i) => i.kind === 'session' && i.credentialId === id).length;
  return (
    <>
      <p className="field-hint block">
        Saved logins hold a username with its password or key. Pick one in a session under <b>Login</b> — when the password changes you
        update it once here.
      </p>
      {credentials.length ? (
        <div className="login-list">
          {credentials.map((c) => (
            <div key={c.id} className="login-row">
              <KeyRound size={16} className="login-icon" />
              <span className="login-text">
                <b>{c.name}</b>
                <span>
                  {c.username}
                  {c.keyPath ? ` · ${c.keyPath}` : ''} · used by {usage(c.id)} session{usage(c.id) === 1 ? '' : 's'}
                </span>
              </span>
              <button className="icon-btn sm" title="Edit" onClick={() => openDialog({ type: 'credential', credentialId: c.id })}>
                <Pencil size={14} />
              </button>
              <button
                className="icon-btn sm"
                title="Delete"
                onClick={async () => {
                  const n = usage(c.id);
                  const ok = await confirm({
                    title: `Delete “${c.name}”?`,
                    message: n
                      ? `${n} session${n === 1 ? '' : 's'} use this login and will ask for username and password again.`
                      : 'The saved login and its password are removed.',
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (ok) removeCredential(c.id);
                }}
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="login-empty">No saved logins yet.</div>
      )}
      <div className="row-actions">
        <button className="btn sm" onClick={() => openDialog({ type: 'credential' })}>
          <Plus size={14} /> New saved login
        </button>
      </div>
    </>
  );
}

function HighlightSettings({ s, set }: P) {
  const preview = useMemo(() => {
    const h = new Highlighter(s.highlightRules);
    return PREVIEW_TEXT.map((line) => ansiToSpans(h.process(line)));
  }, [s.highlightRules]);
  const theme = getTheme(s.theme).colors as unknown as Record<string, string>;
  const rules = s.highlightRules;
  const update = (id: string, patch: Partial<HighlightRule>) => set({ highlightRules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const invalid = (r: HighlightRule) => {
    try {
      new RegExp(r.pattern);
      return false;
    } catch {
      return true;
    }
  };

  return (
    <>
      <Toggle
        checked={s.highlight}
        onChange={(v) => set({ highlight: v })}
        label="Highlight keywords in terminal output"
        hint="Colors errors, warnings, IP addresses and more. Output that is already colored and full-screen apps like vim are left alone. Toggle per tab with ⇧⌘H."
      />
      <div className="hl-preview" style={{ background: theme.background, color: theme.foreground, fontFamily: fontStack(s.fontFamily) }}>
        {preview.map((spans, i) => (
          <div key={i}>
            {spans.map((sp, j) => (
              <span key={j} style={{ color: sp.color ? theme[sp.color] : undefined, fontWeight: sp.bold ? 700 : undefined }}>
                {sp.text}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="hl-rules">
        {rules.map((r) => (
          <div key={r.id} className={`hl-rule${r.enabled ? '' : ' disabled'}`}>
            <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} />
            <input className="hl-name" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
            <input
              className={`hl-pattern mono${invalid(r) ? ' invalid' : ''}`}
              value={r.pattern}
              onChange={(e) => update(r.id, { pattern: e.target.value })}
              spellCheck={false}
              title="Regular expression"
            />
            <select className="hl-color" value={r.color} onChange={(e) => update(r.id, { color: e.target.value as HighlightRule['color'] })} style={{ color: theme[r.color === 'gray' ? 'brightBlack' : r.color] }}>
              {HIGHLIGHT_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className={`icon-btn sm text${r.bold ? ' on' : ''}`} title="Bold" onClick={() => update(r.id, { bold: !r.bold })}>
              B
            </button>
            <button className={`icon-btn sm text${r.ignoreCase ? ' on' : ''}`} title="Ignore case" onClick={() => update(r.id, { ignoreCase: !r.ignoreCase })}>
              Aa
            </button>
            <button className="icon-btn sm" title="Remove" onClick={() => set({ highlightRules: rules.filter((x) => x.id !== r.id) })}>
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="row-actions">
        <button
          className="btn sm"
          onClick={() => set({ highlightRules: [...rules, { id: uid(), name: 'My rule', pattern: String.raw`\bkeyword\b`, ignoreCase: true, color: 'cyan', bold: false, enabled: true }] })}
        >
          <Plus size={14} /> Add rule
        </button>
        <button className="btn sm" onClick={() => set({ highlightRules: DEFAULT_RULES })}>
          <RotateCcw size={14} /> Restore defaults
        </button>
      </div>
    </>
  );
}

function FileSettings({ s, set }: P) {
  const info = useApp((st) => st.info);
  return (
    <>
      <Toggle
        checked={s.autoShowFiles}
        onChange={(v) => set({ autoShowFiles: v })}
        label="Sidebar follows the tabs"
        hint="SSH tabs show the Files panel, Home and local tabs show Sessions. A panel you pick by hand is remembered for that tab."
      />
      <Toggle
        checked={s.followFolder}
        onChange={(v) => set({ followFolder: v })}
        label="Files panel follows the terminal folder"
        hint="After login a small hook is added to bash/zsh so the panel knows when you cd. Can be changed per session."
      />
      <Toggle checked={s.showHidden} onChange={(v) => set({ showHidden: v })} label="Show hidden files" />
      <Field label="Double-click on a remote file">
        <Segmented
          value={s.doubleClick}
          onChange={(v) => set({ doubleClick: v })}
          options={[
            { value: 'edit', label: 'Open / edit' },
            { value: 'download', label: 'Download' },
          ]}
        />
      </Field>
      <Field label="Editor for remote files" hint="Leave empty to use the default app for each file type. Saved changes are uploaded automatically.">
        <input value={s.editorApp} onChange={(e) => set({ editorApp: e.target.value })} placeholder="e.g. Visual Studio Code, TextEdit, BBEdit" />
      </Field>
      <Field label="Download folder">
        <div className="input-with-btn">
          <input value={s.downloadDir} onChange={(e) => set({ downloadDir: e.target.value })} placeholder={info?.downloads || '~/Downloads'} spellCheck={false} />
          <button
            className="btn"
            onClick={async () => {
              const res = await api.openDialog({ title: 'Download folder', directory: true, defaultPath: s.downloadDir || info?.downloads });
              if (res?.[0]) set({ downloadDir: res[0] });
            }}
          >
            <FolderOpen size={14} /> Choose
          </button>
        </div>
      </Field>
      <Toggle checked={s.askDownloadDir} onChange={(v) => set({ askDownloadDir: v })} label="Ask where to save every download" />
    </>
  );
}

function GeneralSettings({ s, set }: P) {
  const info = useApp((st) => st.info);
  return (
    <>
      <Toggle checked={s.confirmClose} onChange={(v) => set({ confirmClose: v })} label="Confirm before closing active sessions" />
      <Field label="Default keep-alive interval (seconds)" hint="Used for new sessions and quick connections.">
        <input className="port" type="number" min={0} value={s.keepAlive} onChange={(e) => set({ keepAlive: Number(e.target.value) })} />
      </Field>
      <div className="about-box">
        <b>Conduit {info?.version}</b>
        <span className="muted">Sessions, settings and host keys are stored in ~/Library/Application Support/Conduit. Passwords are encrypted with a key kept in your macOS Keychain.</span>
      </div>
    </>
  );
}

// ---- triggers ------------------------------------------------------------------------------

function TriggerSettings() {
  const triggers = useApp((st) => st.triggers);
  const update = (id: string, patch: Partial<Trigger>) => saveTriggers(triggers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const invalid = (t: Trigger) => {
    if (!t.pattern) return true;
    try {
      new RegExp(t.pattern);
      return false;
    } catch {
      return true;
    }
  };
  const add = (t: Partial<Trigger>) =>
    saveTriggers([...triggers, { id: uid(), name: 'New trigger', pattern: '', ignoreCase: true, action: 'notify', text: '', hosts: '', enabled: true, ...t }]);

  return (
    <>
      <p className="field-hint block">
        Triggers watch the output of every terminal. When a line matches, Conduit can show a notification (when you are in another tab or
        app), mark the tab, or type an answer. Patterns are regular expressions.
      </p>
      <div className="trigger-list">
        {triggers.map((t) => (
          <div key={t.id} className={`trigger${t.enabled ? '' : ' disabled'}`}>
            <div className="trigger-line">
              <input type="checkbox" checked={t.enabled} onChange={(e) => update(t.id, { enabled: e.target.checked })} title="Enabled" />
              <input className="trigger-name" value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} placeholder="Name" />
              <input
                className={`trigger-pattern mono${invalid(t) ? ' invalid' : ''}`}
                value={t.pattern}
                onChange={(e) => update(t.id, { pattern: e.target.value })}
                placeholder="pattern, e.g. Backup (finished|failed)"
                spellCheck={false}
              />
              <button className={`icon-btn sm text${t.ignoreCase ? ' on' : ''}`} title="Ignore case" onClick={() => update(t.id, { ignoreCase: !t.ignoreCase })}>
                Aa
              </button>
              <button className="icon-btn sm" title="Remove" onClick={() => saveTriggers(triggers.filter((x) => x.id !== t.id))}>
                <Trash size={14} />
              </button>
            </div>
            <div className="trigger-line sub">
              <Segmented
                small
                value={t.action}
                onChange={(action) => update(t.id, { action })}
                options={[
                  { value: 'notify', label: 'Notify' },
                  { value: 'mark', label: 'Mark tab' },
                  { value: 'send', label: 'Type text' },
                ]}
              />
              {t.action === 'send' && (
                <input
                  className="trigger-text mono"
                  value={t.text}
                  onChange={(e) => update(t.id, { text: e.target.value })}
                  placeholder="text to type, then Enter"
                  spellCheck={false}
                />
              )}
              <input
                className="trigger-hosts"
                value={t.hosts}
                onChange={(e) => update(t.id, { hosts: e.target.value })}
                placeholder="all sessions"
                title="Only for these sessions or hosts, comma separated, * as wildcard (e.g. core-*, 10.0.0.*)"
                spellCheck={false}
              />
            </div>
          </div>
        ))}
        {!triggers.length && <div className="login-empty">No triggers yet.</div>}
      </div>
      <div className="row-actions">
        <button className="btn sm" onClick={() => add({})}>
          <Plus size={14} /> Add trigger
        </button>
        <button className="btn sm" onClick={() => add({ name: 'Errors', pattern: String.raw`\b(error|failed|fatal|panic)\b`, action: 'notify' })}>
          + Notify on errors
        </button>
        <button className="btn sm" onClick={() => add({ name: 'Job done', pattern: String.raw`\b(done|finished|completed)\b`, action: 'mark' })}>
          + Mark tab when a job is done
        </button>
      </div>
      <p className="field-hint block">
        “Type text” answers prompts automatically, e.g. a confirmation on a switch. Use precise patterns and limit them to the right hosts
        — a trigger that fires too often is paused for that terminal. Don’t type passwords with triggers; their text is stored unencrypted.
      </p>
    </>
  );
}

// ---- logging -------------------------------------------------------------------------------

function LoggingSettings({ s, set }: P) {
  const dir = s.logDir || DEFAULT_LOG_DIR;
  const example = (s.logName || '{session}_{date}_{time}')
    .replace(/\{session\}/g, 'web-01')
    .replace(/\{host\}/g, '10.0.0.5')
    .replace(/\{user\}/g, 'admin')
    .replace(/\{date\}/g, new Date().toISOString().slice(0, 10))
    .replace(/\{time\}/g, '09-41-07');
  return (
    <>
      <Toggle
        checked={s.logAuto}
        onChange={(v) => set({ logAuto: v })}
        label="Log every session to a file"
        hint="Off by default. Each session can override this (Automation section), and any terminal can start or stop logging from its right-click menu or with ⌥⌘L."
      />
      <Field label="Log folder">
        <div className="input-with-btn">
          <input value={s.logDir} onChange={(e) => set({ logDir: e.target.value })} placeholder={DEFAULT_LOG_DIR} spellCheck={false} />
          <button
            className="btn"
            onClick={async () => {
              const res = await api.openDialog({ title: 'Folder for session logs', directory: true, defaultPath: dir, buttonLabel: 'Choose' });
              if (res?.[0]) set({ logDir: res[0] });
            }}
          >
            <FolderOpen size={14} /> Choose
          </button>
          <button className="btn" onClick={() => api.log.openDir(dir).catch((err) => toast('error', err.message))} title="Open in Finder">
            Open
          </button>
        </div>
      </Field>
      <Field label="File name" hint={<>Placeholders: {'{session} {host} {user} {date} {time}'} · e.g. {example}.log</>}>
        <input className="mono" value={s.logName} onChange={(e) => set({ logName: e.target.value })} placeholder="{session}_{date}_{time}" spellCheck={false} />
      </Field>
      <Toggle checked={s.logTimestamps} onChange={(v) => set({ logTimestamps: v })} label="Add a timestamp to every line" />
      <Toggle
        checked={s.logRaw}
        onChange={(v) => set({ logRaw: v })}
        label="Keep colors and control codes"
        hint="Off: clean text that is easy to read and search. On: the raw stream, which looks right with cat or less -R."
      />
      <p className="field-hint block">Logs contain everything the terminal shows, including anything secret that is printed. They are only readable by your user.</p>
    </>
  );
}

// ---- workspaces ------------------------------------------------------------------------------

function WorkspaceSettings() {
  const workspaces = useApp((st) => st.workspaces);
  const items = useApp((st) => st.items);
  const name = (id: string) => (id ? items.find((i) => i.id === id)?.name || 'deleted session' : 'Local shell');
  return (
    <>
      <p className="field-hint block">
        A workspace opens several sessions at once, in tabs and split panes. Mark one to open automatically when Conduit starts. Open them
        from Home, the launcher, or here.
      </p>
      {workspaces.length ? (
        <div className="login-list">
          {workspaces.map((w) => (
            <div key={w.id} className="login-row">
              <LayoutGrid size={16} className="login-icon" />
              <span className="login-text">
                <b>
                  {w.name}
                  {w.openOnLaunch && <span className="badge">opens at start</span>}
                </b>
                <span>{w.entries.map((e) => name(e.sessionId)).join(' · ')}</span>
              </span>
              <button className="icon-btn sm" title="Open" onClick={() => openWorkspace(w.id)}>
                <Play size={14} />
              </button>
              <button className="icon-btn sm" title="Edit" onClick={() => openDialog({ type: 'workspace', workspaceId: w.id })}>
                <Pencil size={14} />
              </button>
              <button
                className="icon-btn sm"
                title="Delete"
                onClick={async () => {
                  if (await confirm({ title: `Delete “${w.name}”?`, message: 'The workspace is removed. Its sessions stay.', confirmLabel: 'Delete', danger: true }))
                    removeWorkspace(w.id);
                }}
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="login-empty">No workspaces yet.</div>
      )}
      <div className="row-actions">
        <button className="btn sm" onClick={() => openDialog({ type: 'workspace' })}>
          <Plus size={14} /> New workspace
        </button>
        <button className="btn sm" onClick={() => openDialog({ type: 'workspace', fromTabs: true })}>
          Save open tabs as workspace
        </button>
      </div>
    </>
  );
}

// ---- sync & backup -----------------------------------------------------------------------------

function SyncSettings({ s, set }: P) {
  const status = useApp((st) => st.sync);
  const [suggested, setSuggested] = useState('');
  const [pass, setPass] = useState('');
  useEffect(() => {
    api.sync.defaultDir().then(setSuggested).catch(() => {});
    api.sync.status().then((st) => useApp.setState({ sync: st })).catch(() => {});
  }, []);
  const savePass = async () => {
    if (pass.length < 8) return toast('error', 'Use at least 8 characters');
    await api.sync.setPassphrase(pass);
    setPass('');
    useApp.setState({ sync: await api.sync.status() });
    toast('success', 'Sync passphrase saved in the Keychain');
  };
  const since = status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : '';
  return (
    <>
      <p className="field-hint block">
        Keep sessions, folders, saved logins, snippets, button bars, triggers and workspaces the same on all your Macs — without an
        account. Conduit keeps one encrypted file in a folder you choose, e.g. in iCloud Drive or Dropbox. Settings stay per Mac.
      </p>
      <Toggle checked={s.syncEnabled} onChange={(v) => set({ syncEnabled: v, syncDir: s.syncDir || suggested })} label="Sync with my other Macs" />
      <Field label="Sync folder" hint="Use the same folder on every Mac.">
        <div className="input-with-btn">
          <input value={s.syncDir} onChange={(e) => set({ syncDir: e.target.value })} placeholder={suggested || 'Choose a folder'} spellCheck={false} />
          <button
            className="btn"
            onClick={async () => {
              const res = await api.openDialog({ title: 'Sync folder', directory: true, defaultPath: s.syncDir || suggested || '~', buttonLabel: 'Choose' });
              if (res?.[0]) set({ syncDir: res[0] });
            }}
          >
            <FolderOpen size={14} /> Choose
          </button>
        </div>
      </Field>
      {suggested && s.syncDir && s.syncDir !== suggested && (
        <p className="field-hint block">
          <button className="link-btn" onClick={() => set({ syncDir: suggested })}>
            Use iCloud Drive/Conduit
          </button>
        </p>
      )}
      <Field
        label={status.hasPassphrase ? 'Sync passphrase (saved — enter a new one to change it)' : 'Sync passphrase'}
        hint="Encrypts the sync file. Use the same passphrase on every Mac; it is kept in this Mac’s Keychain."
      >
        <div className="input-with-btn">
          <PasswordInput value={pass} onChange={setPass} placeholder={status.hasPassphrase ? '••••••••' : 'at least 8 characters'} />
          <button className="btn" disabled={!pass} onClick={savePass}>
            Save
          </button>
        </div>
      </Field>
      <Toggle
        checked={s.syncSecrets}
        onChange={(v) => set({ syncSecrets: v })}
        label="Include saved passwords"
        hint="Saved passwords and key passphrases travel inside the encrypted file."
      />
      {s.syncEnabled && (
        <div className={`sync-status ${status.state}`}>
          <span className="sync-dot" />
          <span className="sync-text">
            {status.state === 'syncing'
              ? 'Syncing…'
              : status.state === 'error'
                ? status.message || 'Sync failed'
                : status.state === 'idle'
                  ? `Up to date${since ? ` · last sync ${since}` : ''}`
                  : 'Waiting'}
          </span>
          <button className="btn sm" onClick={() => api.sync.now().catch(() => {})} disabled={status.state === 'syncing'}>
            <RefreshCw size={13} className={status.state === 'syncing' ? 'spin' : ''} /> Sync now
          </button>
        </div>
      )}
      <h3 className="settings-subhead">Backup</h3>
      <p className="field-hint block">One file with everything — to move to another Mac or keep a copy. Passwords are included only encrypted with a passphrase.</p>
      <div className="row-actions">
        <button className="btn sm" onClick={() => openDialog({ type: 'backup', mode: 'export' })}>
          Export backup…
        </button>
        <button className="btn sm" onClick={() => openDialog({ type: 'backup', mode: 'import' })}>
          Import backup…
        </button>
        <button className="btn sm" onClick={exportSshConfig}>
          Export SSH sessions as OpenSSH config…
        </button>
      </div>
    </>
  );
}
