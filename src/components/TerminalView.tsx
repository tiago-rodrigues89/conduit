import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Terminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { ArrowDown, ArrowUp, CaseSensitive, Regex, WholeWord, X } from 'lucide-react';
import type { Rect } from '../lib/panes';
import { TermAutomation } from '../lib/automation';
import { api } from '../lib/api';
import { fontStack } from '../lib/fonts';
import { shellQuote } from '../lib/format';
import { Highlighter } from '../lib/highlight';
import { ssmCommand } from '../lib/sessionTypes';
import { terminals, type TabEvent } from '../lib/terminals';
import { getTheme, hasBackdrop } from '../lib/themes';
import { Backdrop } from './Backdrop';
import type { Settings, TerminalTab } from '../lib/types';
import {
  activateTab,
  closePane,
  closeTab,
  confirm,
  openSftp,
  reconnectTab,
  duplicateTab,
  sessionById,
  addHistory,
  setTermUi,
  splitPane,
  toast,
  toggleZoomPane,
  unsplitTab,
  updateTab,
  useApp,
} from '../store/app';
import { logEnabledFor, startLog, stopLog } from '../lib/logging';

// Leaves full-screen apps and mouse/paste modes after a session ended.
// ESC[?1049l is only sent when the alternate screen is active: it also
// restores the saved cursor, which would overwrite the last output.
const SOFT_RESET = '\x1b[0m\x1b[?25h\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?2004l\x1b[?1l';
const softReset = (term: Terminal) => (term.buffer.active.type === 'alternate' ? '\x1b[?1049l' : '') + SOFT_RESET;
const RESPONSE_RE = /^\x1b(\[[?>]?[\d;]*[cRnt]|\][\d;]*;rgb:[^\x07\x1b]*(\x07|\x1b\\)|P[\s\S]*\x1b\\)$/;

function xtermTheme(id: string): ITheme {
  const t = getTheme(id);
  return {
    ...t.colors,
    // a picture or gradient is drawn behind the text
    background: hasBackdrop(t) ? '#00000000' : t.colors.background,
    selectionInactiveBackground: t.colors.selectionBackground,
    scrollbarSliderBackground: 'rgba(255,255,255,0.10)',
    scrollbarSliderHoverBackground: 'rgba(255,255,255,0.18)',
    scrollbarSliderActiveBackground: 'rgba(255,255,255,0.26)',
    overviewRulerBorder: 'transparent',
  };
}

function themeIdFor(tab: TerminalTab, settings: Settings) {
  const session = sessionById(tab.sessionId);
  return session?.theme || settings.theme;
}

function isCommand(tab: TerminalTab) {
  const type = sessionById(tab.sessionId)?.type;
  return type === 'command' || type === 'ssm';
}

function highlightFor(tab: TerminalTab, settings: Settings) {
  const session = sessionById(tab.sessionId);
  if (session?.highlight === 'on') return true;
  if (session?.highlight === 'off') return false;
  return settings.highlight;
}

interface Props {
  tab: TerminalTab;
  /** the tab is shown and this pane is not hidden behind a zoomed pane */
  visible: boolean;
  /** this pane has the keyboard */
  focused: boolean;
  /** the tab has several panes */
  split: boolean;
  /** position inside the tab (fractions) */
  rect: Rect;
}

