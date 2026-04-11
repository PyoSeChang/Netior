import { existsSync } from 'fs';
import { join } from 'path';

export interface SidecarRuntime {
  command: string;
  env: Record<string, string>;
  description: string;
}

interface ResolveSidecarRuntimeOptions {
  envVarName: string;
  displayName: string;
  minNodeMajor?: number;
}

export function resolveSidecarRuntime(options: ResolveSidecarRuntimeOptions): SidecarRuntime {
  const explicitRuntime = process.env[options.envVarName];
  if (explicitRuntime) {
    return {
      command: explicitRuntime,
      env: {
        NETIOR_ELECTRON_PATH: process.execPath,
      },
      description: `configured node runtime (${explicitRuntime})`,
    };
  }

  const devNodePath = process.env.npm_node_execpath;
  if (devNodePath && devNodePath !== process.execPath) {
    return {
      command: devNodePath,
      env: {
        NETIOR_ELECTRON_PATH: process.execPath,
      },
      description: `development node runtime (${devNodePath})`,
    };
  }

  const bundledRuntime = resolveBundledNodeRuntimePath();
  if (bundledRuntime) {
    return {
      command: bundledRuntime,
      env: {
        NETIOR_ELECTRON_PATH: process.execPath,
      },
      description: `bundled node runtime (${bundledRuntime})`,
    };
  }

  const electronNodeMajor = parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (options.minNodeMajor != null && electronNodeMajor < options.minNodeMajor) {
    throw new Error(
      `${options.displayName} requires Node ${options.minNodeMajor}+. ` +
      `Set ${options.envVarName} to a compatible Node binary or bundle one with the app.`,
    );
  }

  return {
    command: process.execPath,
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      NETIOR_ELECTRON_PATH: process.execPath,
    },
    description: `Electron runtime (Node ${process.versions.node})`,
  };
}

function resolveBundledNodeRuntimePath(): string | null {
  const fileName = process.platform === 'win32' ? 'node.exe' : join('bin', 'node');
  const candidates = [
    join(process.resourcesPath ?? '', 'node-runtime', fileName),
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node-runtime', fileName),
    join(process.cwd(), 'packages/desktop-app/resources/node-runtime', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}
