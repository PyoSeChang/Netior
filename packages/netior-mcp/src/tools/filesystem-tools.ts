import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readdirSync, readFileSync } from 'fs';
import fg from 'fast-glob';
import { getAllowedPaths, validatePath } from './path-validation.js';
import { registerNetiorTool } from './shared-tool-registry.js';

export function registerFilesystemTools(server: McpServer): void {
  registerNetiorTool(
    server,
    'list_directory',
    {
      project_id: z.string().describe('The project ID'),
      dir_path: z.string().describe('Absolute path to the directory'),
    },
    async ({ project_id, dir_path }) => {
      try {
        const validation = await validatePath(project_id, dir_path);
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

  registerNetiorTool(
    server,
    'read_file',
    {
      project_id: z.string().describe('The project ID'),
      file_path: z.string().describe('Absolute path to the file'),
      max_lines: z.number().optional().describe('Maximum number of lines to return (default 200)'),
    },
    async ({ project_id, file_path, max_lines }) => {
      try {
        const validation = await validatePath(project_id, file_path);
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

  registerNetiorTool(
    server,
    'glob_files',
    {
      project_id: z.string().describe('The project ID'),
      pattern: z.string().describe('Glob pattern (e.g. "**/*.md")'),
      base_dir: z.string().optional().describe('Optional base directory to search in'),
    },
    async ({ project_id, pattern, base_dir }) => {
      try {
        if (base_dir) {
          const validation = await validatePath(project_id, base_dir);
          if (typeof validation === 'string') {
            return {
              content: [{ type: 'text' as const, text: `Error: ${validation}` }],
              isError: true,
            };
          }
        }

        const searchPaths = base_dir
          ? [base_dir]
          : await getAllowedPaths(project_id);

        if (searchPaths.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No module paths registered for this project' }],
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

  registerNetiorTool(
    server,
    'grep_files',
    {
      project_id: z.string().describe('The project ID'),
      pattern: z.string().describe('Regex pattern to search for'),
      base_dir: z.string().optional().describe('Optional base directory to search in'),
      file_glob: z.string().optional().describe('File glob pattern (default "**/*")'),
    },
    async ({ project_id, pattern, base_dir, file_glob }) => {
      try {
        if (base_dir) {
          const validation = await validatePath(project_id, base_dir);
          if (typeof validation === 'string') {
            return {
              content: [{ type: 'text' as const, text: `Error: ${validation}` }],
              isError: true,
            };
          }
        }

        const searchPaths = base_dir
          ? [base_dir]
          : await getAllowedPaths(project_id);

        if (searchPaths.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No module paths registered for this project' }],
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
