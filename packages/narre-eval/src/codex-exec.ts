import { spawn } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface CodexStructuredTaskOptions {
  prompt: string;
  schema: Record<string, unknown>;
  model?: string;
  workingDirectory?: string;
}

export interface CodexTextTaskOptions {
  prompt: string;
  model?: string;
  workingDirectory?: string;
  sessionId?: string;
}

export interface CodexTextTaskResult {
  text: string;
  sessionId?: string;
}

export async function runCodexStructuredTask<T>(
  options: CodexStructuredTaskOptions,
): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'narre-eval-codex-'));
  const outputPath = join(tempDir, `output-${randomUUID()}.json`);
  const schemaPath = join(tempDir, `schema-${randomUUID()}.json`);

  writeFileSync(schemaPath, JSON.stringify(options.schema, null, 2), 'utf-8');

  try {
    await execCodex(options.prompt, outputPath, schemaPath, options.model, options.workingDirectory);
    const raw = readFileSync(outputPath, 'utf-8');
    return JSON.parse(raw) as T;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function runCodexTextTask(
  options: CodexTextTaskOptions,
): Promise<CodexTextTaskResult> {
  const tempDir = mkdtempSync(join(tmpdir(), 'narre-eval-codex-'));
  const outputPath = join(tempDir, `output-${randomUUID()}.md`);

  try {
    const sessionId = await execCodex(
      options.prompt,
      outputPath,
      undefined,
      options.model,
      options.workingDirectory,
      options.sessionId,
    );
    return {
      text: readFileSync(outputPath, 'utf-8'),
      sessionId,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function execCodex(
  prompt: string,
  outputPath: string,
  schemaPath: string | undefined,
  model?: string,
  workingDirectory?: string,
  sessionId?: string,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const args = sessionId
      ? [
          'exec',
          'resume',
          '--json',
          '--skip-git-repo-check',
          '--color',
          'never',
          '--output-last-message',
          outputPath,
          sessionId,
        ]
      : [
          'exec',
          '--json',
          '--skip-git-repo-check',
          '--color',
          'never',
          '--output-last-message',
          outputPath,
          '-C',
          workingDirectory || process.cwd(),
          '-s',
          'read-only',
        ];

    if (schemaPath) {
      args.splice(sessionId ? 7 : 7, 0, '--output-schema', schemaPath);
    }

    if (model && model.trim().length > 0) {
      args.push('-m', model.trim());
    }

    args.push('-');

    const child = spawn(buildCodexCommand(), buildCodexArgs(args), {
      cwd: workingDirectory || process.cwd(),
      env: {
        ...process.env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    let stdout = '';
    let resolvedSessionId: string | undefined;

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) {
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed) as { type?: string; thread_id?: string };
          if (parsed.type === 'thread.started' && typeof parsed.thread_id === 'string') {
            resolvedSessionId = parsed.thread_id;
          }
        } catch {
          // Ignore non-JSON or partial lines in stdout.
        }
      }
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(resolvedSessionId ?? sessionId);
        return;
      }

      reject(new Error(
        `Codex task exited with code ${code}. ${stderr.trim() || stdout.trim() || 'No output'}`,
      ));
    });

    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}

function buildCodexCommand(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'C:\\WINDOWS\\System32\\cmd.exe';
  }
  return 'codex';
}

function buildCodexArgs(args: string[]): string[] {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', 'codex', ...args];
  }
  return args;
}
