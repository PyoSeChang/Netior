/** Viewport state */
export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export type CanvasNodeType = 'concept' | 'file' | 'dir' | 'network' | 'object';

/** Node data for rendering */
export interface RenderNode {
  id: string;
  x: number;
  y: number;
  label: string;
  icon: string;
  shape?: string;
  semanticType: string;
  semanticTypeLabel: string;
  width?: number;
  height?: number;
  conceptId?: string;
  canvasCount: number;
  nodeType: CanvasNodeType;
  objectType?: string;
  objectTargetId?: string;
  isPortal?: boolean;
  isGroup?: boolean;
  isHierarchy?: boolean;
  isContainer?: boolean;
  isCollapsed?: boolean;
  fileId?: string;
  filePath?: string;
  networkId?: string;
  dimmed?: boolean;
}

export interface RenderPoint {
  x: number;
  y: number;
}

/** Edge data for rendering */
export interface RenderEdge {
  id: string;
  sourceId: string;
  targetId: string;
  directed: boolean;
  label: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  systemContract?: string | null;
  route?: 'straight' | 'orthogonal' | 'hidden';
  routePoints?: RenderPoint[];
  hidden?: boolean;
  dimmed?: boolean;
}

/** Layout input node */
export interface LayoutNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Layout input edge */
export interface LayoutEdge {
  source: string;
  target: string;
  directed: boolean;
}
