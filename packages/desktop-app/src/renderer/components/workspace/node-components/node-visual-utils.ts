let measureContext: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext) return measureContext;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  measureContext = canvas.getContext('2d');
  return measureContext;
}

export function isImageSourceValue(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\//i.test(trimmed) ||
    /^blob:/i.test(trimmed) ||
    /^file:\/\//i.test(trimmed) ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    /^\\\\/.test(trimmed) ||
    /^\//.test(trimmed)
  );
}

export function isLocalImageSource(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  return (
    /^file:\/\//i.test(trimmed) ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    /^\\\\/.test(trimmed) ||
    /^\//.test(trimmed)
  );
}

export function toLocalImagePath(value: string | null | undefined): string | undefined {
  if (!isLocalImageSource(value)) return undefined;

  const trimmed = value.trim();
  if (!/^file:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const pathname = decodeURIComponent(url.pathname);

    if (url.host) {
      return `//${url.host}${pathname}`;
    }

    if (/^\/[a-zA-Z]:\//.test(pathname)) {
      return pathname.slice(1);
    }

    return pathname;
  } catch {
    return trimmed.replace(/^file:\/\//i, '');
  }
}

export function getImageMimeType(path: string): string {
  const normalized = path.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.bmp')) return 'image/bmp';
  if (normalized.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

export function normalizeImageSource(value: string | null | undefined): string | undefined {
  if (!isImageSourceValue(value)) return undefined;

  const trimmed = value.trim();
  return trimmed;
}

export function resolveNodeImageUrl(icon: string, metadata?: Record<string, unknown>): string | undefined {
  void metadata;
  return normalizeImageSource(icon);
}

export function measureNodeLabelWidth(label: string): number {
  const trimmed = label.trim();
  if (!trimmed) return 0;

  const context = getMeasureContext();
  if (!context) {
    return Math.ceil(Array.from(trimmed).length * 8);
  }

  const family = typeof window !== 'undefined' && document.body
    ? getComputedStyle(document.body).fontFamily
    : 'system-ui, sans-serif';
  context.font = `500 14px ${family}`;
  return Math.ceil(context.measureText(trimmed).width);
}

export function getAutoNodeWidth(params: {
  label: string;
  icon: string;
  baseWidth: number;
  metadata?: Record<string, unknown>;
  isContainer?: boolean;
}): number {
  const { label, icon, baseWidth, metadata, isContainer } = params;
  if (isContainer) return baseWidth;

  const titleWidth = measureNodeLabelWidth(label);
  const visualWidth = resolveNodeImageUrl(icon, metadata) ? 52 : 24;
  const nextWidth = titleWidth + visualWidth + 56;

  return Math.max(baseWidth, nextWidth);
}
