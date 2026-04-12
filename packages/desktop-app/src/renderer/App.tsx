import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react';
import { useProjectStore } from './stores/project-store';
import { useNetworkStore } from './stores/network-store';
import { useUIStore } from './stores/ui-store';
import { hasCachedState } from './stores/project-state-cache';
import { useI18n } from './hooks/useI18n';
import { WorkspaceShell } from './components/workspace/WorkspaceShell';
import { SettingsModal } from './components/settings/SettingsModal';
import { ShortcutOverlay } from './components/shortcuts/ShortcutOverlay';
import { ToastContainer } from './components/ui/Toast';
import { WindowControls } from './components/ui/WindowControls';
import { WindowAlwaysOnTopButton } from './components/ui/WindowAlwaysOnTopButton';
import { WindowTitleBar } from './components/ui/WindowTitleBar';
import { MissingFilesDialog } from './components/home/MissingFilesDialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';
import { useNetiorSync } from './hooks/useNetiorSync';
import { MinimizedEditorTabs } from './components/editor/MinimizedEditorTabs';

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
  const { breadcrumbs, networkHistory, navigateToBreadcrumb, navigateBack } = useNetworkStore();

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button
        className="flex items-center justify-center rounded p-0.5 text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
        disabled={networkHistory.length === 0}
        onClick={() => navigateBack()}
      >
        <ArrowLeft size={12} />
      </button>
      {breadcrumbs.map((crumb, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        const label = crumb.networkName;
        return (
          <React.Fragment key={crumb.networkId}>
            {idx > 0 && <ChevronRight size={10} className="text-muted shrink-0" />}
            {isLast ? (
              <span className="text-xs text-accent font-medium truncate max-w-[120px]">{label}</span>
            ) : (
              <button
                className="text-xs text-secondary hover:text-default hover:underline truncate max-w-[120px]"
                onClick={() => navigateToBreadcrumb(crumb.networkId)}
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

function ProjectSwitcher(): JSX.Element {
  const { t } = useI18n();
  const { projects, currentProject, openProject, closeProject, loadProjects } = useProjectStore();
  const currentNetwork = useNetworkStore((state) => state.currentNetwork);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [open]);

  // Projects with cached state (quick-switch spans)
  const cachedProjects = projects.filter((p) => p.id !== currentProject?.id && hasCachedState(p.id));
  const currentLabel = currentProject?.name ?? (currentNetwork?.scope === 'app' ? 'App Root' : t('project.noProject'));

  return (
    <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div ref={dropdownRef} className="relative">
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm text-default hover:bg-surface-hover transition-colors"
          onClick={() => setOpen(!open)}
        >
          {currentLabel}
          <ChevronDown size={12} className="text-muted" />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 z-[10020] min-w-[200px] rounded-md border border-default bg-surface-modal py-1 shadow-lg">
            {projects.map((p) => (
              <button
                key={p.id}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                  currentProject?.id === p.id ? 'text-accent bg-surface-hover' : 'text-default hover:bg-surface-hover'
                }`}
                onClick={() => { openProject(p); setOpen(false); }}
              >
                <span className="truncate flex-1">{p.name}</span>
              </button>
            ))}
            {projects.length > 0 && <div className="my-1 border-t border-subtle" />}
            <button
              className="flex w-full items-center px-3 py-1.5 text-xs text-muted hover:bg-surface-hover hover:text-default"
              onClick={() => { closeProject(); setOpen(false); }}
            >
              {t('project.goHome')}
            </button>
          </div>
        )}
      </div>
      {cachedProjects.map((p) => (
        <button
          key={p.id}
          className="rounded px-1.5 py-0.5 text-xs text-muted hover:text-default hover:bg-surface-hover transition-colors"
          onClick={() => openProject(p)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function TitleBar(): JSX.Element {
  const worktreeLabel = import.meta.env.DEV ? window.electron.app.worktreeLabel : null;

  return (
    <WindowTitleBar
      left={(
        <>
          <div className="flex items-center gap-2 text-secondary">
            <NetiorTitleMark />
            <span className="text-sm font-medium text-secondary">Netior</span>
            {import.meta.env.DEV && (
              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                DEV
              </span>
            )}
            {worktreeLabel && (
              <span
                className="max-w-[180px] truncate rounded border border-default bg-surface-card px-1.5 py-0.5 text-[10px] font-medium leading-none text-secondary"
                title={`worktree: ${worktreeLabel}`}
              >
                {worktreeLabel}
              </span>
            )}
          </div>
          <span className="text-xs text-muted">/</span>
          <ProjectSwitcher />
        </>
      )}
      center={<TitleBarBreadcrumb />}
      right={(
        <div className="flex items-stretch">
          <MinimizedEditorTabs />
          <WindowAlwaysOnTopButton />
          <WindowControls />
        </div>
      )}
    />
  );
}

export default function App(): JSX.Element {
  useGlobalShortcuts();
  const { t } = useI18n();

  const {
    currentProject,
    loadProjects,
    missingPathProject,
    resolveMissingPath,
    dismissMissingPath,
  } = useProjectStore();
  useNetiorSync(currentProject?.id ?? null);
  const {
    showSettings,
    showShortcutOverlay,
    setShowSettings,
    setShowShortcutOverlay,
  } = useUIStore();

  useEffect(() => {
    loadProjects().catch(() => {});
  }, [loadProjects]);

  return (
    <div className="flex h-full flex-col bg-surface-base text-default">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        <WorkspaceShell project={currentProject} />
      </div>
      <ConfirmDialog
        open={!!missingPathProject}
        onClose={dismissMissingPath}
        onConfirm={resolveMissingPath}
        variant="primary"
        title={t('project.missingPathTitle')}
        message={t('project.missingPathMessage', { path: missingPathProject?.root_dir ?? '' })}
        confirmLabel={t('project.selectNewPath')}
      />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <ShortcutOverlay open={showShortcutOverlay} onClose={() => setShowShortcutOverlay(false)} />
      <ToastContainer />
      <MissingFilesDialog />
    </div>
  );
}
