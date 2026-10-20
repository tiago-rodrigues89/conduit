'use strict';
// Local shells (the Mac's own zsh/bash) and local commands via node-pty.

const pty = require('node-pty');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loginShell() {
  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) return process.env.SHELL;
  try {
    const sh = os.userInfo().shell;
    if (sh && fs.existsSync(sh)) return sh;
  } catch { /* ignore */ }
  return '/bin/zsh';
}

/** Shells listed in /etc/shells plus common Homebrew ones that exist. */
function availableShells() {
  const found = new Set();
  try {
    for (const line of fs.readFileSync('/etc/shells', 'utf8').split('\n')) {
      const s = line.trim();
      if (s && !s.startsWith('#') && fs.existsSync(s)) found.add(s);
    }
  } catch { /* ignore */ }
  for (const s of ['/opt/homebrew/bin/fish', '/opt/homebrew/bin/bash', '/opt/homebrew/bin/zsh', '/opt/homebrew/bin/nu', '/usr/local/bin/fish']) {
    if (fs.existsSync(s)) found.add(s);
  }
  return { default: loginShell(), shells: [...found] };
}

class LocalShells {
  constructor({ send, output, integration }) {
    this.send = send;
    this.output = output;
    this.integration = integration; // { zdotdir, bashDir, bashrc } or null
    this.procs = new Map();
  }

  /**
   * @param {{termId: string, cols: number, rows: number, cwd?: string, shell?: string,
   *          command?: string, prompt?: 'conduit'|'minimal'|'shell'}} opts
   */
  spawn({ termId, cols, rows, cwd, shell, command, prompt }) {
    this.kill(termId);
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('ELECTRON_') || k === 'NODE_OPTIONS') delete env[k];
    Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Conduit' });
    if (!env.LANG) env.LANG = 'en_US.UTF-8';

    const shellPath = shell && fs.existsSync(shell) ? shell : loginShell();
    const name = path.basename(shellPath);
    let args;
    if (command) {
      // run through an interactive login shell so PATH etc. match a normal terminal
      args = name === 'zsh' || name === 'bash' ? ['-l', '-i', '-c', command] : ['-l', '-c', command];
    } else if (name === 'zsh' && this.integration) {
      env.CONDUIT_USER_ZDOTDIR = process.env.ZDOTDIR || os.homedir();
      env.ZDOTDIR = this.integration.zdotdir;
      env.CONDUIT_PROMPT = prompt || 'conduit';
      args = ['-l'];
    } else if (name === 'bash' && this.integration) {
      env.CONDUIT_SHELL_DIR = this.integration.bashDir;
      env.CONDUIT_PROMPT = prompt || 'conduit';
      env.BASH_SILENCE_DEPRECATION_WARNING = '1';
      args = ['--rcfile', this.integration.bashrc, '-i'];
    } else {
      args = ['-l'];
    }

    const dir = cwd && fs.existsSync(cwd.replace(/^~(?=\/|$)/, os.homedir())) ? cwd.replace(/^~(?=\/|$)/, os.homedir()) : os.homedir();
    const proc = pty.spawn(shellPath, args, {
      name: 'xterm-256color',
      cols: Math.max(2, cols | 0 || 80),
      rows: Math.max(2, rows | 0 || 24),
      cwd: dir,
      env,
    });
    this.procs.set(termId, proc);
    this.output.register(termId, { pause: () => proc.pause(), resume: () => proc.resume() });
    proc.onData((data) => this.output.push(termId, data));
    proc.onExit(({ exitCode }) => {
      if (this.procs.get(termId) !== proc) return;
      this.procs.delete(termId);
      this.output.unregister(termId);
      this.send('term:exit', termId, { reason: 'exit', code: exitCode });
    });
    return { shell: shellPath, pid: proc.pid };
  }

  has(termId) {
    return this.procs.has(termId);
  }

  write(termId, data) {
    const proc = this.procs.get(termId);
    if (proc) proc.write(data);
  }

  resize(termId, cols, rows) {
    const proc = this.procs.get(termId);
    if (proc && cols > 0 && rows > 0) {
      try { proc.resize(cols, rows); } catch { /* ignore */ }
    }
  }

  kill(termId) {
    const proc = this.procs.get(termId);
    if (!proc) return;
    this.procs.delete(termId);
    this.output.unregister(termId);
    try { proc.kill(); } catch { /* ignore */ }
  }

  killAll() {
    for (const id of [...this.procs.keys()]) this.kill(id);
  }

  activeCount() {
    return this.procs.size;
  }
}

module.exports = { LocalShells, availableShells };
