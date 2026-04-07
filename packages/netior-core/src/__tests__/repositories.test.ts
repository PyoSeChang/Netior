import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, getTestDb } from './test-db';

// Mock getDatabase to use test db, but keep real hasColumn/tableExists for migrations
vi.mock('../connection', async (importOriginal) => {
  const original = await importOriginal<typeof import('../connection')>();
  return {
    ...original,
    getDatabase: () => getTestDb(),
  };
});

// Import after mock
import { createProject, listProjects, deleteProject } from '../repositories/project';
import { createConcept, getConceptsByProject, updateConcept, deleteConcept, searchConcepts } from '../repositories/concept';
import {
  createNetwork, listNetworks, updateNetwork, deleteNetwork, getNetworkFull,
  getNetworkAncestors, getNetworkTree, addNetworkNode, removeNetworkNode,
  createEdge, getEdge, updateEdge, deleteEdge,
  ensureAppRootNetwork, getAppRootNetwork, getProjectRootNetwork,
} from '../repositories/network';
import {
  createLayout, getLayoutByNetwork, updateLayout, deleteLayout,
  setNodePosition, getNodePositions, removeNodePosition,
  setEdgeVisual, getEdgeVisuals, removeEdgeVisual,
} from '../repositories/layout';
import { createFileEntity, getFileEntity, getFileEntityByPath, getFileEntitiesByProject, updateFileEntity, deleteFileEntity } from '../repositories/file';
import { createModule, listModules, updateModule, deleteModule, addModuleDirectory, listModuleDirectories, removeModuleDirectory } from '../repositories/module';
import { getEditorPrefs, upsertEditorPrefs } from '../repositories/editor-prefs';
import { createRelationType, listRelationTypes, getRelationType, updateRelationType, deleteRelationType } from '../repositories/relation-type';
import { createObject, getObject, getObjectByRef, deleteObject, deleteObjectByRef } from '../repositories/objects';
import { createContext, listContexts, getContext, updateContext, deleteContext, addContextMember, removeContextMember, getContextMembers } from '../repositories/context';

