'use strict';
// Shell integration for bash and zsh (scripts live in ./shell):
//  - reports the working directory with OSC 7 (status bar, Files panel)
//  - optionally draws Conduit's prompt (user pill, folder, git branch,
//    duration of slow commands, red/green arrow for the last exit status)
// Local shells load it through rc files that first load the user's own
// config; SSH shells get it typed in once, base64-encoded (see ssh.js).

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'shell');
const read = (name) => fs.readFileSync(path.join(SRC, name), 'utf8');

function minify(script) {
  return script
    .split('\n')
    .map((l) => l.replace(/^\s+/, ''))
    .filter((l) => l && !l.startsWith('#'))
    .join('\n');
}

/**
 * The single line typed into an SSH shell after login. `shell` is 'bash' or
 * 'zsh', or 'auto' when it is not known (e.g. a root shell after sudo -i).
 */
function injectLine(shell, style) {
  const pre = `__conduit_style=${style}\n__conduit_injected=1\n__conduit_remote=1\n`;
  const part = (file, guard) => {
    const b64 = Buffer.from(pre + minify(read(file))).toString('base64');
    return `[ -n "$${guard}" ] && eval "$(echo ${b64} | base64 -d)"`;
  };
  const marker = "printf '\\033]6973;ready\\007'";
  if (shell === 'auto') {
    return ` : __conduit_; ${part('integration.zsh', 'ZSH_VERSION')}; ${part('integration.bash', 'BASH_VERSION')}; ${marker}`;
  }
  return ` : __conduit_; ${part(shell === 'zsh' ? 'integration.zsh' : 'integration.bash', shell === 'zsh' ? 'ZSH_VERSION' : 'BASH_VERSION')}; ${marker}`;
}

/** Copies the rc files for local shells to `dir` (zsh cannot read inside app.asar). */
function prepareLocal(dir) {
  const zdot = path.join(dir, 'zsh');
  const bashDir = path.join(dir, 'bash');
  fs.mkdirSync(zdot, { recursive: true });
  fs.mkdirSync(bashDir, { recursive: true });
  const copy = (from, to) => fs.writeFileSync(to, read(from));
  copy('zshenv', path.join(zdot, '.zshenv'));
  copy('zprofile', path.join(zdot, '.zprofile'));
  copy('zshrc', path.join(zdot, '.zshrc'));
  copy('integration.zsh', path.join(zdot, 'integration.zsh'));
  copy('bashrc', path.join(bashDir, 'rc'));
  copy('integration.bash', path.join(bashDir, 'integration.bash'));
  return { zdotdir: zdot, bashDir, bashrc: path.join(bashDir, 'rc') };
}

module.exports = { injectLine, prepareLocal };
