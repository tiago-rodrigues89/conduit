// Builds Conduit.app and picks the best code signing identity in the keychain:
//
// 1. CONDUIT_SIGN_IDENTITY, if set
// 2. "Developer ID Application: …" or "Apple Development: …" (free with an Apple ID in Xcode):
//    these carry an Apple Team ID, so macOS remembers "Always Allow" for the
//    Conduit Safe Storage keychain item across updates
// 3. "Conduit Local Signing" (self-signed): a stable app identity, but without a
//    Team ID macOS still asks once after each update
// 4. otherwise ad hoc
const { execFileSync, spawnSync } = require('child_process');

let out = '';
try {
  out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
} catch {
  /* no keychain access: ad hoc */
}
const names = [...out.matchAll(/\d+\) [0-9A-F]{40} "([^"]+)"/g)].map((m) => m[1]);
const pick =
  process.env.CONDUIT_SIGN_IDENTITY ||
  names.find((n) => n.startsWith('Developer ID Application:')) ||
  names.find((n) => n.startsWith('Apple Development:')) ||
  names.find((n) => n === 'Conduit Local Signing') ||
  null;

console.log(
  pick
    ? `Signing with "${pick}"${/^(Developer ID|Apple Development)/.test(pick) ? '' : ' (no Team ID: macOS asks for keychain access once after each update)'}`
    : 'No signing certificate found — signing ad hoc (macOS asks for keychain access after each update)'
);
// electron-builder wants the name without the "Developer ID Application:" / "Apple Development:" prefix,
// and the "development" type for Apple Development certificates
const args = ['electron-builder', '--mac', '--arm64'];
if (pick) args.push(`-c.mac.identity=${pick.replace(/^(Developer ID Application|Apple Development): /, '')}`);
if (pick && pick.startsWith('Apple Development:')) args.push('-c.mac.type=development');
const res = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(res.status ?? 1);
