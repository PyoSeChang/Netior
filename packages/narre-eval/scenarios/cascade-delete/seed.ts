import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const project = await ctx.createProject({
    name: '조선시대',
    root_dir: ctx.tempDir,
  });

  const archetype = await ctx.createArchetype({
    project_id: project.id,
    name: '인물',
    icon: 'user',
    color: '#4A90D9',
  });

  await ctx.createConcept({
    project_id: project.id,
    title: '세종대왕',
    archetype_id: archetype.id,
  });
}
