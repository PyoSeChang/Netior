import React from 'react';

export interface SelectionBoxProps {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const SelectionBox: React.FC<SelectionBoxProps> = ({
  startX,
  startY,
  currentX,
  currentY,
}) => {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  if (width < 2 && height < 2) return null;

  return (
    <div
      className="border border-dashed border-accent bg-interactive-muted"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  );
};
