import http from 'http';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, watch } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { app } from 'electron';
import type { AgentTurnEvent, ClaudeNameEvent, ClaudeSessionEvent, ClaudeStatusEvent } from '@netior/shared/types';

interface SessionStartPayload {
  netior_pty_id: string;
  session_id: string | null;
}

interface SessionStopPayload {
  netior_pty_id: string;
}

interface PromptPayload {
  netior_pty_id: string;
}

interface StopPayload {
  netior_pty_id: string;
}

interface HookServerListeners {
  onSessionEvent?: (event: ClaudeSessionEvent) => void;
  onStatusEvent?: (event: ClaudeStatusEvent) => void;
  onNameChanged?: (event: ClaudeNameEvent) => void;
  onTurnEvent?: (event: AgentTurnEvent) => void;
}

/** Maps PTY session ID → Claude session file watcher */
const sessionWatchers = new Map<string, { close(): void }>();

/** Maps PTY session ID → Claude session ID */
const ptyToClaudeSession = new Map<string, string>();

class HookServer {
  private server: http.Server | null = null;
  private port: number | null = null;
  private listeners: HookServerListeners = {};

  setListeners(listeners: HookServerListeners): void {
    this.listeners = listeners;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method !== 'POST' || !req.url) {
          res.writeHead(404);
          res.end();
          return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            switch (req.url) {
              case '/hook/session-start':
                this.handleSessionStart(payload as SessionStartPayload);
                break;
              case '/hook/session-stop':
                this.handleSessionStop(payload as SessionStopPayload);
                break;
              case '/hook/prompt-submit':
                this.handlePromptSubmit(payload as PromptPayload);
                break;
              case '/hook/stop':
                this.handleStop(payload as StopPayload);
                break;
              default:
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end('{"error":"invalid payload"}');
          }
        });
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          console.log(`[HookServer] listening on 127.0.0.1:${this.port}`);
          resolve();
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      this.server.on('error', reject);
    });
  }

  getPort(): number | null {
    return this.port;
  }

  /** Write the current port to a file so hook scripts can read it dynamically */
  writePortFile(): void {
    if (!this.port) return;
    const hooksDir = join(app.getPath('userData'), 'data', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    const portFile = join(hooksDir, 'port');
    writeFileSync(portFile, String(this.port), 'utf-8');
    console.log(`[HookServer] port file written: ${portFile} → ${this.port}`);
  }

  stop(): void {
    for (const [, watcher] of sessionWatchers) watcher.close();
    sessionWatchers.clear();
    ptyToClaudeSession.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.listeners = {};
  }

  private handleSessionStart(payload: SessionStartPayload): void {
    const { netior_pty_id, session_id } = payload;
    console.log(`[HookServer] session-start: pty=${netior_pty_id} claude=${session_id}`);

    if (session_id) {
      ptyToClaudeSession.set(netior_pty_id, session_id);
    }

    this.listeners.onSessionEvent?.({
      ptySessionId: netior_pty_id,
      claudeSessionId: session_id,
      type: 'start',
    });

    // Watch the Claude session file for name changes
    if (session_id) {
      this.watchSessionFile(netior_pty_id, session_id);
    }
  }

  private handleSessionStop(payload: SessionStopPayload): void {
    const { netior_pty_id } = payload;
    console.log(`[HookServer] session-stop: pty=${netior_pty_id}`);

    // Clean up watcher
    const watcher = sessionWatchers.get(netior_pty_id);
    if (watcher) {
      watcher.close();
      sessionWatchers.delete(netior_pty_id);
    }
    ptyToClaudeSession.delete(netior_pty_id);

    this.listeners.onSessionEvent?.({
      ptySessionId: netior_pty_id,
      claudeSessionId: null,
      type: 'stop',
    });
  }

  private handlePromptSubmit(payload: PromptPayload): void {
    const { netior_pty_id } = payload;
    this.listeners.onStatusEvent?.({
      ptySessionId: netior_pty_id,
      status: 'working',
    });
    this.listeners.onTurnEvent?.({
      provider: 'claude',
      sessionId: netior_pty_id,
      type: 'start',
    });
  }

  private handleStop(payload: StopPayload): void {
    const { netior_pty_id } = payload;
    this.listeners.onStatusEvent?.({
      ptySessionId: netior_pty_id,
      status: 'idle',
    });
    this.listeners.onTurnEvent?.({
      provider: 'claude',
      sessionId: netior_pty_id,
      type: 'complete',
    });
  }

  private watchSessionFile(ptySessionId: string, claudeSessionId: string): void {
    // Clean up existing watcher
    const existing = sessionWatchers.get(ptySessionId);
    if (existing) existing.close();

    const sessionsDir = join(homedir(), '.claude', 'sessions');
    let lastKnownName: string | null = null;

    const checkName = (): void => {
      try {
        const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
        for (const file of files) {
          const filePath = join(sessionsDir, file);
          const data = JSON.parse(readFileSync(filePath, 'utf-8'));
          if (data.sessionId === claudeSessionId) {
            const name = data.name || null;
            if (name && name !== lastKnownName) {
              lastKnownName = name;
              this.listeners.onNameChanged?.({
                ptySessionId,
                sessionName: name,
              });
            }
            break;
          }
        }
      } catch {
        // sessions dir may not exist yet
      }
    };

    // Initial check
    checkName();

    // Watch for changes
    try {
      const watcher = watch(sessionsDir, { persistent: false }, (_eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          checkName();
        }
      });
      sessionWatchers.set(ptySessionId, watcher);
    } catch {
      // If the directory doesn't exist, skip watching
    }
  }

}

export const hookServer = new HookServer();
