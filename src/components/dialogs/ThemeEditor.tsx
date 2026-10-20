import { useState } from 'react';
import { Copy, ImagePlus, Paintbrush, RotateCcw, Trash, X } from 'lucide-react';
import { api } from '../../lib/api';
import { uid } from '../../lib/defaults';
import { backgroundUrl, copyTheme, DEFAULT_BACKDROP, getTheme, THEMES, type Backdrop, type TermTheme } from '../../lib/themes';
import { confirm, toast, updateSettings, useApp } from '../../store/app';
import { Field, Segmented } from '../ui';

type ColorKey = keyof TermTheme['colors'];

const NORMAL: { key: ColorKey; label: string }[] = [
  { key: 'black', label: 'Black' },
  { key: 'red', label: 'Red' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'blue', label: 'Blue' },
  { key: 'magenta', label: 'Magenta' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'white', label: 'White' },
];
const BRIGHT: { key: ColorKey; label: string }[] = NORMAL.map((c) => ({
  key: `bright${c.label}` as ColorKey,
  label: c.label,
}));

/** "#82aaff44" → "#82aaff" for <input type=color>, which has no alpha. */
const solid = (c: string) => (/^#[0-9a-f]{6}/i.test(c) ? c.slice(0, 7) : '#000000');
const alphaOf = (c: string) => (/^#[0-9a-f]{8}$/i.test(c) ? c.slice(7) : '');

/** Makes an editable copy of a theme and selects it. */
export function customizeTheme(from: TermTheme) {
  const { settings } = useApp.getState();
  const name = from.custom ? `${from.name} copy` : `My ${from.name.replace(/\s*\(.*\)$/, '')}`;
  const t = copyTheme(from, `custom-${uid()}`, name);
  updateSettings({ customThemes: [...settings.customThemes, t], theme: t.id });
  return t;
}

function ColorWell({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="color-well" title={`${label} · ${value}`}>
      <span className="color-well-swatch" style={{ background: value }}>
        <input type="color" value={solid(value)} onChange={(e) => onChange(e.target.value + alphaOf(value))} />
      </span>
      <span className="color-well-label">{label}</span>
    </label>
  );
}

/** Editor for a custom theme: name, background (color, gradient or picture) and every color. */
export function ThemeEditor({ theme }: { theme: TermTheme }) {
  const themes = useApp((s) => s.settings.customThemes);
  const [showAll, setShowAll] = useState(false);
  const b: Backdrop = { ...DEFAULT_BACKDROP, ...(theme.backdrop || {}) };

  const update = (patch: Partial<TermTheme>) =>
    updateSettings({ customThemes: themes.map((t) => (t.id === theme.id ? { ...t, ...patch } : t)) });
  const setColor = (key: ColorKey, value: string) => {
    const colors = { ...theme.colors, [key]: value };
    // the cursor text keeps the background color unless set separately
    if (key === 'background' && theme.colors.cursorAccent === theme.colors.background) colors.cursorAccent = value;
    update({ colors });
  };
  const setBackdrop = (patch: Partial<Backdrop>) => update({ backdrop: { ...b, ...patch } });

  /** Removes pictures no theme uses any more (Conduit's copies only). */
  const cleanupImage = (name: string, remaining: TermTheme[]) => {
    if (name && !remaining.some((t) => t.backdrop?.image === name)) api.appearance.removeImage(name).catch(() => {});
  };

  const chooseImage = async () => {
    try {
      const name = await api.appearance.chooseImage();
      if (!name) return;
      const old = b.image;
      setBackdrop({ type: 'image', image: name });
      cleanupImage(old, themes.map((t) => (t.id === theme.id ? { ...t, backdrop: { ...b, image: name } } : t)));
    } catch (err: any) {
      toast('error', err.message);
    }
  };

  const removeImage = () => {
    const old = b.image;
    setBackdrop({ type: 'color', image: '' });
    cleanupImage(old, themes.map((t) => (t.id === theme.id ? { ...t, backdrop: { ...b, image: '' } } : t)));
  };

  const remove = async () => {
    const ok = await confirm({ title: `Delete “${theme.name}”?`, message: 'Sessions that use it go back to the default theme.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const remaining = themes.filter((t) => t.id !== theme.id);
    const { settings } = useApp.getState();
    updateSettings({ customThemes: remaining, ...(settings.theme === theme.id ? { theme: theme.base || 'conduit' } : {}) });
    cleanupImage(b.image, remaining);
  };

  const base = THEMES.find((t) => t.id === theme.base);

  return (
    <div className="theme-editor">
      <div className="theme-editor-head">
        <Paintbrush size={15} />
        <input className="theme-name" value={theme.name} onChange={(e) => update({ name: e.target.value })} spellCheck={false} />
        <button className="icon-btn sm" title="Duplicate" onClick={() => customizeTheme(theme)}>
          <Copy size={14} />
        </button>
        <button className="icon-btn sm" title="Delete" onClick={remove}>
          <Trash size={14} />
        </button>
      </div>

      <Field label="Background">
        <Segmented
          small
          value={b.type}
          onChange={(type) => (type === 'image' && !b.image ? chooseImage() : setBackdrop({ type }))}
          options={[
            { value: 'color', label: 'Color' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'image', label: 'Picture' },
          ]}
        />
      </Field>

      <div className="theme-bg-row">
        <ColorWell label={b.type === 'gradient' ? 'From' : b.type === 'image' ? 'Base color' : 'Background'} value={theme.colors.background} onChange={(v) => setColor('background', v)} />
        {b.type === 'gradient' && (
          <>
            <ColorWell label="To" value={b.gradientTo} onChange={(v) => setBackdrop({ gradientTo: v })} />
            <label className="theme-slider">
              <span>Angle · {b.gradientAngle}°</span>
              <input type="range" min={0} max={360} step={5} value={b.gradientAngle} onChange={(e) => setBackdrop({ gradientAngle: Number(e.target.value) })} />
            </label>
          </>
        )}
        {b.type === 'image' && b.image && (
          <>
            <span className="theme-image-thumb" style={{ backgroundImage: `url("${backgroundUrl(b.image)}")` }} />
            <button className="btn sm" onClick={chooseImage}>
              <ImagePlus size={14} /> Other picture…
            </button>
            <button className="icon-btn sm" title="Remove the picture" onClick={removeImage}>
              <X size={14} />
            </button>
          </>
        )}
      </div>

      {b.type === 'image' && b.image && (
        <div className="theme-image-opts">
          <Field label="Fit">
            <Segmented
              small
              value={b.fit}
              onChange={(fit) => setBackdrop({ fit })}
              options={[
                { value: 'cover', label: 'Fill' },
                { value: 'contain', label: 'Fit' },
                { value: 'center', label: 'Center' },
                { value: 'tile', label: 'Tile' },
              ]}
            />
          </Field>
          <label className="theme-slider">
            <span>Visibility · {Math.round(b.imageOpacity * 100)}%</span>
            <input type="range" min={0.05} max={1} step={0.05} value={b.imageOpacity} onChange={(e) => setBackdrop({ imageOpacity: Number(e.target.value) })} />
          </label>
          <label className="theme-slider">
            <span>Blur · {b.blur}px</span>
            <input type="range" min={0} max={24} step={1} value={b.blur} onChange={(e) => setBackdrop({ blur: Number(e.target.value) })} />
          </label>
        </div>
      )}
      {b.type === 'image' && <p className="field-hint block">Keep the visibility low so text stays easy to read. The picture is copied into Conduit’s folder.</p>}

      <Field label="Colors">
        <div className="color-grid">
          <ColorWell label="Text" value={theme.colors.foreground} onChange={(v) => setColor('foreground', v)} />
          <ColorWell label="Cursor" value={theme.colors.cursor} onChange={(v) => setColor('cursor', v)} />
          <ColorWell label="Selection" value={theme.colors.selectionBackground} onChange={(v) => setColor('selectionBackground', v)} />
          <ColorWell label="Accent (app)" value={theme.accent} onChange={(v) => update({ accent: v })} />
        </div>
      </Field>
      {!showAll ? (
        <button className="link-btn theme-more" onClick={() => setShowAll(true)}>
          Edit the 16 terminal colors…
        </button>
      ) : (
        <>
          <Field label="Normal colors">
            <div className="color-grid ansi">
              {NORMAL.map((c) => (
                <ColorWell key={c.key} label={c.label} value={theme.colors[c.key]} onChange={(v) => setColor(c.key, v)} />
              ))}
            </div>
          </Field>
          <Field label="Bright colors">
            <div className="color-grid ansi">
              {BRIGHT.map((c) => (
                <ColorWell key={c.key} label={c.label} value={theme.colors[c.key]} onChange={(v) => setColor(c.key, v)} />
              ))}
            </div>
          </Field>
        </>
      )}
      {base && (
        <div className="row-actions">
          <button className="btn sm" onClick={() => update({ colors: { ...getTheme(base.id).colors }, accent: base.accent })}>
            <RotateCcw size={13} /> Colors from {base.name}
          </button>
        </div>
      )}
    </div>
  );
}
