export interface NarrePendingIndexSkillState {
  startPage: number;
  endPage: number;
  overviewPagesText: string;
}

export interface NarrePendingSkillInvocationState {
  name: string;
  indexArgs?: NarrePendingIndexSkillState;
}

export interface NarreProjectUiState {
  view: 'sessionList' | 'chat';
  activeSessionId: string | null;
  drafts: Record<string, string>;
  pendingSkillInvocations: Record<string, NarrePendingSkillInvocationState>;
}

const STORAGE_PREFIX = 'netior:narre-ui:';
const DEFAULT_PROJECT_UI_STATE: NarreProjectUiState = {
  view: 'sessionList',
  activeSessionId: null,
  drafts: {},
  pendingSkillInvocations: {},
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function sanitizeProjectUiState(value: unknown): NarreProjectUiState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_PROJECT_UI_STATE };
  }

  const source = value as Partial<NarreProjectUiState>;
  const drafts = source.drafts && typeof source.drafts === 'object' && !Array.isArray(source.drafts)
    ? Object.fromEntries(
        Object.entries(source.drafts)
          .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string'),
      )
    : {};
  const rawPendingSkillInvocations = source.pendingSkillInvocations ?? (source as { pendingCommands?: unknown }).pendingCommands;
  const pendingSkillInvocations = rawPendingSkillInvocations && typeof rawPendingSkillInvocations === 'object' && !Array.isArray(rawPendingSkillInvocations)
    ? Object.fromEntries(
        Object.entries(rawPendingSkillInvocations)
          .map(([key, invocation]) => {
            if (typeof key !== 'string' || !invocation || typeof invocation !== 'object' || Array.isArray(invocation)) {
              return null;
            }

            const candidate = invocation as Partial<NarrePendingSkillInvocationState>;
            if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
              return null;
            }

            const next: NarrePendingSkillInvocationState = { name: candidate.name };
            if (candidate.indexArgs && typeof candidate.indexArgs === 'object' && !Array.isArray(candidate.indexArgs)) {
              const indexArgs = candidate.indexArgs as Partial<NarrePendingIndexSkillState>;
              const startPage = typeof indexArgs.startPage === 'number' ? indexArgs.startPage : 1;
              const endPage = typeof indexArgs.endPage === 'number' ? indexArgs.endPage : 1;
              const overviewPagesText = typeof indexArgs.overviewPagesText === 'string' ? indexArgs.overviewPagesText : '';

              next.indexArgs = {
                startPage,
                endPage,
                overviewPagesText,
              };
            }

            return [key, next] as const;
          })
          .filter((entry): entry is readonly [string, NarrePendingSkillInvocationState] => entry !== null),
      )
    : {};

  return {
    view: source.view === 'chat' ? 'chat' : 'sessionList',
    activeSessionId: typeof source.activeSessionId === 'string' ? source.activeSessionId : null,
    drafts,
    pendingSkillInvocations,
  };
}

export function getNarreProjectUiState(projectId: string): NarreProjectUiState {
  if (!canUseStorage()) {
    return { ...DEFAULT_PROJECT_UI_STATE };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(projectId));
    if (!raw) {
      return { ...DEFAULT_PROJECT_UI_STATE };
    }

    return sanitizeProjectUiState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PROJECT_UI_STATE };
  }
}

export function updateNarreProjectUiState(
  projectId: string,
  updater: (prev: NarreProjectUiState) => NarreProjectUiState,
): NarreProjectUiState {
  const next = sanitizeProjectUiState(updater(getNarreProjectUiState(projectId)));
  if (!canUseStorage()) {
    return next;
  }

  try {
    window.localStorage.setItem(getStorageKey(projectId), JSON.stringify(next));
  } catch {
    // Ignore storage failures; Narre still works with in-memory state.
  }

  return next;
}

export function setNarreProjectDraft(
  projectId: string,
  sessionId: string | null,
  draftHtml: string,
): void {
  const draftKey = sessionId ?? '__new__';
  updateNarreProjectUiState(projectId, (prev) => {
    const drafts = { ...prev.drafts };
    if (draftHtml) {
      drafts[draftKey] = draftHtml;
    } else {
      delete drafts[draftKey];
    }

    return {
      ...prev,
      drafts,
    };
  });
}

export function getNarreProjectDraft(projectId: string, sessionId: string | null): string {
  return getNarreProjectUiState(projectId).drafts[sessionId ?? '__new__'] ?? '';
}

export function moveNarreProjectDraft(
  projectId: string,
  fromSessionId: string | null,
  toSessionId: string | null,
): void {
  const fromKey = fromSessionId ?? '__new__';
  const toKey = toSessionId ?? '__new__';

  if (fromKey === toKey) {
    return;
  }

  updateNarreProjectUiState(projectId, (prev) => {
    const drafts = { ...prev.drafts };
    const fromDraft = drafts[fromKey];
    if (typeof fromDraft === 'string' && fromDraft.length > 0 && !drafts[toKey]) {
      drafts[toKey] = fromDraft;
    }
    delete drafts[fromKey];

    return {
      ...prev,
      drafts,
    };
  });
}

export function setNarreProjectPendingSkillInvocation(
  projectId: string,
  sessionId: string | null,
  skillInvocationState: NarrePendingSkillInvocationState | null,
): void {
  const draftKey = sessionId ?? '__new__';
  updateNarreProjectUiState(projectId, (prev) => {
    const pendingSkillInvocations = { ...prev.pendingSkillInvocations };
    if (skillInvocationState) {
      pendingSkillInvocations[draftKey] = skillInvocationState;
    } else {
      delete pendingSkillInvocations[draftKey];
    }

    return {
      ...prev,
      pendingSkillInvocations,
    };
  });
}

export function getNarreProjectPendingSkillInvocation(
  projectId: string,
  sessionId: string | null,
): NarrePendingSkillInvocationState | null {
  return getNarreProjectUiState(projectId).pendingSkillInvocations[sessionId ?? '__new__'] ?? null;
}

export function moveNarreProjectPendingSkillInvocation(
  projectId: string,
  fromSessionId: string | null,
  toSessionId: string | null,
): void {
  const fromKey = fromSessionId ?? '__new__';
  const toKey = toSessionId ?? '__new__';

  if (fromKey === toKey) {
    return;
  }

  updateNarreProjectUiState(projectId, (prev) => {
    const pendingSkillInvocations = { ...prev.pendingSkillInvocations };
    const fromInvocation = pendingSkillInvocations[fromKey];
    if (fromInvocation && !pendingSkillInvocations[toKey]) {
      pendingSkillInvocations[toKey] = fromInvocation;
    }
    delete pendingSkillInvocations[fromKey];

    return {
      ...prev,
      pendingSkillInvocations,
    };
  });
}
