import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { basename, dirname, join } from 'path';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import type {
  NarreBehaviorSettings,
  NarreCodexSettings,
  NarreMention,
  NarreStreamEvent,
  SupervisorSessionReport,
} from '@netior/shared/types';
import { normalizeNarreBehaviorSettings } from './system-prompt.js';
import { SessionStore } from './session-store.js';
import { initSSE, sendSSEEvent, endSSE } from './streaming.js';
import { NarreRuntime } from './runtime/narre-runtime.js';
import type { NarreProviderAdapter } from './runtime/provider-adapter.js';
import { ClaudeProviderAdapter } from './providers/claude.js';
import { initNarreLogging } from './logging.js';
import { buildProjectPromptMetadata } from './project-prompt-metadata.js';
import { getProjectById } from './netior-service-client.js';
import { SupervisorRegistry } from './supervisor/supervisor-registry.js';

const currentFilePath = typeof __filename === 'string'
  ? __filename
  : fileURLToPath(import.meta.url);
const currentDir = typeof __dirname === 'string'
  ? __dirname
  : dirname(currentFilePath);
const require = createRequire(currentFilePath);
const electronResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const MOC_DATA_DIR = process.env.MOC_DATA_DIR;
const NETIOR_SHARED_USER_DATA_ROOT = process.env.NETIOR_SHARED_USER_DATA_ROOT;
const NARRE_GLOBAL_USER_AGENT_ID = process.env.NARRE_GLOBAL_USER_AGENT_ID;
const NARRE_PROJECT_USER_AGENT_ID = process.env.NARRE_PROJECT_USER_AGENT_ID;
const NARRE_TRACE_HEADER = 'x-netior-trace-id';

if (!MOC_DATA_DIR) {
  console.error('Error: MOC_DATA_DIR environment variable is required');
  process.exit(1);
}

const narreLogFilePath = initNarreLogging(MOC_DATA_DIR);
console.log(`[narre] Log file: ${narreLogFilePath}`);

function summarizeStreamEvent(event: NarreStreamEvent): string {
  switch (event.type) {
    case 'text':
      return `type=text chars=${event.content?.length ?? 0}`;
    case 'tool_start':
      return `type=tool_start tool=${event.tool ?? 'unknown'}`;
    case 'tool_end':
      return `type=tool_end tool=${event.tool ?? 'unknown'}`;
    case 'card':
      return `type=card card=${event.card?.type ?? 'unknown'}`;
    case 'error':
      return `type=error error=${JSON.stringify(event.error ?? '')}`;
    case 'done':
      return `type=done session=${event.sessionId ?? 'unknown'}`;
    default:
      return `type=${(event as { type?: string }).type ?? 'unknown'}`;
  }
}

// UI tools may block waiting for user interaction, so extend stream close timeout.
process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT = process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT || '300000';

