// Monospace fonts offered in settings. Only fonts that are actually installed
// are listed (detected by comparing rendered text widths).

export const BUNDLED_FONT = 'JetBrains Mono';

const CANDIDATES = [
  'JetBrains Mono',
  'SF Mono',
  'Menlo',
  'Monaco',
  'Fira Code',
  'Cascadia Code',
  'Cascadia Mono',
  'Hack',
  'Source Code Pro',
  'IBM Plex Mono',
  'Iosevka',
  'MesloLGS NF',
  'MesloLGS Nerd Font',
  'JetBrainsMono Nerd Font',
  'Hack Nerd Font',
  'FiraCode Nerd Font',
  'Roboto Mono',
  'Ubuntu Mono',
  'Inconsolata',
  'Courier New',
];

let cache: string[] | null = null;

export function installedFonts(): string[] {
  if (cache) return cache;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const sample = 'mmmmmmmmmmlliiWW@@00';
  const width = (font: string) => {
    ctx.font = `40px ${font}`;
    return ctx.measureText(sample).width;
  };
  const baseMono = width('monospace');
  const baseSerif = width('serif');
  cache = CANDIDATES.filter((f) => {
    if (f === BUNDLED_FONT) return true;
    return width(`"${f}", monospace`) !== baseMono || width(`"${f}", serif`) !== baseSerif;
  });
  return cache;
}

export function fontStack(family: string): string {
  const f = family.includes(',') ? family : `"${family}"`;
  return `${f}, "JetBrains Mono", Menlo, Monaco, monospace`;
}
