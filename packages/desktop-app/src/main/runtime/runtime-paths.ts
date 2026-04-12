import { app } from 'electron';
import { join } from 'path';
import { createRuntimeScope, createScopedPort, extractWorktreeLabel, isPackagedRuntimeScope } from './runtime-scope';

const APP_DATA_DIRNAME = 'netior';
const HOOK_DISPATCHER_FILENAME = 'netior-session-hook.mjs';

export function getSharedUserDataRoot(): string {
  return join(app.getPath('appData'), APP_DATA_DIRNAME);
}

export function getRuntimeScope(): string {
  return createRuntimeScope({
    cwd: process.cwd(),
    packaged: app.isPackaged,
  });
}

export function getRuntimeInstanceId(): string {
  return `pid-${process.pid}`;
}

export function getWorktreeLabel(): string {
  return extractWorktreeLabel(process.cwd());
}

export function getRuntimeRootDir(): string {
  const runtimeScope = getRuntimeScope();
  if (isPackagedRuntimeScope(runtimeScope)) {
    return getSharedUserDataRoot();
  }

  return join(getSharedUserDataRoot(), 'runtime', runtimeScope);
}

export function getRuntimeInstancesDir(): string {
  return join(getRuntimeRootDir(), 'instances');
}

export function getRuntimeInstanceDir(): string {
  return join(getRuntimeInstancesDir(), getRuntimeInstanceId());
}

export function getRuntimeSessionDataDir(): string {
  return join(getRuntimeInstanceDir(), 'session-data');
}

export function getRuntimeDataDir(): string {
  return join(getRuntimeRootDir(), 'data');
}

export function getRuntimeLogsDir(): string {
  return join(getRuntimeDataDir(), 'logs');
}

export function getRuntimeNarreDir(projectId?: string): string {
  return projectId
    ? join(getRuntimeDataDir(), 'narre', projectId)
    : join(getRuntimeDataDir(), 'narre');
}

export function getRuntimeUndoTrashDir(): string {
  return join(getRuntimeRootDir(), 'undo-trash');
}

export function getRuntimeAgentRuntimeDir(): string {
  return join(getRuntimeInstanceDir(), 'agent-runtime');
}

export function getSharedHooksDir(): string {
  return join(getSharedUserDataRoot(), 'data', 'hooks');
}

export function getHookDispatcherPath(): string {
  return join(getSharedHooksDir(), HOOK_DISPATCHER_FILENAME);
}

export function getHookRuntimeScopeDir(): string {
  return join(getSharedHooksDir(), 'runtimes', getRuntimeScope());
}

export function getHookRuntimeDir(): string {
  return join(getHookRuntimeScopeDir(), getRuntimeInstanceId());
}

export function getHookRuntimePortFilePath(): string {
  return join(getHookRuntimeDir(), 'port');
}

export function getNetiorServicePort(): number {
  return createScopedPort({
    kind: 'netior-service',
    runtimeScope: getRuntimeScope(),
  });
}

export function getNarreServerPort(): number {
  return createScopedPort({
    kind: 'narre-server',
    runtimeScope: getRuntimeScope(),
  });
}
