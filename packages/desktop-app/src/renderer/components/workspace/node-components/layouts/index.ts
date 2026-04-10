import type { NodeShape } from '../types';
import type { ShapeLayout } from '../types';
import { IconOnlyLayout } from './IconOnlyLayout';
import { StadiumLayout } from './StadiumLayout';
import { PortraitLayout } from './PortraitLayout';
import { DashedLayout } from './DashedLayout';
import { GroupLayout } from './GroupLayout';
import { HierarchyLayout } from './HierarchyLayout';
import { WideLayout } from './WideLayout';
import { RectangleLayout } from './RectangleLayout';
import { SquareLayout } from './SquareLayout';

const SHAPE_LAYOUT_MAP: Record<NodeShape, ShapeLayout> = {
  circle: IconOnlyLayout,
  gear: IconOnlyLayout,
  stadium: StadiumLayout,
  portrait: PortraitLayout,
  dashed: DashedLayout,
  group: GroupLayout,
  hierarchy: HierarchyLayout,
  wide: WideLayout,
  rectangle: RectangleLayout,
  square: SquareLayout,
};

export function getShapeLayout(shape: NodeShape): ShapeLayout {
  return SHAPE_LAYOUT_MAP[shape] ?? RectangleLayout;
}
