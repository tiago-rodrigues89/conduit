// Keyword highlighting for terminal output (like MobaXterm's "syntax
// highlighting"). Output is scanned between escape sequences and matching
// words are wrapped in ANSI colour codes. Text that the remote program already
// coloured, and full-screen apps (alternate screen), are left untouched.

import type { HighlightColor, HighlightRule } from './types';

const SGR: Record<HighlightColor, string> = {
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  gray: '90',
  brightRed: '91',
  brightGreen: '92',
  brightYellow: '93',
  brightBlue: '94',
  brightMagenta: '95',
  brightCyan: '96',
};

export const HIGHLIGHT_COLORS = Object.keys(SGR) as HighlightColor[];

export const DEFAULT_RULES: HighlightRule[] = [
  {
    id: 'url',
    name: 'Links',
    pattern: String.raw`\bhttps?:\/\/[^\s"'<>()\x1b]+`,
    ignoreCase: true,
    color: 'blue',
    bold: false,
    enabled: true,
  },
  {
    id: 'ipv4',
    name: 'IP addresses',
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\/\d{1,2})?(?::\d{1,5})?\b`,
    ignoreCase: false,
    color: 'magenta',
    bold: false,
    enabled: true,
  },
  {
    id: 'mac',
    name: 'MAC addresses',
    pattern: String.raw`\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b`,
    ignoreCase: true,
    color: 'magenta',
    bold: false,
    enabled: true,
  },
  {
    id: 'datetime',
    name: 'Dates & times',
    pattern: String.raw`\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b`,
    ignoreCase: false,
    color: 'cyan',
    bold: false,
    enabled: true,
  },
  {
    id: 'error',
    name: 'Errors',
    pattern: String.raw`\b(?:errors?|fail(?:ed|ure|s)?|fatal|critical|crit|emerg(?:ency)?|panic|denied|refused|rejected|forbidden|unauthori[sz]ed|invalid|exception|traceback|segfault|segmentation fault|abort(?:ed)?|killed|unreachable|timed out|timeout|cannot|can't|unable|not found|no such file or directory|corrupt(?:ed)?|dead|down|offline)\b`,
    ignoreCase: true,
    color: 'red',
    bold: true,
    enabled: true,
  },
  {
    id: 'warning',
    name: 'Warnings',
    pattern: String.raw`\b(?:warn(?:ing|ings)?|deprecated|caution|attention|retry(?:ing)?|degraded|pending|inactive|stopped|disabled|missing|skipp(?:ed|ing)|unknown|expired)\b`,
    ignoreCase: true,
    color: 'yellow',
    bold: false,
    enabled: true,
  },
  {
    id: 'success',
    name: 'Success',
    pattern: String.raw`\b(?:ok|okay|success(?:ful(?:ly)?)?|succeeded|done|passed|active|running|enabled|online|up|ready|connected|started|completed?|accepted|established|listen(?:ing)?|healthy)\b`,
    ignoreCase: true,
    color: 'green',
    bold: false,
    enabled: true,
  },
  {
    id: 'levels',
    name: 'Log levels',
    pattern: String.raw`\b(?:INFO|DEBUG|TRACE|NOTICE)\b`,
    ignoreCase: false,
    color: 'cyan',
    bold: false,
    enabled: true,
  },
];

interface Compiled {
  re: RegExp;
  styles: { sgr: string; bold: boolean }[];
}

function compile(rules: HighlightRule[]): Compiled | null {
  const parts: string[] = [];
  const styles: Compiled['styles'] = [];
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const body = rule.ignoreCase ? `(?i:${rule.pattern})` : `(?:${rule.pattern})`;
    try {
      new RegExp(body);
    } catch {
      continue;
    }
    parts.push(`(?<r${styles.length}>${body})`);
    styles.push({ sgr: SGR[rule.color] || '37', bold: rule.bold });
  }
  if (!parts.length) return null;
  try {
    return { re: new RegExp(parts.join('|'), 'g'), styles };
  } catch {
    return null;
  }
}

/** Returns the index just after the escape sequence starting at i, or -1 if incomplete. */
function sequenceEnd(s: string, i: number): number {
  const n = s.length;
  if (i + 1 >= n) return -1;
  const c1 = s[i + 1];
  if (c1 === '[') {
    for (let j = i + 2; j < n; j++) {
      const code = s.charCodeAt(j);
      if (code >= 0x40 && code <= 0x7e) return j + 1;
    }
    return -1;
  }
  if (c1 === ']' || c1 === 'P' || c1 === '_' || c1 === '^' || c1 === 'X') {
    for (let j = i + 2; j < n; j++) {
      const code = s.charCodeAt(j);
      if (code === 0x07 && c1 === ']') return j + 1;
      if (code === 0x1b) {
        if (j + 1 >= n) return -1;
        if (s[j + 1] === '\\') return j + 2;
      }
    }
    return -1;
  }
  let j = i + 1;
  while (j < n && s.charCodeAt(j) >= 0x20 && s.charCodeAt(j) <= 0x2f) j++;
  return j >= n ? -1 : j + 1;
}

export class Highlighter {
  private compiled: Compiled | null = null;
  private carry = '';
  private fg = false;
  private bold = false;
  private inverse = false;
  private alt = false;

  constructor(rules: HighlightRule[]) {
    this.setRules(rules);
  }

