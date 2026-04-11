import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

let activeLogFilePath: string | null = null;
let consolePatched = false;

const originalConsole: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export function initNarreLogging(dataDir: string): string {
  if (activeLogFilePath) {
    return activeLogFilePath;
  }

  const logsDir = join(dataDir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  activeLogFilePath = join(logsDir, 'narre-server.log');

  if (!consolePatched) {
    patchConsole();
    consolePatched = true;
  }

  writeLogLine('info', `logging initialized at ${activeLogFilePath}`);
  return activeLogFilePath;
}

function patchConsole(): void {
  (['log', 'info', 'warn', 'error'] as const).forEach((method) => {
    console[method] = (...args: unknown[]) => {
      originalConsole[method](...args);
      writeLogLine(method, formatArgs(args));
    };
  });
}

function writeLogLine(level: ConsoleMethod, message: string): void {
  if (!activeLogFilePath) {
    return;
  }

  try {
    appendFileSync(
      activeLogFilePath,
      `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`,
      'utf-8',
    );
  } catch {
    // Logging must never break Narre execution.
  }
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    }

    return inspect(arg, {
      depth: 5,
      breakLength: 120,
      colors: false,
    });
  }).join(' ');
}