const sessionStore = new SessionStore(MOC_DATA_DIR);
const sharedUserDataRootDir = NETIOR_SHARED_USER_DATA_ROOT ?? inferSharedUserDataRoot(MOC_DATA_DIR);
const supervisor = new SupervisorRegistry({
  globalUserAgentId: NARRE_GLOBAL_USER_AGENT_ID,
  projectUserAgentId: NARRE_PROJECT_USER_AGENT_ID,
});
const behaviorSettings = parseBehaviorSettings();
const codexSettings = parseCodexSettings();
let provider!: NarreProviderAdapter;
let runtime!: NarreRuntime;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/sessions', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId required' });
    return;
  }
  try {
    res.json(await sessionStore.listSessions(projectId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/skills', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId required' });
    return;
  }
  try {
    res.json(await runtime.listSkills(projectId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/agents', (req, res) => {
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : null;
  res.json(supervisor.listAgents(projectId));
});

app.get('/supervisor/skills', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId required' });
    return;
  }
  try {
    res.json(await runtime.listSkills(projectId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/supervisor/sessions', (_req, res) => {
  res.json(supervisor.listSessions());
});

app.get('/supervisor/events', (req, res) => {
  const afterSeq = typeof req.query.afterSeq === 'string'
    ? Number.parseInt(req.query.afterSeq, 10)
    : null;
  res.json(supervisor.listEvents(Number.isFinite(afterSeq) ? afterSeq : null));
});

app.post('/supervisor/sessions/report', (req, res) => {
  const report = req.body as Partial<SupervisorSessionReport>;
  if (!isSupervisorSessionReport(report)) {
    res.status(400).json({ error: 'invalid supervisor session report' });
    return;
  }

  res.json(supervisor.reportSession(report));
});

app.post('/sessions', async (req, res) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    res.status(400).json({ error: 'projectId required' });
    return;
  }
  try {
    res.json(await sessionStore.createSession(projectId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/sessions/:id', async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const result = projectId
      ? await sessionStore.getSession(req.params.id, projectId)
      : await sessionStore.getSessionById(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/sessions/:id', async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const deleted = projectId
      ? await sessionStore.deleteSession(req.params.id, projectId)
      : await sessionStore.deleteSessionById(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/chat/respond', async (req, res) => {
  const { sessionId, toolCallId, response } = req.body;
  if (!toolCallId) {
    res.status(400).json({ error: 'toolCallId required' });
    return;
  }
  const resolved = runtime.resolveUiCall(toolCallId, response);
  if (!resolved) {
    res.status(404).json({ error: 'No pending UI call' });
    return;
  }

  if (typeof sessionId === 'string') {
    await sessionStore.updateCardResponseById(sessionId, toolCallId, response);
  }

  res.json({ ok: true });
});

app.post('/chat', async (req, res) => {
  const { sessionId, projectId, message, mentions } = req.body as {
    sessionId?: string;
    projectId: string;
    message: string;
    mentions?: NarreMention[];
  };
  const traceId = req.get(NARRE_TRACE_HEADER) || randomUUID();
  const requestStartedAt = Date.now();
  let streamEventCount = 0;
  let responseCompleted = false;

  const emitEvent = (event: NarreStreamEvent): void => {
    streamEventCount += 1;
    console.log(
      `[narre:server] trace=${traceId} stage=sse.send seq=${streamEventCount} ${summarizeStreamEvent(event)}`,
    );
    sendSSEEvent(res, event);
  };

  if (!projectId || !message) {
    res.status(400).json({ error: 'projectId and message are required' });
    return;
  }

  const abortController = new AbortController();
  const abortRun = (): void => {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  };
  req.on('aborted', abortRun);
  res.on('close', abortRun);
  res.setHeader('X-Netior-Trace-Id', traceId);
  initSSE(res);
  res.on('close', () => {
    if (responseCompleted) {
      return;
    }

    console.warn(
      `[narre:server] trace=${traceId} stage=client.closed events=${streamEventCount} ` +
      `elapsedMs=${Date.now() - requestStartedAt}`,
    );
  });

  try {
    console.log(
      `[narre:server] trace=${traceId} stage=request.accept provider=${provider.name} ` +
      `project=${projectId} session=${sessionId ?? 'new'} ` +
      `chars=${message.length} mentions=${mentions?.length ?? 0}`,
    );

    const result = await runtime.runChat(
      { sessionId, projectId, message, mentions, traceId },
      {
        onText: (content) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'text', content });
          }
        },
        onToolStart: (tool, toolInput, toolMetadata) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'tool_start', tool, toolInput, toolMetadata });
          }
        },
        onToolEnd: (tool, toolResult, toolMetadata) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'tool_end', tool, toolResult, toolMetadata });
          }
        },
        onCard: (card) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'card', card });
          }
        },
        onError: (error) => {
          if (!abortController.signal.aborted) {
            emitEvent({ type: 'error', error });
          }
        },
      },
      abortController.signal,
    );
    if (abortController.signal.aborted || res.writableEnded) {
      return;
    }
    console.log(
      `[narre:server] trace=${traceId} stage=request.completed provider=${provider.name} ` +
      `session=${result.sessionId} events=${streamEventCount} elapsedMs=${Date.now() - requestStartedAt}`,
    );
    emitEvent({ type: 'done', sessionId: result.sessionId });
  } catch (error) {
    if (abortController.signal.aborted || res.writableEnded) {
      return;
    }
    console.error(
      `[narre:server] trace=${traceId} stage=request.error ` +
      `message=${(error as Error).stack ?? (error as Error).message}`,
    );
    emitEvent({ type: 'error', error: (error as Error).message });
    emitEvent({ type: 'done', sessionId });
  } finally {
    responseCompleted = true;
    console.log(
      `[narre:server] trace=${traceId} stage=response.end events=${streamEventCount} ` +
      `elapsedMs=${Date.now() - requestStartedAt}`,
    );
    if (!res.writableEnded) {
      endSSE(res);
    }
  }
});