  setRules(rules: HighlightRule[]) {
    this.compiled = compile(rules);
  }

  reset() {
    this.carry = '';
    this.fg = this.bold = this.inverse = this.alt = false;
  }

  process(input: string): string {
    const s = this.carry ? this.carry + input : input;
    this.carry = '';
    let out = '';
    let textStart = 0;
    let i = s.indexOf('\x1b');
    while (i !== -1) {
      if (i > textStart) out += this.text(s.slice(textStart, i));
      const end = sequenceEnd(s, i);
      if (end === -1) {
        const rest = s.slice(i);
        // Very long unterminated sequences (e.g. inline images) are passed on.
        if (rest.length > 65536) out += rest;
        else this.carry = rest;
        return out;
      }
      const seq = s.slice(i, end);
      this.track(seq);
      out += seq;
      textStart = end;
      i = s.indexOf('\x1b', end);
    }
    if (textStart < s.length) out += this.text(s.slice(textStart));
    return out;
  }

  /** Flushes a pending partial escape sequence (used when highlighting is toggled off). */
  flush(): string {
    const c = this.carry;
    this.carry = '';
    return c;
  }

  private track(seq: string) {
    if (seq[1] === '[') {
      const final = seq[seq.length - 1];
      if (final === 'm') this.sgr(seq.slice(2, -1));
      else if ((final === 'h' || final === 'l') && seq[2] === '?') {
        const modes = seq.slice(3, -1).split(';');
        if (modes.some((m) => m === '1049' || m === '47' || m === '1047')) this.alt = final === 'h';
      }
    } else if (seq === '\x1bc') {
      this.fg = this.bold = this.inverse = this.alt = false;
    }
  }

  private sgr(params: string) {
    if (params === '') {
      this.fg = this.bold = this.inverse = false;
      return;
    }
    const parts = params.split(';');
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (p.includes(':')) {
        const main = parseInt(p, 10);
        if (main === 38) this.fg = true;
        continue;
      }
      const v = p === '' ? 0 : parseInt(p, 10);
      if (v === 0) this.fg = this.bold = this.inverse = false;
      else if (v === 1) this.bold = true;
      else if (v === 22) this.bold = false;
      else if (v === 7) this.inverse = true;
      else if (v === 27) this.inverse = false;
      else if ((v >= 30 && v <= 37) || (v >= 90 && v <= 97)) this.fg = true;
      else if (v === 39) this.fg = false;
      else if (v === 38 || v === 48) {
        if (v === 38) this.fg = true;
        if (parts[k + 1] === '5') k += 2;
        else if (parts[k + 1] === '2') k += 4;
      }
    }
  }

  private text(t: string): string {
    const c = this.compiled;
    if (!c || this.fg || this.alt || this.inverse) return t;
    c.re.lastIndex = 0;
    const boldActive = this.bold;
    return t.replace(c.re, (...args) => {
      const match = args[0] as string;
      const groups = args[args.length - 1] as Record<string, string | undefined>;
      let idx = 0;
      for (const key in groups) {
        if (groups[key] !== undefined) {
          idx = Number(key.slice(1));
          break;
        }
      }
      const style = c.styles[idx];
      const addBold = style.bold && !boldActive;
      return `\x1b[${addBold ? '1;' : ''}${style.sgr}m${match}\x1b[${addBold ? '22;' : ''}39m`;
    });
  }
}

// ---- preview helpers (settings page) ------------------------------------------

const ANSI_NAMES: Record<string, string> = {
  '30': 'black', '31': 'red', '32': 'green', '33': 'yellow', '34': 'blue', '35': 'magenta', '36': 'cyan', '37': 'white',
  '90': 'brightBlack', '91': 'brightRed', '92': 'brightGreen', '93': 'brightYellow', '94': 'brightBlue', '95': 'brightMagenta', '96': 'brightCyan', '97': 'brightWhite',
};

export interface Span {
  text: string;
  color?: string;
  bold?: boolean;
}

/** Minimal SGR parser used to render previews as HTML spans. */
export function ansiToSpans(s: string): Span[] {
  const spans: Span[] = [];
  let color: string | undefined;
  let bold = false;
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) spans.push({ text: s.slice(last, m.index), color, bold });
    for (const p of (m[1] || '0').split(';')) {
      if (p === '0' || p === '') {
        color = undefined;
        bold = false;
      } else if (p === '1') bold = true;
      else if (p === '22') bold = false;
      else if (p === '39') color = undefined;
      else if (ANSI_NAMES[p]) color = ANSI_NAMES[p];
    }
    last = re.lastIndex;
  }
  if (last < s.length) spans.push({ text: s.slice(last), color, bold });
  return spans;
}

export const PREVIEW_TEXT = [
  'Oct 16 09:41:02 web-01 systemd[1]: Started nginx.service - A high performance web server.',
  '2026-10-16 09:41:07 INFO  Listening on http://10.0.4.12:8080 (ready)',
  '2026-10-16 09:41:09 WARN  Disk usage at 91% on /var — retrying cleanup',
  '2026-10-16 09:41:12 ERROR Connection refused by 192.168.1.20:5432, permission denied',
  '\x1b[1;34mdrwxr-xr-x\x1b[0m  already coloured output is left untouched',
  'eth0: link up, hwaddr 52:54:00:12:ab:cd — status: active (running)',
];
