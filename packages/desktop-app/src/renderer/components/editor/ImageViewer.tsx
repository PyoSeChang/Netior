import React from 'react';

interface ImageViewerProps {
  absolutePath: string;
}

export function ImageViewer({ absolutePath }: ImageViewerProps): JSX.Element {
  // Convert file path to file:// URL for Electron
  const fileUrl = `file:///${absolutePath.replace(/\\/g, '/')}`;

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-surface-base p-4">
      <img
        src={fileUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
    </div>
  );
}
