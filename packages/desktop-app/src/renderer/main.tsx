import React from 'react';
import ReactDOM, { type Root as ReactRoot } from 'react-dom/client';
import App from './App';
import { DetachedEditorShell } from './components/editor/DetachedEditorShell';
import { ThemeLab } from './components/dev/ThemeLab';
import { initTerminalTracker } from './lib/terminal-tracker';
import { initAgentSessionStore } from './lib/agent-session-store';
import { initTerminalAgentNotifier } from './lib/terminal-agent-notifier';
import { initMainBridge } from './lib/editor-state-bridge';
import { initializeSettingsStore } from './stores/settings-store';
import './styles/globals.css';

const hash = window.location.hash;
const isDetached = hash.startsWith('#/detached/');
const isThemeLab = import.meta.env.DEV && hash.startsWith('#/theme-lab');

if (!isThemeLab) {
  initTerminalTracker();
  initAgentSessionStore();
  initTerminalAgentNotifier();
  initializeSettingsStore();
}

// Main-window-only module-level init.
// Detached windows must not push their local store as the shared source of truth.
if (!isDetached) {
  initMainBridge();
}

function Root(): JSX.Element {
  if (isThemeLab) {
    return <ThemeLab />;
  }

  if (isDetached) {
    const detachedMatch = hash.match(/^#\/detached\/([^/]+)$/);
    const hostId = decodeURIComponent(detachedMatch![1]);
    return <DetachedEditorShell hostId={hostId} />;
  }

  return <App />;
}

type RootContainer = HTMLElement & { __netiorReactRoot?: ReactRoot };

const container = document.getElementById('root') as RootContainer | null;
if (!container) {
  throw new Error('Root container not found.');
}

const root = container.__netiorReactRoot ?? (container.__netiorReactRoot = ReactDOM.createRoot(container));

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
