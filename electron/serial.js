'use strict';
// Serial consoles (USB-serial adapters, console cables) without native
// modules: the device is opened directly and configured with stty.

const { execFileSync } = require('child_process');
const fs = require('fs');
const tty = require('tty');
const { StringDecoder } = require('string_decoder');

function listDevices() {
  try {
    return fs
      .readdirSync('/dev')
      .filter((n) => n.startsWith('cu.'))
      .map((n) => `/dev/${n}`)
      .sort((a, b) => Number(/Bluetooth|debug/i.test(a)) - Number(/Bluetooth|debug/i.test(b)) || a.localeCompare(b));
  } catch {
    return [];
  }
}

function sttyArgs({ device, baud, dataBits, parity, stopBits, flow }) {
  const args = ['-f', device, String(Number(baud) || 115200), 'raw', '-echo', 'clocal', 'cread'];
  args.push(Number(dataBits) === 7 ? 'cs7' : Number(dataBits) === 6 ? 'cs6' : Number(dataBits) === 5 ? 'cs5' : 'cs8');
  if (parity === 'even') args.push('parenb', '-parodd');
  else if (parity === 'odd') args.push('parenb', 'parodd');
  else args.push('-parenb');
  args.push(Number(stopBits) === 2 ? 'cstopb' : '-cstopb');
  if (flow === 'rtscts') args.push('crtscts', '-ixon', '-ixoff');
  else if (flow === 'xonxoff') args.push('-crtscts', 'ixon', 'ixoff');
  else args.push('-crtscts', '-ixon', '-ixoff');
  return args;
}

class SerialSessions {
  constructor({ send, output }) {
    this.send = send;
    this.output = output;
    this.ports = new Map();
  }

  has(termId) {
    return this.ports.has(termId);
  }

  open({ termId, device, baud, dataBits, parity, stopBits, flow }) {
    this.close(termId);
    if (!device || !fs.existsSync(device)) throw new Error(`Serial device not found: ${device || '(none)'}`);
    let fd;
    try {
      fd = fs.openSync(device, fs.constants.O_RDWR | fs.constants.O_NOCTTY | fs.constants.O_NONBLOCK);
    } catch (err) {
      if (err.code === 'EBUSY') throw new Error(`${device} is in use by another program`);
      if (err.code === 'EACCES') throw new Error(`No permission to open ${device}`);
      throw err;
    }
    try {
      execFileSync('/bin/stty', sttyArgs({ device, baud, dataBits, parity, stopBits, flow }), { stdio: 'pipe' });
    } catch (err) {
      fs.closeSync(fd);
      throw new Error(`Could not configure ${device}: ${String(err.stderr || err.message).trim()}`);
    }
    const stream = new tty.ReadStream(fd);
    const decoder = new StringDecoder('utf8');
    const port = { fd, stream, device, closed: false };
    this.ports.set(termId, port);
    this.output.register(termId, { pause: () => stream.pause(), resume: () => stream.resume() });
    stream.on('data', (buf) => this.output.push(termId, decoder.write(buf)));
    const end = (err) => {
      if (port.closed) return;
      port.closed = true;
      if (this.ports.get(termId) !== port) return;
      this.ports.delete(termId);
      this.output.unregister(termId);
      this.send('term:exit', termId, { reason: 'lost', message: err ? err.message : `${device} was disconnected` });
    };
    stream.on('error', end);
    stream.on('end', () => end());
    return { device };
  }

  write(termId, data) {
    const port = this.ports.get(termId);
    if (!port || port.closed) return;
    const buf = Buffer.from(data, 'utf8');
    let offset = 0;
    for (let tries = 0; offset < buf.length && tries < 50; tries++) {
      try {
        offset += fs.writeSync(port.fd, buf, offset);
      } catch (err) {
        if (err.code !== 'EAGAIN') return;
      }
    }
  }

  resize() {
    /* serial lines have no window size */
  }

  close(termId) {
    const port = this.ports.get(termId);
    if (!port) return;
    port.closed = true;
    this.ports.delete(termId);
    this.output.unregister(termId);
    try { port.stream.destroy(); } catch { /* ignore */ }
    try { fs.closeSync(port.fd); } catch { /* ignore */ }
  }

  closeAll() {
    for (const id of [...this.ports.keys()]) this.close(id);
  }

  activeCount() {
    return this.ports.size;
  }
}

module.exports = { SerialSessions, listDevices };
