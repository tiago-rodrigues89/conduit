'use strict';
// Exposes a small, explicit bridge to the renderer (window.conduit).

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const INVOKE_PREFIXES = ['app:', 'store:', 'secrets:', 'clipboard:', 'shell:', 'dialog:', 'menu:', 'term:', 'local:', 'ssh:', 'sftp:', 'transfer:', 'fs:', 'import:', 'telnet:', 'serial:', 'launch:', 'monitor:', 'log:', 'backup:', 'sync:'];
const SEND_CHANNELS = new Set(['term:write', 'term:resize', 'term:ack', 'ui:answer', 'app:set-confirm-close', 'app:close-confirmed', 'app:close-cancelled', 'app:set-vibrancy']);
const EVENT_CHANNELS = new Set([
  'term:data',
  'term:exit',
  'term:integrated',
  'term:ready',
  'store:external',
  'sync:status',
  'ssh:log',
  'ssh:banner',
  'conn:closed',
  'ui:ask',
  'transfer:update',
  'fs:changed',
  'toast',
  'menu',
  'app:confirm-close',
  'monitor:update',
]);

contextBridge.exposeInMainWorld('conduit', {
  platform: process.platform,

  async invoke(channel, ...args) {
    if (!INVOKE_PREFIXES.some((p) => channel.startsWith(p))) throw new Error(`Blocked channel ${channel}`);
    const res = await ipcRenderer.invoke(channel, ...args);
    if (!res.ok) {
      const err = new Error(res.error);
      err.cancelled = res.cancelled;
      throw err;
    }
    return res.value;
  },

  send(channel, ...args) {
    if (SEND_CHANNELS.has(channel)) ipcRenderer.send(channel, ...args);
  },

  on(channel, callback) {
    if (!EVENT_CHANNELS.has(channel)) throw new Error(`Blocked channel ${channel}`);
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  pathForFile(file) {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
});
