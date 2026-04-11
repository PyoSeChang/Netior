import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@netior/shared'] })],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
        '@netior/shared': resolve('../shared/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
        '@netior/shared': resolve('../shared/src'),
        '@codingame/monaco-vscode-api/vscode/vs/base/browser/cssValue': resolve(
          'node_modules/@codingame/monaco-vscode-api/vscode/src/vs/base/browser/cssValue.js',
        ),
      },
    },
    plugins: [react()],
  },
});
