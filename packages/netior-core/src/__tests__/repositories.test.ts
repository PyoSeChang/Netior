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
import { createCanvas, listCanvases, updateCanvas, deleteCanvas, getCanvasFull, getCanvasesByConceptId, getCanvasAncestors, addCanvasNode, updateCanvasNode, removeCanvasNode, createEdge, getEdge, updateEdge, deleteEdge } from '../repositories/canvas';
import { createConceptFile, getConceptFilesByConcept, deleteConceptFile } from '../repositories/concept-file';
import { createModule, listModules, updateModule, deleteModule, addModuleDirectory, listModuleDirectories, removeModuleDirectory } from '../repositories/module';
import { getEditorPrefs, upsertEditorPrefs } from '../repositories/editor-prefs';
import { createRelationType, listRelationTypes, getRelationType, updateRelationType, deleteRelationType } from '../repositories/relation-type';
import { createCanvasType, listCanvasTypes, getCanvasType, updateCanvasType, deleteCanvasType, addAllowedRelation, removeAllowedRelationByPair, listAllowedRelations } from '../repositories/canvas-type';

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

  // --- Canvas + Nodes + Edges ---

  describe('Canvas', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/p2' }).id;
    });

    it('should create and list canvases', () => {
      createCanvas({ project_id: projectId, name: 'Canvas 1' });
      createCanvas({ project_id: projectId, name: 'Canvas 2' });
      expect(listCanvases(projectId)).toHaveLength(2);
    });

    it('should update canvas viewport', () => {
      const c = createCanvas({ project_id: projectId, name: 'C' });
      const updated = updateCanvas(c.id, { viewport_zoom: 2.5, viewport_x: 100 });
      expect(updated?.viewport_zoom).toBe(2.5);
      expect(updated?.viewport_x).toBe(100);
    });

    it('should add nodes and get full canvas', () => {
      const canvas = createCanvas({ project_id: projectId, name: 'C' });
      const concept = createConcept({ project_id: projectId, title: 'Node1' });
      addCanvasNode({
        canvas_id: canvas.id,
        concept_id: concept.id,
        position_x: 50,
        position_y: 100,
      });

      const full = getCanvasFull(canvas.id);
      expect(full).toBeDefined();
      expect(full!.nodes).toHaveLength(1);
      expect(full!.nodes[0]!.concept!.title).toBe('Node1');
      expect(full!.nodes[0]!.position_x).toBe(50);
    });

    it('should enforce unique concept per canvas', () => {
      const canvas = createCanvas({ project_id: projectId, name: 'C' });
      const concept = createConcept({ project_id: projectId, title: 'N' });
      addCanvasNode({ canvas_id: canvas.id, concept_id: concept.id, position_x: 0, position_y: 0 });
      expect(() =>
        addCanvasNode({ canvas_id: canvas.id, concept_id: concept.id, position_x: 10, position_y: 10 }),
      ).toThrow();
    });

    it('should create and delete edges', () => {
      const canvas = createCanvas({ project_id: projectId, name: 'C' });
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      const n1 = addCanvasNode({ canvas_id: canvas.id, concept_id: c1.id, position_x: 0, position_y: 0 });
      const n2 = addCanvasNode({ canvas_id: canvas.id, concept_id: c2.id, position_x: 100, position_y: 0 });

      const edge = createEdge({ canvas_id: canvas.id, source_node_id: n1.id, target_node_id: n2.id });
      expect(edge.id).toBeDefined();

      const full = getCanvasFull(canvas.id);
      expect(full!.edges).toHaveLength(1);

      expect(deleteEdge(edge.id)).toBe(true);
      expect(getCanvasFull(canvas.id)!.edges).toHaveLength(0);
    });

    it('should cascade delete nodes when canvas is deleted', () => {
      const canvas = createCanvas({ project_id: projectId, name: 'C' });
      const concept = createConcept({ project_id: projectId, title: 'N' });
      addCanvasNode({ canvas_id: canvas.id, concept_id: concept.id, position_x: 0, position_y: 0 });

      deleteCanvas(canvas.id);
      expect(getCanvasFull(canvas.id)).toBeUndefined();
    });
  });

  // --- ConceptFile ---

  describe('ConceptFile', () => {
    let projectId: string;
    let conceptId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/p3' }).id;
      conceptId = createConcept({ project_id: projectId, title: 'C' }).id;
    });

    it('should create and query files', () => {
      const f = createConceptFile({ concept_id: conceptId, file_path: 'notes.md' });
      expect(f.file_path).toBe('notes.md');

      const files = getConceptFilesByConcept(conceptId);
      expect(files).toHaveLength(1);
    });

    it('should delete file', () => {
      const f = createConceptFile({ concept_id: conceptId, file_path: 'a.md' });
      expect(deleteConceptFile(f.id)).toBe(true);
      expect(getConceptFilesByConcept(conceptId)).toHaveLength(0);
    });

    it('should enforce unique concept+file_path', () => {
      createConceptFile({ concept_id: conceptId, file_path: 'dup.md' });
      expect(() => createConceptFile({ concept_id: conceptId, file_path: 'dup.md' })).toThrow();
    });

    it('should cascade delete when concept is deleted', () => {
      createConceptFile({ concept_id: conceptId, file_path: 'x.md' });
      deleteConcept(conceptId);
      expect(getConceptFilesByConcept(conceptId)).toHaveLength(0);
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

  // --- Hierarchical Canvas ---

  describe('Hierarchical Canvas', () => {
    let projectId: string;

    beforeEach(() => {
      projectId = createProject({ name: 'P', root_dir: '/tmp/hc' }).id;
    });

    it('should create sub-canvas with concept_id', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const canvas = createCanvas({ project_id: projectId, name: 'ML Canvas', concept_id: concept.id });
      expect(canvas.concept_id).toBe(concept.id);
    });

    it('should allow multiple canvases per concept (1:N)', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const c1 = createCanvas({ project_id: projectId, name: 'Canvas1', concept_id: concept.id });
      const c2 = createCanvas({ project_id: projectId, name: 'Canvas2', concept_id: concept.id });
      expect(c1.id).not.toBe(c2.id);
      expect(c1.concept_id).toBe(concept.id);
      expect(c2.concept_id).toBe(concept.id);
    });

    it('should list root canvases only when rootOnly=true', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      createCanvas({ project_id: projectId, name: 'Root' });
      createCanvas({ project_id: projectId, name: 'Sub', concept_id: concept.id });

      expect(listCanvases(projectId)).toHaveLength(2);
      expect(listCanvases(projectId, true)).toHaveLength(1);
      expect(listCanvases(projectId, true)[0].name).toBe('Root');
    });

    it('should get canvases by concept id (array)', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const canvas = createCanvas({ project_id: projectId, name: 'Sub', concept_id: concept.id });

      const found = getCanvasesByConceptId(concept.id);
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(canvas.id);
      expect(getCanvasesByConceptId('nonexistent')).toHaveLength(0);
    });

    it('should return canvas_count in getCanvasFull', () => {
      const root = createCanvas({ project_id: projectId, name: 'Root' });
      const c1 = createConcept({ project_id: projectId, title: 'WithSub' });
      const c2 = createConcept({ project_id: projectId, title: 'NoSub' });

      createCanvas({ project_id: projectId, name: 'Sub', concept_id: c1.id });
      addCanvasNode({ canvas_id: root.id, concept_id: c1.id, position_x: 0, position_y: 0 });
      addCanvasNode({ canvas_id: root.id, concept_id: c2.id, position_x: 100, position_y: 0 });

      const full = getCanvasFull(root.id)!;
      const withSub = full.nodes.find(n => n.concept?.title === 'WithSub');
      const noSub = full.nodes.find(n => n.concept?.title === 'NoSub');
      expect(withSub?.canvas_count).toBe(1);
      expect(noSub?.canvas_count).toBe(0);
    });

    it('should get canvas ancestors', () => {
      const root = createCanvas({ project_id: projectId, name: 'Root' });
      const c1 = createConcept({ project_id: projectId, title: 'ML' });
      addCanvasNode({ canvas_id: root.id, concept_id: c1.id, position_x: 0, position_y: 0 });

      const sub1 = createCanvas({ project_id: projectId, name: 'ML Canvas', concept_id: c1.id });
      const c2 = createConcept({ project_id: projectId, title: 'CNN' });
      addCanvasNode({ canvas_id: sub1.id, concept_id: c2.id, position_x: 0, position_y: 0 });

      const sub2 = createCanvas({ project_id: projectId, name: 'CNN Canvas', concept_id: c2.id });

      const ancestors = getCanvasAncestors(sub2.id);
      expect(ancestors).toHaveLength(3);
      expect(ancestors[0].canvasName).toBe('Root');
      expect(ancestors[0].conceptTitle).toBeNull();
      expect(ancestors[1].canvasName).toBe('ML Canvas');
      expect(ancestors[1].conceptTitle).toBe('ML');
      expect(ancestors[2].canvasName).toBe('CNN Canvas');
      expect(ancestors[2].conceptTitle).toBe('CNN');
    });

    it('should cascade delete sub-canvas when concept is deleted', () => {
      const concept = createConcept({ project_id: projectId, title: 'ML' });
      const sub = createCanvas({ project_id: projectId, name: 'Sub', concept_id: concept.id });
      deleteConcept(concept.id);
      expect(getCanvasesByConceptId(concept.id)).toHaveLength(0);
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

  describe('CanvasType', () => {
    let projectId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/ct-test' });
      projectId = project.id;
    });

    it('should create and list canvas types', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Relationship Map' });
      expect(ct.name).toBe('Relationship Map');
      const list = listCanvasTypes(projectId);
      expect(list).toHaveLength(1);
    });

    it('should get, update, and delete', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Old' });
      const updated = updateCanvasType(ct.id, { name: 'New', color: '#00ff00' });
      expect(updated?.name).toBe('New');
      expect(updated?.color).toBe('#00ff00');

      expect(getCanvasType(ct.id)?.name).toBe('New');

      expect(deleteCanvasType(ct.id)).toBe(true);
      expect(listCanvasTypes(projectId)).toHaveLength(0);
    });

    it('should cascade delete when project is deleted', () => {
      createCanvasType({ project_id: projectId, name: 'CascadeTest' });
      deleteProject(projectId);
      expect(listCanvasTypes(projectId)).toHaveLength(0);
    });

    it('should add and list allowed relations', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const rt1 = createRelationType({ project_id: projectId, name: 'Ally' });
      const rt2 = createRelationType({ project_id: projectId, name: 'Enemy' });

      addAllowedRelation(ct.id, rt1.id);
      addAllowedRelation(ct.id, rt2.id);

      const allowed = listAllowedRelations(ct.id);
      expect(allowed).toHaveLength(2);
      expect(allowed.map((r) => r.name).sort()).toEqual(['Ally', 'Enemy']);
    });

    it('should enforce unique allowed relation pair', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      addAllowedRelation(ct.id, rt.id);
      expect(() => addAllowedRelation(ct.id, rt.id)).toThrow();
    });

    it('should remove allowed relation by pair', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      addAllowedRelation(ct.id, rt.id);
      expect(removeAllowedRelationByPair(ct.id, rt.id)).toBe(true);
      expect(listAllowedRelations(ct.id)).toHaveLength(0);
    });

    it('should cascade delete junction when canvas type deleted', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      addAllowedRelation(ct.id, rt.id);
      deleteCanvasType(ct.id);
      // rt should still exist
      expect(getRelationType(rt.id)).toBeDefined();
    });

    it('should cascade delete junction when relation type deleted', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      addAllowedRelation(ct.id, rt.id);
      deleteRelationType(rt.id);
      expect(listAllowedRelations(ct.id)).toHaveLength(0);
      // ct should still exist
      expect(getCanvasType(ct.id)).toBeDefined();
    });

    it('should set canvas_type_id on canvas', () => {
      const ct = createCanvasType({ project_id: projectId, name: 'Map' });
      const canvas = createCanvas({ project_id: projectId, name: 'Test Canvas', canvas_type_id: ct.id });
      expect(canvas.canvas_type_id).toBe(ct.id);
    });
  });

  describe('CanvasNode expansion', () => {
    let projectId: string;
    let canvasId: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/node-test' });
      projectId = project.id;
      canvasId = createCanvas({ project_id: projectId, name: 'Canvas' }).id;
    });

    it('should add node with file_path', () => {
      const node = addCanvasNode({ canvas_id: canvasId, file_path: '/readme.md', position_x: 0, position_y: 0 });
      expect(node.file_path).toBe('/readme.md');
      expect(node.concept_id).toBeNull();
      expect(node.dir_path).toBeNull();
    });

    it('should add node with dir_path', () => {
      const node = addCanvasNode({ canvas_id: canvasId, dir_path: '/docs', position_x: 0, position_y: 0 });
      expect(node.dir_path).toBe('/docs');
      expect(node.concept_id).toBeNull();
    });

    it('should reject node with no concept/file/dir', () => {
      expect(() => addCanvasNode({ canvas_id: canvasId, position_x: 0, position_y: 0 })).toThrow();
    });

    it('should reject node with multiple of concept/file/dir', () => {
      const concept = createConcept({ project_id: projectId, title: 'C' });
      expect(() => addCanvasNode({ canvas_id: canvasId, concept_id: concept.id, file_path: '/x.md', position_x: 0, position_y: 0 })).toThrow();
    });

    it('should return file/dir nodes in getCanvasFull', () => {
      addCanvasNode({ canvas_id: canvasId, file_path: '/test.md', position_x: 0, position_y: 0 });
      const full = getCanvasFull(canvasId)!;
      expect(full.nodes).toHaveLength(1);
      expect(full.nodes[0].file_path).toBe('/test.md');
      expect(full.nodes[0].concept).toBeUndefined();
    });
  });

  describe('Edge expansion', () => {
    let projectId: string;
    let canvasId: string;
    let n1Id: string;
    let n2Id: string;

    beforeEach(() => {
      const project = createProject({ name: 'Test', root_dir: '/edge-test' });
      projectId = project.id;
      canvasId = createCanvas({ project_id: projectId, name: 'Canvas' }).id;
      const c1 = createConcept({ project_id: projectId, title: 'A' });
      const c2 = createConcept({ project_id: projectId, title: 'B' });
      n1Id = addCanvasNode({ canvas_id: canvasId, concept_id: c1.id, position_x: 0, position_y: 0 }).id;
      n2Id = addCanvasNode({ canvas_id: canvasId, concept_id: c2.id, position_x: 100, position_y: 0 }).id;
    });

    it('should create edge with relation_type_id', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Ally' });
      const edge = createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      expect(edge.relation_type_id).toBe(rt.id);
    });

    it('should create edge without relation_type_id', () => {
      const edge = createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id });
      expect(edge.relation_type_id).toBeNull();
    });

    it('should get edge by id', () => {
      const edge = createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id });
      const fetched = getEdge(edge.id);
      expect(fetched?.id).toBe(edge.id);
    });

    it('should update edge relation_type_id', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Enemy' });
      const edge = createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id });
      const updated = updateEdge(edge.id, { relation_type_id: rt.id });
      expect(updated?.relation_type_id).toBe(rt.id);
    });

    it('should SET NULL when relation type deleted', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Temp' });
      const edge = createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      deleteRelationType(rt.id);
      const fetched = getEdge(edge.id);
      expect(fetched?.relation_type_id).toBeNull();
    });

    it('should include relation_type in getCanvasFull', () => {
      const rt = createRelationType({ project_id: projectId, name: 'Ally', color: '#00ff00', directed: true });
      createEdge({ canvas_id: canvasId, source_node_id: n1Id, target_node_id: n2Id, relation_type_id: rt.id });
      const full = getCanvasFull(canvasId)!;
      expect(full.edges).toHaveLength(1);
      expect(full.edges[0].relation_type?.name).toBe('Ally');
      expect(full.edges[0].relation_type?.directed).toBe(true);
    });
  });
});
