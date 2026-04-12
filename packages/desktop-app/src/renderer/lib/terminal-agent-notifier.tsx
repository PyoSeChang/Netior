import React from 'react';
import {
  getAllAgentTerminalStates,
  subscribeAgentSessionStore,
  type AgentSessionState,
} from './agent-session-store';
import completionSoundUrl from '../assets/agent-sounds/completion-pixabay-universfield-new-notification-07-210334.mp3';
import attentionSoundUrl from '../assets/agent-sounds/attention-pixabay-dragon-studio-new-notification-3-398649.mp3';
import { dismissToastByKey, showCustomToast } from '../components/ui/Toast';
import { ClaudeIcon, CodexIcon } from '../components/ui/AgentProviderIcons';
import { useEditorStore } from '../stores/editor-store';
import { useSettingsStore } from '../stores/settings-store';

type AgentProvider = AgentSessionState['provider'];
type AgentTurnState = AgentSessionState['turnState'];
type AgentUxState = AgentSessionState['uxState'];
type AgentAttentionReason = AgentSessionState['attentionReason'];

type WindowContext =
  | { kind: 'main' }
  | { kind: 'detached'; hostId: string };

interface AgentTerminalSnapshot {
  provider: AgentProvider;
  terminalSessionId: string;
  uxState: AgentUxState;
  attentionReason: AgentAttentionReason;
  turnState: AgentTurnState;
  terminalName: string | null;
}

interface AgentTerminalSource {
  subscribe: (callback: () => void) => () => void;
  getSnapshots: () => AgentTerminalSnapshot[];
}

type AgentNotifierGlobal = {
  initialized?: boolean;
  unsubscribers?: Array<() => void>;
};

interface UnacknowledgedEntry {
  tabId: string;
  provider: AgentProvider;
  title: string;
  timestamp: number;
}

const unacknowledgedQueue: UnacknowledgedEntry[] = [];
const windowContext = getWindowContext();
const SOUND_THROTTLE_MS = 1200;
const soundCooldownByKind = new Map<'completion' | 'attention' | 'error', number>();
const agentSoundElements = new Map<'completion' | 'attention' | 'error', HTMLAudioElement>();
let windowFocused = typeof document === 'undefined' ? true : document.hasFocus();
let windowFocusListenerInitialized = false;
let nativeFocusListenerInitialized = false;
let soundUnlockListenerInitialized = false;
let agentAudioContext: AudioContext | null = null;
const AGENT_SOUND_ASSETS: Record<'completion' | 'attention' | 'error', string> = {
  completion: completionSoundUrl,
  attention: attentionSoundUrl,
  error: attentionSoundUrl,
};

function getAgentToastKey(tabId: string, kind: 'attention' | 'completion'): string {
  return `agent-toast:${kind}:${tabId}`;
}

function dismissAgentToasts(tabId: string): void {
  dismissToastByKey(getAgentToastKey(tabId, 'attention'));
  dismissToastByKey(getAgentToastKey(tabId, 'completion'));
}

