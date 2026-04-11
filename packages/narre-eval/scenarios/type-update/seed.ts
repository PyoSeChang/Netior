import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const project = await ctx.createProject({
    name: '조선시대',
    root_dir: ctx.tempDir,
  });

  ctx.createArchetype({ project_id: project.id, name: '인물', icon: 'user', color: '#4A90D9' });
  ctx.createArchetype({ project_id: project.id, name: '사건', icon: 'calendar', color: '#E74C3C' });
  ctx.createArchetype({ project_id: project.id, name: '장소', icon: 'map-pin', color: '#2ECC71' });
}
