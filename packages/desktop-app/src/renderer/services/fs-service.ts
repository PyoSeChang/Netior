import type { FileTreeNode } from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function readDir(dirPath: string): Promise<FileTreeNode[]> {
  return unwrapIpc(await window.electron.fs.readDir(dirPath));
}

export async function readDirShallow(dirPath: string, depth?: number): Promise<FileTreeNode[]> {
  return unwrapIpc(await window.electron.fs.readDirShallow(dirPath, depth));
}

export async function readFile(filePath: string): Promise<string> {
  return unwrapIpc(await window.electron.fs.readFile(filePath));
}

export async function readBinaryFile(filePath: string): Promise<ArrayBuffer> {
  return unwrapIpc(await window.electron.fs.readBinaryFile(filePath));
}

export async function writeFile(filePath: string, content: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.writeFile(filePath, content));
}

export async function openFolderDialog(): Promise<string | null> {
  const result = unwrapIpc(await window.electron.fs.openDialog({ properties: ['openDirectory'] }));
  return result ? (result as string[])[0] : null;
}

export async function openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
  const result = unwrapIpc(await window.electron.fs.openDialog({
    properties: ['openFile'],
    filters,
  }));
  return result ? (result as string[])[0] : null;
}

export async function renameItem(oldPath: string, newPath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.rename(oldPath, newPath));
}

export async function deleteItem(targetPath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.delete(targetPath));
}

export async function createFile(filePath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.createFile(filePath));
}

export async function createDir(dirPath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.createDir(dirPath));
}

export async function copyItem(src: string, dest: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.copy(src, dest));
}

export async function moveItem(src: string, dest: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.move(src, dest));
}

export async function showInExplorer(targetPath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.showInExplorer(targetPath));
}

export async function existsItem(targetPath: string): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.exists(targetPath));
}

export async function watchDirs(dirs: string[]): Promise<void> {
  await window.electron.fs.watchDirs(dirs);
}

export async function unwatchDirs(): Promise<void> {
  await window.electron.fs.unwatchDirs();
}

export function onDirChanged(callback: () => void): () => void {
  return window.electron.fs.onDirChanged(callback);
}

export async function hasClipboardFiles(): Promise<boolean> {
  return unwrapIpc(await window.electron.fs.hasClipboardFiles());
}

export async function readClipboardFiles(): Promise<string[]> {
  return unwrapIpc(await window.electron.fs.readClipboardFiles());
}

export const fsService = {
  readDir, readDirShallow, readFile, readBinaryFile, writeFile, openFolderDialog, openFileDialog,
  renameItem, deleteItem, createFile, createDir, copyItem, moveItem,
  showInExplorer, existsItem, watchDirs, unwatchDirs, onDirChanged, hasClipboardFiles, readClipboardFiles,
};
