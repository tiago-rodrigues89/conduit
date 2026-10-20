// Triggers and login scripts of one terminal. Both read the terminal output
// as plain text: triggers test each line, a login script waits for a text
// and then types the next answer.

import { activateTab, sessionById, toast, updateTab, useApp } from '../store/app';
import type { LoginStep, SessionItem, Trigger } from './types';

const ANSI_RE = /\x1b\[[0-9;?<=>]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1bP[\s\S]*?\x1b\\|\x1b[()*+][0-9A-Za-z]|\x1b[=>78DEHMNOc]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Terminal output without colors and control codes (keeps \r and \n). */
export function plainText(data: string) {
  return data.replace(ANSI_RE, '');
}

const STEP_TIMEOUT = 20000;
const COOLDOWN = 2000;
const MAX_SENDS_PER_MINUTE = 6;

function globToRe(glob: string) {
  return new RegExp(`^${glob.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
}

/** Does a trigger apply to this session? `hosts` lists names or hosts with * wildcards. */
export function triggerApplies(t: Trigger, session: SessionItem | undefined, host: string | undefined) {
  const list = t.hosts.split(',').map((x) => x.trim()).filter(Boolean);
  if (!list.length) return true;
  const names = [session?.name, session?.host, host].filter(Boolean) as string[];
  return list.some((g) => {
    const re = globToRe(g);
    return names.some((n) => re.test(n));
  });
}

interface Deps {
  send(text: string): void;
  flash(text: string): void;
}

export class TermAutomation {
  private tabId: string;
  private deps: Deps;
  private triggers: { t: Trigger; re: RegExp }[] = [];
  private line = '';
  private partialFired = new Set<string>();
  private partialTimer: ReturnType<typeof setTimeout> | undefined;
  private lastFire = new Map<string, number>();
  private sends = new Map<string, number[]>();
  private muted = new Set<string>();
  // login script
  private steps: LoginStep[] = [];
  private step = 0;
  private running = false;
  private waitingForReady = false;
  private buf = '';
  private scanFrom = 0;
  private stepTimer: ReturnType<typeof setTimeout> | undefined;
  private sendTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(tabId: string, deps: Deps) {
    this.tabId = tabId;
    this.deps = deps;
  }

  setTriggers(list: Trigger[], session: SessionItem | undefined, host: string | undefined) {
    this.triggers = [];
    for (const t of list) {
      if (!t.enabled || !t.pattern || !triggerApplies(t, session, host)) continue;
      try {
        this.triggers.push({ t, re: new RegExp(t.pattern, t.ignoreCase ? 'i' : '') });
      } catch {
        /* invalid pattern: the settings show it in red */
      }
    }
  }

  /** A new connection starts: arm the session's login script. */
  reset(session: SessionItem | undefined) {
    this.stop();
    this.buf = '';
    this.scanFrom = 0;
    this.line = '';
    this.partialFired.clear();
    this.muted.clear();
    this.steps = (session?.loginScript || []).filter((s) => s.expect.trim() || s.send.trim());
    this.step = 0;
    this.waitingForReady = this.steps.length > 0;
  }

  /** SSH: the connection is up, but the shell may still get its folder hook. */
  connected() {
    /* the script starts on ready() */
  }

  /** The terminal accepts input now: start the login script. */
  ready() {
    if (!this.waitingForReady) return;
    this.waitingForReady = false;
    this.running = true;
    this.deps.flash(`Login script: step 1 of ${this.steps.length}`);
    this.armTimeout();
    this.advance();
  }

  stop() {
    this.running = false;
    this.waitingForReady = false;
    clearTimeout(this.stepTimer);
    clearTimeout(this.sendTimer);
    clearTimeout(this.partialTimer);
  }

  output(data: string) {
    const text = plainText(data);
    if (!text) return;
    if (this.running || this.waitingForReady) {
      this.buf += text;
      if (this.buf.length > 20000) {
        const cut = this.buf.length - 10000;
        this.buf = this.buf.slice(cut);
        this.scanFrom = Math.max(0, this.scanFrom - cut);
      }
      if (this.running) this.advance();
    }
    if (!this.triggers.length) return;
    const parts = (this.line + text).split('\n');
    this.line = parts.pop() || '';
    for (const p of parts) {
      this.test(lastSegment(p), true);
      this.partialFired.clear();
    }
    if (this.line.length > 4000) this.line = this.line.slice(-4000);
    // prompts like "Password:" or "[y/N]" end without a newline: test them once output pauses
    clearTimeout(this.partialTimer);
    if (this.line.trim()) this.partialTimer = setTimeout(() => this.test(lastSegment(this.line), false), 250);
  }

  // ---- login script ----------------------------------------------------------------------

  private armTimeout() {
    clearTimeout(this.stepTimer);
    this.stepTimer = setTimeout(() => {
      if (!this.running) return;
      const st = this.steps[this.step];
      this.running = false;
      this.deps.flash('Login script stopped');
      toast('error', `Login script stopped: “${st?.expect}” did not appear within ${STEP_TIMEOUT / 1000} seconds`);
    }, STEP_TIMEOUT);
  }

  private advance() {
    if (!this.running || this.sendTimer) return;
    const st = this.steps[this.step];
    if (!st) return;
    const expect = st.expect.trim();
    if (expect) {
      const idx = this.buf.indexOf(expect, this.scanFrom);
      if (idx === -1) return;
      this.scanFrom = idx + expect.length;
    }
    // a short pause: devices often print the prompt before they accept input
    this.sendTimer = setTimeout(() => {
      this.sendTimer = undefined;
      if (!this.running) return;
      this.deps.send(st.send + '\r');
      this.scanFrom = this.buf.length;
      this.step++;
      if (this.step >= this.steps.length) {
        this.running = false;
        clearTimeout(this.stepTimer);
        this.deps.flash('Login script done');
        return;
      }
      this.deps.flash(`Login script: step ${this.step + 1} of ${this.steps.length}`);
      this.armTimeout();
      this.advance();
    }, expect ? 150 : 400);
  }

  // ---- triggers -------------------------------------------------------------------------

  private test(line: string, complete: boolean) {
    if (!line.trim()) return;
    for (const { t, re } of this.triggers) {
      if (this.muted.has(t.id)) continue;
      if (complete && this.partialFired.has(t.id)) continue;
      if (!re.test(line)) continue;
      const now = Date.now();
      if (now - (this.lastFire.get(t.id) || 0) < COOLDOWN) continue;
      this.lastFire.set(t.id, now);
      if (!complete) this.partialFired.add(t.id);
      this.fire(t, line.trim());
    }
  }

  private fire(t: Trigger, line: string) {
    const state = useApp.getState();
    const tab = state.tabs.find((x) => x.id === this.tabId);
    if (!tab || tab.kind !== 'terminal') return;
    const focused = state.activeTabId === this.tabId && document.hasFocus();
    if (t.action === 'send') {
      // a reply that makes the pattern appear again would loop: stop after a few rounds
      const recent = (this.sends.get(t.id) || []).filter((x) => Date.now() - x < 60000);
      if (recent.length >= MAX_SENDS_PER_MINUTE) {
        this.muted.add(t.id);
        toast('error', `Trigger “${t.name}” fired too often and is paused for this terminal`);
        return;
      }
      this.sends.set(t.id, [...recent, Date.now()]);
      if (tab.status === 'connected') this.deps.send(t.text + '\r');
      this.deps.flash(`Trigger: ${t.name}`);
      return;
    }
    if (t.action === 'mark') {
      if (!focused) updateTab(this.tabId, { attention: true });
      this.deps.flash(`Trigger: ${t.name}`);
      return;
    }
    // notify
    const session = sessionById(tab.sessionId);
    const title = `${t.name} · ${session?.name || tab.title}`;
    if (focused) {
      toast('info', `${title}: ${line.slice(0, 160)}`);
      return;
    }
    updateTab(this.tabId, { attention: true });
    try {
      const n = new Notification(title, { body: line.slice(0, 240), silent: false });
      n.onclick = () => {
        window.focus();
        activateTab(this.tabId, { pane: true });
      };
    } catch {
      toast('info', `${title}: ${line.slice(0, 160)}`);
    }
  }
}

/** Text after the last carriage return (what is visible on the line). */
function lastSegment(line: string) {
  const trimmed = line.replace(/\r+$/, '');
  const i = trimmed.lastIndexOf('\r');
  return i === -1 ? trimmed : trimmed.slice(i + 1);
}
