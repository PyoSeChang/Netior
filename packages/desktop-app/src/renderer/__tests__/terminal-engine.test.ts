import { describe, expect, it, vi } from 'vitest';

const hyperEngine = {
  kind: 'hyper' as const,
  getOrCreateTerminal: vi.fn(),
};

vi.mock('../lib/terminal/engine/hyper-terminal-engine', () => ({
  getHyperTerminalEngine: () => hyperEngine,
}));

import { getTerminalEngine } from '../lib/terminal/engine';

describe('terminal engine factory', () => {
  it('defaults to the hyper fork renderer path', () => {
    expect(getTerminalEngine()).toBe(hyperEngine);
    expect(getTerminalEngine().kind).toBe('hyper');
  });
});
