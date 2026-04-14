import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import type { NarreBehaviorSettings, NarreCodexSettings, NarreMention, NarreStreamEvent } from '@netior/shared/types';
import {
  normalizeNarreBehaviorSettings,
  type SystemPromptParams,
} from './system-prompt.js';
import { SessionStore } from './session-store.js';
import { initSSE, sendSSEEvent, endSSE } from './streaming.js';
import { parseCommand } from './command-router.js';
import { NarreRuntime } from './runtime/narre-runtime.js';
import type { NarreProviderAdapter } from './runtime/provider-adapter.js';
import { ClaudeProviderAdapter } from './providers/claude.js';
import { initNarreLogging } from './logging.js';

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

app.post('/chat/respond', (req, res) => {
  const { toolCallId, response } = req.body;
  if (!toolCallId) {
    res.status(400).json({ error: 'toolCallId required' });
    return;
  }
  const resolved = runtime.resolveUiCall(toolCallId, response);
  if (!resolved) {
    res.status(404).json({ error: 'No pending UI call' });
    return;
  }
  res.json({ ok: true });
});

app.post('/command', async (req, res) => {
  const { projectId, command } = req.body;
  if (!projectId || !command) {
    res.status(400).json({ error: 'projectId and command required' });
    return;
  }
  const parsed = parseCommand('/' + command);
  if (!parsed || parsed.command.type !== 'system') {
    res.status(400).json({ error: 'Invalid system command' });
    return;
  }

  initSSE(res);
  sendSSEEvent(res, { type: 'error', error: `System command /${command} not yet implemented` });
  sendSSEEvent(res, { type: 'done' });
  endSSE(res);
});

app.post('/chat', async (req, res) => {
  const { sessionId, projectId, message, mentions, projectMetadata } = req.body as {
    sessionId?: string;
    projectId: string;
    message: string;
    mentions?: NarreMention[];
    projectMetadata?: SystemPromptParams;
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

  const parsedCommand = parseCommand(message);
  if (parsedCommand && parsedCommand.command.type === 'system') {
    res.status(400).json({ error: 'Use /command endpoint for system commands' });
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
      { sessionId, projectId, message, mentions, projectMetadata, traceId },
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
  sessionStore,
});
  return { provider, runtime };
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
