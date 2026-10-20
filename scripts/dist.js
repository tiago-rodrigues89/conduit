// Builds Conduit.app. When a code signing identity named "Conduit Local
// Signing" exists in the keychain, the app is signed with it: the signature
// then stays the same across updates, so macOS remembers "Always Allow" for
// the Conduit Safe Storage keychain item. Otherwise the build is signed ad hoc.
const { execFileSync, spawnSync } = require('child_process');

const IDENTITY = process.env.CONDUIT_SIGN_IDENTITY || 'Conduit Local Signing';
let identity = null;
try {
  const out = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
  if (out.includes(`"${IDENTITY}"`)) identity = IDENTITY;
} catch {
  /* no keychain access: ad hoc */
}
console.log(
  identity
    ? `Signing with "${identity}"`
    : `No "${IDENTITY}" certificate found — signing ad hoc (macOS asks for keychain access again after each update)`
);
const args = ['electron-builder', '--mac', '--arm64', ...(identity ? [`-c.mac.identity=${identity}`] : [])];
const res = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(res.status ?? 1);