export function TerminalView({ tab, visible, focused, split, rect }: Props) {
  const settings = useApp((s) => s.settings);
  const items = useApp((s) => s.items);
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const hlRef = useRef(new Highlighter(settings.highlightRules));
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [highlight, setHighlight] = useState(() => highlightFor(tab, settings));
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const [size, setSize] = useState({ cols: 0, rows: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [bell, setBell] = useState(false);
  const lastGen = useRef(-1);
  const autoRef = useRef<TermAutomation | null>(null);

  const showFlash = (text: string) => {
    setFlash(text);
    clearTimeout((showFlash as any).t);
    (showFlash as any).t = setTimeout(() => setFlash(null), 900);
  };

  const fit = () => {
    const term = termRef.current;
    const host = hostRef.current;
    if (!term || !host || host.clientWidth < 20 || host.clientHeight < 20) return;
    try {
      fitRef.current?.fit();
    } catch {
      return;
    }
    setSize((s) => (s.cols === term.cols && s.rows === term.rows ? s : { cols: term.cols, rows: term.rows }));
  };

  const writeLine = (text: string) => termRef.current?.write(text + '\r\n');

  const sendInput = (data: string) => {
    const t = tabRef.current;
    if (t.status === 'connected') api.term.write(t.id, data);
  };

  const doPaste = async (text: string) => {
    const term = termRef.current;
    if (!term || !text) return;
    const t = tabRef.current;
    if (t.status !== 'connected') return;
    const lines = text.replace(/\r?\n$/, '').split(/\r?\n/);
    if (settingsRef.current.pasteWarning && lines.length > 1) {
      const ok = await confirm({
        title: `Paste ${lines.length} lines?`,
        message: `The text will be sent to “${t.title}” and may run several commands.`,
        detail: lines.slice(0, 6).join('\n') + (lines.length > 6 ? '\n…' : ''),
        confirmLabel: 'Paste',
      });
      if (!ok) {
        term.focus();
        return;
      }
    }
    term.paste(text);
    term.focus();
  };

  const pasteFromClipboard = async () => doPaste(await api.clipboard.read());

  const zoom = (delta: number | 'reset') => {
    setFontSize((s) => {
      const next = delta === 'reset' ? settingsRef.current.fontSize : Math.min(40, Math.max(7, s + delta));
      if (next !== s) showFlash(`${next}px`);
      return next;
    });
  };

  // ---- create the terminal once ------------------------------------------------
  useLayoutEffect(() => {
    const s = settingsRef.current;
    const term = new Terminal({
      fontFamily: fontStack(s.fontFamily),
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      fontWeight: s.fontWeight as any,
      fontWeightBold: 700,
      cursorStyle: s.cursorStyle,
      cursorBlink: s.cursorBlink,
      cursorInactiveStyle: 'outline',
      scrollback: s.scrollback,
      macOptionIsMeta: s.optionAsMeta,
      macOptionClickForcesSelection: true,
      rightClickSelectsWord: false,
      drawBoldTextInBrightColors: false,
      allowProposedApi: true,
      allowTransparency: true,
      customGlyphs: true,
      rescaleOverlappingGlyphs: true,
      smoothScrollDuration: 0,
      fastScrollSensitivity: 5,
      theme: xtermTheme(themeIdFor(tabRef.current, s)),
      linkHandler: {
        activate: (e, uri) => {
          if (e.metaKey) api.openExternal(uri).catch(() => {});
        },
      },
    });
    termRef.current = term;
    const fitAddon = new FitAddon();
    fitRef.current = fitAddon;
    const search = new SearchAddon();
    searchRef.current = search;
    term.loadAddon(fitAddon);
    term.loadAddon(search);
    term.loadAddon(
      new WebLinksAddon((e, uri) => {
        if (e.metaKey) api.openExternal(uri).catch(() => {});
        else showFlash('⌘-click to open link');
      })
    );
    const unicode = new Unicode11Addon();
    term.loadAddon(unicode);
    term.unicode.activeVersion = '11';
    term.open(hostRef.current!);
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      /* DOM renderer fallback */
    }

    const tabId = tabRef.current.id;

    // clicking or tabbing into a pane makes it the focused one
    const onFocus = () => {
      if (useApp.getState().activeTabId !== tabId) activateTab(tabId, { pane: true });
    };
    term.textarea?.addEventListener('focus', onFocus);

    const automation = new TermAutomation(tabId, {
      send: (text) => sendInput(text),
      flash: (text) => showFlash(text),
    });
    autoRef.current = automation;

    // OSC 7: the shell reports its working directory
    term.parser.registerOscHandler(7, (data) => {
      const m = data.match(/^file:\/\/[^/]*(\/.*)$/);
      if (m) {
        let p = m[1];
        try {
          p = decodeURIComponent(p);
        } catch {
          /* keep raw */
        }
        if (tabRef.current.cwd !== p) updateTab(tabId, { cwd: p });
      }
      return true;
    });

    // OSC 6973 "user=<name>": the shell reports who it runs as (sudo -i, su -)
    term.parser.registerOscHandler(6973, (data) => {
      if (data.startsWith('cmd=')) {
        try {
          const bytes = Uint8Array.from(atob(data.slice(4)), (c) => c.charCodeAt(0));
          addHistory(tabId, new TextDecoder().decode(bytes));
        } catch {
          /* ignore malformed reports */
        }
        return true;
      }
      if (!data.startsWith('user=')) return true;
      const user = data.slice(5);
      const t = tabRef.current;
      if (user && (t.shellUser !== user || !t.loginUser)) {
        updateTab(tabId, { shellUser: user, loginUser: t.loginUser || user });
      }
      return true;
    });

    term.onData((data) => {
      const t = tabRef.current;
      if (t.status === 'closed' || t.status === 'error') {
        if (data === 'r' || data === 'R') reconnectTab(t.id);
        else if (data === '\r') closePane(t.id, true);
        return;
      }
      if (t.status !== 'connected') return;
      api.term.write(t.id, data);
      if (useApp.getState().broadcast && !RESPONSE_RE.test(data)) {
        for (const other of useApp.getState().tabs) {
          if (other.id !== t.id && other.kind === 'terminal' && other.status === 'connected') api.term.write(other.id, data);
        }
      }
    });
    term.onBinary((data) => sendInput(data));
    term.onResize(({ cols, rows }) => api.term.resize(tabId, cols, rows));
    term.onBell(() => {
      if (settingsRef.current.bell === 'visual') {
        setBell(true);
        setTimeout(() => setBell(false), 180);
      }
    });

    let selTimer: ReturnType<typeof setTimeout>;
    term.onSelectionChange(() => {
      if (!settingsRef.current.copyOnSelect) return;
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const sel = term.getSelection();
        if (sel) {
          api.clipboard.write(sel);
          showFlash('Copied');
        }
      }, 150);
    });

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      // ⌥⌘ arrows move between split panes (app menu), never into the shell
      if (e.metaKey && e.altKey && e.key.startsWith('Arrow')) return false;
      if (e.metaKey && !e.ctrlKey && !e.altKey) {
        // macOS line editing: ⌘← start of line, ⌘→ end of line, ⌘⌫ delete line
        if (e.key === 'ArrowLeft') return sendInput('\x01'), false;
        if (e.key === 'ArrowRight') return sendInput('\x05'), false;
        if (e.key === 'Backspace') return sendInput('\x15'), false;
        return false; // leave other ⌘ shortcuts to the app menu
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && !settingsRef.current.optionAsMeta) {
        // ⌥← / ⌥→ jump words, ⌥⌫ deletes a word
        if (e.key === 'ArrowLeft') return sendInput('\x1bb'), false;
        if (e.key === 'ArrowRight') return sendInput('\x1bf'), false;
        if (e.key === 'Backspace') return sendInput('\x17'), false;
      }
      return true;
    });

    const wrap = wrapRef.current!;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (settingsRef.current.rightClick === 'paste' && !e.ctrlKey && !e.shiftKey) {
        pasteFromClipboard();
        return;
      }
      showContextMenu();
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!term.hasSelection()) return;
      e.preventDefault();
      e.stopPropagation();
      e.clipboardData?.setData('text/plain', term.getSelection());
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      doPaste(e.clipboardData?.getData('text/plain') || '');
    };
    let wheelAcc = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) >= 18) {
        zoom(wheelAcc < 0 ? 1 : -1);
        wheelAcc = 0;
      }
    };
    wrap.addEventListener('contextmenu', onContext, true);
    wrap.addEventListener('paste', onPaste, true);
    wrap.addEventListener('copy', onCopy, true);
    wrap.addEventListener('wheel', onWheel, { capture: true, passive: false });

    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(hostRef.current!);

    // ---- events from the main process ----
    const onEvent = (e: TabEvent) => {
      switch (e.type) {
        case 'data': {
          const out = highlightRef.current ? hlRef.current.process(e.data) : e.data;
          const n = e.data.length;
          term.write(out, () => api.term.ack(tabId, n));
          automation.output(e.data);
          break;
        }
        case 'log': {
          if (tabRef.current.status !== 'connecting') break;
          const style = { info: '\x1b[38;5;244m  ·', ok: '\x1b[32m  ✓', warn: '\x1b[33m  !', error: '\x1b[31m  ✗' }[e.level];
          writeLine(`${style} ${e.text}\x1b[0m`);
          break;
        }
        case 'banner':
          term.write(e.text.replace(/\r?\n/g, '\r\n'));
          break;
        case 'integrated':
          updateTab(tabId, { integrated: true });
          break;
        case 'ready':
          automation.ready();
          break;
        case 'exit': {
          const t = tabRef.current;
          if (t.status !== 'connected') break;
          updateTab(tabId, { status: 'closed', connId: undefined });
          automation.stop();
          stopLog(tabId);
          const msg =
            e.reason === 'lost'
              ? `Connection lost${e.message ? ` — ${e.message}` : ''}`
              : t.mode === 'local'
                ? `${isCommand(t) ? 'Command finished' : 'Shell exited'}${e.code ? ` with code ${e.code}` : ''}`
                : 'Session closed';
          term.write(softReset(term));
          writeLine('');
          writeLine(
            `\x1b[${e.reason === 'lost' ? '31' : '38;5;250'}m● ${msg}\x1b[0m   \x1b[38;5;244mPress \x1b[1;37mR\x1b[0;38;5;244m to reconnect · \x1b[1;37mEnter\x1b[0;38;5;244m to close the tab\x1b[0m`
          );
          break;
        }
      }
    };
    const unsubscribe = terminals.subscribe(tabId, onEvent);

    terminals.register({
      tabId,
      sendInput,
      paste: pasteFromClipboard,
      selectAll: () => term.selectAll(),
      clear: () => term.clear(),
      focus: () => term.focus(),
      find: () => setSearchOpen(true),
      zoom,
      toggleHighlight: () => setHighlight((h) => !h),
      text: (lines = 60) => {
        const b = term.buffer.active;
        const out: string[] = [];
        const end = b.baseY + term.rows;
        for (let i = Math.max(0, end - lines); i < end; i++) out.push(b.getLine(i)?.translateToString(true) || '');
        return out.join('\n').replace(/\n+$/, '');
      },
    });

    requestAnimationFrame(fit);

    return () => {
      unsubscribe();
      terminals.unregister(tabId);
      automation.stop();
      term.textarea?.removeEventListener('focus', onFocus);
      ro.disconnect();
      wrap.removeEventListener('contextmenu', onContext, true);
      wrap.removeEventListener('paste', onPaste, true);
      wrap.removeEventListener('copy', onCopy, true);
      wrap.removeEventListener('wheel', onWheel, true);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // ---- connect / reconnect --------------------------------------------------------
  useEffect(() => {
    if (lastGen.current === tab.generation) return;
    const isReconnect = lastGen.current !== -1;
    lastGen.current = tab.generation;
    const term = termRef.current!;
    const gen = tab.generation;
    hlRef.current.reset();

    const run = async () => {
      // wait for the first layout so the remote side gets the right size
      // (a hidden window gets no animation frames: don't wait for one forever)
      await new Promise((r) => {
        requestAnimationFrame(() => r(null));
        setTimeout(() => r(null), 150);
      });
      fit();
      const t = tabRef.current;
      if (isReconnect) {
        term.write(softReset(term));
        writeLine('');
        writeLine('\x1b[38;5;240m' + '─'.repeat(Math.max(10, Math.min(term.cols - 2, 60))) + '\x1b[0m');
      }
      const session = sessionById(t.sessionId);
      const s = settingsRef.current;
      const prompt = session?.promptStyle || s.promptStyle;
      const header = (title: string, sub: string) =>
        writeLine(`\x1b[1;38;2;130;170;255m${title}\x1b[0m \x1b[38;5;244m· ${sub}\x1b[0m`);
      const fail = (err: any) => {
        if (tabRef.current.generation !== gen) return;
        updateTab(t.id, { status: 'error', connId: undefined });
        stopLog(t.id);
        writeLine(err.cancelled ? '\x1b[38;5;244m  · Cancelled\x1b[0m' : `\x1b[31m  ✗ ${err.message}\x1b[0m`);
        writeLine('');
        writeLine(
          '\x1b[38;5;244mPress \x1b[1;37mR\x1b[0;38;5;244m to try again · \x1b[1;37mEnter\x1b[0;38;5;244m to close the tab\x1b[0m'
        );
      };
      const connected = () => {
        if (tabRef.current.generation !== gen) return;
        updateTab(t.id, { status: 'connected' });
        // local shells, telnet and serial are ready for a login script right away
        automation.ready();
      };
      const automation = autoRef.current!;
      automation.reset(session);
      if (logEnabledFor(session)) await startLog(t, session);

      try {
        if (t.mode === 'local') {
          const command =
            session?.type === 'command' ? session.command : session?.type === 'ssm' ? ssmCommand(session) : undefined;
          if (command) header(session!.name || 'Command', command.split('\n')[0]);
          await api.term.spawnLocal({
            termId: t.id,
            cols: term.cols,
            rows: term.rows,
            cwd: t.cwd || session?.startDir || undefined,
            shell: session?.shell || undefined,
            command,
            prompt,
          });
          return connected();
        }
        if (t.mode === 'telnet' && session) {
          header(session.name || session.host, `telnet ${session.host}${session.port !== 23 ? ':' + session.port : ''}`);
          writeLine(`\x1b[38;5;244m  · Connecting to ${session.host}:${session.port || 23}\x1b[0m`);
          await api.term.telnet({ termId: t.id, host: session.host, port: session.port || 23, cols: term.cols, rows: term.rows });
          writeLine('\x1b[32m  ✓ Connected\x1b[0m');
          writeLine('');
          return connected();
        }
        if (t.mode === 'serial' && session) {
          header(session.name || 'Serial', `${session.serialDevice} · ${session.baudRate} baud`);
          await api.term.serial({
            termId: t.id,
            device: session.serialDevice,
            baud: session.baudRate,
            dataBits: session.dataBits,
            parity: session.parity,
            stopBits: session.stopBits,
            flow: session.flowControl,
          });
          writeLine('\x1b[32m  ✓ Port open\x1b[0m \x1b[38;5;244m— press Enter to wake up the console\x1b[0m');
          writeLine('');
          return connected();
        }

        const spec = t.spec!;
        const remotePrompt = session?.promptStyle || (s.promptOnServers ? s.promptStyle : 'shell');
        const follow = session?.followFolder === 'on' ? true : session?.followFolder === 'off' ? false : s.followFolder;
        header(spec.name || spec.host, `${spec.username ? spec.username + '@' : ''}${spec.host}${spec.port !== 22 ? ':' + spec.port : ''}`);
        const shell = {
          cols: term.cols,
          rows: term.rows,
          integrate: follow || remotePrompt !== 'shell',
          prompt: remotePrompt,
          startDir: t.startIn || session?.startDir || undefined,
          initCommand: session?.initCommand || undefined,
        };
        let connId: string | undefined;
        if (t.shareConnId && !isReconnect) {
          // a split pane: a new shell on the connection that is already logged in
          try {
            ({ connId } = await api.ssh.openShell({ holderId: t.id, connId: t.shareConnId, shell }));
            writeLine('\x1b[38;5;244m  · New shell on the open connection\x1b[0m');
          } catch {
            connId = undefined;
          }
        }
        if (!connId) ({ connId } = await api.ssh.connect({ holderId: t.id, session: spec, shell }));
        if (tabRef.current.generation !== gen) return;
        updateTab(t.id, { status: 'connected', connId, integrated: false, cwd: undefined, loginUser: undefined, shellUser: undefined });
        automation.connected();
        if (settingsRef.current.monitoring) api.monitor.start(connId).catch(() => {});
        writeLine('');
      } catch (err: any) {
        fail(err);
      }
    };
    run();
  }, [tab.generation]);

  // ---- settings changes -------------------------------------------------------------
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontFamily = fontStack(settings.fontFamily);
    term.options.lineHeight = settings.lineHeight;
    term.options.letterSpacing = settings.letterSpacing;
    term.options.fontWeight = settings.fontWeight as any;
    term.options.cursorStyle = settings.cursorStyle;
    term.options.cursorBlink = settings.cursorBlink;
    term.options.scrollback = settings.scrollback;
    term.options.macOptionIsMeta = settings.optionAsMeta;
    term.options.theme = xtermTheme(themeIdFor(tabRef.current, settings));
    hlRef.current.setRules(settings.highlightRules);
    requestAnimationFrame(fit);
  }, [settings, items]);

  const triggers = useApp((s) => s.triggers);
  useEffect(() => autoRef.current?.setTriggers(triggers, sessionById(tab.sessionId), tab.spec?.host), [triggers, items, tab.spec?.host]);

  useEffect(() => {
    setFontSize(settings.fontSize);
  }, [settings.fontSize]);

  // the status bar of the tab shows size, zoom and highlighting of the focused pane
  useEffect(() => setTermUi(tab.id, { cols: size.cols, rows: size.rows, fontSize, highlight }), [size, fontSize, highlight]);

  useEffect(() => {
    if (tab.mode !== 'ssh' || tab.status !== 'connected' || !tab.connId) return;
    if (settings.monitoring) api.monitor.start(tab.connId).catch(() => {});
    else api.monitor.stop(tab.connId).catch(() => {});
  }, [settings.monitoring]);

  useEffect(() => {
    setHighlight(highlightFor(tabRef.current, settings));
  }, [settings.highlight, items]);

  useEffect(() => {
    if (!highlight) {
      const rest = hlRef.current.flush();
      if (rest) termRef.current?.write(rest);
    } else hlRef.current.reset();
  }, [highlight]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.fontSize = fontSize;
    requestAnimationFrame(fit);
  }, [fontSize]);

  useEffect(() => {
    if (visible) requestAnimationFrame(fit);
  }, [visible, rect.x, rect.y, rect.w, rect.h]);

  useEffect(() => {
    if (!visible || !focused) return;
    requestAnimationFrame(() => {
      const el = document.activeElement;
      // keep the focus where the user typed (compose bar, search) unless it was another terminal
      const elsewhere = el && el !== document.body && !el.closest('.terminal-host');
      if (!useApp.getState().dialogs.length && !elsewhere) termRef.current?.focus();
    });
  }, [visible, focused]);

  // ---- context menu -----------------------------------------------------------------
  const showContextMenu = async () => {
    const term = termRef.current!;
    const t = tabRef.current;
    const hasSel = term.hasSelection();
    const choice = await api.popupMenu([
      { id: 'copy', label: 'Copy', accelerator: 'Cmd+C', enabled: hasSel },
      { id: 'paste', label: 'Paste', accelerator: 'Cmd+V', enabled: t.status === 'connected' },
      { id: 'select-all', label: 'Select All', accelerator: 'Cmd+A' },
      { type: 'separator' },
      { id: 'find', label: 'Find…', accelerator: 'Cmd+F' },
      { id: 'clear', label: 'Clear Scrollback', accelerator: 'Cmd+K' },
      { id: 'highlight', label: 'Syntax Highlighting', checked: highlightRef.current },
      { type: 'separator' },
      ...(t.mode === 'ssh'
        ? [
            { id: 'sftp', label: 'Open SFTP Browser', enabled: t.status === 'connected' },
            { id: 'reconnect', label: 'Reconnect' },
          ]
        : []),
      { id: 'split-right', label: 'Split Right', accelerator: 'Cmd+D' },
      { id: 'split-down', label: 'Split Down', accelerator: 'Cmd+Shift+D' },
      ...(split ? [{ id: 'zoom-pane', label: 'Maximize Pane', accelerator: 'Cmd+Shift+Enter', checked: !!useApp.getState().tabs.find((x) => x.id === (t.paneOf || t.id) && x.kind === 'terminal' && x.zoomedPane) }] : []),
      { id: 'duplicate', label: 'Duplicate Tab' },
      { type: 'separator' },
      t.logFile
        ? { id: 'log-stop', label: 'Stop Logging' }
        : { id: 'log-start', label: 'Log Output to File', enabled: t.status === 'connected' },
      ...(t.logFile ? [{ id: 'log-show', label: 'Show Log File in Finder' }] : []),
      { type: 'separator' },
      ...(split
        ? [
            { id: 'close-pane', label: 'Close Pane', accelerator: 'Cmd+W' },
            { id: 'unsplit', label: 'Close Other Panes (Back to One)' },
          ]
        : []),
      { id: 'close', label: 'Close Tab' },
    ]);
    switch (choice) {
      case 'copy': {
        const sel = term.getSelection();
        if (sel) api.clipboard.write(sel);
        break;
      }
      case 'paste':
        pasteFromClipboard();
        break;
      case 'select-all':
        term.selectAll();
        break;
      case 'find':
        setSearchOpen(true);
        break;
      case 'clear':
        term.clear();
        break;
      case 'highlight':
        setHighlight((h) => !h);
        break;
      case 'sftp':
        openSftp({ fromTabId: t.id });
        break;
      case 'reconnect':
        reconnectTab(t.id);
        break;
      case 'duplicate':
        duplicateTab(t.id);
        break;
      case 'split-right':
        splitPane(t.id, 'row');
        break;
      case 'split-down':
        splitPane(t.id, 'col');
        break;
      case 'zoom-pane':
        toggleZoomPane(t.id);
        break;
      case 'log-start':
        startLog(t, sessionById(t.sessionId), true);
        break;
      case 'log-stop':
        stopLog(t.id, true);
        break;
      case 'log-show':
        if (t.logFile) api.fs.reveal(t.logFile);
        break;
      case 'close-pane':
        closePane(t.id);
        break;
      case 'unsplit':
        unsplitTab(t.id);
        break;
      case 'close':
        closeTab(t.paneOf || t.id);
        break;
    }
    if (choice !== 'find') term.focus();
  };

  // ---- drag & drop files from Finder -------------------------------------------------
  const dropTarget = () => {
    const t = tabRef.current;
    if (t.mode === 'local') return { kind: 'paste' as const };
    const dir = t.cwd || useApp.getState().files[t.id]?.path;
    return { kind: 'upload' as const, dir };
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    const target = dropTarget();
    setDropHint(
      target.kind === 'paste' ? 'Drop to insert the file path' : target.dir ? `Drop to upload to ${target.dir}` : 'Drop to upload'
    );
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHint(null);
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => api.pathForFile(f))
      .filter(Boolean);
    if (!paths.length) return;
    const t = tabRef.current;
    const target = dropTarget();
    if (target.kind === 'paste') {
      sendInput(paths.map(shellQuote).join(' ') + ' ');
      termRef.current?.focus();
      return;
    }
    if (t.status !== 'connected' || !t.connId) return toast('error', 'Not connected');
    if (!target.dir) return toast('error', 'Open the Files panel first to choose an upload folder');
    api.transfer
      .start({ connId: t.connId, direction: 'upload', sources: paths, targetDir: target.dir })
      .then(() => toast('info', `Uploading ${paths.length === 1 ? 'file' : `${paths.length} items`} to ${target.dir}`))
      .catch((err) => toast('error', err.message));
  };

  const theme = getTheme(themeIdFor(tab, settings));
  const GAP = 1;
  const style: React.CSSProperties = {
    display: visible ? 'block' : 'none',
    left: `calc(${rect.x * 100}% + ${rect.x > 0 ? GAP : 0}px)`,
    top: `calc(${rect.y * 100}% + ${rect.y > 0 ? GAP : 0}px)`,
    width: `calc(${rect.w * 100}% - ${rect.x > 0 ? GAP : 0}px)`,
    height: `calc(${rect.h * 100}% - ${rect.y > 0 ? GAP : 0}px)`,
  };

  return (
    <div className={`terminal-pane${split ? ' split' : ''}${focused ? ' focused' : ''}`} data-pane={tab.id} style={style} onMouseDown={() => !focused && activateTab(tab.id, { pane: true })}>
      <div
        ref={wrapRef}
        className={`terminal-wrap${bell ? ' bell' : ''}`}
        style={{ background: theme.colors.background, padding: settings.padding }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropHint(null)}
        onDrop={onDrop}
      >
        <Backdrop theme={theme} />
        <div ref={hostRef} className="terminal-host" />
        {searchOpen && termRef.current && searchRef.current && (
          <SearchBar
            search={searchRef.current}
            onClose={() => {
              setSearchOpen(false);
              searchRef.current?.clearDecorations();
              termRef.current?.focus();
            }}
          />
        )}
        {flash && <div className="term-flash">{flash}</div>}
        {dropHint && <div className="term-drop">{dropHint}</div>}
        {split && (
          <div className="pane-label" title={tab.title}>
            {tab.color && <i style={{ background: tab.color }} />}
            {tab.title}
            {tab.status !== 'connected' && <span className="pane-label-state">{tab.status === 'connecting' ? 'connecting' : tab.status === 'error' ? 'failed' : 'closed'}</span>}
            <button
              className="pane-close"
              title="Close this pane (⌘W)"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closePane(tab.id);
              }}
            >
              <X size={11} strokeWidth={2.5} />
            </button>
          </div>
        )}
        {split && !focused && <div className="pane-dim" />}
      </div>
    </div>
  );
}

