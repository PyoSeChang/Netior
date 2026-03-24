import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useProjectStore } from './stores/project-store';
import { ProjectHome } from './components/home/ProjectHome';
import { WorkspaceShell } from './components/workspace/WorkspaceShell';
import { SettingsModal } from './components/settings/SettingsModal';
import { ToastContainer } from './components/ui/Toast';

function TitleBar({ onOpenSettings }: { onOpenSettings: () => void }): JSX.Element {
  const { currentProject, closeProject } = useProjectStore();

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-subtle px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-secondary">MoC</span>
        {currentProject && (
          <>
            <span className="text-xs text-muted">/</span>
            <span className="text-sm text-default">{currentProject.name}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {currentProject && (
          <button
            className="rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-hover hover:text-default"
            onClick={closeProject}
          >
            Close Project
          </button>
        )}
        <button
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
          onClick={onOpenSettings}
        >
          <Settings size={14} />
        </button>
        <button
          className="rounded p-1 text-muted hover:bg-surface-hover"
          onClick={() => window.electron.window.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button
          className="rounded p-1 text-muted hover:bg-surface-hover"
          onClick={() => window.electron.window.maximize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>
        </button>
        <button
          className="rounded p-1 text-muted hover:bg-surface-hover hover:text-status-error"
          onClick={() => window.electron.window.close()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" /><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" /></svg>
        </button>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const { currentProject } = useProjectStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-full flex-col bg-surface-base text-default">
      <TitleBar onOpenSettings={() => setShowSettings(true)} />
      <div className="flex-1 overflow-hidden">
        {currentProject ? (
          <WorkspaceShell project={currentProject} />
        ) : (
          <ProjectHome />
        )}
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ToastContainer />
    </div>
  );
}
