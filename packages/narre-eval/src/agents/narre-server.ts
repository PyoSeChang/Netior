import { spawn, type ChildProcess } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NarreStreamEvent } from '@netior/shared/types';
import type { ToolCallRecord, AgentInfo } from '../types.js';
import type {
  EvalAgentAdapter,
  EvalRunContext,
  SendTurnInput,
  AdapterTurnResult,
  CardHandler,
  AgentRuntimeType,
} from './base.js';

const HEALTH_CHECK_TIMEOUT = 15_000;
const HEALTH_CHECK_INTERVAL = 500;

// ── PID file management ──

interface PidRecord {
  pid: number;
  runId: string;
  port: number;
  startedAt: string;
}

function pidFilePath(dataDir: string): string {
  return join(dataDir, 'narre-eval.pid.json');
}

function writePidFile(path: string, record: PidRecord): void {
  writeFileSync(path, JSON.stringify(record, null, 2), 'utf-8');
}

function readPidFile(path: string): PidRecord | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as PidRecord;
  } catch {
    return null;
  }
}

function removePidFile(path: string): void {
  if (existsSync(path)) {
    try { unlinkSync(path); } catch { /* ignore */ }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function probeHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure the port is available. Never kills a process we didn't spawn.
 */
async function ensurePortAvailable(port: number, pidPath: string): Promise<void> {
  const record = readPidFile(pidPath);
  if (!record) return;

  if (!isProcessAlive(record.pid)) {
    removePidFile(pidPath);
    return;
  }

  const isNarreServer = await probeHealth(record.port);
  if (isNarreServer) {
    throw new Error(
      `Another narre-server is already running on port ${record.port} ` +
      `(pid=${record.pid}, run=${record.runId.slice(0, 8)}, started=${record.startedAt}). ` +
      `Stop it first or use a different --port.`,
    );
  }

  removePidFile(pidPath);
}

// ── Adapter implementation ──

export class NarreServerAdapter implements EvalAgentAdapter {
  readonly agentId = 'narre-server';
  readonly agentName = 'Narre Server';
  readonly runtimeType: AgentRuntimeType = 'http';
  readonly capabilities = ['session_resume', 'tool_call_trace', 'card_response'];

  private process: ChildProcess | null = null;
  private baseUrl = '';
  private pidPath = '';
  private runId = '';

  getAgentInfo(): AgentInfo {
    return { id: this.agentId, name: this.agentName, runtime: this.runtimeType };
  }

  async setup(ctx: EvalRunContext): Promise<void> {
    const apiKey = ctx.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const serverPath = resolveNarreServerPath();
    if (!serverPath) {
      throw new Error('Could not find narre-server. Run: pnpm --filter @netior/narre-server build');
    }

    this.runId = ctx.runId;
    this.baseUrl = `http://localhost:${ctx.port}`;
    this.pidPath = pidFilePath(ctx.dataDir);

    await ensurePortAvailable(ctx.port, this.pidPath);
    mkdirSync(ctx.dataDir, { recursive: true });

    this.process = spawn(process.execPath, [serverPath], {
      env: {
        ...process.env,
        PORT: String(ctx.port),
        MOC_DATA_DIR: ctx.dataDir,
        NETIOR_SERVICE_URL: ctx.serviceUrl,
        ANTHROPIC_API_KEY: apiKey,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (this.process.pid) {
      writePidFile(this.pidPath, {
        pid: this.process.pid,
        runId: this.runId,
        port: ctx.port,
        startedAt: new Date().toISOString(),
      });
    }

    this.process.stdout?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`  [narre-server] ${line}`);
    });

    this.process.stderr?.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.error(`  [narre-server:err] ${line}`);
    });

    await this.waitForHealth(ctx.port);
  }

  async sendTurn(input: SendTurnInput): Promise<AdapterTurnResult> {
    const body: Record<string, unknown> = {
      projectId: input.projectId,
      message: input.message,
      projectMetadata: input.projectMetadata,
    };
    if (input.sessionId) body.sessionId = input.sessionId;
    if (input.mentions) body.mentions = input.mentions;

    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Chat request failed: ${res.status} ${res.statusText}`);
    }
    if (!res.body) {
      throw new Error('No response body (SSE stream expected)');
    }

    return this.parseSSEStream(res.body, input.onCard);
  }

  async teardown(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    removePidFile(this.pidPath);
  }

  // ── Private helpers ──

  private async submitCardResponse(toolCallId: string, response: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${this.baseUrl}/chat/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolCallId, response }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `${res.status} ${res.statusText}` };
  }

  private async waitForHealth(port: number): Promise<void> {
    const start = Date.now();
    const url = `http://localhost:${port}/health`;

    while (Date.now() - start < HEALTH_CHECK_TIMEOUT) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL));
    }

    throw new Error(`narre-server health check timed out after ${HEALTH_CHECK_TIMEOUT}ms`);
  }

  /**
   * Parse the SSE stream from /chat. Card responses are submitted inline
   * during the stream via onCard + /chat/respond so the agent can continue.
   */
  private async parseSSEStream(
    body: ReadableStream<Uint8Array>,
    onCard?: CardHandler,
  ): Promise<AdapterTurnResult> {
    const events: NarreStreamEvent[] = [];
    let assistantText = '';
    const toolCalls: ToolCallRecord[] = [];
    const errors: string[] = [];
    const pendingTools: ToolCallRecord[] = [];
    let sessionId: string | null = null;
    let cardResponseCount = 0;

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data) continue;

        let event: NarreStreamEvent;
        try {
          event = JSON.parse(data);
        } catch {
          continue;
        }

        events.push(event);

        switch (event.type) {
          case 'text':
            if (event.content) assistantText += event.content;
            break;
          case 'tool_start':
            pendingTools.push({
              tool: event.tool ?? 'unknown_tool',
              input: event.toolInput ?? {},
            });
            break;
          case 'tool_end':
            if (event.tool) {
              const pendingIndex = pendingTools.findIndex((tc) => tc.tool === event.tool);
              if (pendingIndex >= 0) {
                const [pending] = pendingTools.splice(pendingIndex, 1);
                toolCalls.push({
                  tool: pending.tool,
                  input: pending.input,
                  result: event.toolResult,
                });
                break;
              }
            }
            toolCalls.push({
              tool: event.tool ?? 'unknown_tool',
              input: {},
              result: event.toolResult,
            });
            break;
          case 'card': {
            const card = event.card;
            if (onCard && card && 'toolCallId' in card) {
              const response = onCard(card);
              const cardRes = await this.submitCardResponse(card.toolCallId, response);
              if (cardRes.ok) {
                cardResponseCount++;
              } else {
                const errMsg = `Card response failed: ${cardRes.error} (toolCallId=${card.toolCallId})`;
                assistantText += `\n[ERROR: ${errMsg}]`;
                errors.push(errMsg);
              }
            }
            break;
          }
          case 'error':
            assistantText += `\n[ERROR: ${event.error}]`;
            if (event.error) errors.push(event.error);
            break;
          case 'done':
            if (event.sessionId) {
              sessionId = event.sessionId;
            }
            break;
        }
      }
    }

    return { sessionId, assistantText, toolCalls, events, errors, cardResponseCount };
  }
}

function resolveNarreServerPath(): string | null {
  const candidates = [
    join(process.cwd(), 'packages/narre-server/dist/index.js'),
    join(process.cwd(), '../narre-server/dist/index.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}
