import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { TextDecoder } from 'node:util';

const ROOT = process.cwd();
const decoder = new TextDecoder('utf-8', { fatal: true });

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'release',
  '.turbo',
]);

const EXCLUDED_PREFIXES = [
  '.claude/worktrees/',
  'scripts/rename-brand.mjs',
];

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.conf',
  '.css',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsonc',
  '.md',
  '.mjs',
  '.mts',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const DEFAULT_REPLACEMENTS = [
  ['@moc/', '@netior/'],
  ['com.moc.app', 'com.netior.app'],
  ['%APPDATA%/moc/data/moc.db', '%APPDATA%/netior/data/netior.db'],
  ['%APPDATA%/moc/data', '%APPDATA%/netior/data'],
  ["join(APPDATA, 'moc', 'data', 'moc-eval.db')", "join(APPDATA, 'netior', 'data', 'netior-eval.db')"],
  ["join(APPDATA, 'moc', 'data', 'eval')", "join(APPDATA, 'netior', 'data', 'eval')"],
  ["join(APPDATA, 'moc', 'data')", "join(APPDATA, 'netior', 'data')"],
  ["'moc-mcp'", "'netior-mcp'"],
  ['"moc-mcp"', '"netior-mcp"'],
  ['[moc-mcp]', '[netior-mcp]'],
  ['[moc-sync]', '[netior-sync]'],
  ['moc-terminal-', 'netior-terminal-'],
  ['moc-terminal-workbench', 'netior-terminal-workbench'],
  ['moc-terminal-panel', 'netior-terminal-panel'],
  ['moc-terminal-container', 'netior-terminal-container'],
  ['application/x-moc-tab', 'application/x-netior-tab'],
  ['application/moc-node', 'application/netior-node'],
  ["TERM_PROGRAM: 'moc'", "TERM_PROGRAM: 'netior'"],
  ["app.name = 'moc'", "app.name = 'netior'"],
  ["join(app.getPath('appData'), 'moc')", "join(app.getPath('appData'), 'netior')"],
  ["is.dev ? 'moc-dev.db' : 'moc.db'", "is.dev ? 'netior-dev.db' : 'netior.db'"],
  ["join(dbDir, 'moc.db')", "join(dbDir, 'netior.db')"],
  ['Could not find moc-mcp server.', 'Could not find netior-mcp server.'],
  ['packages/moc-core', 'packages/netior-core'],
  ['packages/moc-mcp', 'packages/netior-mcp'],
  ['../../moc-mcp/dist/index.js', '../../netior-mcp/dist/index.js'],
  ['../../../moc-mcp/dist/index.js', '../../../netior-mcp/dist/index.js'],
  ['moc-mcp SSE', 'netior-mcp SSE'],
  ['moc-mcp', 'netior-mcp'],
  ['moc.db', 'netior.db'],
  ['moc-dev.db', 'netior-dev.db'],
  ['moc:change', 'netior:change'],
  ['MocChangeEvent', 'NetiorChangeEvent'],
  ['useMocSync', 'useNetiorSync'],
  ['MoCTerminal', 'NetiorTerminal'],
  ['moc-dark', 'netior-dark'],
  ['moc-light', 'netior-light'],
  ['MoC', 'Netior'],
];

const PATH_REPLACEMENTS = [
  ['packages/moc-core', 'packages/netior-core'],
  ['packages/moc-mcp', 'packages/netior-mcp'],
  ['useMocSync', 'useNetiorSync'],
  ['moc-mcp-subscriber', 'netior-mcp-subscriber'],
];

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    renamePaths: argv.includes('--rename-paths'),
    verbose: argv.includes('--verbose'),
  };
}

function shouldExclude(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (!normalized) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return normalized.split('/').some((part) => EXCLUDED_DIRS.has(part));
}

function isTextFile(relPath) {
  const ext = extname(relPath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !ext;
}

function decodeUtf8(buffer) {
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const body = hasBom ? buffer.subarray(3) : buffer;
  const text = decoder.decode(body);
  return { text, hasBom };
}

function applyReplacements(text, replacements) {
  let next = text;
  let count = 0;
  for (const [from, to] of replacements) {
    if (!from || from === to) continue;
    const hits = next.split(from).length - 1;
    if (hits > 0) {
      next = next.split(from).join(to);
      count += hits;
    }
  }
  return { text: next, count };
}

async function walk(dir, relBase = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  const dirs = [];
  for (const entry of entries) {
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (shouldExclude(relPath)) continue;
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(relPath);
      const nested = await walk(absPath, relPath);
      files.push(...nested.files);
      dirs.push(...nested.dirs);
      continue;
    }
    files.push({ absPath, relPath });
  }
  return { files, dirs };
}

