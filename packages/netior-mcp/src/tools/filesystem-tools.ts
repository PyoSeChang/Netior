import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listModules, listModuleDirectories } from '@netior/core';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import fg from 'fast-glob';

function getAllowedPaths(projectId: string): string[] {
  const modules = listModules(projectId);
  return modules.flatMap(m =>
    listModuleDirectories(m.id).map(d => resolve(d.dir_path))
  );
}

function isPathAllowed(targetPath: string, allowedPaths: string[]): boolean {
  const resolved = resolve(targetPath);
  return allowedPaths.some(allowed =>
    resolved === allowed || resolved.startsWith(allowed + '/') || resolved.startsWith(allowed + '\\')
  );
}

function validatePath(projectId: string, targetPath: string): string[] | string {
  const allowed = getAllowedPaths(projectId);
  if (allowed.length === 0) return 'No module directories registered for this project';
  if (!isPathAllowed(targetPath, allowed)) return 'Path is outside registered module directories';
  return allowed;
}

export function registerFilesystemTools(server: McpServer): void {
  server.tool(
    'list_directory',
    'List contents of a directory within registered module directories',
    {
      project_id: z.string().describe('The project ID'),
      dir_path: z.string().describe('Absolute path to the directory'),
    },
    async ({ project_id, dir_path }) => {
      try {
        const validation = validatePath(project_id, dir_path);
        if (typeof validation === 'string') {
          return {
            content: [{ type: 'text' as const, text: `Error: ${validation}` }],
            isError: true,
          };
        }

        const entries = readdirSync(dir_path, { withFileTypes: true });
        const result = entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() }));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'read_file',
    'Read contents of a file within registered module directories',
    {
      project_id: z.string().describe('The project ID'),
      file_path: z.string().describe('Absolute path to the file'),
      max_lines: z.number().optional().describe('Maximum number of lines to return (default 200)'),
    },
    async ({ project_id, file_path, max_lines }) => {
      try {
        const validation = validatePath(project_id, file_path);
        if (typeof validation === 'string') {
          return {
            content: [{ type: 'text' as const, text: `Error: ${validation}` }],
            isError: true,
          };
        }

        const content = readFileSync(file_path, 'utf-8');
        const lines = content.split('\n');
        const limit = max_lines ?? 200;
        const truncated = lines.length > limit;
        const result = {
          content: lines.slice(0, limit).join('\n'),
          totalLines: lines.length,
          truncated,
        };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'glob_files',
    'Find files matching a glob pattern within registered module directories',
    {
      project_id: z.string().describe('The project ID'),
      pattern: z.string().describe('Glob pattern (e.g. "**/*.md")'),
      base_dir: z.string().optional().describe('Optional base directory to search in'),
    },
    async ({ project_id, pattern, base_dir }) => {
      try {
        if (base_dir) {
          const validation = validatePath(project_id, base_dir);
          if (typeof validation === 'string') {
            return {
              content: [{ type: 'text' as const, text: `Error: ${validation}` }],
              isError: true,
            };
          }
        }

        const searchPaths = base_dir
          ? [base_dir]
          : getAllowedPaths(project_id);

        if (searchPaths.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No module directories registered for this project' }],
            isError: true,
          };
        }

        const results: string[] = [];
        for (const searchPath of searchPaths) {
          const matches = await fg(pattern, {
            cwd: searchPath,
            absolute: true,
            dot: false,
          });
          results.push(...matches);
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'grep_files',
    'Search file contents with a regex pattern within registered module directories',
    {
      project_id: z.string().describe('The project ID'),
      pattern: z.string().describe('Regex pattern to search for'),
      base_dir: z.string().optional().describe('Optional base directory to search in'),
      file_glob: z.string().optional().describe('File glob pattern (default "**/*")'),
    },
    async ({ project_id, pattern, base_dir, file_glob }) => {
      try {
        if (base_dir) {
          const validation = validatePath(project_id, base_dir);
          if (typeof validation === 'string') {
            return {
              content: [{ type: 'text' as const, text: `Error: ${validation}` }],
              isError: true,
            };
          }
        }

        const searchPaths = base_dir
          ? [base_dir]
          : getAllowedPaths(project_id);

        if (searchPaths.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No module directories registered for this project' }],
            isError: true,
          };
        }

        const glob = file_glob ?? '**/*';
        const regex = new RegExp(pattern);
        const matches: { file: string; line: number; content: string }[] = [];
        const LIMIT = 100;

        for (const searchPath of searchPaths) {
          if (matches.length >= LIMIT) break;

          const files = await fg(glob, {
            cwd: searchPath,
            absolute: true,
            dot: false,
            onlyFiles: true,
          });

          for (const file of files) {
            if (matches.length >= LIMIT) break;

            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matches.push({ file, line: i + 1, content: lines[i] });
                  if (matches.length >= LIMIT) break;
                }
              }
            } catch {
              // Skip binary/unreadable files
            }
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(matches, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
