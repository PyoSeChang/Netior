import { copyFileSync, existsSync } from 'fs';
import { basename, join, resolve } from 'path';
import type { SeedContext } from '../../src/types.js';

export default async function seed(ctx: SeedContext): Promise<void> {
  const sourcePdf = resolve(ctx.scenarioDir, '..', '..', '..', '..', 'Think Data Structure.pdf');
  if (!existsSync(sourcePdf)) {
    throw new Error(`Fixture PDF not found: ${sourcePdf}`);
  }

  const fileName = basename(sourcePdf);
  const targetPdf = join(ctx.tempDir, fileName);
  copyFileSync(sourcePdf, targetPdf);

  const project = await ctx.createProject({
    name: 'Think Data Structure Indexing',
    root_dir: ctx.tempDir,
  });
  await ctx.createModule({
    project_id: project.id,
    name: 'Ontology',
    path: ctx.tempDir,
  });
  const file = await ctx.createFileEntity({
    project_id: project.id,
    path: fileName,
    type: 'file',
  });

  ctx.setTemplateVars({
    file_id: file.id,
    file_id_json: JSON.stringify(file.id),
    file_name: fileName,
    file_path: targetPdf,
    file_path_json: JSON.stringify(targetPdf),
  });
}
