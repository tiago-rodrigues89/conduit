import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

export function Modal({
  title,
  icon,
  children,
  footer,
  onClose,
  width = 460,
  className = '',
  closeOnBackdrop = false,
  autoFocus = true,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  width?: number;
  className?: string;
  closeOnBackdrop?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = autoFocus
      ? el?.querySelector<HTMLElement>('[data-autofocus], input:not([type=checkbox]):not([disabled]), textarea, select, button.primary')
      : null;
    (first || el)?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div ref={ref} className={`modal ${className}`} style={{ width }} role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="modal-head">
          {icon && <span className="modal-icon">{icon}</span>}
          <h2>{title}</h2>
          <button className="icon-btn sm" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  inline,
  group,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  inline?: boolean;
  /** several controls (a list): a plain container, so clicks don't jump to the first input */
  group?: boolean;
}) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`field${inline ? ' inline' : ''}`}>
      {label && <span className="field-label">{label}</span>}
      <span className="field-control">{children}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="toggle-row">
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <span className={`switch${checked ? ' on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch-knob" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`segmented${small ? ' small' : ''}`}>
      {options.map((o) => (
        <button type="button" key={o.value} title={o.title} className={`segment${value === o.value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Password input with a button to show/hide what was typed. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  reveal,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** loads the saved secret (Touch ID) when the field is empty and the eye is clicked */
  reveal?: () => Promise<string>;
}) {
  const [visible, setVisible] = useState(false);
  const toggle = async () => {
    if (!visible && !value && reveal) {
      try {
        const saved = await reveal();
        if (saved) onChange(saved);
      } catch {
        return;
      }
    }
    setVisible((v) => !v);
  };
  return (
    <span className="password-input">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="icon-btn sm password-eye"
        title={visible ? 'Hide password' : 'Show password'}
        onClick={toggle}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </span>
  );
}
