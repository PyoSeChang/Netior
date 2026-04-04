import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { useModuleStore } from '../../stores/module-store';
import { useProjectStore } from '../../stores/project-store';

function resolveTerminalCwd(): string | undefined {
  return useModuleStore.getState().directories[0]?.dir_path
    ?? useProjectStore.getState().currentProject?.root_dir
    ?? undefined;
}

export function openTerminalTab(hostId = MAIN_HOST_ID, title = 'Terminal'): void {
  const sessionId = `term-${Date.now()}`;
  const terminalCwd = resolveTerminalCwd();

  console.log(`[TerminalOpen] hostId=${hostId}, sessionId=${sessionId}, cwd=${terminalCwd ?? 'missing'}`);

  void useEditorStore.getState().openTab({
    type: 'terminal',
    targetId: sessionId,
    title,
    hostId,
    terminalCwd,
  });
}

export function getDefaultTerminalCwd(): string | undefined {
  return resolveTerminalCwd();
}
