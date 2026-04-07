import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { FileTree } from '../sidebar/FileTree';
import { useFileStore } from '../../stores/file-store';
import { useI18n } from '../../hooks/useI18n';

interface FileNodeAddModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string, type: 'file' | 'dir') => void;
}

export function FileNodeAddModal({ open, onClose, onSelect }: FileNodeAddModalProps): JSX.Element {
  const { t } = useI18n();
  const { fileTree } = useFileStore();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'file' | 'dir'>('file');

  useEffect(() => {
    if (open) {
      setSelectedPath(null);
    }
  }, [open]);

  const handleFileClick = (absolutePath: string) => {
    setSelectedPath(absolutePath);
    setSelectedType('file');
  };

  const handleConfirm = () => {
    if (selectedPath) {
      onSelect(selectedPath, selectedType);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('network.addFileNode')}>
      <div className="flex flex-col gap-3 min-h-[300px] max-h-[500px]">
        <div className="flex-1 overflow-auto border border-subtle rounded-md">
          {fileTree.length > 0 ? (
            <FileTree
              nodes={fileTree}
              onFileClick={handleFileClick}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted p-4">
              {t('sidebar.noModules') ?? 'No module directories configured'}
            </div>
          )}
        </div>

        {selectedPath && (
          <div className="text-xs text-secondary px-1 truncate">
            {selectedPath}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('common.cancel') ?? 'Cancel'}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedPath}>
            {t('common.confirm') ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
