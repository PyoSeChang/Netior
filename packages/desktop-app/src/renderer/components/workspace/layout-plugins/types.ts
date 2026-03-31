import type React from 'react';
import type { RenderNode, RenderEdge } from '../types';

// ── Plugin Data Contract ──

/** A field the layout requires from concept properties */
export interface FieldRequirement {
  /** Standard key the plugin reads from metadata (e.g., 'time_value') */
  key: string;
  type: 'number' | 'string' | 'enum';
  label: string;
  required: boolean;
  default?: unknown;
  /** Enum options (when type='enum') */
  options?: string[];
}

/** A user-configurable layout option */
export interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'enum';
  label: string;
  default: unknown;
  options?: string[];
}

// ── Interaction ──

export interface InteractionConstraints {
  /** Lock pan to a single axis? null = free pan */
  panAxis: 'x' | 'y' | null;
  /** Lock node drag to a single axis? null = free drag */
  nodeDragAxis: 'x' | 'y' | null;
  /** Enable span resize handles? */
  enableSpanResize: boolean;
}

// ── Layout Computation ──

/** RenderNode extended with plugin metadata */
export interface LayoutRenderNode extends RenderNode {
  metadata: Record<string, unknown>;
  archetypeId?: string;
}

export interface LayoutComputeInput {
  nodes: LayoutRenderNode[];
  edges: RenderEdge[];
  viewport: { width: number; height: number };
  config: Record<string, unknown>;
}

export interface LayoutComputeResult {
  [nodeId: string]: { x: number; y: number; width?: number };
}

// ── Node Drop ──

export interface NodeDropContext {
  nodeId: string;
  newX: number;
  newY: number;
  config: Record<string, unknown>;
  node: LayoutRenderNode;
}

export interface NodeDropResult {
  position: { x: number; y: number };
  propertyUpdates?: Array<{ conceptId: string; fieldId: string; value: string }>;
}

// ── Rendering ──

export interface LayoutLayerProps {
  width: number;
  height: number;
  zoom: number;
  panX: number;
  panY: number;
  nodes: LayoutRenderNode[];
  edges: RenderEdge[];
  config: Record<string, unknown>;
  nodeDragOffset: { id: string; dx: number; dy: number } | null;
  spanResizeOffset?: { id: string; edge: 'start' | 'end'; dx: number } | null;
  onSpanResizeStart?: (nodeId: string, edge: 'start' | 'end', startX: number, startValue: number) => void;
  onNodeClick?: (id: string, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (id: string) => void;
  onContextMenu?: (type: 'canvas' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
}

// ── Plugin Interface ──

export interface CanvasLayoutPlugin {
  key: string;
  displayName: string;

  /** Fields this layout requires from concept properties */
  requiredFields: FieldRequirement[];
  /** User-configurable options (unit, tick_interval, etc.) */
  configSchema: ConfigField[];
  /** Default layout_config values */
  getDefaultConfig(): Record<string, unknown>;

  /** Interaction constraints */
  interactionConstraints: InteractionConstraints;

  /** Compute node positions */
  computeLayout(input: LayoutComputeInput): LayoutComputeResult;

  /** Classify nodes into card vs overlay rendering */
  classifyNodes(nodes: LayoutRenderNode[]): {
    cardNodes: LayoutRenderNode[];
    overlayNodes: LayoutRenderNode[];
  };

  /** Background layer (replaces dot grid) */
  BackgroundComponent: React.ComponentType<LayoutLayerProps>;
  /** Overlay layer between edges and nodes (optional) */
  OverlayComponent?: React.ComponentType<LayoutLayerProps>;

  /** Handle node drop — return position + optional property updates */
  onNodeDrop?: (context: NodeDropContext) => NodeDropResult;
}
