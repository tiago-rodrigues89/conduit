// Registry of live terminal views so menus, snippets and broadcast input can
// reach the terminal of a tab, plus a per-tab event bus for main-process
// events (output, exit, connection log lines).

import { api } from './api';

export interface TerminalController {
  tabId: string;
  sendInput(data: string): void;
  paste(): void;
  selectAll(): void;
  clear(): void;
  focus(): void;
  find(): void;
  zoom(delta: number | 'reset'): void;
  toggleHighlight(): void;
  /** the last lines of the screen as text (for tests and debugging) */
  text(lines?: number): string;
}

export type TabEvent =
  | { type: 'data'; data: string }
  | { type: 'exit'; reason: 'exit' | 'lost'; code?: number; message?: string }
  | { type: 'integrated' }
  | { type: 'ready' }
  | { type: 'log'; level: 'info' | 'ok' | 'warn' | 'error'; text: string }
  | { type: 'banner'; text: string };

type Handler = (e: TabEvent) => void;

const controllers = new Map<string, TerminalController>();
const handlers = new Map<string, Handler>();
const backlog = new Map<string, TabEvent[]>();

function emit(tabId: string, e: TabEvent) {
  const h = handlers.get(tabId);
  if (h) h(e);
  else {
    // events can arrive before the view subscribed (e.g. very fast output)
    const list = backlog.get(tabId) || [];
    if (list.length < 2000) list.push(e);
    backlog.set(tabId, list);
  }
}

let wired = false;
export function wireTerminalEvents() {
  if (wired) return;
  wired = true;
  api.on('term:data', (id: string, data: string) => emit(id, { type: 'data', data }));
  api.on('term:exit', (id: string, info: { reason: 'exit' | 'lost'; code?: number; message?: string }) =>
    emit(id, { type: 'exit', ...info })
  );
  api.on('term:integrated', (id: string) => emit(id, { type: 'integrated' }));
  api.on('term:ready', (id: string) => emit(id, { type: 'ready' }));
  api.on('ssh:log', (id: string, level: 'info' | 'ok' | 'warn' | 'error', text: string) => emit(id, { type: 'log', level, text }));
  api.on('ssh:banner', (id: string, text: string) => emit(id, { type: 'banner', text }));
}

export const terminals = {
  register(c: TerminalController) {
    controllers.set(c.tabId, c);
  },
  unregister(tabId: string) {
    controllers.delete(tabId);
  },
  get(tabId: string | undefined) {
    return tabId ? controllers.get(tabId) : undefined;
  },
  all() {
    return [...controllers.values()];
  },
  forget(tabId: string) {
    handlers.delete(tabId);
    backlog.delete(tabId);
  },
  subscribe(tabId: string, h: Handler) {
    handlers.set(tabId, h);
    const pending = backlog.get(tabId);
    if (pending) {
      backlog.delete(tabId);
      for (const e of pending) h(e);
    }
    return () => {
      if (handlers.get(tabId) === h) handlers.delete(tabId);
    };
  },
};