function SearchBar({ search, onClose }: { search: SearchAddon; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState({ caseSensitive: false, regex: false, wholeWord: false });
  const [count, setCount] = useState<{ index: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const d = search.onDidChangeResults((r) => setCount({ index: r.resultIndex, total: r.resultCount }));
    return () => d.dispose();
  }, []);

  const decorations = {
    matchBackground: '#ffd47940',
    matchBorder: '#ffd47900',
    matchOverviewRuler: '#ffd479',
    activeMatchBackground: '#ff9e64aa',
    activeMatchBorder: '#ff9e64',
    activeMatchColorOverviewRuler: '#ff9e64',
  };
  const run = (dir: 'next' | 'prev', incremental = false) => {
    if (!q) {
      search.clearDecorations();
      setCount(null);
      return;
    }
    const o = { ...opts, decorations, incremental };
    if (dir === 'next') search.findNext(q, o);
    else search.findPrevious(q, o);
  };

  useEffect(() => run('next', true), [q, opts]);

  const toggle = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="term-search" onMouseDown={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={q}
        placeholder="Find"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') run(e.shiftKey ? 'prev' : 'next');
          if (e.key === 'Escape') onClose();
        }}
      />
      <span className="term-search-count">
        {q ? (count && count.total ? `${count.index + 1}/${count.total}` : 'No results') : ''}
      </span>
      <button className={`icon-btn sm${opts.caseSensitive ? ' on' : ''}`} title="Match case" onClick={() => toggle('caseSensitive')}>
        <CaseSensitive size={15} />
      </button>
      <button className={`icon-btn sm${opts.wholeWord ? ' on' : ''}`} title="Whole word" onClick={() => toggle('wholeWord')}>
        <WholeWord size={15} />
      </button>
      <button className={`icon-btn sm${opts.regex ? ' on' : ''}`} title="Regular expression" onClick={() => toggle('regex')}>
        <Regex size={15} />
      </button>
      <span className="term-search-sep" />
      <button className="icon-btn sm" title="Previous (⇧↩)" onClick={() => run('prev')}>
        <ArrowUp size={15} />
      </button>
      <button className="icon-btn sm" title="Next (↩)" onClick={() => run('next')}>
        <ArrowDown size={15} />
      </button>
      <button className="icon-btn sm" title="Close (Esc)" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  );
}
