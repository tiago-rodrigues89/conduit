import { createRoot } from 'react-dom/client';
import '@xterm/xterm/css/xterm.css';
import '@fontsource/jetbrains-mono/300.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/400-italic.css';
import './styles.css';
import { App } from './App';
import * as store from './store/app';
import { terminals, wireTerminalEvents } from './lib/terminals';

async function start() {
  wireTerminalEvents();
  // xterm measures glyphs when it opens, so the bundled font must be ready first
  await Promise.all(
    ['300', '400', '500', '700'].map((w) => document.fonts.load(`${w} 13px "JetBrains Mono"`).catch(() => null))
  );
  await store.initApp();
  // handle for debugging from DevTools and UI automation
  (window as any).__conduit = { ...store, terminals };
  createRoot(document.getElementById('root')!).render(<App />);
}

start();
