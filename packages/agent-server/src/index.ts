import express from 'express';
import cors from 'cors';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { NarreMessage, NarreMention, NarreToolCall, NarreStreamEvent } from '@moc/shared/types';
import * as core from '@moc/core';
import { buildSystemPrompt } from './system-prompt.js';
import { SessionStore } from './session-store.js';
import { initSSE, sendSSEEvent, endSSE } from './streaming.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT ?? '3100', 10);
const MOC_DATA_DIR = process.env.MOC_DATA_DIR;
const MOC_DB_PATH = process.env.MOC_DB_PATH;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

if (!MOC_DATA_DIR) {
  console.error('Error: MOC_DATA_DIR environment variable is required');
  process.exit(1);
}

if (!MOC_DB_PATH) {
  console.error('Error: MOC_DB_PATH environment variable is required');
  process.exit(1);
}

// Initialize the database for system prompt building
core.initDatabase(MOC_DB_PATH);

const sessionStore = new SessionStore(MOC_DATA_DIR);
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
  if (!projectId) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }
  try {
    const sessions = await sessionStore.listSessions(projectId);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/sessions', async (req, res) => {
  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    res.status(400).json({ error: 'projectId is required in request body' });
    return;
  }
  try {
    const session = await sessionStore.createSession(projectId);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/sessions/:id', async (req, res) => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }
  try {
    const result = await sessionStore.getSession(req.params.id, projectId);
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
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'projectId query parameter is required' });
    return;
  }
  try {
    const deleted = await sessionStore.deleteSession(req.params.id, projectId);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ── Chat endpoint (SSE) ──
app.post('/chat', async (req, res) => {
  const { sessionId, projectId, message, mentions } = req.body as {
    sessionId?: string;
    projectId: string;
    message: string;
    mentions?: NarreMention[];
  };

  if (!projectId || !message) {
    res.status(400).json({ error: 'projectId and message are required' });
    return;
  }

  try {
    // 1. Resolve or create session
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const newSession = await sessionStore.createSession(projectId, message.slice(0, 60));
      activeSessionId = newSession.id;
    }

    initSSE(res);

    // 2. Build system prompt with live DB metadata
    const project = core.getProjectById(projectId);
    if (!project) {
      sendSSEEvent(res, { type: 'error', error: `Project not found: ${projectId}` });
      sendSSEEvent(res, { type: 'done' });
      endSSE(res);
      return;
    }

    const archetypes = core.listArchetypes(projectId);
    const relationTypes = core.listRelationTypes(projectId);
    const canvasTypes = core.listCanvasTypes(projectId);

    const systemPrompt = buildSystemPrompt({
      projectName: project.name,
      archetypes: archetypes.map((a) => ({
        name: a.name, icon: a.icon, color: a.color, node_shape: a.node_shape,
      })),
      relationTypes: relationTypes.map((r) => ({
        name: r.name, directed: r.directed, line_style: r.line_style, color: r.color,
      })),
      canvasTypes: canvasTypes.map((c) => ({
        name: c.name, description: c.description,
      })),
    });

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
    const userMessage: NarreMessage = {
      role: 'user',
      content: message,
      mentions: mentions,
      timestamp: new Date().toISOString(),
    };
    await sessionStore.appendMessage(activeSessionId, projectId, userMessage);

    // 5. Resolve moc-mcp server path for tool access
    let mcpServerPath: string;
    try {
      mcpServerPath = await resolveMcpServerPathSync();
    } catch (err) {
      sendSSEEvent(res, { type: 'error', error: (err as Error).message });
      sendSSEEvent(res, { type: 'done' });
      endSSE(res);
      return;
    }

    // 6. Build session-aware prompt
    const sessionData = await sessionStore.getSession(activeSessionId, projectId);
    const history = sessionData?.messages ?? [];
    const isResume = history.length > 1; // more than just the user message we just added

    const prompt = isResume
      ? processedMessage
      : `${systemPrompt}\n\n${processedMessage}`;

    // 7. Configure query options
    const queryOptions: Record<string, unknown> = {
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns: 30,
      tools: [], // no built-in tools, only MCP
      model: 'sonnet',
      mcpServers: {
        'moc': {
          command: 'node',
          args: [mcpServerPath],
          env: {
            MOC_DB_PATH: MOC_DB_PATH,
          },
        },
      },
    };

    // Session continuity
    if (isResume && activeSessionId) {
      queryOptions.resume = activeSessionId;
    } else {
      queryOptions.sessionId = activeSessionId;
    }

    // 8. Run the agent loop
    let assistantText = '';
    const toolCalls: NarreToolCall[] = [];

    try {
      for await (const msg of query({
        prompt,
        options: queryOptions as Parameters<typeof query>[0]['options'],
      })) {
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if ('text' in block && block.text) {
              sendSSEEvent(res, { type: 'text', content: block.text });
              assistantText += block.text;
            }
            if ('name' in block && block.name) {
              const toolInput = (block.input as Record<string, unknown>) ?? {};
              sendSSEEvent(res, { type: 'tool_start', tool: block.name, toolInput });
              toolCalls.push({
                tool: block.name,
                input: toolInput,
                status: 'running',
              });
            }
          }
        } else if (msg.type === 'result') {
          console.log(`[narre] Completed in ${msg.num_turns || 0} turns, cost: $${msg.total_cost_usd?.toFixed(4) || '?'}`);

          // Mark all running tool calls as success
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
      const assistantMessage: NarreMessage = {
        role: 'assistant',
        content: assistantText,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: new Date().toISOString(),
      };
      await sessionStore.appendMessage(activeSessionId, projectId, assistantMessage);
    }

    sendSSEEvent(res, { type: 'done' });
    endSSE(res);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    if (res.headersSent) {
      sendSSEEvent(res, { type: 'error', error: (error as Error).message });
      sendSSEEvent(res, { type: 'done' });
      endSSE(res);
    } else {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

/**
 * Synchronous version of MCP server path resolution.
 */
async function resolveMcpServerPathSync(): Promise<string> {
  const { existsSync } = await import('fs');
  const candidates = [
    join(__dirname, '../../moc-mcp/dist/index.js'),
    join(__dirname, '../../../moc-mcp/dist/index.js'),
    join(process.cwd(), 'packages/moc-mcp/dist/index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not find moc-mcp server. Run: pnpm --filter @moc/mcp build');
}

/**
 * Build a mention tag string from a NarreMention.
 */
function buildMentionTag(mention: NarreMention): string {
  switch (mention.type) {
    case 'concept':
      return `[concept:id=${mention.id}, title="${mention.display}"]`;
    case 'canvas':
      return `[canvas:id=${mention.id}, name="${mention.display}"]`;
    case 'edge':
      return `[edge:id=${mention.id}]`;
    case 'archetype':
      return `[archetype:id=${mention.id}, name="${mention.display}"]`;
    case 'relationType':
      return `[relationType:id=${mention.id}, name="${mention.display}"]`;
    case 'canvasType':
      return `[canvasType:id=${mention.id}, name="${mention.display}"]`;
    case 'module':
      return `[module:path="${mention.path}"]`;
    case 'file':
      return `[file:path="${mention.path}"]`;
    default:
      return mention.display;
  }
}

// ── Start server ──
app.listen(PORT, () => {
  console.log(`Narre agent-server listening on port ${PORT}`);
  console.log(`Data directory: ${MOC_DATA_DIR}`);
  console.log(`DB path: ${MOC_DB_PATH}`);
});

export type { };
