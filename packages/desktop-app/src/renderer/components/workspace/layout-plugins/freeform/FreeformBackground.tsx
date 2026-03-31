import React from 'react';
import { Background } from '../../Background';
import type { LayoutLayerProps } from '../types';

export const FreeformBackground: React.FC<LayoutLayerProps> = ({ width, height, zoom, panX, panY }) => (
  <Background width={width} height={height} zoom={zoom} panX={panX} panY={panY} />
);
