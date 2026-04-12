import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  getHookRuntimeScopeDir,
  getRuntimeInstanceDir,
  getRuntimeInstanceId,
  getRuntimeInstancesDir,
  getRuntimeRootDir,
} from './runtime-paths';

const DESKTOP_INSTANCE_MARKER_FILENAME = 'instance.json';

export type SharedSidecarName = 'netior-service' | 'narre-server';

interface DesktopRuntimeInstanceRecord {
  instanceId: string;
  pid: number;
  startedAt: string;
}

interface SharedSidecarStateRecord {
  pid: number;
  port: number;
  updatedAt: string;
}

export function registerDesktopRuntimeInstance(): void {
  cleanupStaleRuntimeInstances();
  mkdirSync(getRuntimeInstanceDir(), { recursive: true });
  const record: DesktopRuntimeInstanceRecord = {
    instanceId: getRuntimeInstanceId(),
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(
    getDesktopInstanceMarkerPath(),
    JSON.stringify(record, null, 2),
    'utf8',
  );
}

export function unregisterDesktopRuntimeInstance(): void {
  removeRuntimeInstanceArtifacts(getRuntimeInstanceId());
}

export function hasOtherDesktopRuntimeInstances(): boolean {
  cleanupStaleRuntimeInstances();

  const instancesDir = getRuntimeInstancesDir();
  if (!existsSync(instancesDir)) {
    return false;
  }

  const currentInstanceId = getRuntimeInstanceId();
  for (const entry of readdirSync(instancesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === currentInstanceId) {
      continue;
    }

    if (readDesktopRuntimeInstance(entry.name)) {
      return true;
    }
  }

  return false;
}

export function writeSharedSidecarState(
  name: SharedSidecarName,
  state: Pick<SharedSidecarStateRecord, 'pid' | 'port'>,
): void {
  mkdirSync(getSharedSidecarStateDir(), { recursive: true });
  const record: SharedSidecarStateRecord = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(
    getSharedSidecarStatePath(name),
    JSON.stringify(record, null, 2),
    'utf8',
  );
}

export function readSharedSidecarState(name: SharedSidecarName): SharedSidecarStateRecord | null {
  const statePath = getSharedSidecarStatePath(name);
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8')) as Partial<SharedSidecarStateRecord>;
    if (typeof parsed.pid !== 'number' || typeof parsed.port !== 'number') {
      clearSharedSidecarState(name);
      return null;
    }

    return {
      pid: parsed.pid,
      port: parsed.port,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    clearSharedSidecarState(name);
    return null;
  }
}

export function clearSharedSidecarState(name: SharedSidecarName, expectedPid?: number | null): void {
  const statePath = getSharedSidecarStatePath(name);
  if (!existsSync(statePath)) {
    return;
  }

  if (typeof expectedPid === 'number') {
    const currentState = readSharedSidecarState(name);
    if (currentState && currentState.pid !== expectedPid) {
      return;
    }
  }

  try {
    unlinkSync(statePath);
  } catch {
    // Ignore cleanup failures during shutdown.
  }
}

export function stopSharedSidecarProcess(name: SharedSidecarName): boolean {
  const state = readSharedSidecarState(name);
  if (!state) {
    return false;
  }

  try {
    if (isProcessRunning(state.pid)) {
      process.kill(state.pid);
    }
  } catch {
    // The shared sidecar may already be gone.
  } finally {
    clearSharedSidecarState(name, state.pid);
  }

  return true;
}

function cleanupStaleRuntimeInstances(): void {
  const instancesDir = getRuntimeInstancesDir();
  if (!existsSync(instancesDir)) {
    return;
  }

  for (const entry of readdirSync(instancesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    readDesktopRuntimeInstance(entry.name);
  }
}

function readDesktopRuntimeInstance(instanceId: string): DesktopRuntimeInstanceRecord | null {
  const markerPath = getDesktopInstanceMarkerPath(instanceId);
  if (!existsSync(markerPath)) {
    removeRuntimeInstanceArtifacts(instanceId);
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf8')) as Partial<DesktopRuntimeInstanceRecord>;
    if (
      parsed.instanceId !== instanceId
      || typeof parsed.pid !== 'number'
      || typeof parsed.startedAt !== 'string'
    ) {
      removeRuntimeInstanceArtifacts(instanceId);
      return null;
    }

    if (!isProcessRunning(parsed.pid)) {
      removeRuntimeInstanceArtifacts(instanceId);
      return null;
    }

    return {
      instanceId,
      pid: parsed.pid,
      startedAt: parsed.startedAt,
    };
  } catch {
    removeRuntimeInstanceArtifacts(instanceId);
    return null;
  }
}

function removeRuntimeInstanceArtifacts(instanceId: string): void {
  try {
    rmSync(join(getRuntimeInstancesDir(), instanceId), { recursive: true, force: true });
  } catch {
    // Ignore stale runtime cleanup failures.
  }

  try {
    rmSync(join(getHookRuntimeScopeDir(), instanceId), { recursive: true, force: true });
  } catch {
    // Ignore stale hook cleanup failures.
  }
}

function getDesktopInstanceMarkerPath(instanceId = getRuntimeInstanceId()): string {
  return join(getRuntimeInstancesDir(), instanceId, DESKTOP_INSTANCE_MARKER_FILENAME);
}

function getSharedSidecarStateDir(): string {
  return join(getRuntimeRootDir(), 'shared-sidecars');
}

function getSharedSidecarStatePath(name: SharedSidecarName): string {
  return join(getSharedSidecarStateDir(), `${name}.json`);
}

function isProcessRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
