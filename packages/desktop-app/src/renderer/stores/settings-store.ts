import { create } from 'zustand';
import type { Locale } from '@netior/shared/i18n';

const THEME_CONCEPTS = ['forest', 'neon', 'slate'] as const;

type ThemeConcept = (typeof THEME_CONCEPTS)[number];
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

export const AVAILABLE_CONCEPTS = THEME_CONCEPTS;

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
