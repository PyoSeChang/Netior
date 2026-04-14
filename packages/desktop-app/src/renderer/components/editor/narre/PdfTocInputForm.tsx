import React from 'react';
import { FileText } from 'lucide-react';
import { useI18n } from '../../../hooks/useI18n';
import { NumberInput } from '../../ui/NumberInput';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';

export interface PdfTocFormState {
  startPage: number;
  endPage: number;
  overviewPagesText: string;
}

interface PdfTocInputFormProps {
  value: PdfTocFormState;
  onChange: (nextValue: PdfTocFormState) => void;
  fileDisplay?: string;
  disabled?: boolean;
}

export function PdfTocInputForm({
  value,
  onChange,
  fileDisplay,
  disabled = false,
}: PdfTocInputFormProps): JSX.Element {
  const { t } = useI18n();
  const isValid = value.startPage > 0 && value.endPage > 0 && value.endPage >= value.startPage;

  return (
    <div className="rounded-lg border border-subtle bg-surface-base px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-medium text-default">{t('pdfToc.inputTitle')}</h3>
        {isValid ? (
          <Badge variant="success">{t('pdfToc.startAnalysis')}</Badge>
        ) : (
          <Badge variant="warning">{t('pdfToc.invalidRange')}</Badge>
        )}
      </div>

      {fileDisplay && (
        <div className="mb-3 flex items-center gap-2 rounded border border-subtle bg-surface-card px-2 py-1.5">
          <FileText size={14} className="shrink-0 text-muted" />
          <span className="truncate text-xs text-secondary">{fileDisplay}</span>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-secondary">{t('pdfToc.startPage')}</label>
          <NumberInput
            value={value.startPage}
            onChange={(startPage) => onChange({ ...value, startPage })}
            min={1}
            inputSize="sm"
            disabled={disabled}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-secondary">{t('pdfToc.endPage')}</label>
          <NumberInput
            value={value.endPage}
            onChange={(endPage) => onChange({ ...value, endPage })}
            min={1}
            inputSize="sm"
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-secondary">{t('pdfToc.overviewPages')}</label>
        <Input
          value={value.overviewPagesText}
          onChange={(e) => onChange({ ...value, overviewPagesText: e.target.value })}
          placeholder={t('pdfToc.overviewPagesHint')}
          inputSize="sm"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
