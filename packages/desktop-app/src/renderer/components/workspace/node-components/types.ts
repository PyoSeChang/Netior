import type { WorkspaceMode } from '../../../stores/ui-store';

/** Shared types for workspace node card rendering. */
export type NodeShape = 'circle' | 'gear' | 'stadium' | 'portrait' | 'dashed' | 'wide' | 'rectangle' | 'square' | 'group' | 'hierarchy';
export type NodeResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Props for shape-specific internal layout components */
export interface ShapeLayoutProps {
  label: string;
  icon: string;
  semanticTypeLabel: string;
  collapsed?: boolean;
  canToggleCollapse?: boolean;
  onToggleCollapse?: () => void;
  updatedAt?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Shape layout component type */
export type ShapeLayout = React.ComponentType<ShapeLayoutProps>;

/** Base props for all node components */
export interface NodeComponentProps {
  // Identity
  id: string;
  semanticTypeLabel: string;

  // Position & Size
  x: number;
  y: number;
  width?: number;
  height?: number;

  // Display
  label: string;
  updatedAt?: string;
  icon: string;
  selected: boolean;
  highlighted?: boolean;
  mode?: WorkspaceMode;

  // Appearance (Level 1: Shape)
  shape?: NodeShape;

  // Extended data (Level 2/3: Custom components)
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  portalChips?: Array<{ id: string; label: string; networkId: string }>;
  onPortalChipClick?: (nodeId: string, chipId: string, networkId: string) => void;

  resizable?: boolean;
  onResizeStart?: (nodeId: string, direction: NodeResizeDirection, startX: number, startY: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;

  // Callbacks
  onClick: (id: string, event: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onDragStart?: (id: string, startX: number, startY: number) => void;
  onContextMenu?: (type: 'workspace' | 'node' | 'edge', x: number, y: number, targetId?: string) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}
