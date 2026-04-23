import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import type { NarreMention, SkillDefinition } from '@netior/shared/types';
import { SLASH_TRIGGER_SKILLS } from '@netior/shared/constants';
import type { MentionResult } from '../../../services/narre-service';
import type { NarrePendingSkillInvocationState } from '../../../lib/narre-ui-state';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { IconButton } from '../../ui/IconButton';
import { NarreMentionPicker } from './NarreMentionPicker';
import { PdfTocInputForm, type PdfTocFormState } from './PdfTocInputForm';
import { NarreSlashPicker } from './NarreSlashPicker';
import { logShortcut } from '../../../shortcuts/shortcut-utils';

export interface NarreComposerSubmit {
  text: string;
  mentions: NarreMention[];
  draftHtml: string;
  pendingSkillInvocation: NarrePendingSkillInvocationState | null;
}

interface NarreMentionInputProps {
  projectId: string;
  onSend: (payload: NarreComposerSubmit) => Promise<boolean | void> | boolean | void;
  disabled?: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
  draftHtml?: string;
  availableSkills?: readonly SkillDefinition[];
  pendingSkillInvocation?: NarrePendingSkillInvocationState | null;
  onDraftChange?: (draftHtml: string) => void;
  onPendingSkillInvocationChange?: (pendingSkillInvocation: NarrePendingSkillInvocationState | null) => void;
}

interface PickerState {
  isOpen: boolean;
  query: string;
  position: { bottom: number; left: number };
}

interface ComposerSnapshot {
  text: string;
  mentions: NarreMention[];
}

const EMPTY_SNAPSHOT: ComposerSnapshot = {
  text: '',
  mentions: [],
};

function serializeContentEditable(el: HTMLDivElement): {
  text: string;
  mentions: NarreMention[];
} {
  const mentions: NarreMention[] = [];
  let text = '';

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent || '').replace(/\u200B/g, '');
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
  // Store path from meta for file mentions (and module mentions)
  if (typeof mention.meta?.path === 'string') {
    chip.dataset.mentionPath = mention.meta.path;
  }
  chip.className =
    'inline-flex items-center gap-0.5 rounded px-1 py-0 mx-0.5 text-xs font-medium cursor-default select-none bg-[var(--accent)]/15 text-[var(--accent)]';
  chip.textContent = mention.display;
  // Make the chip respond to selection correctly
  chip.setAttribute('data-chip', 'true');
  return chip;
}

function getSlashSkillByName(skillName: string, skills: readonly SkillDefinition[]): SkillDefinition | null {
  return skills.find((skill) =>
    skill.name === skillName || skill.trigger?.name === skillName,
  ) ?? null;
}

function createPendingSkillInvocationState(skill: SkillDefinition): NarrePendingSkillInvocationState {
  const triggerName = skill.trigger?.type === 'slash' ? skill.trigger.name : skill.name;
  if (triggerName === 'index') {
    return {
      name: triggerName,
      indexArgs: {
        startPage: 1,
        endPage: 1,
        overviewPagesText: '',
      },
    };
  }

  return { name: triggerName };
}

function isPdfMention(mention: NarreMention): boolean {
  const candidate = mention.path ?? mention.display;
  return candidate.toLowerCase().endsWith('.pdf');
}

