import type { AgentRuntimeAdapter, AgentRuntimeSink } from '../agent-runtime-manager';
import { setupClaudeSettings, setupHookScript } from '../../hook-server/hook-setup';
import { hookServer } from '../../hook-server/hook-server';

export class ClaudeHookAdapter implements AgentRuntimeAdapter {
  readonly provider = 'claude' as const;

  async start(sink: AgentRuntimeSink): Promise<void> {
    hookServer.setListeners({
      onSessionEvent: (event) => {
        sink.emitSessionEvent({
          provider: 'claude',
          sessionId: event.ptySessionId,
          surface: { kind: 'terminal', id: event.ptySessionId },
          externalSessionId: event.claudeSessionId,
          type: event.type,
        });
      },
      onStatusEvent: (event) => {
        sink.emitStatusEvent({
          provider: 'claude',
          sessionId: event.ptySessionId,
          status: event.status,
        });
      },
      onNameChanged: (event) => {
        sink.emitNameEvent({
          provider: 'claude',
          sessionId: event.ptySessionId,
          name: event.sessionName,
        });
      },
      onTurnEvent: (event) => {
        sink.emitTurnEvent(event);
      },
    });

    await hookServer.start();

    const port = hookServer.getPort();
    if (port) {
      hookServer.writePortFile();
      setupHookScript(port);
      setupClaudeSettings();
    }
  }

  stop(): void {
    hookServer.stop();
  }
}
