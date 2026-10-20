import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileKey,
  FileSpreadsheet,
  FileSymlink,
  FileTerminal,
  FileText,
  Folder,
  FolderSymlink,
  LoaderCircle,
} from 'lucide-react';
import { formatBytes, formatDate, naturalCompare } from '../lib/format';
import type { FileEntry } from '../lib/types';

const EXT_ICONS: [RegExp, typeof File, string][] = [
  [/\.(zip|tar|gz|tgz|bz2|xz|7z|rar|zst|deb|rpm|jar|war)$/i, FileArchive, 'var(--ansi-yellow)'],
  [/\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?|heic)$/i, FileImage, 'var(--ansi-magenta)'],
  [/\.(sh|bash|zsh|fish|ps1|bat|cmd|command)$/i, FileTerminal, 'var(--ansi-green)'],
  [/\.(js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|c|h|cc|cpp|hpp|cs|php|pl|lua|swift|sql|html?|css|scss|vue|svelte)$/i, FileCode, 'var(--ansi-cyan)'],
  [/\.(json|ya?ml|toml|ini|conf|cfg|env|xml|properties|service|timer|socket|plist)$|^(\.?[a-z]*rc|Dockerfile|Makefile|nginx\.conf|crontab)$/i, FileCog, 'var(--ansi-blue)'],
  [/\.(pem|key|crt|cer|pub|p12|pfx|csr|ppk)$|^id_[a-z0-9]+$|^authorized_keys$|^known_hosts$/i, FileKey, 'var(--ansi-red)'],
  [/\.(csv|tsv|xlsx?|ods)$/i, FileSpreadsheet, 'var(--ansi-green)'],
  [/\.(md|txt|log|rst|out|err|pdf|docx?)$|^(README|LICENSE|CHANGELOG)/i, FileText, 'var(--text-muted)'],
];

export function FileIcon({ entry, size = 15 }: { entry: FileEntry; size?: number }) {
  if (entry.type === 'dir') return <Folder size={size} className="fi fi-dir" />;
  if (entry.type === 'link' && entry.linkDir) return <FolderSymlink size={size} className="fi fi-dir" />;
  if (entry.type === 'link') return <FileSymlink size={size} className="fi" style={{ color: 'var(--text-muted)' }} />;
  for (const [re, Icon, color] of EXT_ICONS) if (re.test(entry.name)) return <Icon size={size} className="fi" style={{ color }} />;
  return <File size={size} className="fi" style={{ color: 'var(--text-faint)' }} />;
}

export const isDirLike = (e: FileEntry) => e.type === 'dir' || (e.type === 'link' && e.linkDir);

export type SortKey = 'name' | 'size' | 'mtime' | 'perms';

export function sortEntries(entries: FileEntry[], key: SortKey, desc: boolean): FileEntry[] {
  const dir = desc ? -1 : 1;
  return [...entries].sort((a, b) => {
    const da = isDirLike(a) ? 0 : 1;
    const db = isDirLike(b) ? 0 : 1;
    if (da !== db) return da - db;
    let c = 0;
    if (key === 'size') c = a.size - b.size;
    else if (key === 'mtime') c = a.mtime - b.mtime;
    else if (key === 'perms') c = a.perms.localeCompare(b.perms);
    if (c === 0) c = naturalCompare(a.name, b.name);
    return c * dir;
  });
}

export const DRAG_MIME = 'application/x-conduit-files';

export interface DragPayload {
  side: 'local' | 'remote';
  connId?: string;
  dir: string;
  names: string[];
}

interface Props {
  entries: FileEntry[];
  selected: Set<string>;
  onSelect: (sel: Set<string>) => void;
  onOpen: (e: FileEntry) => void;
  onContextMenu: (entry: FileEntry | null, e: React.MouseEvent) => void;
  onDropPaths?: (paths: string[], targetDir?: FileEntry) => void;
  onDropInternal?: (payload: DragPayload, targetDir?: FileEntry) => void;
  dragPayload?: (names: string[]) => DragPayload;
  acceptInternal?: (p: DragPayload) => boolean;
  onKeyAction?: (action: 'delete' | 'parent' | 'rename' | 'refresh') => void;
  compact?: boolean;
  showOwner?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  pathForFile: (f: File) => string;
}

