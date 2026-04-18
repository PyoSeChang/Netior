import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { RadioGroup } from '../ui/RadioGroup';
import { FilePicker } from '../ui/FilePicker';
import { IconSelector } from '../ui/IconSelector';
import { useI18n } from '../../hooks/useI18n';
import { useArchetypeStore } from '../../stores/archetype-store';
import { isImageSourceValue } from './node-components/node-visual-utils';

const CONCEPT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c',
];

const IMAGE_FILE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
] as const;

type VisualMode = 'icon' | 'image';

interface ConceptCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; color?: string; icon?: string; archetype_id?: string }) => void;
}

export function ConceptCreateModal({ open, onClose, onCreate }: ConceptCreateModalProps): JSX.Element {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string | undefined>(undefined);
  const [icon, setIcon] = useState('');
  const [visualMode, setVisualMode] = useState<VisualMode>('icon');
  const [archetypeId, setArchetypeId] = useState<string | undefined>(undefined);
  const archetypes = useArchetypeStore((s) => s.archetypes);

  // Apply archetype defaults when selected
  useEffect(() => {
    if (archetypeId) {
      const arch = archetypes.find((a) => a.id === archetypeId);
      if (arch) {
        if (arch.color && !color) setColor(arch.color);
        if (arch.icon && !icon) {
          setIcon(arch.icon);
          setVisualMode(isImageSourceValue(arch.icon) ? 'image' : 'icon');
        }
      }
    }
  }, [archetypeId]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      color: color || undefined,
      icon: icon.trim() || undefined,
      archetype_id: archetypeId || undefined,
    });
    setTitle('');
    setColor(undefined);
    setIcon('');
    setVisualMode('icon');
    setArchetypeId(undefined);
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setColor(undefined);
    setIcon('');
    setVisualMode('icon');
    setArchetypeId(undefined);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('network.createConcept')}
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
        {archetypes.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.archetype')}</label>
            <Select
              options={[
                { value: '', label: t('common.none') },
                ...archetypes.map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={archetypeId ?? ''}
              onChange={(e) => setArchetypeId(e.target.value || undefined)}
              selectSize="sm"
            />
          </div>
        )}

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
          <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.visual' as never)}</label>
          <div className="flex flex-col gap-2">
            <RadioGroup
              options={[
                { value: 'icon', label: t('concept.visualModeOptions.icon' as never) },
                { value: 'image', label: t('concept.visualModeOptions.image' as never) },
              ]}
              value={visualMode}
              onChange={(value) => {
                const nextMode = value as VisualMode;
                setVisualMode(nextMode);
                setIcon('');
              }}
              orientation="horizontal"
            />
            {visualMode === 'icon' ? (
              <IconSelector
                value={!isImageSourceValue(icon) ? (icon || undefined) : undefined}
                onChange={(name) => setIcon(name)}
              />
            ) : (
              <FilePicker
                value={isImageSourceValue(icon) ? icon : ''}
                onChange={(path) => setIcon(path)}
                placeholder={t('concept.selectProfileImage' as never)}
                filters={[...IMAGE_FILE_FILTERS]}
              />
            )}
          </div>
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
