import React, { useEffect, useState } from 'react';
import { resolveIcon } from '../../../utils/icon-resolver';
import { fsService } from '../../../services';
import {
  getImageMimeType,
  isImageSourceValue,
  isLocalImageSource,
  resolveNodeImageUrl,
  toLocalImagePath,
} from './node-visual-utils';

interface NodeVisualProps {
  icon: string;
  size?: number;
  imageSize?: number;
  metadata?: Record<string, unknown>;
  className?: string;
}

export const NodeVisual: React.FC<NodeVisualProps> = ({
  icon,
  size = 20,
  imageSize,
  metadata,
  className,
}) => {
  const imageSource = resolveNodeImageUrl(icon, metadata);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackIcon = isImageSourceValue(icon) ? 'user-round' : icon;
  const resolvedImageSize = imageSize ?? size;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setImageUrl(null);

    if (!imageSource) {
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    if (!isLocalImageSource(imageSource)) {
      setImageUrl(imageSource);
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    const localPath = toLocalImagePath(imageSource);
    if (!localPath) {
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }

    void (async () => {
      try {
        const buffer = await fsService.readBinaryFile(localPath);
        if (cancelled) return;
        const blob = new Blob([buffer], { type: getImageMimeType(localPath) });
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setImageFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageSource]);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={resolvedImageSize}
        height={resolvedImageSize}
        loading="lazy"
        draggable={false}
        className={[
          'pointer-events-none block shrink-0 rounded-full border border-default bg-surface-base object-cover select-none',
          className ?? '',
        ].join(' ').trim()}
        style={{ width: resolvedImageSize, height: resolvedImageSize }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <span className={['pointer-events-none select-none', className ?? ''].join(' ').trim()}>{resolveIcon(fallbackIcon, size)}</span>;
};