function getPathRename(relPath) {
  let renamed = relPath.replace(/\\/g, '/');
  for (const [from, to] of PATH_REPLACEMENTS) {
    renamed = renamed.split(from).join(to);
  }
  return renamed === relPath.replace(/\\/g, '/') ? null : renamed;
}

function collapseDirRenames(renames) {
  const sorted = [...renames].sort((a, b) => a[0].length - b[0].length);
  return sorted.filter(([from]) => !sorted.some(([parent]) => parent !== from && from.startsWith(`${parent}/`)));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { files, dirs } = await walk(ROOT);

  const changedFiles = [];
  const skippedBinary = [];
  const skippedEncoding = [];
  const skippedWrite = [];
  const dirRenames = [];
  const fileRenames = [];

  for (const relPath of dirs) {
    const maybeRename = getPathRename(relPath);
    if (options.renamePaths && maybeRename) {
      dirRenames.push([relPath, maybeRename]);
    }
  }

  const collapsedDirRenames = collapseDirRenames(dirRenames);

  for (const file of files) {
    const maybeRename = getPathRename(file.relPath);
    if (
      options.renamePaths &&
      maybeRename &&
      !collapsedDirRenames.some(([from]) => file.relPath.startsWith(`${from}/`))
    ) {
      fileRenames.push([file.relPath, maybeRename]);
    }

    if (!isTextFile(file.relPath)) {
      skippedBinary.push(file.relPath);
      continue;
    }

    const raw = await readFile(file.absPath);

    if (raw.includes(0)) {
      skippedBinary.push(file.relPath);
      continue;
    }

    let decoded;
    try {
      decoded = decodeUtf8(raw);
    } catch {
      skippedEncoding.push(file.relPath);
      continue;
    }

    const { text: nextText, count } = applyReplacements(decoded.text, DEFAULT_REPLACEMENTS);
    if (count === 0) continue;

    changedFiles.push({
      relPath: file.relPath,
      replacements: count,
      hasBom: decoded.hasBom,
      nextText,
    });

    if (options.apply) {
      const output = decoded.hasBom
        ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(nextText, 'utf8')])
        : Buffer.from(nextText, 'utf8');
      try {
        await writeFile(file.absPath, output);
      } catch (error) {
        skippedWrite.push([
          file.relPath,
          error instanceof Error ? error.message : String(error),
        ]);
      }
    }
  }

  if (options.apply && options.renamePaths) {
    collapsedDirRenames.sort((a, b) => b[0].length - a[0].length);
    for (const [from, to] of collapsedDirRenames) {
      try {
        await rename(join(ROOT, from), join(ROOT, to));
      } catch (error) {
        skippedWrite.push([
          from,
          error instanceof Error ? error.message : String(error),
        ]);
      }
    }

    fileRenames.sort((a, b) => b[0].length - a[0].length);
    for (const [from, to] of fileRenames) {
      try {
        await rename(join(ROOT, from), join(ROOT, to));
      } catch (error) {
        skippedWrite.push([
          from,
          error instanceof Error ? error.message : String(error),
        ]);
      }
    }
  }

  console.log(options.apply ? 'APPLY MODE' : 'DRY RUN');
  console.log(`Content changes: ${changedFiles.length} file(s)`);
  for (const file of changedFiles) {
    console.log(`  - ${file.relPath} (${file.replacements} replacement${file.replacements === 1 ? '' : 's'})`);
  }

  if (options.renamePaths) {
    const pathRenames = [...collapsedDirRenames, ...fileRenames];
    console.log(`Path renames: ${pathRenames.length}`);
    for (const [from, to] of pathRenames) {
      console.log(`  - ${from} -> ${to}`);
    }
  }

  console.log(`Skipped non-text files: ${skippedBinary.length}`);
  if (options.verbose && skippedBinary.length > 0) {
    for (const relPath of skippedBinary) {
      console.log(`  - ${relPath}`);
    }
  }

  console.log(`Skipped non-UTF8 files: ${skippedEncoding.length}`);
  if (skippedEncoding.length > 0) {
    for (const relPath of skippedEncoding) {
      console.log(`  - ${relPath}`);
    }
  }

  console.log(`Skipped write/rename failures: ${skippedWrite.length}`);
  if (skippedWrite.length > 0) {
    for (const [relPath, reason] of skippedWrite) {
      console.log(`  - ${relPath}: ${reason}`);
    }
  }

  if (!options.apply) {
    console.log('No files were modified.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
