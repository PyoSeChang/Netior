import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createProject({
    name: 'Foreshadowing Model Workshop',
    root_dir: ctx.tempDir,
  });
}
