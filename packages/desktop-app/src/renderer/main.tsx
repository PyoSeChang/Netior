import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DetachedEditorShell } from './components/editor/DetachedEditorShell';
import { initTerminalTracker } from './lib/terminal-tracker';
import { initClaudeTerminalTracker } from './lib/claude-terminal-tracker';
import { initTerminalAgentNotifier } from './lib/terminal-agent-notifier';
import { initMainBridge } from './lib/editor-state-bridge';
import './styles/globals.css';

const hash = window.location.hash;
const isDetached = hash.startsWith('#/detached/');

// Main-window-only module-level inits.
// MUST NOT run in detached windows — initMainBridge pushes Zustand store to
// main process cache, which would overwrite the correct state with empty state.
if (!isDetached) {
  initTerminalTracker();
  initClaudeTerminalTracker();
  initTerminalAgentNotifier();
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