function placeCaretAtEnd(el: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function NarreMentionInput({
  projectId,
  onSend,
  disabled = false,
  sendDisabled = false,
  placeholder,
  draftHtml = '',
  availableSkills = SLASH_TRIGGER_SKILLS,
  pendingSkillInvocation = null,
  onDraftChange,
  onPendingSkillInvocationChange,
}: NarreMentionInputProps): JSX.Element {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<ComposerSnapshot>(EMPTY_SNAPSHOT);
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
  const previousDisabled = useRef(disabled);
  const selectedSkill = pendingSkillInvocation ? getSlashSkillByName(pendingSkillInvocation.name, availableSkills) : null;
  const fileMention = snapshot.mentions.find((mention) => mention.type === 'file');

  const syncComposerState = useCallback((): ComposerSnapshot => {
    const el = editorRef.current;
    if (!el) {
      setSnapshot(EMPTY_SNAPSHOT);
      setIsEmpty(true);
      return EMPTY_SNAPSHOT;
    }

    const nextSnapshot = serializeContentEditable(el);
    const text = (el.textContent || '').replace(/\u200B/g, '').trim();
    setSnapshot(nextSnapshot);
    setIsEmpty(text.length === 0 && nextSnapshot.mentions.length === 0);
    return nextSnapshot;
  }, []);

  const resetEditor = useCallback(() => {
    const el = editorRef.current;
    if (el) {
      el.innerHTML = '';
    }

    setSnapshot(EMPTY_SNAPSHOT);
    setIsEmpty(true);
    setPicker((p) => ({ ...p, isOpen: false }));
    setSlashPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
    onDraftChange?.('');
    onPendingSkillInvocationChange?.(null);
  }, [onDraftChange, onPendingSkillInvocationChange]);

  const skillValidationMessage = (() => {
    if (!pendingSkillInvocation || pendingSkillInvocation.name !== 'index') {
      return null;
    }

    if (!fileMention) {
      return t('pdfToc.noFile');
    }

    if (!isPdfMention(fileMention)) {
      return t('pdfToc.noPdfFile');
    }

    if (!pendingSkillInvocation.indexArgs || pendingSkillInvocation.indexArgs.endPage < pendingSkillInvocation.indexArgs.startPage) {
      return t('pdfToc.invalidRange');
    }

    return null;
  })();

  const canSubmit = pendingSkillInvocation ? skillValidationMessage === null : !isEmpty;

  const handleSend = useCallback(async () => {
    const el = editorRef.current;
    if (!el || disabled || sendDisabled || !canSubmit) return;

    const { text, mentions } = serializeContentEditable(el);
    if (!pendingSkillInvocation && !text.trim()) return;

    const result = await onSend({
      text,
      mentions,
      draftHtml: el.innerHTML,
      pendingSkillInvocation,
    });
    if (result === false) return;

    logShortcut('shortcut.narreChat.sendMessage');
    resetEditor();
  }, [canSubmit, disabled, onSend, pendingSkillInvocation, resetEditor, sendDisabled]);

  const handleSlashSelect = useCallback((skill: SkillDefinition) => {
    const el = editorRef.current;
    if (el) {
      el.innerHTML = '';
      setSnapshot(EMPTY_SNAPSHOT);
      setIsEmpty(true);
      onDraftChange?.('');
      el.focus();
      placeCaretAtEnd(el);
    }

    setSlashPicker((p) => ({ ...p, isOpen: false }));
    onPendingSkillInvocationChange?.(createPendingSkillInvocationState(skill));
  }, [onDraftChange, onPendingSkillInvocationChange]);

  const handleSlashPickerClose = useCallback(() => {
    setSlashPicker((p) => ({ ...p, isOpen: false }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (picker.isOpen || slashPicker.isOpen) {
      // Let the picker handle these keys
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
        return; // picker's document listener will handle
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (sendDisabled) return;
      void handleSend();
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
              syncComposerState();
              onDraftChange?.(editorRef.current?.innerHTML ?? '');
              return;
            }
          }

          // If we're in the editor div and the previous child is a chip
          if (node === editorRef.current && offset > 0) {
            const child = node.childNodes[offset - 1];
            if (child && (child as HTMLElement).dataset?.chip) {
              e.preventDefault();
              child.parentNode?.removeChild(child);
              syncComposerState();
              onDraftChange?.(editorRef.current?.innerHTML ?? '');
              return;
            }
          }
        }
      }
    }
  }, [picker.isOpen, slashPicker.isOpen, handleSend, onDraftChange, sendDisabled, syncComposerState]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    syncComposerState();
    onDraftChange?.(editor.innerHTML);

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

    // Check for "/" at the start of input (slash-triggered skill)
    const fullText = (editor.textContent || '').replace(/\u200B/g, '');
    if (!pendingSkillInvocation && fullText.startsWith('/')) {
      const slashBody = fullText.slice(1);
      const slashQuery = slashBody.split(/\s+/, 1)[0] ?? '';

      if (!/\s/.test(slashBody)) {
        const rect = editor.getBoundingClientRect();
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
  }, [pendingSkillInvocation, picker.isOpen, slashPicker.isOpen, onDraftChange, syncComposerState]);

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
    syncComposerState();
    onDraftChange?.(el.innerHTML);
    el.focus();
  }, [onDraftChange, syncComposerState]);

  const handlePickerClose = useCallback(() => {
    setPicker((p) => ({ ...p, isOpen: false }));
    mentionSearchStart.current = null;
  }, []);

  // Focus editor on mount
  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  useEffect(() => {
    const wasDisabled = previousDisabled.current;
    previousDisabled.current = disabled;
    if (!wasDisabled || disabled) {
      return;
    }

    const el = editorRef.current;
    if (!el) {
      return;
    }

    el.focus();
    placeCaretAtEnd(el);
  }, [disabled]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === draftHtml) {
      return;
    }

    el.innerHTML = draftHtml;
    syncComposerState();
  }, [draftHtml, syncComposerState]);

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
        {selectedSkill && !disabled && (
          <div className="mt-2 rounded-md border border-subtle bg-surface-card px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="accent">
                  /{pendingSkillInvocation?.name ?? selectedSkill.trigger?.name ?? selectedSkill.name}
                </Badge>
                <span className="text-xs text-default">
                  {selectedSkill.source === 'builtin' ? t(selectedSkill.description as any) : selectedSkill.description}
                </span>
                {skillValidationMessage ? (
                  <Badge variant="warning">{skillValidationMessage}</Badge>
                ) : (
                  selectedSkill.name === 'index'
                    && fileMention
                    && isPdfMention(fileMention)
                    && <Badge variant="success">@{fileMention.display}</Badge>
                )}
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted transition-colors hover:bg-surface-hover hover:text-default"
                onClick={() => onPendingSkillInvocationChange?.(null)}
              >
                <X size={14} />
              </button>
            </div>
            {selectedSkill.hint && (
              <p className="mt-2 text-xs text-muted">
                {selectedSkill.source === 'builtin' ? t(selectedSkill.hint as any) : selectedSkill.hint}
              </p>
            )}
            {pendingSkillInvocation?.name === 'index' && pendingSkillInvocation.indexArgs && (
              <div className="mt-3">
                <PdfTocInputForm
                  value={pendingSkillInvocation.indexArgs as PdfTocFormState}
                  fileDisplay={fileMention?.display}
                  disabled={disabled || sendDisabled}
                  onChange={(nextValue) => {
                    onPendingSkillInvocationChange?.({
                      ...pendingSkillInvocation,
                      indexArgs: nextValue,
                    });
                  }}
                />
              </div>
            )}
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
      {slashPicker.isOpen && !picker.isOpen && !pendingSkillInvocation && (
        <NarreSlashPicker
          query={slashPicker.query}
          position={slashPicker.position}
          skills={availableSkills}
          onSelect={handleSlashSelect}
          onClose={handleSlashPickerClose}
        />
      )}
      <IconButton
        label={t('narre.sendMessage')}
        disabled={disabled || sendDisabled || !canSubmit}
        onClick={() => { void handleSend(); }}
      >
        <Send size={16} />
      </IconButton>
    </div>
  );
}
