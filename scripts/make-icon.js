// Renders build/icon.svg to PNGs with Electron and assembles build/icon.icns.
// Usage: npm run icon
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG = fs.readFileSync(path.join(ROOT, 'build', 'icon.svg'), 'utf8');

app.dock?.hide();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.setZoomFactor(1);
  const html = `<html><body style="margin:0;background:transparent">${SVG}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const png = image.resize({ width: 1024, height: 1024 }).toPNG();
  fs.writeFileSync(path.join(ROOT, 'build', 'icon.png'), png);

  const iconset = path.join(os.tmpdir(), `conduit-${process.pid}.iconset`);
  fs.mkdirSync(iconset, { recursive: true });
  const src = path.join(ROOT, 'build', 'icon.png');
  for (const size of [16, 32, 128, 256, 512]) {
    execFileSync('sips', ['-z', String(size), String(size), src, '--out', path.join(iconset, `icon_${size}x${size}.png`)], { stdio: 'ignore' });
    execFileSync('sips', ['-z', String(size * 2), String(size * 2), src, '--out', path.join(iconset, `icon_${size}x${size}@2x.png`)], { stdio: 'ignore' });
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(ROOT, 'build', 'icon.icns')]);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log('Wrote build/icon.png and build/icon.icns');
  app.exit(0);
});
