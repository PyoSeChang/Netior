import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { useModuleStore } from '../../stores/module-store';
import { useProjectStore } from '../../stores/project-store';
import type { TerminalLaunchConfig } from '@netior/shared/types';

function resolveTerminalCwd(): string | undefined {
  return useModuleStore.getState().directories[0]?.dir_path
    ?? useProjectStore.getState().currentProject?.root_dir
    ?? undefined;
}

interface OpenTerminalTabOptions {
  terminalCwd?: string;
  terminalLaunchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>;
}

export function openTerminalTab(
  hostId = MAIN_HOST_ID,
  title = 'Terminal',
  options: OpenTerminalTabOptions = {},
): void {
  const sessionId = `term-${Date.now()}`;
  const terminalCwd = options.terminalCwd ?? resolveTerminalCwd();

  void useEditorStore.getState().openTab({
    type: 'terminal',
    targetId: sessionId,
    title,
    hostId,
    terminalCwd,
    terminalLaunchConfig: options.terminalLaunchConfig,
  });
}

export function openCodexTab(hostId = MAIN_HOST_ID): void {
  openTerminalTab(hostId, 'Codex', {
    terminalLaunchConfig: {
      shell: 'codex',
      args: ['--no-alt-screen'],
      agent: {
        provider: 'codex',
      },
    },
  });
}

export function getDefaultTerminalCwd(): string | undefined {
  return resolveTerminalCwd();
}
