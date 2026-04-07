import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS, DEFAULTS } from '../constants';

describe('IPC_CHANNELS', () => {
  it('should have project channels', () => {
    expect(IPC_CHANNELS.PROJECT_CREATE).toBe('project:create');
    expect(IPC_CHANNELS.PROJECT_LIST).toBe('project:list');
    expect(IPC_CHANNELS.PROJECT_DELETE).toBe('project:delete');
  });

  it('should have concept channels', () => {
    expect(IPC_CHANNELS.CONCEPT_CREATE).toBe('concept:create');
    expect(IPC_CHANNELS.CONCEPT_GET_BY_PROJECT).toBe('concept:getByProject');
  });

  it('should have network channels', () => {
    expect(IPC_CHANNELS.NETWORK_CREATE).toBe('network:create');
    expect(IPC_CHANNELS.NETWORK_GET_FULL).toBe('network:getFull');
  });

  it('should have fs channels', () => {
    expect(IPC_CHANNELS.FS_READ_DIR).toBe('fs:readDir');
    expect(IPC_CHANNELS.FS_WRITE_FILE).toBe('fs:writeFile');
  });

  it('should have all channels as strings', () => {
    for (const value of Object.values(IPC_CHANNELS)) {
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^[a-zA-Z]+:[a-zA-Z]+$/);
    }
  });
});

describe('DEFAULTS', () => {
  it('should have network defaults', () => {
    expect(DEFAULTS.NETWORK_ZOOM).toBe(1.0);
    expect(DEFAULTS.NETWORK_PAN_X).toBe(0);
    expect(DEFAULTS.NETWORK_PAN_Y).toBe(0);
  });

  it('should have window defaults', () => {
    expect(DEFAULTS.WINDOW_WIDTH).toBe(1200);
    expect(DEFAULTS.WINDOW_HEIGHT).toBe(800);
  });
});
