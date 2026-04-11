const fs = require('fs');
const path = require('path');

const MIN_NODE_MAJOR = 22;
const runtimeVersion = process.versions.node;
const runtimeMajor = parseInt(runtimeVersion.split('.')[0] ?? '0', 10);

if (runtimeMajor < MIN_NODE_MAJOR) {
  throw new Error(
    `Bundled sidecar runtime requires Node ${MIN_NODE_MAJOR}+. ` +
    `Current runtime is ${process.version}.`,
  );
}

const packageRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(packageRoot, 'resources', 'node-runtime');
const executableRelativePath = process.platform === 'win32'
  ? 'node.exe'
  : path.join('bin', 'node');
const executableTargetPath = path.join(runtimeRoot, executableRelativePath);

fs.mkdirSync(runtimeRoot, { recursive: true });
for (const entry of fs.readdirSync(runtimeRoot)) {
  if (entry === '.gitignore') {
    continue;
  }

  fs.rmSync(path.join(runtimeRoot, entry), { recursive: true, force: true });
}

fs.mkdirSync(path.dirname(executableTargetPath), { recursive: true });
fs.copyFileSync(process.execPath, executableTargetPath);

if (process.platform !== 'win32') {
  fs.chmodSync(executableTargetPath, 0o755);
}

const licenseCandidates = [
  path.join(path.dirname(process.execPath), 'LICENSE'),
  path.join(path.dirname(process.execPath), 'LICENSE.txt'),
  path.join(path.dirname(process.execPath), '..', 'LICENSE'),
  path.join(path.dirname(process.execPath), '..', 'LICENSE.txt'),
];

for (const candidate of licenseCandidates) {
  if (!fs.existsSync(candidate)) {
    continue;
  }

  const licenseTargetPath = path.join(runtimeRoot, path.basename(candidate));
  fs.copyFileSync(candidate, licenseTargetPath);
  break;
}

const manifestPath = path.join(runtimeRoot, 'runtime-manifest.json');
const manifest = {
  nodeVersion: runtimeVersion,
  platform: process.platform,
  arch: process.arch,
  executable: executableRelativePath.replace(/\\/g, '/'),
  sourcePath: process.execPath,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(runtimeRoot, '.gitignore'), '*\n!.gitignore\n', 'utf8');

console.log(`[prepare-node-runtime] Bundled Node ${runtimeVersion}`);
console.log(`[prepare-node-runtime] Source: ${process.execPath}`);
console.log(`[prepare-node-runtime] Target: ${executableTargetPath}`);
