import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DetachedEditorShell } from './components/editor/DetachedEditorShell';
import { initTerminalTracker } from './lib/terminal-tracker';
import { initClaudeTerminalTracker } from './lib/claude-terminal-tracker';
import { initTerminalAgentNotifier } from './lib/terminal-agent-notifier';
import { initMainBridge } from './lib/editor-state-bridge';
import { initializeSettingsStore } from './stores/settings-store';
import './styles/globals.css';

const hash = window.location.hash;
const isDetached = hash.startsWith('#/detached/');

initTerminalTracker();
initClaudeTerminalTracker();
initTerminalAgentNotifier();
initializeSettingsStore();

// Main-window-only module-level init.
// Detached windows must not push their local store as the shared source of truth.
if (!isDetached) {
  initMainBridge();
}

function Root(): JSX.Element {
  if (isDetached) {
    const detachedMatch = hash.match(/^#\/detached\/([^/]+)$/);
    const hostId = decodeURIComponent(detachedMatch![1]);
    return <DetachedEditorShell hostId={hostId} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
