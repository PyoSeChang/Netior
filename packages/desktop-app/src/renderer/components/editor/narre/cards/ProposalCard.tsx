import React, { useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import type { NarreProposalCard, ProposalRow, ProposalColumn } from '@netior/shared/types';
import { useI18n } from '../../../../hooks/useI18n';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Select } from '../../../ui/Select';
import { Toggle } from '../../../ui/Toggle';
import { Tooltip } from '../../../ui/Tooltip';
import { IconButton } from '../../../ui/IconButton';

interface ProposalCardProps {
  card: NarreProposalCard;
  onConfirm: (rows: ProposalRow[]) => Promise<void> | void;
  onRetry: () => Promise<void> | void;
}

function CellEditor({
  column,
  value,
  onChange,
}: {
  column: ProposalColumn;
  value: unknown;
  onChange: (val: unknown) => void;
}): JSX.Element {
  switch (column.cellType) {
    case 'boolean':
      return (
        <Toggle
          checked={Boolean(value)}
          onChange={(checked) => onChange(checked)}
        />
      );
    case 'enum':
      return (
        <Select
          selectSize="sm"
          options={(column.options ?? []).map((o) => ({ value: o, label: o }))}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'color':
      return (
        <div className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded border border-subtle shrink-0"
            style={{ backgroundColor: String(value ?? '#888888') }}
          />
          <Input
            inputSize="sm"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="!w-20"
          />
        </div>
      );
    case 'readonly':
      return (
        <span className="text-xs text-text-secondary">
          {String(value ?? '')}
        </span>
      );
    case 'icon':
    case 'text':
    default:
      return (
        <Input
          inputSize="sm"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function ProposalCard({
  card,
  onConfirm,
  onRetry,
}: ProposalCardProps): JSX.Element {
  const { t } = useI18n();
  const [rows, setRows] = useState<ProposalRow[]>(() =>
    card.rows.map((r) => ({ ...r, values: { ...r.values } })),
  );
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const handleCellChange = useCallback(
    (rowIdx: number, key: string, value: unknown) => {
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIdx ? { ...row, values: { ...row.values, [key]: value } } : row,
        ),
      );
    },
    [],
  );

  const handleAddRow = useCallback(() => {
    const empty: ProposalRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      values: {},
    };
    for (const col of card.columns) {
      empty.values[col.key] = col.cellType === 'boolean' ? false : '';
    }
    setRows((prev) => [...prev, empty]);
  }, [card.columns]);

  const handleRemoveRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (status === 'submitting' || status === 'submitted') {
      return;
    }

    setStatus('submitting');
    try {
      await onConfirm(rows);
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [onConfirm, rows, status]);

  const handleRetry = useCallback(async () => {
    if (status === 'submitting') {
      return;
    }

    setStatus('submitting');
    try {
      await onRetry();
      setStatus('submitted');
    } catch {
      setStatus('error');
    }
  }, [onRetry, status]);

  return (
    <div className="mt-2 rounded-lg border border-subtle bg-surface-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        {card.title ? (
          <h4 className="text-xs font-semibold text-default">
            {card.title}
          </h4>
        ) : <span />}
        {status === 'submitting' && <Badge variant="warning">{t('narre.card.submitting')}</Badge>}
        {status === 'submitted' && <Badge variant="success">{t('narre.card.submitted')}</Badge>}
        {status === 'error' && <Badge variant="error">{t('narre.card.submitFailed')}</Badge>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {card.columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left p-1.5 border-b border-border-default text-text-secondary font-medium"
                >
                  {col.label}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group">
                {card.columns.map((col) => (
                  <td
                    key={col.key}
                    className="p-1.5 border-b border-border-subtle align-middle"
                  >
                    <CellEditor
                      column={col}
                      value={row.values[col.key]}
                      onChange={(val) =>
                        handleCellChange(rowIdx, col.key, val)
                      }
                    />
                  </td>
                ))}
                <td className="p-1 border-b border-border-subtle align-middle">
                  <Tooltip content={t('narre.card.removeRow')}>
                    <IconButton
                      label={t('narre.card.removeRow')}
                      onClick={() => handleRemoveRow(rowIdx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </IconButton>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="flex items-center gap-1 mt-2 text-xs text-text-secondary hover:text-text-default transition-colors"
        onClick={handleAddRow}
      >
        <Plus size={12} />
        {t('narre.card.addRow')}
      </button>

      <div className="flex justify-end gap-2 mt-3">
        <Button variant="ghost" size="sm" disabled={status === 'submitting'} onClick={() => { void handleRetry(); }}>
          {t('narre.card.proposalRetry')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={status === 'submitting' || status === 'submitted'}
          onClick={() => { void handleConfirm(); }}
        >
          {t('narre.card.proposalConfirm')}
        </Button>
      </div>
    </div>
  );
}
