import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import type { NarreBehaviorSettings, NarreCodexSettings, NarreMention } from '@netior/shared/types';
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
import { OpenAIProviderAdapter } from './providers/openai.js';
import { CodexProviderAdapter } from './providers/codex.js';
import { normalizeCodexRuntimeSettings } from './providers/openai-family/codex-transport.js';
import { initNarreLogging } from './logging.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const MOC_DATA_DIR = process.env.MOC_DATA_DIR;

if (!MOC_DATA_DIR) {
  console.error('Error: MOC_DATA_DIR environment variable is required');
  process.exit(1);
}

const narreLogFilePath = initNarreLogging(MOC_DATA_DIR);
console.log(`[narre] Log file: ${narreLogFilePath}`);

// UI tools may block waiting for user interaction, so extend stream close timeout.
process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT = process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT || '300000';

const sessionStore = new SessionStore(MOC_DATA_DIR);
const behaviorSettings = parseBehaviorSettings();
const codexSettings = parseCodexSettings();
const provider = createProviderAdapter(process.env.NARRE_PROVIDER ?? 'claude');
const runtime = new NarreRuntime({
  behaviorSettings,
  provider,
  resolveMcpServerPath,
  sessionStore,
});
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

  if (!projectId || !message) {
    res.status(400).json({ error: 'projectId and message are required' });
    return;
  }

  const parsedCommand = parseCommand(message);
  if (parsedCommand && parsedCommand.command.type === 'system') {
    res.status(400).json({ error: 'Use /command endpoint for system commands' });
    return;
  }

  initSSE(res);

  try {
    console.log(
      `[narre] Chat request provider=${provider.name} project=${projectId} session=${sessionId ?? 'new'} ` +
      `chars=${message.length} mentions=${mentions?.length ?? 0}`,
    );

    const result = await runtime.runChat(
      { sessionId, projectId, message, mentions, projectMetadata },
      {
        onText: (content) => sendSSEEvent(res, { type: 'text', content }),
        onToolStart: (tool, toolInput) => sendSSEEvent(res, { type: 'tool_start', tool, toolInput }),
        onToolEnd: (tool, toolResult) => sendSSEEvent(res, { type: 'tool_end', tool, toolResult }),
        onCard: (card) => sendSSEEvent(res, { type: 'card', card }),
        onError: (error) => sendSSEEvent(res, { type: 'error', error }),
      },
    );
    console.log(`[narre] Chat completed provider=${provider.name} session=${result.sessionId}`);
    sendSSEEvent(res, { type: 'done', sessionId: result.sessionId });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    sendSSEEvent(res, { type: 'error', error: (error as Error).message });
    sendSSEEvent(res, { type: 'done', sessionId });
  } finally {
    endSSE(res);
  }
});

function resolveMcpServerPath(): string | null {
  const candidates = [
    join(__dirname, '../../netior-mcp/dist/index.js'),
    join(__dirname, '../../../netior-mcp/dist/index.js'),
    join(process.cwd(), 'packages/netior-mcp/dist/index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function createProviderAdapter(providerName: string): NarreProviderAdapter {
  switch (providerName) {
    case 'claude':
      return new ClaudeProviderAdapter();
    case 'openai':
      return new OpenAIProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: process.env.NARRE_OPENAI_MODEL,
      });
    case 'codex':
      return new CodexProviderAdapter({
        dataDir: MOC_DATA_DIR!,
        model: process.env.NARRE_CODEX_MODEL,
        runtimeSettings: codexSettings,
      });
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
    return normalizeCodexRuntimeSettings(undefined);
  }

  try {
    return normalizeCodexRuntimeSettings(JSON.parse(raw));
  } catch (error) {
    console.warn(`[narre] Failed to parse NARRE_CODEX_SETTINGS_JSON: ${(error as Error).message}`);
    return normalizeCodexRuntimeSettings(undefined);
  }
}

app.listen(PORT, () => {
  console.log(`Narre server listening on port ${PORT}`);
  console.log(`Provider: ${provider.name}`);
  console.log(`Data directory: ${MOC_DATA_DIR}`);
});

export type { };
