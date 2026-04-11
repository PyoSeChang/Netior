/**
 * Rebuild better-sqlite3 native module for system Node.js.
 * Used by @netior/core tests and any Node-sidecar workflows that need
 * the current Node ABI instead of Electron's ABI.
 */
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const bsPkg = require.resolve('better-sqlite3/package.json');
const bsDir = dirname(bsPkg);

console.log(`[rebuild-native] Rebuilding better-sqlite3 for Node ${process.version}...`);
console.log(`[rebuild-native] Path: ${bsDir}`);

execSync('npx node-gyp rebuild --release', {
  cwd: bsDir,
  stdio: 'inherit',
});

console.log('[rebuild-native] Done.');
