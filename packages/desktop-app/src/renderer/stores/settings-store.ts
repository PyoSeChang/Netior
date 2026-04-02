import { create } from 'zustand';
import type { Locale } from '@netior/shared/i18n';

const THEME_OPTIONS = [
  {
    id: 'forest',
    label: 'Forest',
    description: 'Organic greens with soft moss neutrals',
    preview: ['#c7f0d1', '#34a853', '#14281d'],
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Balanced blue neutrals for focused work',
    preview: ['#d8e7ff', '#1668dc', '#111827'],
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Classic neutral gray for a standard, no-surprises UI',
    preview: ['#e5e7eb', '#6b7280', '#111827'],
  },
  {
    id: 'tide',
    label: 'Tide',
    description: 'Sea-glass teal with crisp marine shadows',
    preview: ['#c8f8f4', '#0f9f95', '#102a33'],
  },
  {
    id: 'dune',
    label: 'Dune',
    description: 'Sandstone warmth with restrained gold accents',
    preview: ['#f5e4c3', '#b7791f', '#2f261c'],
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Terracotta heat over smoked brown neutrals',
    preview: ['#ffd7c7', '#dd6b38', '#2b1711'],
  },
  {
    id: 'pastel',
    label: 'Pastel',
    description: 'Powder lavender-blue accents with soft airy neutrals',
    preview: ['#f4e8ff', '#a78bfa', '#cbd5e1'],
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'High-contrast electric accent on deep midnight',
    preview: ['#fff7a8', '#ffe600', '#09090f'],
  },
] as const;

export type ThemeConcept = (typeof THEME_OPTIONS)[number]['id'];
type ThemeMode = 'dark' | 'light';

interface SettingsStore {
  themeConcept: ThemeConcept;
  themeMode: ThemeMode;
  locale: Locale;

  setThemeConcept: (concept: ThemeConcept) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
}

function applyTheme(concept: string, mode: string) {
  document.documentElement.setAttribute('data-concept', concept);
  document.documentElement.setAttribute('data-mode', mode);
}

export const AVAILABLE_CONCEPTS = THEME_OPTIONS;

export const useSettingsStore = create<SettingsStore>((set) => ({
  themeConcept: 'forest',
  themeMode: 'dark',
  locale: 'ko',

  setThemeConcept: (concept) => {
    set({ themeConcept: concept });
    applyTheme(concept, useSettingsStore.getState().themeMode);
  },

  setThemeMode: (mode) => {
    set({ themeMode: mode });
    applyTheme(useSettingsStore.getState().themeConcept, mode);
  },

  setLocale: (locale) => set({ locale }),
}));
