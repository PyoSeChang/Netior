import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { NarreMention, SlashCommand } from '@netior/shared/types';
import { SLASH_COMMANDS } from '@netior/shared/constants';
import type { MentionResult } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { IconButton } from '../../ui/IconButton';
import { NarreMentionPicker } from './NarreMentionPicker';
import { NarreSlashPicker } from './NarreSlashPicker';
import { logShortcut } from '../../../shortcuts/shortcut-utils';

interface NarreMentionInputProps {
  projectId: string;
  onSend: (text: string, mentions: NarreMention[]) => void;
  onCommand?: (command: SlashCommand) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface PickerState {
  isOpen: boolean;
  query: string;
  position: { bottom: number; left: number };
}

function serializeContentEditable(el: HTMLDivElement): {
  text: string;
  mentions: NarreMention[];
} {
  const mentions: NarreMention[] = [];
  let text = '';

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;
      if (elem.dataset.mentionType) {
        const type = elem.dataset.mentionType as NarreMention['type'];
        const id = elem.dataset.mentionId;
        const path = elem.dataset.mentionPath;
        const display = elem.dataset.mentionDisplay || elem.textContent || '';

        text += `[${type}:id=${id || path}, title="${display}"]`;
        mentions.push({ type, id, path, display });
      } else if (elem.tagName === 'BR') {
        text += '\n';
      } else if (elem.tagName === 'DIV' || elem.tagName === 'P') {
        // Block elements get newlines
        if (text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        elem.childNodes.forEach(walk);
        return;
      } else {
        elem.childNodes.forEach(walk);
        return;
      }
      return;
    }
    if (node.childNodes) {
      node.childNodes.forEach(walk);
    }
  }

  walk(el);
  return { text: text.trim(), mentions };
}

function createMentionChip(mention: MentionResult): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mentionType = mention.type;
  chip.dataset.mentionId = mention.id;
  chip.dataset.mentionDisplay = mention.display;
  chip.className =
    'inline-flex items-center gap-0.5 rounded px-1 py-0 mx-0.5 text-xs font-medium cursor-default select-none bg-[var(--accent)]/15 text-[var(--accent)]';
  chip.textContent = mention.display;
  // Make the chip respond to selection correctly
  chip.setAttribute('data-chip', 'true');
  return chip;
}

