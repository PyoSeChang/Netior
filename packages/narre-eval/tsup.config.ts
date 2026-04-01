import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'better-sqlite3',
    '@netior/core',
    '@netior/shared',
    '@anthropic-ai/sdk',
  ],
});
