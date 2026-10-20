import type { ITheme } from '@xterm/xterm';

export interface TermTheme {
  id: string;
  name: string;
  /** UI accent used for focus rings, active tabs etc. */
  accent: string;
  colors: Required<
    Pick<
      ITheme,
      | 'background' | 'foreground' | 'cursor' | 'cursorAccent' | 'selectionBackground'
      | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
      | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow' | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite'
    >
  >;
}

const conduitAnsi = {
  red: '#ff6b81',
  green: '#7ee2a8',
  yellow: '#ffd479',
  blue: '#6cb6ff',
  magenta: '#c792ea',
  cyan: '#5ee1e6',
  white: '#c8d0de',
  brightBlack: '#5c6577',
  brightRed: '#ff8fa0',
  brightGreen: '#a3f0c2',
  brightYellow: '#ffe4a3',
  brightBlue: '#9acbff',
  brightMagenta: '#dcb6f5',
  brightCyan: '#8ff0f2',
  brightWhite: '#f2f5fa',
};

export const THEMES: TermTheme[] = [
  {
    id: 'conduit',
    name: 'Conduit Night',
    accent: '#82aaff',
    colors: {
      background: '#0f1218',
      foreground: '#d6dbe6',
      cursor: '#82aaff',
      cursorAccent: '#0f1218',
      selectionBackground: '#82aaff44',
      black: '#262b36',
      ...conduitAnsi,
    },
  },
  {
    id: 'conduit-ember',
    name: 'Ember (production)',
    accent: '#ff7a7a',
    colors: {
      background: '#1a0f12',
      foreground: '#efdcdf',
      cursor: '#ff7a7a',
      cursorAccent: '#1a0f12',
      selectionBackground: '#ff7a7a44',
      black: '#33222a',
      ...conduitAnsi,
      brightBlack: '#7a5f66',
    },
  },
  {
    id: 'conduit-forest',
    name: 'Forest (staging)',
    accent: '#6fdc9c',
    colors: {
      background: '#0d1512',
      foreground: '#d5e6dc',
      cursor: '#6fdc9c',
      cursorAccent: '#0d1512',
      selectionBackground: '#6fdc9c40',
      black: '#1f2d27',
      ...conduitAnsi,
      brightBlack: '#5a7066',
    },
  },
  {
    id: 'conduit-ocean',
    name: 'Deep Ocean',
    accent: '#5ab0ff',
    colors: {
      background: '#0a1420',
      foreground: '#d2e1f0',
      cursor: '#5ab0ff',
      cursorAccent: '#0a1420',
      selectionBackground: '#5ab0ff40',
      black: '#1a2a3c',
      ...conduitAnsi,
      brightBlack: '#566b82',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    accent: '#7aa2f7',
    colors: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    accent: '#61afef',
    colors: {
      background: '#21252b',
      foreground: '#abb2bf',
      cursor: '#528bff',
      cursorAccent: '#21252b',
      selectionBackground: '#3e4451',
      black: '#3f4451',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#d7dae0',
      brightBlack: '#5c6370',
      brightRed: '#ff7a85',
      brightGreen: '#b5e890',
      brightYellow: '#ffd58f',
      brightBlue: '#8cc8ff',
      brightMagenta: '#e19ef5',
      brightCyan: '#7bd3df',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    accent: '#89b4fa',
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b7088',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    accent: '#bd93f9',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    accent: '#88c0d0',
    colors: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    accent: '#58a6ff',
    colors: {
      background: '#0d1117',
      foreground: '#e6edf3',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    accent: '#fabd2f',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      cursorAccent: '#282828',
      selectionBackground: '#504945',
      black: '#3c3836',
      red: '#fb4934',
      green: '#b8bb26',
      yellow: '#fabd2f',
      blue: '#83a598',
      magenta: '#d3869b',
      cyan: '#8ec07c',
      white: '#d5c4a1',
      brightBlack: '#928374',
      brightRed: '#fb4934',
      brightGreen: '#b8bb26',
      brightYellow: '#fabd2f',
      brightBlue: '#83a598',
      brightMagenta: '#d3869b',
      brightCyan: '#8ec07c',
      brightWhite: '#fbf1c7',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    accent: '#268bd2',
    colors: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursor: '#93a1a1',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#93a62a',
      brightYellow: '#c29b2a',
      brightBlue: '#4aa3e0',
      brightMagenta: '#6c71c4',
      brightCyan: '#3fbfb3',
      brightWhite: '#fdf6e3',
    },
  },
  {
    id: 'classic',
    name: 'Classic Black',
    accent: '#7aa2f7',
    colors: {
      background: '#0a0a0a',
      foreground: '#e6e6e6',
      cursor: '#e6e6e6',
      cursorAccent: '#0a0a0a',
      selectionBackground: '#ffffff33',
      black: '#1c1c1c',
      red: '#ef5350',
      green: '#66bb6a',
      yellow: '#fdd835',
      blue: '#42a5f5',
      magenta: '#ab47bc',
      cyan: '#26c6da',
      white: '#d0d0d0',
      brightBlack: '#6b6b6b',
      brightRed: '#ff7b78',
      brightGreen: '#8fd694',
      brightYellow: '#ffe66d',
      brightBlue: '#73bcff',
      brightMagenta: '#d07ce0',
      brightCyan: '#5fe0ef',
      brightWhite: '#ffffff',
    },
  },
];

export function getTheme(id: string | undefined): TermTheme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Applies the chrome palette derived from the selected terminal theme. */
export function applyUiTheme(theme: TermTheme) {
  const root = document.documentElement.style;
  const [r, g, b] = hexToRgb(theme.colors.background);
  const [ar, ag, ab] = hexToRgb(theme.accent);
  root.setProperty('--term-bg', theme.colors.background);
  root.setProperty('--term-bg-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-rgb', `${ar}, ${ag}, ${ab}`);
  root.setProperty('--ansi-red', theme.colors.red);
  root.setProperty('--ansi-green', theme.colors.green);
  root.setProperty('--ansi-yellow', theme.colors.yellow);
  root.setProperty('--ansi-blue', theme.colors.blue);
  root.setProperty('--ansi-magenta', theme.colors.magenta);
  root.setProperty('--ansi-cyan', theme.colors.cyan);
}

export const SESSION_COLORS = ['', '#ff6b81', '#ff9e64', '#ffd479', '#7ee2a8', '#5ee1e6', '#6cb6ff', '#c792ea', '#f5a3d0', '#a0a8b8'];
