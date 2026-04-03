import React from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useProjectStore } from './stores/project-store';
import { useCanvasStore } from './stores/canvas-store';
import { useUIStore } from './stores/ui-store';
import { ProjectHome } from './components/home/ProjectHome';
import { WorkspaceShell } from './components/workspace/WorkspaceShell';
import { SettingsModal } from './components/settings/SettingsModal';
import { ShortcutOverlay } from './components/shortcuts/ShortcutOverlay';
import { ToastContainer } from './components/ui/Toast';
import { initTerminalTracker } from './lib/terminal-tracker';
import { initClaudeTerminalTracker } from './lib/claude-terminal-tracker';
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';

initTerminalTracker();
initClaudeTerminalTracker();

function NetiorTitleMark(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 512 512"
      aria-hidden="true"
      className="shrink-0"
    >
      <g stroke="currentColor" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round">
        <path d="M132 170L256 108L380 170" />
        <path d="M132 342L256 404L380 342" />
        <path d="M132 170V342" opacity="0.72" />
        <path d="M380 170V342" opacity="0.72" />
        <path d="M256 108V404" opacity="0.46" />
        <path d="M132 170L256 256L380 170" />
        <path d="M132 342L256 256L380 342" />
        <path d="M132 170H380" opacity="0.36" />
        <path d="M132 342H380" opacity="0.36" />
      </g>
      <g fill="currentColor">
        <circle cx="132" cy="170" r="26" />
        <circle cx="256" cy="108" r="24" />
        <circle cx="380" cy="170" r="26" />
        <circle cx="256" cy="256" r="34" />
        <circle cx="132" cy="342" r="26" />
        <circle cx="256" cy="404" r="24" />
        <circle cx="380" cy="342" r="26" />
      </g>
      <g fill="var(--color-accent, currentColor)">
        <circle cx="256" cy="256" r="14" />
        <circle cx="256" cy="108" r="10" />
        <circle cx="256" cy="404" r="10" />
      </g>
    </svg>
  );
}

function TitleBarBreadcrumb(): JSX.Element | null {
  const { breadcrumbs, canvasHistory, navigateToBreadcrumb, navigateBack } = useCanvasStore();

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        className="flex items-center justify-center rounded p-0.5 text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={canvasHistory.length === 0}
        onClick={() => navigateBack()}
      >
        <ArrowLeft size={12} />
      </button>
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const label = crumb.conceptTitle ?? crumb.canvasName;
        return (
          <React.Fragment key={crumb.canvasId}>
            {idx > 0 && <ChevronRight size={10} className="text-muted shrink-0" />}
            {isLast ? (
              <span className="text-xs text-accent font-medium truncate max-w-[120px]">{label}</span>
            ) : (
              <button
                className="text-xs text-secondary hover:text-default hover:underline truncate max-w-[120px]"
                onClick={() => navigateToBreadcrumb(crumb.canvasId)}
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TitleBar(): JSX.Element {
  const { currentProject, closeProject } = useProjectStore();

  return (
    <div
      className="relative z-20 flex h-9 shrink-0 items-center border-b border-subtle px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: app name + project */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 text-secondary">
          <NetiorTitleMark />
          <span className="text-sm font-medium text-secondary">Netior</span>
          {import.meta.env.DEV && (
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              DEV
            </span>
          )}
        </div>
        {currentProject && (
          <>
            <span className="text-xs text-muted">/</span>
            <span className="text-sm text-default">{currentProject.name}</span>
          </>
        )}
      </div>

      {/* Center: breadcrumb */}
      <div className="flex-1 flex justify-center">
        {currentProject && <TitleBarBreadcrumb />}
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-1 shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {currentProject && (
          <button
            className="rounded px-2 py-0.5 text-xs text-muted hover:bg-surface-hover hover:text-default"
            onClick={closeProject}
          >
            Close Project
          </button>
        )}
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
  useGlobalShortcuts();

  const { currentProject } = useProjectStore();
  const {
    showSettings,
    showShortcutOverlay,
    setShowSettings,
    setShowShortcutOverlay,
  } = useUIStore();

  return (
    <div className="flex h-full flex-col bg-surface-base text-default">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        {currentProject ? (
          <WorkspaceShell project={currentProject} />
        ) : (
          <ProjectHome />
        )}
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ShortcutOverlay open={showShortcutOverlay} onClose={() => setShowShortcutOverlay(false)} />
      <ToastContainer />
    </div>
  );
}