async function initializeRuntime(): Promise<{ provider: NarreProviderAdapter; runtime: NarreRuntime }> {
  const provider = await createProviderAdapter(process.env.NARRE_PROVIDER ?? 'claude');
  const runtime = new NarreRuntime({
    behaviorSettings,
    provider,
    resolveMcpServerPath,
    resolvePromptMetadata: buildProjectPromptMetadata,
    resolveProjectRootDir,
    sharedUserDataRootDir,
    globalUserAgentId: NARRE_GLOBAL_USER_AGENT_ID,
    projectUserAgentId: NARRE_PROJECT_USER_AGENT_ID,
    supervisor,
    sessionStore,
  });
  return { provider, runtime };
}

function inferSharedUserDataRoot(dataDir: string): string {
  return basename(dataDir) === 'data'
    ? dirname(dataDir)
    : dataDir;
}

async function resolveProjectRootDir(projectId: string): Promise<string | null> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return project.root_dir;
}

function isSupervisorSessionReport(value: unknown): value is SupervisorSessionReport {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const report = value as Partial<SupervisorSessionReport>;
  if (typeof report.sessionId !== 'string' || report.sessionId.length === 0) {
    return false;
  }
  if (!report.agent || typeof report.agent !== 'object' || typeof report.agent.id !== 'string') {
    return false;
  }
  if (
    !report.surface
    || typeof report.surface !== 'object'
    || (report.surface.kind !== 'terminal' && report.surface.kind !== 'editor')
    || typeof report.surface.id !== 'string'
  ) {
    return false;
  }

  return true;
}

function resolveMcpServerPath(): string | null {
  const candidates = [
    join(electronResourcesPath ?? '', 'sidecars', 'netior-mcp', 'dist', 'index.cjs'),
    join(electronResourcesPath ?? '', 'sidecars', 'netior-mcp', 'dist', 'index.js'),
    join(currentDir, '../../mcp/dist/index.cjs'),
    join(currentDir, '../../mcp/dist/index.js'),
    join(currentDir, '../../netior-mcp/dist/index.cjs'),
    join(currentDir, '../../netior-mcp/dist/index.js'),
    join(currentDir, '../../../netior-mcp/dist/index.cjs'),
    join(currentDir, '../../../netior-mcp/dist/index.js'),
    join(currentDir, '../../mcp/dist-trace/index.cjs'),
    join(currentDir, '../../mcp/dist-trace/index.js'),
    join(currentDir, '../../netior-mcp/dist-trace/index.cjs'),
    join(currentDir, '../../netior-mcp/dist-trace/index.js'),
    join(currentDir, '../../../netior-mcp/dist-trace/index.cjs'),
    join(currentDir, '../../../netior-mcp/dist-trace/index.js'),
    join(process.cwd(), 'packages/netior-mcp/dist/index.cjs'),
    join(process.cwd(), 'packages/netior-mcp/dist/index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  try {
    const resolved = require.resolve('@netior/mcp');
    const unpacked = toUnpackedAsarPath(resolved);
    if (unpacked && existsSync(unpacked)) {
      return unpacked;
    }
    if (existsSync(resolved)) {
      return resolved;
    }
  } catch {
    // Ignore and fall through to null.
  }

  return null;
}

function toUnpackedAsarPath(resolvedPath: string): string | null {
  const marker = `${process.platform === 'win32' ? '\\' : '/'}app.asar${process.platform === 'win32' ? '\\' : '/'}`;
  if (!resolvedPath.includes(marker)) {
    return null;
  }

  return resolvedPath.replace(marker, marker.replace('app.asar', 'app.asar.unpacked'));
}

async function createProviderAdapter(providerName: string): Promise<NarreProviderAdapter> {
  switch (providerName) {
    case 'claude':
      return new ClaudeProviderAdapter();
    case 'openai': {
      const { OpenAIProviderAdapter } = await import('./providers/openai.js');
      return new OpenAIProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: process.env.NARRE_OPENAI_MODEL,
      });
    }
    case 'codex': {
      const { CodexProviderAdapter } = await import('./providers/codex.js');
      return new CodexProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: process.env.NARRE_CODEX_MODEL,
        runtimeSettings: codexSettings,
      });
    }
    default:
      throw new Error(`Unsupported Narre provider: ${providerName}`);
  }
}

