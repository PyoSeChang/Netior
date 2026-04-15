import type React from 'react';
import type { RenderNode, RenderEdge } from '../types';

/** A user-configurable layout option */
export interface ConfigField {
  key: string;
  type: 'string' | 'number' | 'enum' | 'date';
  label: string;
  default: unknown;
  options?: string[];
  optionLabelKeyPrefix?: string;
}

// ── Interaction ──

export interface InteractionConstraints {
  /** Lock pan to a single axis? null = free pan */
  panAxis: 'x' | 'y' | 'none' | null;
  /** Lock node drag to a single axis? null = free drag */
  nodeDragAxis: 'x' | 'y' | 'none' | null;
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
  viewportState: { zoom: number; panX: number; panY: number };
  config: Record<string, unknown>;
}

export interface LayoutComputeResult {
  [nodeId: string]: { x: number; y: number; width?: number; height?: number };
}

// ── Node Drop ──

export interface NodeDropContext {
  nodeId: string;
  newX: number;
  newY: number;
  zoom: number;
  viewport: { width: number; height: number };
  viewportState: { zoom: number; panX: number; panY: number };
  config: Record<string, unknown>;
  nodes: LayoutRenderNode[];
  node: LayoutRenderNode;
}

export interface NodeDropResult {
  position: { x: number; y: number };
  propertyUpdates?: Array<{ conceptId: string; fieldId: string; value: string }>;
}

export interface SpanResizeContext {
  nodeId: string;
  edge: 'start' | 'end';
  dx: number;
  zoom: number;
  config: Record<string, unknown>;
  node: LayoutRenderNode;
}

export interface SpanResizeResult {
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
  onContextMenu?: (type: 'workspace' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
}

export interface LayoutViewportResetContext {
  viewport: { width: number; height: number };
  config: Record<string, unknown>;
}

export type LayoutViewportMode = 'world' | 'timeline' | 'screen';
export type LayoutWheelBehavior = 'freeform' | 'timeline' | 'calendar';

export interface LayoutViewportPolicy {
  viewportMode?: LayoutViewportMode;
  wheelBehavior?: LayoutWheelBehavior;
  persistViewport?: boolean;
  interactionConstraints?: InteractionConstraints;
  viewportReset?: { zoom: number; panX: number; panY: number };
}

export type LayoutControlsPresentation = 'floating-draggable' | 'header-fixed';

export interface LayoutViewportPolicyContext {
  viewport: { width: number; height: number };
  config: Record<string, unknown>;
}

export interface LayoutControlContext {
  zoom: number;
  panX: number;
  panY: number;
  config: Record<string, unknown>;
  setZoom: (z: number) => void;
  setPanX: (x: number) => void;
  setPanY: (y: number) => void;
  updateConfig: (
    patch:
      | Record<string, unknown>
      | ((config: Record<string, unknown>) => Record<string, unknown>),
  ) => void | Promise<void>;
}

export interface LayoutResolvedControlItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

export interface LayoutWheelContext extends LayoutControlContext {
  event: WheelEvent;
  viewport: { width: number; height: number };
  nodes: LayoutRenderNode[];
}

export interface LayoutControlsRendererProps {
  mode: 'browse' | 'edit';
  zoom: number;
  panX: number;
  panY: number;
  canGoBack: boolean;
  canGoForward: boolean;
  config: Record<string, unknown>;
  hiddenControls?: Array<'zoom' | 'fit' | 'nav' | 'mode'>;
  extraItems?: LayoutResolvedControlItem[];
  setZoom: (z: number) => void;
  setPanX: (x: number) => void;
  setPanY: (y: number) => void;
  updateConfig: (
    patch:
      | Record<string, unknown>
      | ((config: Record<string, unknown>) => Record<string, unknown>),
  ) => void | Promise<void>;
  onToggleMode: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
}

// ── Plugin Interface ──

export interface WorkspaceLayoutPlugin {
  key: string;
  displayName: string;

  /** User-configurable options (unit, tick_interval, etc.) */
  configSchema: ConfigField[];
  /** Default layout_config values */
  getDefaultConfig(): Record<string, unknown>;

  /** Interaction constraints */
  interactionConstraints: InteractionConstraints;
  /** How the node layer should interpret world coordinates */
  viewportMode?: LayoutViewportMode;
  /** How wheel gestures should behave inside the workspace */
  wheelBehavior?: LayoutWheelBehavior;
  /** Whether pan/zoom should be restored and persisted for this layout */
  persistViewport?: boolean;
  /** Dynamic viewport policy derived from config and viewport size */
  getViewportPolicy?: (context: LayoutViewportPolicyContext) => LayoutViewportPolicy;
  /** Default viewport for layouts that manage their own framing */
  getViewportReset?: (context: LayoutViewportResetContext) => { zoom: number; panX: number; panY: number };

  /** Compute node positions */
  computeLayout(input: LayoutComputeInput): LayoutComputeResult;

  /** Project source nodes into layout-specific render nodes */
  projectNodes?: (input: LayoutComputeInput) => LayoutRenderNode[];

  /** Classify nodes into card vs overlay rendering */
  classifyNodes(nodes: LayoutRenderNode[], config: Record<string, unknown>): {
    cardNodes: LayoutRenderNode[];
    overlayNodes: LayoutRenderNode[];
  };

  /** Background layer (replaces dot grid) */
  BackgroundComponent: React.ComponentType<LayoutLayerProps>;
  /** Overlay layer between edges and nodes (optional) */
  OverlayComponent?: React.ComponentType<LayoutLayerProps>;

  /** Handle node drop — return position + optional property updates */
  onNodeDrop?: (context: NodeDropContext) => NodeDropResult;
  onSpanResize?: (context: SpanResizeContext) => SpanResizeResult;

  /** Hide default control buttons */
  hiddenControls?: Array<'zoom' | 'fit' | 'nav' | 'mode'>;
  /** How the remote control should be presented for this layout */
  controlsPresentation?: LayoutControlsPresentation;
  /** Custom controls renderer for layouts that want header-integrated actions */
  ControlsComponent?: React.ComponentType<LayoutControlsRendererProps>;

  /** Custom wheel handling for layouts that do not use the workspace defaults */
  onWheel?: (context: LayoutWheelContext) => void;

  /** Additional control buttons provided by this plugin */
  controlItems?: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    isActive?: (context: LayoutControlContext) => boolean;
    onClick: (context: LayoutControlContext) => void | Promise<void>;
  }>;
}
