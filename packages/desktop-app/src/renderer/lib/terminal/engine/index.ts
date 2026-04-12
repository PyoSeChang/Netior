import type { TerminalEngine } from './terminal-engine';
import { getHyperTerminalEngine } from './hyper-terminal-engine';

let activeEngine: TerminalEngine | null = null;

export function getTerminalEngine(): TerminalEngine {
  activeEngine ??= getHyperTerminalEngine();
  return activeEngine;
}

export type {
  TerminalEngine,
  TerminalEngineInstance,
  TerminalEngineLaunchConfig,
  TerminalFindResult,
  TerminalRawXterm,
  TerminalSearchController,
} from './terminal-engine';
