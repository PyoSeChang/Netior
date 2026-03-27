import React from 'react';
import { getIconForFile, getIconForFolder, getIconForOpenFolder } from 'vscode-icons-js';

// Import all SVGs from assets/file-icons using Vite's glob import
const iconModules = import.meta.glob<{ default: string }>(
  '../../assets/file-icons/*.svg',
  { eager: true, query: '?url', import: 'default' },
);

// Build a lookup map: icon filename → resolved URL
const iconMap: Record<string, string> = {};
for (const [path, url] of Object.entries(iconModules)) {
  const filename = path.split('/').pop();
  if (filename) {
    iconMap[filename] = url as unknown as string;
  }
}

interface FileIconProps {
  name: string;
  isFolder?: boolean;
  isOpen?: boolean;
  size?: number;
  className?: string;
}

export function FileIcon({
  name,
  isFolder = false,
  isOpen = false,
  size = 16,
  className,
}: FileIconProps): JSX.Element {
  let iconFilename: string;

  if (isFolder) {
    iconFilename = isOpen
      ? (getIconForOpenFolder(name) ?? 'default_folder_opened.svg')
      : (getIconForFolder(name) ?? 'default_folder.svg');
  } else {
    iconFilename = getIconForFile(name) ?? 'default_file.svg';
  }

  const iconUrl = iconMap[iconFilename];

  if (!iconUrl) {
    // Fallback to default icons
    const fallbackKey = isFolder
      ? (isOpen ? 'default_folder_opened.svg' : 'default_folder.svg')
      : 'default_file.svg';
    const fallbackUrl = iconMap[fallbackKey];

    if (fallbackUrl) {
      return (
        <img
          src={fallbackUrl}
          alt=""
          width={size}
          height={size}
          className={className}
          style={{ flexShrink: 0 }}
        />
      );
    }

    // Ultimate fallback: empty placeholder
    return <span style={{ width: size, height: size, flexShrink: 0 }} className={className} />;
  }

  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    />
  );
}
