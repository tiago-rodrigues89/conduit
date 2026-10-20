import { useState } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { newFolder } from '../../lib/defaults';
import { ICON_NAMES, ICONS } from '../../lib/icons';
import { SESSION_COLORS } from '../../lib/themes';
import type { FolderItem } from '../../lib/types';
import { closeDialog, saveItem, useApp, type Dialog } from '../../store/app';
import { Field, Modal } from '../ui';

export function FolderDialog({ d }: { d: Extract<Dialog, { type: 'folder' }> }) {
  const existing = useApp.getState().items.find((i): i is FolderItem => i.id === d.folderId && i.kind === 'folder');
  const [f, setF] = useState<FolderItem>(() => existing || newFolder({ name: '', parentId: d.parentId ?? null }));
  const valid = f.name.trim().length > 0;
  const save = () => {
    if (!valid) return;
    saveItem({ ...f, name: f.name.trim() });
    closeDialog(d.id);
  };
  const Preview = ICONS[f.icon] || ICONS.folder;
  return (
    <Modal
      title={existing ? 'Edit folder' : 'New folder'}
      icon={<Preview size={18} style={f.color ? { color: f.color } : undefined} />}
      onClose={() => closeDialog(d.id)}
      width={460}
      footer={
        <>
          <span className="flex" />
          <button className="btn" onClick={() => closeDialog(d.id)}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            {existing ? 'Save' : 'Create'}
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
        <Field label="Name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Production servers" autoFocus />
        </Field>
        <Field label="Icon">
          <IconGrid value={f.icon || 'folder'} color={f.color} onChange={(icon) => setF({ ...f, icon: icon === 'folder' ? '' : icon })} />
        </Field>
        <Field label="Color">
          <ColorSwatches value={f.color} onChange={(color) => setF({ ...f, color })} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function IconGrid({
  value,
  color,
  onChange,
  include,
  typeIcon,
}: {
  value: string;
  color?: string;
  onChange: (v: string) => void;
  include?: string[];
  /** icon shown for the special "__type" entry (default icon of a session type) */
  typeIcon?: LucideIcon;
}) {
  return (
    <div className="icon-grid">
      {(include || ICON_NAMES).map((name) => {
        const Icon = name === '__type' ? typeIcon || ICONS.terminal : ICONS[name];
        return (
          <button
            type="button"
            key={name}
            className={`icon-choice${value === name ? ' active' : ''}`}
            title={name === '__type' ? 'Default for this type' : name}
            onClick={() => onChange(name)}
            style={value === name && color ? { color } : undefined}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="swatches">
      {SESSION_COLORS.map((c) => (
        <button
          type="button"
          key={c || 'none'}
          className={`swatch${value === c ? ' active' : ''}${!c ? ' none' : ''}`}
          style={c ? { background: c } : undefined}
          onClick={() => onChange(c)}
          title={c || 'Default'}
        >
          {value === c && <Check size={12} />}
        </button>
      ))}
    </div>
  );
}