function parseBehaviorSettings(): NarreBehaviorSettings {
  const raw = process.env.NARRE_BEHAVIOR_SETTINGS_JSON;
  if (!raw) {
    return normalizeNarreBehaviorSettings(undefined);
  }

  try {
    return normalizeNarreBehaviorSettings(JSON.parse(raw));
  } catch (error) {
    console.warn(`[narre] Failed to parse NARRE_BEHAVIOR_SETTINGS_JSON: ${(error as Error).message}`);
    return normalizeNarreBehaviorSettings(undefined);
  }
}

function parseCodexSettings(): NarreCodexSettings {
  const raw = process.env.NARRE_CODEX_SETTINGS_JSON;
  if (!raw) {
    return getDefaultCodexSettings();
  }

  try {
    return normalizeCodexSettings(JSON.parse(raw));
  } catch (error) {
    console.warn(`[narre] Failed to parse NARRE_CODEX_SETTINGS_JSON: ${(error as Error).message}`);
    return getDefaultCodexSettings();
  }
}

function normalizeCodexSettings(value: unknown): NarreCodexSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return getDefaultCodexSettings();
  }

  const source = value as Record<string, unknown>;
  return {
    model: typeof source.model === 'string' ? source.model.trim() : '',
    useProjectRootAsWorkingDirectory: source.useProjectRootAsWorkingDirectory !== false,
    sandboxMode: source.sandboxMode === 'workspace-write' || source.sandboxMode === 'danger-full-access'
      ? source.sandboxMode
      : 'read-only',
    approvalPolicy: source.approvalPolicy === 'untrusted' || source.approvalPolicy === 'never'
      ? source.approvalPolicy
      : 'on-request',
    enableShellTool: source.enableShellTool === true,
    enableMultiAgent: source.enableMultiAgent === true,
    enableWebSearch: source.enableWebSearch === true,
    enableViewImage: source.enableViewImage === true,
    enableApps: source.enableApps === true,
  };
}

function getDefaultCodexSettings(): NarreCodexSettings {
  return {
    model: '',
    useProjectRootAsWorkingDirectory: true,
    sandboxMode: 'read-only',
    approvalPolicy: 'on-request',
    enableShellTool: false,
    enableMultiAgent: false,
    enableWebSearch: false,
    enableViewImage: false,
    enableApps: false,
  };
}

async function main(): Promise<void> {
  ({ provider, runtime } = await initializeRuntime());

  app.listen(PORT, () => {
    console.log(`Narre server listening on port ${PORT}`);
    console.log(`Provider: ${provider.name}`);
    console.log(`Data directory: ${MOC_DATA_DIR}`);
  });
}

void main().catch((error) => {
  console.error('[narre] Startup failed:', error);
  process.exit(1);
});

export type { };