export function NarreMentionInput({
  projectId,
  onSend,
  onCommand,
  disabled = false,
  placeholder,
}: NarreMentionInputProps): JSX.Element {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [picker, setPicker] = useState<PickerState>({
    isOpen: false,
    query: '',
    position: { bottom: 0, left: 0 },
  });
  const [slashPicker, setSlashPicker] = useState<PickerState>({
    isOpen: false,
    query: '',
    position: { bottom: 0, left: 0 },
  });
  const mentionSearchStart = useRef<number | null>(null);

  const checkEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.textContent || '';
    setIsEmpty(text.trim().length === 0);
  }, []);

  const handleSend = useCallback(() => {
    const el = editorRef.current;
    if (!el || disabled) return;

    const { text, mentions } = serializeContentEditable(el);
    if (!text.trim()) return;

    onSend(text, mentions);
    logShortcut('shortcut.narreChat.sendMessage');
    el.innerHTML = '';
    setIsEmpty(true);
    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
  }, [onSend, disabled]);

  const handleSlashSelect = useCallback((command: SlashCommand) => {
    const el = editorRef.current;
    if (!el) return;

    if (command.type === 'conversation') {
      // Send as a message — NarreChat will route to /chat
      onSend(`/${command.name}`, []);
    } else if (onCommand) {
      onCommand(command);
    }

    el.innerHTML = '';
    setIsEmpty(true);
    setSlashPicker((p) => ({ ...p, isOpen: false }));
  }, [onSend, onCommand]);

  const handleSlashPickerClose = useCallback(() => {
    setSlashPicker((p) => ({ ...p, isOpen: false }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (picker.isOpen || slashPicker.isOpen) {
      // Let the picker handle these keys
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        return; // picker's document listener will handle
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) {
      logShortcut('shortcut.narreChat.insertNewline');
    }

    // Backspace: check if we're right after a chip
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          const node = range.startContainer;
          const offset = range.startOffset;

          // If we're at the start of a text node, check previous sibling
          if (node.nodeType === Node.TEXT_NODE && offset === 0) {
            const prev = node.previousSibling;
            if (prev && (prev as HTMLElement).dataset?.chip) {
              e.preventDefault();
              prev.parentNode?.removeChild(prev);
              checkEmpty();
              return;
            }
          }

          // If we're in the editor div and the previous child is a chip
          if (node === editorRef.current && offset > 0) {
            const child = node.childNodes[offset - 1];
            if (child && (child as HTMLElement).dataset?.chip) {
              e.preventDefault();
              child.parentNode?.removeChild(child);
              checkEmpty();
              return;
            }
          }
        }
      }
    }
  }, [picker.isOpen, slashPicker.isOpen, handleSend, checkEmpty]);

  const handleInput = useCallback(() => {
    checkEmpty();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      // Close picker if not in text
      if (picker.isOpen) {
        setPicker((p) => ({ ...p, isOpen: false }));
        mentionSearchStart.current = null;
      }
      return;
    }

    const text = node.textContent || '';
    const cursorPos = range.startOffset;

    // Check for "/" at the start of input (slash command)
    const fullText = editorRef.current?.textContent || '';
    if (fullText.startsWith('/')) {
      const slashQuery = fullText.slice(1);
      const el = editorRef.current!;
      const rect = el.getBoundingClientRect();
      setSlashPicker({
        isOpen: true,
        query: slashQuery,
        position: {
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
        },
      });
    } else if (slashPicker.isOpen) {
      setSlashPicker((p) => ({ ...p, isOpen: false }));
    }

    // Look backward from cursor for @
    let atPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === '@') {
        atPos = i;
        break;
      }
      if (ch === ' ' || ch === '\n') break;
    }

    if (atPos >= 0) {
      const query = text.slice(atPos + 1, cursorPos);
      mentionSearchStart.current = atPos;

      // Get caret position in viewport coordinates for fixed-positioned picker
      const caretRange = document.createRange();
      caretRange.setStart(node, atPos);
      caretRange.setEnd(node, atPos);
      const caretRect = caretRange.getBoundingClientRect();

      setPicker({
        isOpen: true,
        query,
        position: {
          bottom: window.innerHeight - caretRect.top + 4,
          left: caretRect.left,
        },
      });
    } else {
      if (picker.isOpen) {
        setPicker((p) => ({ ...p, isOpen: false }));
        mentionSearchStart.current = null;
      }
    }
  }, [picker.isOpen, slashPicker.isOpen, checkEmpty]);

  const handleMentionSelect = useCallback((mention: MentionResult) => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent || '';
    const cursorPos = range.startOffset;
    const atPos = mentionSearchStart.current;

    if (atPos === null || atPos < 0) return;

    // Remove @query text
    const before = text.slice(0, atPos);
    const after = text.slice(cursorPos);

    const chip = createMentionChip(mention);
    const beforeNode = document.createTextNode(before);
    const afterNode = document.createTextNode(after || '\u200B'); // zero-width space if empty

    const parent = node.parentNode!;
    parent.insertBefore(beforeNode, node);
    parent.insertBefore(chip, node);
    parent.insertBefore(afterNode, node);
    parent.removeChild(node);

    // Place cursor after chip
    const newRange = document.createRange();
    newRange.setStart(afterNode, after ? 0 : 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
    checkEmpty();
    el.focus();
  }, [checkEmpty]);

  const handlePickerClose = useCallback(() => {
    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
  }, []);

  // Focus editor on mount
  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  return (
    <div className="flex w-full items-end gap-2">
      <div className="relative flex-1">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          role="textbox"
          className={[
            'min-h-[36px] max-h-[120px] overflow-y-auto rounded-lg border border-input bg-input px-3 py-2 text-sm text-default outline-none transition-all',
            'hover:border-strong focus:border-accent',
            'placeholder:text-muted',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          suppressContentEditableWarning
        />
        {isEmpty && !disabled && (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted">
            {placeholder || t('narre.inputPlaceholder')}
          </div>
        )}
      </div>
      {picker.isOpen && (
        <NarreMentionPicker
          query={picker.query}
          projectId={projectId}
          position={picker.position}
          onSelect={handleMentionSelect}
          onClose={handlePickerClose}
        />
      )}
      {slashPicker.isOpen && !picker.isOpen && (
        <NarreSlashPicker
          query={slashPicker.query}
          position={slashPicker.position}
          onSelect={handleSlashSelect}
          onClose={handleSlashPickerClose}
        />
      )}
      <IconButton
        label={t('narre.sendMessage')}
        disabled={isEmpty || disabled}
        onClick={handleSend}
      >
        <Send size={16} />
      </IconButton>
    </div>
  );
}
