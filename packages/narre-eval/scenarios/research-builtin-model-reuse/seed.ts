import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  await ctx.createProject({
    name: 'Research Model Reuse Lab',
    root_dir: ctx.tempDir,
  });
}
