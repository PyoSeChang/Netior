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
const MOC_DB_PATH = process.env.MOC_DB_PATH;

if (!MOC_DATA_DIR) {
  console.error('Error: MOC_DATA_DIR environment variable is required');
  process.exit(1);
}

if (!MOC_DB_PATH) {
  console.error('Error: MOC_DB_PATH environment variable is required');
  process.exit(1);
}

const narreLogFilePath = initNarreLogging(MOC_DATA_DIR);
console.log(`[narre] Log file: ${narreLogFilePath}`);

// UI tools may block waiting for user interaction — extend stream close timeout
process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT = process.env.CLAUDE_CODE_STREAM_CLOSE_TIMEOUT || '300000';

const sessionStore = new SessionStore(MOC_DATA_DIR);
const behaviorSettings = parseBehaviorSettings();
const codexSettings = parseCodexSettings();
const provider = createProviderAdapter(process.env.NARRE_PROVIDER ?? 'claude');
const runtime = new NarreRuntime({
  mcpDbPath: MOC_DB_PATH,
  electronPath: process.env.NETIOR_ELECTRON_PATH,
  behaviorSettings,
  provider,
  resolveMcpServerPath,
  sessionStore,
});
const app = express();

app.use(cors());
app.use(express.json());

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Session endpoints ──
app.get('/sessions', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
  try {
    res.json(await sessionStore.listSessions(projectId));
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

app.post('/sessions', async (req, res) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
  try {
    res.json(await sessionStore.createSession(projectId));
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

app.get('/sessions/:id', async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const result = projectId
      ? await sessionStore.getSession(req.params.id, projectId)
      : await sessionStore.getSessionById(req.params.id);
    if (!result) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(result);
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

app.delete('/sessions/:id', async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const deleted = projectId
      ? await sessionStore.deleteSession(req.params.id, projectId)
      : await sessionStore.deleteSessionById(req.params.id);
    if (!deleted) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: (error as Error).message }); }
});

// ── UI tool response endpoint ──
app.post('/chat/respond', (req, res) => {
  const { toolCallId, response } = req.body;
  if (!toolCallId) { res.status(400).json({ error: 'toolCallId required' }); return; }
  const resolved = runtime.resolveUiCall(toolCallId, response);
  if (!resolved) { res.status(404).json({ error: 'No pending UI call' }); return; }
  res.json({ ok: true });
});

// ── System command endpoint ──
app.post('/command', async (req, res) => {
  const { projectId, command } = req.body;
  if (!projectId || !command) { res.status(400).json({ error: 'projectId and command required' }); return; }
  const parsed = parseCommand('/' + command);
  if (!parsed || parsed.command.type !== 'system') {
    res.status(400).json({ error: 'Invalid system command' });
    return;
  }
  // For now, return not implemented
  initSSE(res);
  sendSSEEvent(res, { type: 'error', error: `System command /${command} not yet implemented` });
  sendSSEEvent(res, { type: 'done' });
  endSSE(res);
});

// ── Chat endpoint (SSE) ──
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
    return;
    /*

    // 2. Build system prompt — use command-specific prompt if available
    const metadata = projectMetadata ?? {
      projectName: projectId,
      archetypes: [],
      relationTypes: [],
    };
    const commandName = parsedCommand?.command.name;
    const promptBuilder = commandName && commandPromptBuilders[commandName];
    const systemPrompt = promptBuilder
      ? promptBuilder(metadata)
      : buildSystemPrompt(metadata);

    // 3. Convert mentions to inline format
    let processedMessage = message;
    if (mentions && mentions.length > 0) {
      for (const mention of mentions) {
        const tag = buildMentionTag(mention);
        if (mention.display && processedMessage.includes(mention.display)) {
          processedMessage = processedMessage.replace(mention.display, tag);
        } else {
          processedMessage += `\n${tag}`;
        }
      }
    }

    // 4. Save user message
    await sessionStore.appendMessage(activeSessionId, projectId, {
      role: 'user',
      content: message,
      mentions,
      timestamp: new Date().toISOString(),
    });

    // 5. Resolve netior-mcp server path
    const mcpServerPath = resolveMcpServerPath();
    if (!mcpServerPath) {
      sendSSEEvent(res, { type: 'error', error: 'Could not find netior-mcp server. Run: pnpm --filter @netior/mcp build' });
      sendSSEEvent(res, { type: 'done' });
      endSSE(res);
      return;
    }

    // 6. Build prompt (system prompt on first message, just user message on resume)
    const sessionData = await sessionStore.getSession(activeSessionId, projectId);
    const history = sessionData?.messages ?? [];
    const isResume = history.length > 1;

    const prompt = isResume
      ? processedMessage
      : `${systemPrompt}\n\n${processedMessage}`;

    // 7. Configure query options
    // Use Electron binary if available (passed via NETIOR_ELECTRON_PATH) to ensure
    // native module compatibility. Falls back to 'node' for standalone usage.
    const mcpCommand = process.env.NETIOR_ELECTRON_PATH || 'node';
    const mcpEnv: Record<string, string> = { MOC_DB_PATH };
    if (process.env.NETIOR_ELECTRON_PATH) {
      mcpEnv.ELECTRON_RUN_AS_NODE = '1';
    }

    const mcpServers: Record<string, unknown> = {
      'netior': {
        command: mcpCommand,
        args: [mcpServerPath],
        env: mcpEnv,
      },
    };

    // Always include UI tools — they're needed for conversation command sessions
    // and harmless if unused in regular chat
    const uiServer = createNarreUiServer((card) => sendSSEEvent(res, { type: 'card', card }));
    mcpServers['narre-ui'] = uiServer;

    const queryOptions: Record<string, unknown> = {
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      tools: [],
      model: 'sonnet',
      mcpServers,
    };

    if (isResume && activeSessionId) {
      queryOptions.resume = activeSessionId;
    } else {
      queryOptions.sessionId = activeSessionId;
    }

    // 8. Run the agent loop
    let assistantText = '';
    const toolCalls: NarreToolCall[] = [];
    const processedMessageIds = new Set<string>();

    try {
      for await (const msg of query({
        prompt,
        options: queryOptions as Parameters<typeof query>[0]['options'],
      })) {
        if (msg.type === 'assistant' && msg.message?.content) {
          // Skip already-processed assistant messages (SDK may re-yield)
          const msgId = (msg as Record<string, unknown>).uuid as string | undefined;
          if (msgId) {
            if (processedMessageIds.has(msgId)) continue;
            processedMessageIds.add(msgId);
          }

          for (const block of msg.message.content) {
            if ('text' in block && block.text) {
              sendSSEEvent(res, { type: 'text', content: block.text });
              assistantText += block.text;
            }
            if ('name' in block && block.name) {
              const toolInput = (block.input as Record<string, unknown>) ?? {};
              sendSSEEvent(res, { type: 'tool_start', tool: block.name, toolInput });
              toolCalls.push({ tool: block.name, input: toolInput, status: 'running' });
            }
          }
        } else if (msg.type === 'result') {
          console.log(`[narre] Completed in ${msg.num_turns || 0} turns, cost: $${msg.total_cost_usd?.toFixed(4) || '?'}`);
          for (const tc of toolCalls) {
            if (tc.status === 'running') {
              tc.status = 'success';
              sendSSEEvent(res, { type: 'tool_end', tool: tc.tool, toolResult: 'completed' });
            }
          }
        }
      }
    } catch (error) {
      sendSSEEvent(res, { type: 'error', error: (error as Error).message });
    }

    // 9. Save assistant message
    if (assistantText || toolCalls.length > 0) {
      await sessionStore.appendMessage(activeSessionId, projectId, {
        role: 'assistant',
        content: assistantText,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    sendSSEEvent(res, { type: 'done', sessionId: activeSessionId });
    endSSE(res);
    */
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
  console.log(`MCP DB path: ${MOC_DB_PATH}`);
});

export type { };
