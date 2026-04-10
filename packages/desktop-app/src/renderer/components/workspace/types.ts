export type WorkspaceNodeType = 'concept' | 'file' | 'dir' | 'network' | 'object';
export interface PortalChip {
  id: string;
  label: string;
  networkId: string;
}

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
  nodeType: WorkspaceNodeType;
  objectType?: string;
  objectTargetId?: string;
  isPortal?: boolean;
  isGroup?: boolean;
  isHierarchy?: boolean;
  isContainer?: boolean;
  isCollapsed?: boolean;
  portalChips?: PortalChip[];
  metadata?: Record<string, unknown>;
  fileId?: string;
  filePath?: string;
  networkId?: string;
  dimmed?: boolean;
}

export interface RenderPoint {
  x: number;
  y: number;
}

export type RenderEdgeAnchor = 'center' | 'top' | 'right' | 'bottom' | 'left' | 'root-top' | 'root-bottom';

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
  routeStrategy?: 'default' | 'hierarchy-branch';
  sourceAnchor?: RenderEdgeAnchor;
  targetAnchor?: RenderEdgeAnchor;
  orthogonalAxis?: 'horizontal' | 'vertical';
  hidden?: boolean;
  dimmed?: boolean;
}
