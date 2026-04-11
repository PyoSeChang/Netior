import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@netior/shared',
    '@modelcontextprotocol/sdk',
    /^@modelcontextprotocol\/sdk\//,
    'zod',
    'fast-glob',
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
