import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { fsService } from '../../services';
import { useI18n } from '../../hooks/useI18n';

interface ProjectCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, rootDir: string) => void;
}

export function ProjectCreateDialog({ open, onClose, onCreate }: ProjectCreateDialogProps): JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [rootDir, setRootDir] = useState('');

  const handleSelectFolder = async () => {
    const path = await fsService.openFolderDialog();
    if (path) {
      setRootDir(path);
      if (!name) {
        const folderName = path.split(/[\\/]/).pop() || '';
        setName(folderName);
      }
    }
  };

  const handleCreate = () => {
    if (!name.trim() || !rootDir.trim()) return;
    onCreate(name.trim(), rootDir.trim());
    setName('');
    setRootDir('');
    onClose();
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" onClick={handleCreate} disabled={!name.trim() || !rootDir.trim()}>
        {t('common.create')}
      </Button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('project.create')} footer={footer} width={480}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('project.name')}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('project.namePlaceholder')}
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">{t('project.folder')}</label>
          <div className="flex gap-2">
            <Input
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              placeholder={t('project.folderPlaceholder')}
              className="flex-1"
              readOnly
            />
            <Button variant="secondary" onClick={handleSelectFolder}>
              <FolderOpen size={16} />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
