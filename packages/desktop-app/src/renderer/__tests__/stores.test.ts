import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window.electron for renderer services
const mockElectron = {
  project: {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  },
  fileEntity: {
    getByProject: vi.fn(),
    delete: vi.fn(),
  },
  concept: {
    create: vi.fn(),
    getByProject: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  network: {
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getFull: vi.fn(),
    getTree: vi.fn(),
    getAncestors: vi.fn(),
  },
  networkNode: {
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  edge: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  layout: {
    getByNetwork: vi.fn(),
    update: vi.fn(),
  },
  layoutNode: {
    setPosition: vi.fn(),
    getPositions: vi.fn(),
    remove: vi.fn(),
  },
  layoutEdge: {
    setVisual: vi.fn(),
    getVisuals: vi.fn(),
    remove: vi.fn(),
  },
  fs: {
    readDir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    openDialog: vi.fn(),
    exists: vi.fn(),
  },
  config: {
    get: vi.fn().mockResolvedValue({ success: true, data: null }),
    set: vi.fn().mockResolvedValue({ success: true, data: true }),
  },
};

Object.defineProperty(globalThis, 'window', {
  value: { electron: mockElectron },
  writable: true,
});

// Import stores after mock
const { useProjectStore } = await import('../stores/project-store');
const { useConceptStore } = await import('../stores/concept-store');
const { useUIStore } = await import('../stores/ui-store');

describe('ProjectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });
    mockElectron.fileEntity.getByProject.mockResolvedValue({ success: true, data: [] });
    useProjectStore.setState({ projects: [], currentProject: null, loading: false, missingFiles: [], missingPathProject: null });
  });

  it('should have correct initial state', () => {
    const state = useProjectStore.getState();
    expect(state.projects).toEqual([]);
    expect(state.currentProject).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('should load projects', async () => {
    const mockProjects = [
      { id: '1', name: 'P1', root_dir: '/a', created_at: '', updated_at: '' },
    ];
    mockElectron.project.list.mockResolvedValue({ success: true, data: mockProjects });

    await useProjectStore.getState().loadProjects();
    expect(useProjectStore.getState().projects).toEqual(mockProjects);
  });

  it('should create and add project', async () => {
    const newProject = { id: '2', name: 'New', root_dir: '/b', created_at: '', updated_at: '' };
    mockElectron.project.create.mockResolvedValue({ success: true, data: newProject });

    const result = await useProjectStore.getState().createProject('New', '/b');
    expect(result).toEqual(newProject);
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it('should open and close project', async () => {
    const project = { id: '1', name: 'P', root_dir: '/x', created_at: '', updated_at: '' };
    await useProjectStore.getState().openProject(project);
    expect(useProjectStore.getState().currentProject).toEqual(project);

    useProjectStore.getState().closeProject();
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('should validate relative file entity paths against the project root', async () => {
    mockElectron.fileEntity.getByProject.mockResolvedValue({
      success: true,
      data: [{ id: 'f1', project_id: '1', path: 'docs/readme.md', type: 'file', metadata: null, created_at: '', updated_at: '' }],
    });
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });

    await useProjectStore.getState().validateFilePaths({
      id: '1',
      name: 'P',
      root_dir: 'C:/project',
      created_at: '',
      updated_at: '',
    });

    expect(mockElectron.fs.exists).toHaveBeenCalledWith('C:/project/docs/readme.md');
    expect(useProjectStore.getState().missingFiles).toEqual([]);
  });

  it('should validate absolute file entity paths without prepending the project root', async () => {
    mockElectron.fileEntity.getByProject.mockResolvedValue({
      success: true,
      data: [{ id: 'f1', project_id: '1', path: 'C:/project/docs/readme.md', type: 'file', metadata: null, created_at: '', updated_at: '' }],
    });
    mockElectron.fs.exists.mockResolvedValue({ success: true, data: true });

    await useProjectStore.getState().validateFilePaths({
      id: '1',
      name: 'P',
      root_dir: 'C:/project',
      created_at: '',
      updated_at: '',
    });

    expect(mockElectron.fs.exists).toHaveBeenCalledWith('C:/project/docs/readme.md');
    expect(useProjectStore.getState().missingFiles).toEqual([]);
  });
});

describe('ConceptStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConceptStore.setState({ concepts: [], loading: false });
  });

  it('should have correct initial state', () => {
    const state = useConceptStore.getState();
    expect(state.concepts).toEqual([]);
  });

  it('should load concepts by project', async () => {
    const mockConcepts = [
      { id: '1', project_id: 'p1', title: 'C1', color: null, icon: null, created_at: '', updated_at: '' },
    ];
    mockElectron.concept.getByProject.mockResolvedValue({ success: true, data: mockConcepts });

    await useConceptStore.getState().loadByProject('p1');
    expect(useConceptStore.getState().concepts).toEqual(mockConcepts);
  });
});

describe('UIStore', () => {
  it('should toggle workspace mode', () => {
    useUIStore.getState().setWorkspaceMode('browse');
    expect(useUIStore.getState().workspaceMode).toBe('browse');

    useUIStore.getState().setWorkspaceMode('edit');
    expect(useUIStore.getState().workspaceMode).toBe('edit');
  });

  it('should toggle sidebar', () => {
    const initial = useUIStore.getState().sidebarOpen;
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(!initial);
  });

});
