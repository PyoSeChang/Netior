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
import { createNetwork, listNetworks, updateNetwork, deleteNetwork, getNetworkFull, getNetworksByConceptId, getNetworkAncestors, addNetworkNode, updateNetworkNode, removeNetworkNode, createEdge, getEdge, updateEdge, deleteEdge } from '../repositories/network';
import { createFileEntity, getFileEntity, getFileEntityByPath, getFileEntitiesByProject, updateFileEntity, deleteFileEntity } from '../repositories/file';
import { createModule, listModules, updateModule, deleteModule, addModuleDirectory, listModuleDirectories, removeModuleDirectory } from '../repositories/module';
import { getEditorPrefs, upsertEditorPrefs } from '../repositories/editor-prefs';
import { createRelationType, listRelationTypes, getRelationType, updateRelationType, deleteRelationType } from '../repositories/relation-type';

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

    it('should update network viewport', () => {
      const n = createNetwork({ project_id: projectId, name: 'N' });
      const updated = updateNetwork(n.id, { viewport_zoom: 2.5, viewport_x: 100 });
      expect(updated?.viewport_zoom).toBe(2.5);
      expect(updated?.viewport_x).toBe(100);
    });

    it('should add nodes and get full network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const concept = createConcept({ project_id: projectId, title: 'Node1' });
      addNetworkNode({
        network_id: network.id,
        concept_id: concept.id,
        position_x: 50,
        position_y: 100,
      });

      const full = getNetworkFull(network.id);
      expect(full).toBeDefined();
      expect(full!.nodes).toHaveLength(1);
      expect(full!.nodes[0]!.concept!.title).toBe('Node1');
      expect(full!.nodes[0]!.position_x).toBe(50);
    });

    it('should enforce unique concept per network', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const concept = createConcept({ project_id: projectId, title: 'N' });
      addNetworkNode({ network_id: network.id, concept_id: concept.id, position_x: 0, position_y: 0 });
      expect(() =>
        addNetworkNode({ network_id: network.id, concept_id: concept.id, position_x: 10, position_y: 10 }),
      ).toThrow();
    });

    it('should create and delete edges', () => {
      const network = createNetwork({ project_id: projectId, name: 'N' });
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const n1 = addNetworkNode({ network_id: network.id, concept_id: c1.id, position_x: 0, position_y: 0 });
      const n2 = addNetworkNode({ network_id: network.id, concept_id: c2.id, position_x: 100, position_y: 0 });

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
      addNetworkNode({ network_id: network.id, concept_id: concept.id, position_x: 0, position_y: 0 });

      deleteNetwork(network.id);
      expect(getNetworkFull(network.id)).toBeUndefined();
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

  // --- Hierarchical Network ---

  describe('Hierarchical Network', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/hc' }).id;
    });

    it('should create sub-network with concept_id', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const network = createNetwork({ project_id: projectId, name: 'ML Network', concept_id: concept.id });
      expect(network.concept_id).toBe(concept.id);
    });

    it('should allow multiple networks per concept (1:N)', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const n1 = createNetwork({ project_id: projectId, name: 'Network1', concept_id: concept.id });
      const n2 = createNetwork({ project_id: projectId, name: 'Network2', concept_id: concept.id });
      expect(n1.id).not.toBe(n2.id);
      expect(n1.concept_id).toBe(concept.id);
      expect(n2.concept_id).toBe(concept.id);
    });

    it('should list root networks only when rootOnly=true', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      createNetwork({ project_id: projectId, name: 'Root' });
      createNetwork({ project_id: projectId, name: 'Sub', concept_id: concept.id });

      expect(listNetworks(projectId)).toHaveLength(2);
      expect(listNetworks(projectId, true)).toHaveLength(1);
      expect(listNetworks(projectId, true)[0].name).toBe('Root');
    });

    it('should get networks by concept id (array)', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const network = createNetwork({ project_id: projectId, name: 'Sub', concept_id: concept.id });

      const found = getNetworksByConceptId(concept.id);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(network.id);
      expect(getNetworksByConceptId('nonexistent')).toHaveLength(0);
    });

    it('should return network_count in getNetworkFull', () => {
      const root = createNetwork({ project_id: projectId, name: 'Root' });
      const c1 = createConcept({ project_id: projectId, title: 'WithSub' });
      const c2 = createConcept({ project_id: projectId, title: 'NoSub' });

      createNetwork({ project_id: projectId, name: 'Sub', concept_id: c1.id });
      addNetworkNode({ network_id: root.id, concept_id: c1.id, position_x: 0, position_y: 0 });
      addNetworkNode({ network_id: root.id, concept_id: c2.id, position_x: 100, position_y: 0 });

      const full = getNetworkFull(root.id)!;
      const withSub = full.nodes.find(n => n.concept?.title === 'WithSub');
      const noSub = full.nodes.find(n => n.concept?.title === 'NoSub');
      expect(withSub?.network_count).toBe(1);
      expect(noSub?.network_count).toBe(0);
    });

    it('should get network ancestors', () => {
      const root = createNetwork({ project_id: projectId, name: 'Root' });
      const c1 = createConcept({ project_id: projectId, title: 'ML' });
      addNetworkNode({ network_id: root.id, concept_id: c1.id, position_x: 0, position_y: 0 });

      const sub1 = createNetwork({ project_id: projectId, name: 'ML Network', concept_id: c1.id });
      const c2 = createConcept({ project_id: projectId, title: 'CNN' });
      addNetworkNode({ network_id: sub1.id, concept_id: c2.id, position_x: 0, position_y: 0 });

      const sub2 = createNetwork({ project_id: projectId, name: 'CNN Network', concept_id: c2.id });

      const ancestors = getNetworkAncestors(sub2.id);
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].networkName).toBe('Root');
      expect(ancestors[0].conceptTitle).toBeNull();
      expect(ancestors[1].networkName).toBe('ML Network');
      expect(ancestors[1].conceptTitle).toBe('ML');
      expect(ancestors[2].networkName).toBe('CNN Network');
      expect(ancestors[2].conceptTitle).toBe('CNN');
    });

    it('should cascade delete sub-network when concept is deleted', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const sub = createNetwork({ project_id: projectId, name: 'Sub', concept_id: concept.id });
      deleteConcept(concept.id);
      expect(getNetworksByConceptId(concept.id)).toHaveLength(0);
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

  describe('NetworkNode expansion', () => {
    let projectId: string;
    let networkId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/node-test' });
      projectId = project.id;
      networkId = createNetwork({ project_id: projectId, name: 'Network' }).id;
    });

    it('should add node with file_id (file)', () => {
      const file = createFileEntity({ project_id: projectId, path: 'readme.md', type: 'file' });
      const node = addNetworkNode({ network_id: networkId, file_id: file.id, position_x: 0, position_y: 0 });
      expect(node.file_id).toBe(file.id);
      expect(node.concept_id).toBeNull();
    });

    it('should add node with file_id (directory)', () => {
      const dir = createFileEntity({ project_id: projectId, path: 'docs', type: 'directory' });
      const node = addNetworkNode({ network_id: networkId, file_id: dir.id, position_x: 0, position_y: 0 });
      expect(node.file_id).toBe(dir.id);
      expect(node.concept_id).toBeNull();
    });

    it('should reject node with no concept/file', () => {
      expect(() => addNetworkNode({ network_id: networkId, position_x: 0, position_y: 0 })).toThrow();
    });

    it('should reject node with both concept and file', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      const file = createFileEntity({ project_id: projectId, path: 'x.md', type: 'file' });
      expect(() => addNetworkNode({ network_id: networkId, concept_id: concept.id, file_id: file.id, position_x: 0, position_y: 0 })).toThrow();
    });

    it('should return file nodes with file data in getNetworkFull', () => {
      const file = createFileEntity({ project_id: projectId, path: 'test.md', type: 'file' });
      addNetworkNode({ network_id: networkId, file_id: file.id, position_x: 0, position_y: 0 });
      const full = getNetworkFull(networkId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].file_id).toBe(file.id);
      expect(full.nodes[0].file?.path).toBe('test.md');
      expect(full.nodes[0].concept).toBeUndefined();
    });

    it('should support node metadata', () => {
      const file = createFileEntity({ project_id: projectId, path: 'doc.pdf', type: 'file' });
      const meta = JSON.stringify({ description: 'Reference material' });
      const node = addNetworkNode({ network_id: networkId, file_id: file.id, metadata: meta, position_x: 0, position_y: 0 });
      expect(node.metadata).toBe(meta);

      const updated = updateNetworkNode(node.id, { metadata: JSON.stringify({ description: 'Updated' }) });
      expect(JSON.parse(updated!.metadata!).description).toBe('Updated');
    });

    it('should cascade delete node when file is deleted', () => {
      const file = createFileEntity({ project_id: projectId, path: 'cascade.md', type: 'file' });
      addNetworkNode({ network_id: networkId, file_id: file.id, position_x: 0, position_y: 0 });
      deleteFileEntity(file.id);
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
      n1Id = addNetworkNode({ network_id: networkId, concept_id: c1.id, position_x: 0, position_y: 0 }).id;
      n2Id = addNetworkNode({ network_id: networkId, concept_id: c2.id, position_x: 100, position_y: 0 }).id;
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
  });
});
