import type { Project, ProjectCreate, ProjectUpdate } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createProject(data: ProjectCreate): Promise<Project> {
  return unwrapIpc(await window.electron.project.create(data));
}

export async function listProjects(): Promise<Project[]> {
  return unwrapIpc(await window.electron.project.list());
}

export async function deleteProject(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.project.delete(id));
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<Project> {
  return unwrapIpc(await window.electron.project.update(id, data as unknown as Record<string, unknown>));
}

export async function updateProjectRootDir(id: string, rootDir: string): Promise<Project> {
  return unwrapIpc(await window.electron.project.updateRootDir(id, rootDir));
}

export const projectService = {
  create: createProject,
  list: listProjects,
  delete: deleteProject,
  update: updateProject,
  updateRootDir: updateProjectRootDir,
};
