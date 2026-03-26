import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useI18n } from '../../hooks/useI18n';

const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c',
];

interface ConceptCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; color?: string; icon?: string }) => void;
}

export function ConceptCreateModal({ open, onClose, onCreate }: ConceptCreateModalProps): JSX.Element {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      color: color || undefined,
      icon: icon.trim() || undefined,
    });
    setTitle('');
    setColor(undefined);
    setIcon('');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setColor(undefined);
    setIcon('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('canvas.createConcept')}
      width="400px"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.title')}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('concept.titlePlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.icon')}</label>
          <Input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="📌"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-secondary">{t('concept.color')}</label>
          <div className="flex flex-wrap gap-2">
            {CONCEPT_COLORS.map((c) => (
              <button
                key={c}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c ? 'border-accent scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(color === c ? undefined : c)}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
