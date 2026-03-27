import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DetachedEditorShell } from './components/editor/DetachedEditorShell';
import './styles/globals.css';

function Root(): JSX.Element {
  const hash = window.location.hash;
  const detachedMatch = hash.match(/^#\/detached\/([^/]+)\/(.+)$/);

  if (detachedMatch) {
    const tabId = decodeURIComponent(detachedMatch[1]);
    const title = decodeURIComponent(detachedMatch[2]);
    return <DetachedEditorShell tabId={tabId} title={title} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