function getWindowContext(): WindowContext {
  const hash = window.location.hash;
  if (!hash.startsWith('#/detached/')) return { kind: 'main' };

  const match = hash.match(/^#\/detached\/([^/]+)$/);
  return { kind: 'detached', hostId: decodeURIComponent(match?.[1] ?? '') };
}

export function acknowledgeAgent(tabId: string): void {
  const idx = unacknowledgedQueue.findIndex((entry) => entry.tabId === tabId);
  if (idx >= 0) unacknowledgedQueue.splice(idx, 1);
  dismissAgentToasts(tabId);
}

export function getUnacknowledgedCount(): number {
  return unacknowledgedQueue.length;
}

export function getUnacknowledgedEntries(): readonly UnacknowledgedEntry[] {
  return unacknowledgedQueue;
}

export function jumpToNextUnacknowledgedAgent(): void {
  if (unacknowledgedQueue.length === 0) return;

  const entry = unacknowledgedQueue[0];
  const store = useEditorStore.getState();
  const tab = store.tabs.find((candidate) => candidate.id === entry.tabId);
  if (!tab) {
    unacknowledgedQueue.shift();
    return;
  }

  store.setHostActiveTab(tab.hostId, tab.id);
  store.setFocusedHost(tab.hostId);
}

let activeTabListenerInitialized = false;

function initActiveTabListener(): void {
  if (activeTabListenerInitialized) return;
  activeTabListenerInitialized = true;

  let prevActiveTabId: string | null = null;
  let prevHostActiveTabIds: Record<string, string | null> = {};

  useEditorStore.subscribe((state) => {
    if (state.activeTabId !== prevActiveTabId) {
      prevActiveTabId = state.activeTabId;
      if (state.activeTabId) acknowledgeAgent(state.activeTabId);
    }

    for (const [hostId, host] of Object.entries(state.hosts)) {
      if (host.activeTabId !== prevHostActiveTabIds[hostId]) {
        prevHostActiveTabIds[hostId] = host.activeTabId;
        if (host.activeTabId) acknowledgeAgent(host.activeTabId);
      }
    }

    for (const hostId of Object.keys(prevHostActiveTabIds)) {
      if (!state.hosts[hostId]) delete prevHostActiveTabIds[hostId];
    }
  });
}

const previousSnapshots = new Map<string, { uxState: AgentUxState; turnState: AgentTurnState }>();
const agentNotifierGlobal = window as Window & { __netiorAgentNotifier?: AgentNotifierGlobal };
agentNotifierGlobal.__netiorAgentNotifier ??= {};

const SOURCES: AgentTerminalSource[] = [
  {
    subscribe: subscribeAgentSessionStore,
    getSnapshots: () =>
      getAllAgentTerminalStates().map((state: AgentSessionState) => ({
        provider: state.provider,
        terminalSessionId: state.surface.id,
        uxState: state.uxState,
        attentionReason: state.attentionReason,
        turnState: state.turnState,
        terminalName: state.name,
      })),
  },
];

function getTerminalTabId(sessionId: string): string {
  return `terminal:${sessionId}`;
}

function getProviderLabel(provider: AgentProvider): string {
  switch (provider) {
    case 'claude':
      return 'Claude';
    case 'codex':
      return 'Codex';
    case 'narre':
      return 'Narre';
  }
}

function isTabActiveInHost(tabId: string): boolean {
  const store = useEditorStore.getState();
  const tab = store.tabs.find((candidate) => candidate.id === tabId);
  if (!tab) return false;

  if (tab.hostId === 'main') {
    return store.activeTabId === tabId;
  }

  const host = store.hosts[tab.hostId];
  return host?.activeTabId === tabId;
}

function shouldShowDetachedToast(tabHostId: string, tabId: string): boolean {
  if (windowContext.kind !== 'detached') return false;
  if (windowContext.hostId !== tabHostId) return false;

  const mode = useSettingsStore.getState().detachedAgentToastMode;
  if (mode === 'always') return true;
  return !isTabActiveInHost(tabId);
}

function shouldShowToast(tabHostId: string, tabId: string): boolean {
  const needsVisibleToast = !windowFocused || !isTabActiveInHost(tabId);
  if (!needsVisibleToast) return false;
  if (windowContext.kind === 'main') return true;
  return shouldShowDetachedToast(tabHostId, tabId);
}

function getAgentSoundElement(kind: 'completion' | 'attention' | 'error'): HTMLAudioElement {
  let element = agentSoundElements.get(kind);
  if (!element) {
    element = new Audio(AGENT_SOUND_ASSETS[kind]);
    element.preload = 'auto';
    agentSoundElements.set(kind, element);
  }

  element.volume = kind === 'attention' ? 0.95 : kind === 'error' ? 1 : 0.88;
  return element;
}

function getAudioContextCtor():
  | typeof AudioContext
  | undefined {
  return window.AudioContext ?? (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
}

async function getAgentAudioContext(): Promise<AudioContext | null> {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    console.warn('[AgentSound] AudioContext unavailable');
    return null;
  }

  if (!agentAudioContext) {
    agentAudioContext = new AudioContextCtor();
    console.log('[AgentSound] created AudioContext', { state: agentAudioContext.state });
  }

  if (agentAudioContext.state === 'suspended') {
    try {
      await agentAudioContext.resume();
      console.log('[AgentSound] resumed AudioContext', { state: agentAudioContext.state });
    } catch {
      console.warn('[AgentSound] failed to resume AudioContext', { state: agentAudioContext.state });
      return agentAudioContext;
    }
  }

  return agentAudioContext;
}

function initSoundUnlockListener(): void {
  if (soundUnlockListenerInitialized) return;
  soundUnlockListenerInitialized = true;

  const unlock = () => {
    console.log('[AgentSound] unlock event');
    getAgentSoundElement('completion').load();
    getAgentSoundElement('attention').load();
    void getAgentAudioContext();
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

async function playAgentSound(kind: 'completion' | 'attention' | 'error'): Promise<void> {
  if (!useSettingsStore.getState().agentNotificationSoundEnabled) {
    console.log('[AgentSound] skipped, disabled in settings', { kind });
    return;
  }

  const now = Date.now();
  const lastPlayed = soundCooldownByKind.get(kind) ?? 0;
  if (now - lastPlayed < SOUND_THROTTLE_MS) {
    console.log('[AgentSound] skipped, throttled', { kind, elapsedMs: now - lastPlayed });
    return;
  }
  soundCooldownByKind.set(kind, now);
  console.log('[AgentSound] requested', { kind });

  try {
    const sound = getAgentSoundElement(kind);
    sound.currentTime = 0;
    await sound.play();
    console.log('[AgentSound] played via audio asset', { kind, src: sound.currentSrc || sound.src, volume: sound.volume });
    return;
  } catch {
    console.warn('[AgentSound] audio asset playback failed, trying AudioContext fallback', { kind });
  }

  const audioContext = await getAgentAudioContext();
  console.log('[AgentSound] AudioContext state', { kind, state: audioContext?.state ?? 'none' });
  if (!audioContext || audioContext.state !== 'running') {
    try {
      console.warn('[AgentSound] falling back to main-process beep', { kind });
      await window.electron.notifications.playSound(kind);
    } catch {
      console.warn('[AgentSound] main-process beep failed', { kind });
    }
    return;
  }

  try {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const duration = kind === 'attention' ? 0.34 : kind === 'error' ? 0.38 : 0.24;
    const peakGain = kind === 'attention' ? 0.095 : kind === 'error' ? 0.11 : 0.08;
    const startFrequency = kind === 'attention' ? 760 : kind === 'error' ? 430 : 620;
    const endFrequency = kind === 'attention' ? 880 : kind === 'error' ? 320 : 780;

    oscillator.type = kind === 'completion' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(startFrequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, audioContext.currentTime + (duration * 0.65));
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, audioContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
    console.log('[AgentSound] played via AudioContext', { kind, startFrequency, endFrequency, peakGain, duration });
  } catch {
    try {
      console.warn('[AgentSound] AudioContext playback failed, falling back to main-process beep', { kind });
      await window.electron.notifications.playSound(kind);
    } catch {
      console.warn('[AgentSound] main-process beep failed after AudioContext error', { kind });
    }
  }
}

async function maybeShowNativeNotification(tabId: string, title: string, message: string): Promise<boolean> {
  if (!useSettingsStore.getState().nativeAgentNotificationsEnabled) {
    console.log('[AgentNotify] native notification skipped, disabled in settings', { tabId });
    return false;
  }

  try {
    const shown = await window.electron.notifications.notifyAgent({
      tabId,
      title,
      message,
      playSound: useSettingsStore.getState().agentNotificationSoundEnabled,
    });
    console.log('[AgentNotify] native notification result', { tabId, shown, title });
    return shown;
  } catch {
    console.warn('[AgentNotify] native notification failed', { tabId, title });
    return false;
  }
}

function getUnreadCount(isActive: boolean): number {
  return isActive ? unacknowledgedQueue.length : Math.max(unacknowledgedQueue.length - 1, 0);
}

function maybeQueueUnacknowledged(tabId: string, snapshot: AgentTerminalSnapshot, title: string, isActive: boolean): void {
  if (!isActive && !unacknowledgedQueue.find((entry) => entry.tabId === tabId)) {
    unacknowledgedQueue.push({ tabId, provider: snapshot.provider, title, timestamp: Date.now() });
  }
}

async function maybeNotifyCompletion(snapshot: AgentTerminalSnapshot): Promise<void> {
  const tabId = getTerminalTabId(snapshot.terminalSessionId);
  const store = useEditorStore.getState();
  const tab = store.tabs.find((entry) => entry.id === tabId);
  const title = tab?.title || snapshot.terminalName || `${getProviderLabel(snapshot.provider)} Terminal`;
  const isActive = isTabActiveInHost(tabId);

  if (!tab) return;

  maybeQueueUnacknowledged(tabId, snapshot, title, isActive);
  const otherUnread = getUnreadCount(isActive);
  const message = otherUnread > 0
    ? `${getProviderLabel(snapshot.provider)} finished responding. (${otherUnread} more unread)`
    : `${getProviderLabel(snapshot.provider)} finished responding.`;
  dismissAgentToasts(tabId);

  const nativeShown = await maybeShowNativeNotification(tabId, title, message);
  if (nativeShown) return;
  if (!shouldShowToast(tab.hostId, tabId)) return;

  showCustomToast({
    toastKey: getAgentToastKey(tabId, 'completion'),
    type: 'info',
    title,
    message,
    duration: 5000,
    icon: snapshot.provider === 'claude'
      ? <ClaudeIcon />
      : snapshot.provider === 'codex'
        ? <CodexIcon />
        : undefined,
    actionLabel: 'Go to Agent (Ctrl+.)',
    onAction: () => {
      store.setHostActiveTab(tab.hostId, tab.id);
      store.setFocusedHost(tab.hostId);
    },
  });
  void playAgentSound('completion');
}

function initWindowFocusListener(): void {
  if (windowFocusListenerInitialized) return;
  windowFocusListenerInitialized = true;

  const syncFocus = () => {
    windowFocused = document.hasFocus() && document.visibilityState !== 'hidden';
  };

  syncFocus();
  window.addEventListener('focus', syncFocus);
  window.addEventListener('blur', syncFocus);
  document.addEventListener('visibilitychange', syncFocus);
}

function initNativeFocusListener(): void {
  if (nativeFocusListenerInitialized) return;
  nativeFocusListenerInitialized = true;

  window.electron.notifications.onFocusTab(({ tabId }) => {
    const store = useEditorStore.getState();
    const tab = store.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    store.setHostActiveTab(tab.hostId, tab.id);
    store.setFocusedHost(tab.hostId);
    acknowledgeAgent(tab.id);
  });
}

function getAttentionMessage(snapshot: AgentTerminalSnapshot, otherUnread: number): string {
  const baseMessage = snapshot.attentionReason === 'approval'
    ? `${getProviderLabel(snapshot.provider)} is waiting for approval.`
    : snapshot.attentionReason === 'user_input'
      ? `${getProviderLabel(snapshot.provider)} is waiting for your input.`
      : `${getProviderLabel(snapshot.provider)} needs your attention.`;

  return otherUnread > 0 ? `${baseMessage} (${otherUnread} more unread)` : baseMessage;
}

async function maybeNotifyAttention(snapshot: AgentTerminalSnapshot): Promise<void> {
  const tabId = getTerminalTabId(snapshot.terminalSessionId);
  const store = useEditorStore.getState();
  const tab = store.tabs.find((entry) => entry.id === tabId);
  const title = tab?.title || snapshot.terminalName || `${getProviderLabel(snapshot.provider)} Terminal`;
  const isActive = isTabActiveInHost(tabId);

  if (!tab) return;

  maybeQueueUnacknowledged(tabId, snapshot, title, isActive);
  const otherUnread = getUnreadCount(isActive);
  dismissAgentToasts(tabId);
  const message = getAttentionMessage(snapshot, otherUnread);

  const nativeShown = await maybeShowNativeNotification(tabId, title, message);
  if (nativeShown) return;
  if (!shouldShowToast(tab.hostId, tabId)) return;

  showCustomToast({
    toastKey: getAgentToastKey(tabId, 'attention'),
    type: 'warning',
    title,
    message,
    duration: 7000,
    icon: snapshot.provider === 'claude'
      ? <ClaudeIcon />
      : snapshot.provider === 'codex'
        ? <CodexIcon />
        : undefined,
    actionLabel: 'Go to Agent (Ctrl+.)',
    onAction: () => {
      store.setHostActiveTab(tab.hostId, tab.id);
      store.setFocusedHost(tab.hostId);
    },
  });
  void playAgentSound('attention');
}

function processSnapshots(snapshots: AgentTerminalSnapshot[]): void {
  const activeKeys = new Set<string>();

  for (const snapshot of snapshots) {
    const key = `${snapshot.provider}:${snapshot.terminalSessionId}`;
    activeKeys.add(key);
    const tabId = getTerminalTabId(snapshot.terminalSessionId);

    const prev = previousSnapshots.get(key);
    const completedTurn = prev?.turnState === 'working' && snapshot.turnState === 'idle';
    const completedByIdleTransition = prev?.uxState === 'working' && snapshot.uxState === 'idle';
    const attentionCleared = prev?.uxState === 'needs_attention' && snapshot.uxState !== 'needs_attention';

    if (snapshot.uxState === 'needs_attention') {
      void maybeNotifyAttention(snapshot);
    }

    if (attentionCleared) {
      dismissToastByKey(getAgentToastKey(tabId, 'attention'));
    }

    if (completedTurn || completedByIdleTransition) {
      void maybeNotifyCompletion(snapshot);
    }

    previousSnapshots.set(key, {
      uxState: snapshot.uxState,
      turnState: snapshot.turnState,
    });
  }

  for (const key of Array.from(previousSnapshots.keys())) {
    if (!activeKeys.has(key)) previousSnapshots.delete(key);
  }
}

export function initTerminalAgentNotifier(): void {
  if (agentNotifierGlobal.__netiorAgentNotifier?.initialized) return;

  const existing = agentNotifierGlobal.__netiorAgentNotifier?.unsubscribers ?? [];
  for (const unsubscribe of existing) unsubscribe();

  const unsubscribers: Array<() => void> = [];
  agentNotifierGlobal.__netiorAgentNotifier = { initialized: true, unsubscribers };

  initActiveTabListener();
  initWindowFocusListener();
  initNativeFocusListener();
  initSoundUnlockListener();

  for (const source of SOURCES) {
    processSnapshots(source.getSnapshots());
    const unsubscribe = source.subscribe(() => {
      processSnapshots(source.getSnapshots());
    });
    unsubscribers.push(unsubscribe);
  }
}