const ROW_COMPACT = 24;
const ROW_DETAIL = 26;

export function FileList(props: Props) {
  const { entries, selected, onSelect, compact } = props;
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [desc, setDesc] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(400);
  const [dropRow, setDropRow] = useState<string | null>(null);
  const [dropAll, setDropAll] = useState(false);
  const anchor = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', at: 0 });
  const rowH = compact ? ROW_COMPACT : ROW_DETAIL;

  const sorted = useMemo(() => sortEntries(entries, sortKey, desc), [entries, sortKey, desc]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [entries]);

  const start = Math.max(0, Math.floor(scrollTop / rowH) - 8);
  const end = Math.min(sorted.length, Math.ceil((scrollTop + height) / rowH) + 8);

  const ensureVisible = (index: number) => {
    const el = scroller.current;
    if (!el) return;
    const top = index * rowH;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowH > el.scrollTop + el.clientHeight) el.scrollTop = top + rowH - el.clientHeight;
  };

  const clickRow = (e: React.MouseEvent, entry: FileEntry) => {
    const name = entry.name;
    if (e.metaKey) {
      const next = new Set(selected);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      onSelect(next);
      anchor.current = name;
    } else if (e.shiftKey && anchor.current) {
      const a = sorted.findIndex((x) => x.name === anchor.current);
      const b = sorted.findIndex((x) => x.name === name);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      onSelect(new Set(sorted.slice(lo, hi + 1).map((x) => x.name)));
    } else {
      onSelect(new Set([name]));
      anchor.current = name;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const idx = sorted.findIndex((x) => x.name === anchor.current);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.metaKey && e.key === 'ArrowUp') return props.onKeyAction?.('parent');
      if (e.metaKey && e.key === 'ArrowDown' && idx >= 0) return props.onOpen(sorted[idx]);
      const next = Math.max(0, Math.min(sorted.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
      const entry = sorted[next];
      if (!entry) return;
      anchor.current = entry.name;
      onSelect(e.shiftKey ? new Set([...selected, entry.name]) : new Set([entry.name]));
      ensureVisible(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0) props.onOpen(sorted[idx]);
    } else if (e.key === 'Backspace' && e.metaKey) {
      e.preventDefault();
      if (selected.size) props.onKeyAction?.('delete');
    } else if (e.key === 'F2') {
      if (selected.size === 1) props.onKeyAction?.('rename');
    } else if (e.key === 'a' && e.metaKey) {
      e.preventDefault();
      onSelect(new Set(sorted.map((x) => x.name)));
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const ta = typeahead.current;
      ta.text = now - ta.at > 800 ? e.key.toLowerCase() : ta.text + e.key.toLowerCase();
      ta.at = now;
      const found = sorted.findIndex((x) => x.name.toLowerCase().startsWith(ta.text));
      if (found >= 0) {
        anchor.current = sorted[found].name;
        onSelect(new Set([sorted[found].name]));
        ensureVisible(found);
      }
    }
  };

  // ---- drag & drop ----
  const hasInternal = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG_MIME);
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  const onDragStart = (e: React.DragEvent, entry: FileEntry) => {
    if (!props.dragPayload) return;
    const names = selected.has(entry.name) ? [...selected] : [entry.name];
    if (!selected.has(entry.name)) onSelect(new Set([entry.name]));
    const payload = props.dragPayload(names);
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    (window as any).__conduitDrag = payload;
  };

  const canAccept = (e: React.DragEvent) => {
    if (hasFiles(e) && props.onDropPaths) return true;
    if (hasInternal(e) && props.onDropInternal) {
      const p = (window as any).__conduitDrag as DragPayload | undefined;
      return !p || !props.acceptInternal || props.acceptInternal(p);
    }
    return false;
  };

  const handleDrop = (e: React.DragEvent, target?: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDropRow(null);
    setDropAll(false);
    if (hasInternal(e) && props.onDropInternal) {
      try {
        const payload = JSON.parse(e.dataTransfer.getData(DRAG_MIME)) as DragPayload;
        if (!props.acceptInternal || props.acceptInternal(payload)) props.onDropInternal(payload, target);
      } catch {
        /* ignore */
      }
      return;
    }
    if (hasFiles(e) && props.onDropPaths) {
      const paths = Array.from(e.dataTransfer.files)
        .map((f) => props.pathForFile(f))
        .filter(Boolean);
      if (paths.length) props.onDropPaths(paths, target);
    }
  };

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setDesc(!desc);
    else {
      setSortKey(k);
      setDesc(false);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (k === sortKey ? desc ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : null);

  return (
    <div
      className={`filelist${compact ? ' compact' : ''}${dropAll ? ' drop-all' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if (!canAccept(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropAll(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropAll(false);
          setDropRow(null);
        }
      }}
      onDrop={(e) => handleDrop(e)}
    >
      {!compact && (
        <div className="filelist-head">
          <button className="col-name" onClick={() => sortBy('name')}>
            Name <SortIcon k="name" />
          </button>
          <button className="col-size" onClick={() => sortBy('size')}>
            Size <SortIcon k="size" />
          </button>
          <button className="col-date" onClick={() => sortBy('mtime')}>
            Modified <SortIcon k="mtime" />
          </button>
          <button className="col-perms" onClick={() => sortBy('perms')}>
            Permissions <SortIcon k="perms" />
          </button>
          {props.showOwner && <span className="col-owner">Owner</span>}
        </div>
      )}
      <div
        ref={scroller}
        className="filelist-body"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onSelect(new Set());
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('filelist-spacer')) {
            e.preventDefault();
            onSelect(new Set());
            props.onContextMenu(null, e);
          }
        }}
      >
        {props.loading && !sorted.length ? (
          <div className="filelist-empty">
            <LoaderCircle size={16} className="spin" />
          </div>
        ) : props.error ? (
          <div className="filelist-empty error">{props.error}</div>
        ) : !sorted.length ? (
          <div className="filelist-empty">{props.emptyText || 'Empty folder'}</div>
        ) : (
          <div className="filelist-spacer" style={{ height: sorted.length * rowH, position: 'relative' }}>
            {sorted.slice(start, end).map((entry, i) => {
              const index = start + i;
              const dirLike = isDirLike(entry);
              const isSel = selected.has(entry.name);
              return (
                <div
                  key={entry.name}
                  className={`filerow${isSel ? ' selected' : ''}${dropRow === entry.name ? ' drop' : ''}${entry.name.startsWith('.') ? ' hidden-file' : ''}`}
                  style={{ top: index * rowH, height: rowH }}
                  draggable={!!props.dragPayload}
                  onDragStart={(e) => onDragStart(e, entry)}
                  onDragEnd={() => ((window as any).__conduitDrag = undefined)}
                  onDragOver={(e) => {
                    if (!dirLike || !canAccept(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    setDropAll(false);
                    setDropRow(entry.name);
                  }}
                  onDragLeave={() => setDropRow((r) => (r === entry.name ? null : r))}
                  onDrop={dirLike ? (e) => handleDrop(e, entry) : undefined}
                  onMouseDown={(e) => {
                    if (e.button === 0) clickRow(e, entry);
                  }}
                  onDoubleClick={() => props.onOpen(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isSel) {
                      onSelect(new Set([entry.name]));
                      anchor.current = entry.name;
                    }
                    props.onContextMenu(entry, e);
                  }}
                  title={
                    compact
                      ? `${entry.name}\n${dirLike ? 'Folder' : formatBytes(entry.size)} · ${formatDate(entry.mtime)}\n${entry.perms}${
                          entry.owner ? ` ${entry.owner}:${entry.group}` : ''
                        }`
                      : undefined
                  }
                >
                  <span className="col-name">
                    <FileIcon entry={entry} size={compact ? 14 : 15} />
                    <span className="filename">{entry.name}</span>
                  </span>
                  {compact ? (
                    <span className="col-size">{dirLike ? '' : formatBytes(entry.size)}</span>
                  ) : (
                    <>
                      <span className="col-size">{dirLike ? '—' : formatBytes(entry.size)}</span>
                      <span className="col-date">{formatDate(entry.mtime)}</span>
                      <span className="col-perms mono">{entry.perms}</span>
                      {props.showOwner && (
                        <span className="col-owner">
                          {entry.owner}
                          {entry.group ? `:${entry.group}` : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
