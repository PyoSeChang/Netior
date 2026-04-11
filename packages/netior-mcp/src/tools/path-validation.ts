import { getProjectById, listModules } from '../netior-service-client.js';
import { resolve } from 'path';

export async function getAllowedPaths(projectId: string): Promise<string[]> {
  return (await listModules(projectId)).map((module) => resolve(module.path));
}

export function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  const resolved = resolve(targetPath);
  return allowedPaths.some(allowed =>
    resolved === allowed || resolved.startsWith(allowed + '/') || resolved.startsWith(allowed + '\\')
  );
}

/**
 * Returns allowed paths array on success, or error message string on failure.
 * Validates against registered module paths.
 */
export async function validatePath(projectId: string, targetPath: string): Promise<string[] | string> {
  const allowed = await getAllowedPaths(projectId);
  if (allowed.length === 0) return 'No module paths registered for this project';
  if (!isPathAllowed(targetPath, allowed)) return 'Path is outside registered module paths';
  return allowed;
}

/**
 * Validates that a path is under the project's root directory.
 * Use this for file-entity-based operations where the file may not be under a module directory.
 * Returns null on success, or error message string on failure.
 */
export async function validateProjectRootPath(projectId: string, targetPath: string): Promise<string | null> {
  const project = await getProjectById(projectId);
  if (!project) return `Project not found: ${projectId}`;
  const rootDir = resolve(project.root_dir);
  const resolved = resolve(targetPath);
  if (resolved === rootDir || resolved.startsWith(rootDir + '/') || resolved.startsWith(rootDir + '\\')) {
    return null;
  }
  return 'Path is outside the project root directory';
}