describe('Repositories', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  // --- Project ---

  describe('Project', () => {
    it('should create and list projects', () => {
      const p = createProject({ name: 'Test', root_dir: '/tmp/test' });
      expect(p.id).toBeDefined();
      expect(p.name).toBe('Test');
      expect(p.root_dir).toBe('/tmp/test');

      const list = listProjects();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(p.id);
    });

    it('should delete project', () => {
      const p = createProject({ name: 'Del', root_dir: '/tmp/del' });
      expect(deleteProject(p.id)).toBe(true);
      expect(listProjects()).toHaveLength(0);
    });

    it('should reject duplicate root_dir', () => {
      createProject({ name: 'A', root_dir: '/tmp/dup' });
      expect(() => createProject({ name: 'B', root_dir: '/tmp/dup' })).toThrow();
    });

    it('should create object record when creating project', () => {
      const p = createProject({ name: 'P', root_dir: '/tmp/obj-test' });
      const obj = getObjectByRef('project', p.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('project');
      expect(obj!.scope).toBe('app');
      expect(obj!.project_id).toBeNull();
    });

    it('should delete object record when deleting project', () => {
      const p = createProject({ name: 'P', root_dir: '/tmp/obj-del' });
      deleteProject(p.id);
      expect(getObjectByRef('project', p.id)).toBeUndefined();
    });
  });

  // --- Concept ---

  describe('Concept', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/p' }).id;
    });

    it('should create and query by project', () => {
      const c = createConcept({ project_id: projectId, title: 'Hello' });
      expect(c.title).toBe('Hello');
      expect(c.project_id).toBe(projectId);

      const list = getConceptsByProject(projectId);
      expect(list).toHaveLength(1);
    });

    it('should update concept', () => {
      const c = createConcept({ project_id: projectId, title: 'Old' });
      const updated = updateConcept(c.id, { title: 'New', color: '#ff0000' });
      expect(updated?.title).toBe('New');
      expect(updated?.color).toBe('#ff0000');
    });

    it('should delete concept', () => {
      const c = createConcept({ project_id: projectId, title: 'Del' });
      expect(deleteConcept(c.id)).toBe(true);
      expect(getConceptsByProject(projectId)).toHaveLength(0);
    });

    it('should search by title', () => {
      createConcept({ project_id: projectId, title: 'Alpha' });
      createConcept({ project_id: projectId, title: 'Beta' });
      createConcept({ project_id: projectId, title: 'Alphabet' });

      expect(searchConcepts(projectId, 'alph')).toHaveLength(2);
      expect(searchConcepts(projectId, 'beta')).toHaveLength(1);
      expect(searchConcepts(projectId, 'xyz')).toHaveLength(0);
    });

    it('should cascade delete when project is deleted', () => {
      createConcept({ project_id: projectId, title: 'C1' });
      deleteProject(projectId);
      expect(getConceptsByProject(projectId)).toHaveLength(0);
    });

    it('should create object record when creating concept', () => {
      const c = createConcept({ project_id: projectId, title: 'C' });
      const obj = getObjectByRef('concept', c.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('concept');
      expect(obj!.scope).toBe('project');
      expect(obj!.project_id).toBe(projectId);
    });

    it('should delete object record when deleting concept', () => {
      const c = createConcept({ project_id: projectId, title: 'C' });
      deleteConcept(c.id);
      expect(getObjectByRef('concept', c.id)).toBeUndefined();
    });
  });

  // --- Objects ---

  describe('Objects', () => {
    it('should create and get object', () => {
      const obj = createObject('concept', 'project', null, 'ref-123');
      expect(obj.id).toBeDefined();
      expect(obj.object_type).toBe('concept');
      expect(obj.ref_id).toBe('ref-123');

      const fetched = getObject(obj.id);
      expect(fetched?.id).toBe(obj.id);
    });

    it('should get object by ref', () => {
      createObject('concept', 'project', null, 'ref-456');
      const found = getObjectByRef('concept', 'ref-456');
      expect(found?.ref_id).toBe('ref-456');
      expect(getObjectByRef('concept', 'nonexistent')).toBeUndefined();
    });

    it('should enforce unique object_type + ref_id', () => {
      createObject('concept', 'project', null, 'dup-ref');
      expect(() => createObject('concept', 'project', null, 'dup-ref')).toThrow();
    });

    it('should allow same ref_id with different object_type', () => {
      createObject('concept', 'project', null, 'shared-ref');
      expect(() => createObject('file', 'project', null, 'shared-ref')).not.toThrow();
    });

    it('should delete object', () => {
      const obj = createObject('concept', 'project', null, 'del-ref');
      expect(deleteObject(obj.id)).toBe(true);
      expect(getObject(obj.id)).toBeUndefined();
    });

    it('should delete object by ref', () => {
      createObject('concept', 'project', null, 'del-by-ref');
      expect(deleteObjectByRef('concept', 'del-by-ref')).toBe(true);
      expect(getObjectByRef('concept', 'del-by-ref')).toBeUndefined();
    });
  });

  // --- Network + Nodes + Edges ---

  describe('Network', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/p2' }).id;
    });

    it('should create and list networks', () => {
      createNetwork({ project_id: projectId, name: 'Network 1' });
      createNetwork({ project_id: projectId, name: 'Network 2' });
      expect(listNetworks(projectId)).toHaveLength(2);
    });

    it('should create network with scope and parent', () => {
      const parent = createNetwork({ project_id: projectId, name: 'Parent' });
      const child = createNetwork({ project_id: projectId, name: 'Child', parent_network_id: parent.id });
      expect(child.parent_network_id).toBe(parent.id);
      expect(child.scope).toBe('project');
    });

    it('should auto-create layout when creating network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const layout = getLayoutByNetwork(network.id);
      expect(layout).toBeDefined();
      expect(layout!.layout_type).toBe('freeform');
      expect(layout!.network_id).toBe(network.id);
    });

    it('should create object record when creating network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const obj = getObjectByRef('network', network.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('network');
      expect(obj!.scope).toBe('project');
    });

    it('should update network name', () => {
      const n = createNetwork({ project_id: projectId, name: 'Old' });
      const updated = updateNetwork(n.id, { name: 'New' });
      expect(updated?.name).toBe('New');
    });

    it('should add nodes with object_id and get full network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const concept = createConcept({ project_id: projectId, title: 'Node1' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({
        network_id: network.id,
        object_id: conceptObj.id,
      });

      // Set position via layout
      const layout = getLayoutByNetwork(network.id)!;
      setNodePosition(layout.id, node.id, JSON.stringify({ x: 50, y: 100 }));

      const full = getNetworkFull(network.id);
      expect(full).toBeDefined();
      expect(full!.nodes).toHaveLength(1);
      expect(full!.nodes[0]!.concept!.title).toBe('Node1');
      expect(full!.nodes[0]!.object!.object_type).toBe('concept');
      expect(full!.nodePositions).toHaveLength(1);
      expect(JSON.parse(full!.nodePositions[0].positionJson).x).toBe(50);
    });

    it('should enforce unique object per network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const concept = createConcept({ project_id: projectId, title: 'N' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      addNetworkNode({ network_id: network.id, object_id: conceptObj.id });
      expect(() =>
        addNetworkNode({ network_id: network.id, object_id: conceptObj.id }),
      ).toThrow();
    });

    it('should create and delete edges', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const obj1 = getObjectByRef('concept', c1.id)!;
      const obj2 = getObjectByRef('concept', c2.id)!;
      const n1 = addNetworkNode({ network_id: network.id, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: network.id, object_id: obj2.id });

      const edge = createEdge({ network_id: network.id, source_node_id: n1.id, target_node_id: n2.id });
      expect(edge.id).toBeDefined();

      const full = getNetworkFull(network.id);
      expect(full!.edges).toHaveLength(1);

      expect(deleteEdge(edge.id)).toBe(true);
      expect(getNetworkFull(network.id)!.edges).toHaveLength(0);
    });

    it('should cascade delete nodes when network is deleted', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const concept = createConcept({ project_id: projectId, title: 'N' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      addNetworkNode({ network_id: network.id, object_id: conceptObj.id });

      deleteNetwork(network.id);
      expect(getNetworkFull(network.id)).toBeUndefined();
    });
  });

  // --- Layout ---

  describe('Layout', () => {
    let projectId: string;
    let networkId: string;
    let layoutId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/layout' }).id;
      const network = createNetwork({ project_id: projectId, name: 'N' });
      networkId = network.id;
      layoutId = getLayoutByNetwork(networkId)!.id;
    });

    it('should get layout by network', () => {
      const layout = getLayoutByNetwork(networkId);
      expect(layout).toBeDefined();
      expect(layout!.network_id).toBe(networkId);
      expect(layout!.layout_type).toBe('freeform');
    });

    it('should update layout', () => {
      const viewport = JSON.stringify({ x: 100, y: 200, zoom: 1.5 });
      const updated = updateLayout(layoutId, { viewport_json: viewport, layout_type: 'force' });
      expect(updated?.viewport_json).toBe(viewport);
      expect(updated?.layout_type).toBe('force');
    });

    it('should delete layout', () => {
      expect(deleteLayout(layoutId)).toBe(true);
      expect(getLayoutByNetwork(networkId)).toBeUndefined();
    });

    it('should set and get node positions', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: conceptObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      const positions = getNodePositions(layoutId);
      expect(positions).toHaveLength(1);
      expect(positions[0].nodeId).toBe(node.id);
      expect(JSON.parse(positions[0].positionJson)).toEqual({ x: 10, y: 20 });
    });

    it('should upsert node position on conflict', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: conceptObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      setNodePosition(layoutId, node.id, JSON.stringify({ x: 30, y: 40 }));
      const positions = getNodePositions(layoutId);
      expect(positions).toHaveLength(1);
      expect(JSON.parse(positions[0].positionJson)).toEqual({ x: 30, y: 40 });
    });

    it('should remove node position', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: conceptObj.id });

      setNodePosition(layoutId, node.id, JSON.stringify({ x: 10, y: 20 }));
      expect(removeNodePosition(layoutId, node.id)).toBe(true);
      expect(getNodePositions(layoutId)).toHaveLength(0);
    });

    it('should set and get edge visuals', () => {
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const obj1 = getObjectByRef('concept', c1.id)!;
      const obj2 = getObjectByRef('concept', c2.id)!;
      const n1 = addNetworkNode({ network_id: networkId, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: networkId, object_id: obj2.id });
      const edge = createEdge({ network_id: networkId, source_node_id: n1.id, target_node_id: n2.id });

      const visual = JSON.stringify({ color: '#ff0000', lineStyle: 'dashed', directed: true });
      setEdgeVisual(layoutId, edge.id, visual);
      const visuals = getEdgeVisuals(layoutId);
      expect(visuals).toHaveLength(1);
      expect(visuals[0].edgeId).toBe(edge.id);
      expect(JSON.parse(visuals[0].visualJson)).toEqual({ color: '#ff0000', lineStyle: 'dashed', directed: true });
    });

    it('should remove edge visual', () => {
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const obj1 = getObjectByRef('concept', c1.id)!;
      const obj2 = getObjectByRef('concept', c2.id)!;
      const n1 = addNetworkNode({ network_id: networkId, object_id: obj1.id });
      const n2 = addNetworkNode({ network_id: networkId, object_id: obj2.id });
      const edge = createEdge({ network_id: networkId, source_node_id: n1.id, target_node_id: n2.id });

      setEdgeVisual(layoutId, edge.id, JSON.stringify({ color: '#00ff00' }));
      expect(removeEdgeVisual(layoutId, edge.id)).toBe(true);
      expect(getEdgeVisuals(layoutId)).toHaveLength(0);
    });

    it('should cascade delete layout_nodes when layout is deleted', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const conceptObj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: conceptObj.id });
      setNodePosition(layoutId, node.id, JSON.stringify({ x: 0, y: 0 }));

      deleteLayout(layoutId);
      // Re-create layout to query positions (original was deleted)
      const newLayout = createLayout({ contextId: 'test-ctx' });
      expect(getNodePositions(newLayout.id)).toHaveLength(0);
    });

    it('should cascade delete layout when network is deleted', () => {
      deleteNetwork(networkId);
      expect(getLayoutByNetwork(networkId)).toBeUndefined();
    });
  });

  // --- App Root / Project Root ---

  describe('App Root Network', () => {
    it('should create app root network', () => {
      const root = ensureAppRootNetwork();
      expect(root.scope).toBe('app');
      expect(root.parent_network_id).toBeNull();
      expect(root.name).toBe('App Root');
    });

    it('should return same app root on subsequent calls', () => {
      const root1 = ensureAppRootNetwork();
      const root2 = ensureAppRootNetwork();
      expect(root1.id).toBe(root2.id);
    });

    it('should get app root network', () => {
      ensureAppRootNetwork();
      const root = getAppRootNetwork();
      expect(root).toBeDefined();
      expect(root!.scope).toBe('app');
    });

    it('should get project root network', () => {
      const appRoot = ensureAppRootNetwork();
      const project = createProject({ name: 'P', root_dir: '/tmp/pr' });
      createNetwork({ project_id: project.id, name: 'Project Root', scope: 'project', parent_network_id: appRoot.id });

      const projectRoot = getProjectRootNetwork(project.id);
      expect(projectRoot).toBeDefined();
      expect(projectRoot!.parent_network_id).toBe(appRoot.id);
    });
  });

  // --- File Entity ---

  describe('FileEntity', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/p3' }).id;
    });

    it('should create and get file entity', () => {
      const f = createFileEntity({ project_id: projectId, path: 'docs/readme.md', type: 'file' });
      expect(f.path).toBe('docs/readme.md');
      expect(f.type).toBe('file');
      expect(f.metadata).toBeNull();

      const fetched = getFileEntity(f.id);
      expect(fetched?.id).toBe(f.id);
    });

    it('should get file entity by path', () => {
      createFileEntity({ project_id: projectId, path: 'src/index.ts', type: 'file' });
      const found = getFileEntityByPath(projectId, 'src/index.ts');
      expect(found?.path).toBe('src/index.ts');
      expect(getFileEntityByPath(projectId, 'nonexistent')).toBeUndefined();
    });

    it('should list by project', () => {
      createFileEntity({ project_id: projectId, path: 'a.md', type: 'file' });
      createFileEntity({ project_id: projectId, path: 'docs', type: 'directory' });
      const list = getFileEntitiesByProject(projectId);
      expect(list).toHaveLength(2);
    });

    it('should update metadata', () => {
      const f = createFileEntity({ project_id: projectId, path: 'test.pdf', type: 'file' });
      const meta = JSON.stringify({ pdf_toc: { entries: [] } });
      const updated = updateFileEntity(f.id, { metadata: meta });
      expect(updated?.metadata).toBe(meta);
    });

    it('should delete file entity', () => {
      const f = createFileEntity({ project_id: projectId, path: 'del.md', type: 'file' });
      expect(deleteFileEntity(f.id)).toBe(true);
      expect(getFileEntity(f.id)).toBeUndefined();
    });

    it('should enforce unique project_id+path', () => {
      createFileEntity({ project_id: projectId, path: 'dup.md', type: 'file' });
      expect(() => createFileEntity({ project_id: projectId, path: 'dup.md', type: 'file' })).toThrow();
    });

    it('should cascade delete when project is deleted', () => {
      createFileEntity({ project_id: projectId, path: 'cascade.md', type: 'file' });
      deleteProject(projectId);
      expect(getFileEntitiesByProject(projectId)).toHaveLength(0);
    });

    it('should create object record when creating file entity', () => {
      const f = createFileEntity({ project_id: projectId, path: 'obj.md', type: 'file' });
      const obj = getObjectByRef('file', f.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('file');
      expect(obj!.scope).toBe('project');
    });

    it('should delete object record when deleting file entity', () => {
      const f = createFileEntity({ project_id: projectId, path: 'obj-del.md', type: 'file' });
      deleteFileEntity(f.id);
      expect(getObjectByRef('file', f.id)).toBeUndefined();
    });
  });

  // --- Module ---

  describe('Module', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/mod' }).id;
    });

    it('should create and list modules', () => {
      const m = createModule({ project_id: projectId, name: 'frontend' });
      expect(m.id).toBeDefined();
      expect(m.name).toBe('frontend');

      const list = listModules(projectId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(m.id);
    });

    it('should update module name', () => {
      const m = createModule({ project_id: projectId, name: 'old' });
      const updated = updateModule(m.id, { name: 'new' });
      expect(updated?.name).toBe('new');
    });

    it('should delete module', () => {
      const m = createModule({ project_id: projectId, name: 'del' });
      expect(deleteModule(m.id)).toBe(true);
      expect(listModules(projectId)).toHaveLength(0);
    });

    it('should cascade delete when project is deleted', () => {
      createModule({ project_id: projectId, name: 'mod' });
      deleteProject(projectId);
      expect(listModules(projectId)).toHaveLength(0);
    });

    it('should add and list directories', () => {
      const m = createModule({ project_id: projectId, name: 'mod' });
      const d = addModuleDirectory({ module_id: m.id, dir_path: '/home/src' });
      expect(d.dir_path).toBe('/home/src');

      const dirs = listModuleDirectories(m.id);
      expect(dirs).toHaveLength(1);
    });

    it('should enforce unique dir_path per module', () => {
      const m = createModule({ project_id: projectId, name: 'mod' });
      addModuleDirectory({ module_id: m.id, dir_path: '/dup' });
      expect(() => addModuleDirectory({ module_id: m.id, dir_path: '/dup' })).toThrow();
    });

    it('should remove directory', () => {
      const m = createModule({ project_id: projectId, name: 'mod' });
      const d = addModuleDirectory({ module_id: m.id, dir_path: '/rm' });
      expect(removeModuleDirectory(d.id)).toBe(true);
      expect(listModuleDirectories(m.id)).toHaveLength(0);
    });

    it('should cascade delete directories when module is deleted', () => {
      const m = createModule({ project_id: projectId, name: 'mod' });
      addModuleDirectory({ module_id: m.id, dir_path: '/a' });
      addModuleDirectory({ module_id: m.id, dir_path: '/b' });
      deleteModule(m.id);
      expect(listModuleDirectories(m.id)).toHaveLength(0);
    });
  });

  // --- Hierarchical Network (parent_network_id) ---

  describe('Hierarchical Network', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/hc' }).id;
    });

    it('should create child network with parent_network_id', () => {
      const parent = createNetwork({ project_id: projectId, name: 'Root' });
      const child = createNetwork({ project_id: projectId, name: 'Child', parent_network_id: parent.id });
      expect(child.parent_network_id).toBe(parent.id);
    });

    it('should build network tree from parent_network_id', () => {
      const root = createNetwork({ project_id: projectId, name: 'Root' });
      const child1 = createNetwork({ project_id: projectId, name: 'Child1', parent_network_id: root.id });
      const child2 = createNetwork({ project_id: projectId, name: 'Child2', parent_network_id: root.id });
      createNetwork({ project_id: projectId, name: 'Grandchild', parent_network_id: child1.id });

      const tree = getNetworkTree(projectId);
      expect(tree).toHaveLength(1);
      expect(tree[0].network.name).toBe('Root');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].network.name).toBe('Grandchild');
    });

    it('should get network ancestors via parent_network_id chain', () => {
      const root = createNetwork({ project_id: projectId, name: 'Root' });
      const child = createNetwork({ project_id: projectId, name: 'Child', parent_network_id: root.id });
      const grandchild = createNetwork({ project_id: projectId, name: 'Grandchild', parent_network_id: child.id });

      const ancestors = getNetworkAncestors(grandchild.id);
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].networkName).toBe('Root');
      expect(ancestors[1].networkName).toBe('Child');
      expect(ancestors[2].networkName).toBe('Grandchild');
    });

    it('should cascade delete child networks when parent is deleted', () => {
      const parent = createNetwork({ project_id: projectId, name: 'Parent' });
      const child = createNetwork({ project_id: projectId, name: 'Child', parent_network_id: parent.id });
      deleteNetwork(parent.id);
      expect(getNetworkFull(child.id)).toBeUndefined();
    });

    it('should include layout data in getNetworkFull', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const full = getNetworkFull(network.id);
      expect(full).toBeDefined();
      expect(full!.layout).toBeDefined();
      expect(full!.layout!.layout_type).toBe('freeform');
    });
  });

  // --- Editor Prefs ---

  describe('EditorPrefs', () => {
    let conceptId: string;

    beforeEach(() => {
      const projectId = createProject({ name: 'P', root_dir: '/tmp/ep' }).id;
      conceptId = createConcept({ project_id: projectId, title: 'C' }).id;
    });

    it('should return undefined for non-existing prefs', () => {
      expect(getEditorPrefs(conceptId)).toBeUndefined();
    });

    it('should upsert prefs (insert then update)', () => {
      const p1 = upsertEditorPrefs(conceptId, { view_mode: 'float', float_x: 100 });
      expect(p1.view_mode).toBe('float');
      expect(p1.float_x).toBe(100);
      expect(p1.float_width).toBe(600);

      const p2 = upsertEditorPrefs(conceptId, { view_mode: 'side', side_split_ratio: 0.3 });
      expect(p2.view_mode).toBe('side');
      expect(p2.float_x).toBe(100); // preserved from previous
      expect(p2.side_split_ratio).toBe(0.3);
    });

    it('should get prefs after upsert', () => {
      upsertEditorPrefs(conceptId, { view_mode: 'full' });
      const prefs = getEditorPrefs(conceptId);
      expect(prefs?.view_mode).toBe('full');
    });

    it('should cascade delete when concept is deleted', () => {
      upsertEditorPrefs(conceptId, { view_mode: 'float' });
      deleteConcept(conceptId);
      expect(getEditorPrefs(conceptId)).toBeUndefined();
    });
  });

  describe('RelationType', () => {
    let projectId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/rt-test' });
      projectId = project.id;
    });

    it('should create and list relation types', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Antagonist' });
      expect(rt.name).toBe('Antagonist');
      expect(rt.line_style).toBe('solid');
      expect(rt.directed).toBe(false);
      const list = listRelationTypes(projectId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(rt.id);
    });

    it('should get single relation type', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      expect(getRelationType(rt.id)?.name).toBe('Ally');
      expect(getRelationType('nonexistent')).toBeUndefined();
    });

    it('should update relation type', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Old' });
      const updated = updateRelationType(rt.id, { name: 'New', color: '#ff0000', line_style: 'dashed', directed: true });
      expect(updated?.name).toBe('New');
      expect(updated?.color).toBe('#ff0000');
      expect(updated?.line_style).toBe('dashed');
      expect(updated?.directed).toBe(true);
    });

    it('should delete relation type', () => {
      const rt = createRelationType({ project_id: projectId, name: 'ToDelete' });
      expect(deleteRelationType(rt.id)).toBe(true);
      expect(listRelationTypes(projectId)).toHaveLength(0);
    });

    it('should cascade delete when project is deleted', () => {
      createRelationType({ project_id: projectId, name: 'CascadeTest' });
      deleteProject(projectId);
      expect(listRelationTypes(projectId)).toHaveLength(0);
    });

    it('should handle directed boolean conversion', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Directed', directed: true });
      expect(typeof rt.directed).toBe('boolean');
      expect(rt.directed).toBe(true);

      const fetched = getRelationType(rt.id);
      expect(typeof fetched?.directed).toBe('boolean');
    });

    it('should use default values when optional fields omitted', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Minimal' });
      expect(rt.line_style).toBe('solid');
      expect(rt.directed).toBe(false);
      expect(rt.description).toBeNull();
      expect(rt.color).toBeNull();
    });
  });

  describe('NetworkNode with objects', () => {
    let projectId: string;
    let networkId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/node-test' });
      projectId = project.id;
      networkId = createNetwork({ project_id: projectId, name: 'Network' }).id;
    });

    it('should add node with concept object', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const obj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id });
      expect(node.object_id).toBe(obj.id);
      expect(node.node_type).toBe('basic');
    });

    it('should add node with file object', () => {
      const file = createFileEntity({ project_id: projectId, path: 'readme.md', type: 'file' });
      const obj = getObjectByRef('file', file.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id });
      expect(node.object_id).toBe(obj.id);
      expect(node.node_type).toBe('basic');
    });

    it('should add node with custom node_type', () => {
      const concept = createConcept({ project_id: projectId, title: 'Portal' });
      const obj = getObjectByRef('concept', concept.id)!;
      const node = addNetworkNode({ network_id: networkId, object_id: obj.id, node_type: 'portal' });
      expect(node.node_type).toBe('portal');
    });

    it('should add node with parent_node_id', () => {
      const c1 = createConcept({ project_id: projectId, title: 'Parent' });
      const c2 = createConcept({ project_id: projectId, title: 'Child' });
      const obj1 = getObjectByRef('concept', c1.id)!;
      const obj2 = getObjectByRef('concept', c2.id)!;
      const parentNode = addNetworkNode({ network_id: networkId, object_id: obj1.id, node_type: 'box' });
      const childNode = addNetworkNode({ network_id: networkId, object_id: obj2.id, parent_node_id: parentNode.id });
      expect(childNode.parent_node_id).toBe(parentNode.id);
    });

    it('should return file nodes with file data in getNetworkFull', () => {
      const file = createFileEntity({ project_id: projectId, path: 'test.md', type: 'file' });
      const obj = getObjectByRef('file', file.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].object!.object_type).toBe('file');
      expect(full.nodes[0].file?.path).toBe('test.md');
      expect(full.nodes[0].concept).toBeUndefined();
    });

    it('should return concept nodes with concept data in getNetworkFull', () => {
      const concept = createConcept({ project_id: projectId, title: 'My Concept' });
      const obj = getObjectByRef('concept', concept.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].object!.object_type).toBe('concept');
      expect(full.nodes[0].concept?.title).toBe('My Concept');
      expect(full.nodes[0].file).toBeUndefined();
    });

    it('should cascade delete node when object is deleted', () => {
      const concept = createConcept({ project_id: projectId, title: 'Cascade' });
      const obj = getObjectByRef('concept', concept.id)!;
      addNetworkNode({ network_id: networkId, object_id: obj.id });
      // Deleting the concept deletes the object (via deleteObjectByRef), which cascades to network_nodes
      deleteConcept(concept.id);
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(0);
    });
  });

  describe('Edge expansion', () => {
    let projectId: string;
    let networkId: string;
    let n1Id: string;
    let n2Id: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/edge-test' });
      projectId = project.id;
      networkId = createNetwork({ project_id: projectId, name: 'Network' }).id;
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const obj1 = getObjectByRef('concept', c1.id)!;
      const obj2 = getObjectByRef('concept', c2.id)!;
      n1Id = addNetworkNode({ network_id: networkId, object_id: obj1.id }).id;
      n2Id = addNetworkNode({ network_id: networkId, object_id: obj2.id }).id;
    });

    it('should create edge with relation_type_id', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      expect(edge.relation_type_id).toBe(rt.id);
    });

    it('should create edge without relation_type_id', () => {
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id });
      expect(edge.relation_type_id).toBeNull();
    });

    it('should get edge by id', () => {
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id });
      const fetched = getEdge(edge.id);
      expect(fetched?.id).toBe(edge.id);
    });

    it('should update edge relation_type_id', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Enemy' });
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id });
      const updated = updateEdge(edge.id, { relation_type_id: rt.id });
      expect(updated?.relation_type_id).toBe(rt.id);
    });

    it('should SET NULL when relation type deleted', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Temp' });
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      deleteRelationType(rt.id);
      const fetched = getEdge(edge.id);
      expect(fetched?.relation_type_id).toBeNull();
    });

    it('should include relation_type in getNetworkFull', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Ally', color: '#00ff00', directed: true });
      createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      const full = getNetworkFull(networkId)!;
      expect(full.edges).toHaveLength(1);
      expect(full.edges[0].relation_type?.name).toBe('Ally');
      expect(full.edges[0].relation_type?.directed).toBe(true);
    });

    it('should store edge visuals in layout layer', () => {
      const edge = createEdge({ network_id: networkId, source_node_id: n1Id, target_node_id: n2Id });
      const layout = getLayoutByNetwork(networkId)!;
      setEdgeVisual(layout.id, edge.id, JSON.stringify({ color: '#ff0000', lineStyle: 'dashed' }));

      const full = getNetworkFull(networkId)!;
      expect(full.edgeVisuals).toHaveLength(1);
      expect(JSON.parse(full.edgeVisuals[0].visualJson).color).toBe('#ff0000');
    });
  });

  // --- Context ---

  describe('Context', () => {
    let projectId: string;
    let networkId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/ctx-test' });
      projectId = project.id;
      networkId = createNetwork({ project_id: projectId, name: 'Network' }).id;
    });

    it('should create and list contexts', () => {
      const ctx = createContext({ network_id: networkId, name: 'View A' });
      expect(ctx.id).toBeDefined();
      expect(ctx.name).toBe('View A');
      expect(ctx.network_id).toBe(networkId);
      expect(ctx.description).toBeNull();

      const list = listContexts(networkId);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(ctx.id);
    });

    it('should get context by id', () => {
      const ctx = createContext({ network_id: networkId, name: 'Ctx' });
      expect(getContext(ctx.id)?.name).toBe('Ctx');
      expect(getContext('nonexistent')).toBeUndefined();
    });

    it('should update context', () => {
      const ctx = createContext({ network_id: networkId, name: 'Old' });
      const updated = updateContext(ctx.id, { name: 'New', description: 'desc' });
      expect(updated?.name).toBe('New');
      expect(updated?.description).toBe('desc');
    });

    it('should delete context', () => {
      const ctx = createContext({ network_id: networkId, name: 'Del' });
      expect(deleteContext(ctx.id)).toBe(true);
      expect(listContexts(networkId)).toHaveLength(0);
    });

    it('should create object record when creating context', () => {
      const ctx = createContext({ network_id: networkId, name: 'ObjTest' });
      const obj = getObjectByRef('context', ctx.id);
      expect(obj).toBeDefined();
      expect(obj!.object_type).toBe('context');
      expect(obj!.scope).toBe('project');
    });

    it('should delete object record when deleting context', () => {
      const ctx = createContext({ network_id: networkId, name: 'ObjDel' });
      deleteContext(ctx.id);
      expect(getObjectByRef('context', ctx.id)).toBeUndefined();
    });

    it('should add and get context members', () => {
      const ctx = createContext({ network_id: networkId, name: 'Members' });
      const member = addContextMember(ctx.id, 'object', 'some-object-id');
      expect(member.context_id).toBe(ctx.id);
      expect(member.member_type).toBe('object');
      expect(member.member_id).toBe('some-object-id');

      const members = getContextMembers(ctx.id);
      expect(members).toHaveLength(1);
      expect(members[0].id).toBe(member.id);
    });

    it('should remove context member', () => {
      const ctx = createContext({ network_id: networkId, name: 'Rm' });
      const member = addContextMember(ctx.id, 'edge', 'some-edge-id');
      expect(removeContextMember(member.id)).toBe(true);
      expect(getContextMembers(ctx.id)).toHaveLength(0);
    });

    it('should cascade delete members when context is deleted', () => {
      const ctx = createContext({ network_id: networkId, name: 'Cascade' });
      addContextMember(ctx.id, 'object', 'obj-1');
      addContextMember(ctx.id, 'edge', 'edge-1');
      deleteContext(ctx.id);
      expect(getContextMembers(ctx.id)).toHaveLength(0);
    });

    it('should cascade delete contexts when network is deleted', () => {
      createContext({ network_id: networkId, name: 'C1' });
      createContext({ network_id: networkId, name: 'C2' });
      deleteNetwork(networkId);
      expect(listContexts(networkId)).toHaveLength(0);
    });

    it('should enforce unique context member', () => {
      const ctx = createContext({ network_id: networkId, name: 'Unique' });
      addContextMember(ctx.id, 'object', 'dup-id');
      expect(() => addContextMember(ctx.id, 'object', 'dup-id')).toThrow();
    });
  });
});
