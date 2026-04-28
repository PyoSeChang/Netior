import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface NetworkObjectEditorShellProps {
  badge: string;
  title: string;
  subtitle?: string | null;
  description?: React.ReactNode;
  leadingVisual?: React.ReactNode;
  actions?: React.ReactNode;
  showHeader?: boolean;
  fillHeight?: boolean;
  children: React.ReactNode;
}

interface NetworkObjectEditorSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

interface NetworkObjectMetadataListProps {
  items: Array<{ label: string; value: React.ReactNode }>;
}

export function NetworkObjectEditorShell({
  badge,
  title,
  subtitle,
  description,
  leadingVisual,
  actions,
  showHeader = true,
  fillHeight = true,
  children,
}: NetworkObjectEditorShellProps): JSX.Element {
  return (
    <div className={`${fillHeight ? 'min-h-full' : 'min-h-0'} bg-surface-editor`}>
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-6 py-5">
        {showHeader && (
          <section className="rounded-xl border border-default bg-surface-panel p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                {leadingVisual && <div className="shrink-0">{leadingVisual}</div>}
                <div className="min-w-0 flex-1">
                  <Badge variant="accent" className="mb-3">
                    {badge}
                  </Badge>
                  <div className="truncate text-lg font-semibold text-default">{title}</div>
                  {subtitle && <div className="mt-1 text-xs text-secondary">{subtitle}</div>}
                  {description && <div className="mt-3 text-sm text-secondary">{description}</div>}
                </div>
              </div>
              {actions && <div className="shrink-0">{actions}</div>}
            </div>
          </section>
        )}
        {children}
      </div>
    </div>
  );
}

export function NetworkObjectEditorSection({
  title,
  description,
  defaultOpen = true,
  actions,
  children,
}: NetworkObjectEditorSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-subtle bg-surface-card">
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-secondary" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-secondary" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-default">{title}</div>
            {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
          </div>
        </button>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {open && <div className="flex flex-col gap-4 px-4 py-4">{children}</div>}
    </section>
  );
}

export function NetworkObjectMetadataList({ items }: NetworkObjectMetadataListProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-subtle bg-surface-editor px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{item.label}</div>
          <div className="mt-1 break-all text-sm text-default">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
