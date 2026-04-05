import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Locale, TranslationKey } from '@netior/shared/i18n';

type CssVariableMap = Record<string, string>;

interface PrimaryPresetDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  color: string;
}

interface ThemeVariantDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  preview: [string, string, string];
  overrides: CssVariableMap;
  recommendedPrimaryPresetIds: readonly string[];
}

interface ThemeFamilyDefinition {
  id: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  preview: [string, string, string];
  defaultVariant: string;
  variants: readonly ThemeVariantDefinition[];
}

export type AppearanceMode = 'system' | 'dark' | 'light';
export type ThemePrimaryMode = 'preset' | 'custom';
export type DetachedAgentToastMode = 'always' | 'inactive-only';
export type ThemeFamily = ThemeFamilyDefinition['id'];
export type ResolvedThemeMode = 'dark' | 'light';
export type PrimaryPresetId = string;

export interface ThemeSlotConfig {
  family: ThemeFamily;
  variant: string;
  primaryMode: ThemePrimaryMode;
  primaryPresetId: PrimaryPresetId;
  primaryCustomColor: string;
}

const PRIMARY_PRESETS: readonly PrimaryPresetDefinition[] = [
  { id: 'gray', labelKey: 'settings.primaryPresets.gray.label', descriptionKey: 'settings.primaryPresets.gray.description', color: '#7a7a7a' },
  { id: 'warm-gray', labelKey: 'settings.primaryPresets.warmGray.label', descriptionKey: 'settings.primaryPresets.warmGray.description', color: '#8f7f73' },
  { id: 'cool-gray', labelKey: 'settings.primaryPresets.coolGray.label', descriptionKey: 'settings.primaryPresets.coolGray.description', color: '#77808c' },
  { id: 'violet', labelKey: 'settings.primaryPresets.violet.label', descriptionKey: 'settings.primaryPresets.violet.description', color: '#9b8cff' },
  { id: 'mint', labelKey: 'settings.primaryPresets.mint.label', descriptionKey: 'settings.primaryPresets.mint.description', color: '#66cbb0' },
  { id: 'peach', labelKey: 'settings.primaryPresets.peach.label', descriptionKey: 'settings.primaryPresets.peach.description', color: '#e49d7a' },
  { id: 'teal', labelKey: 'settings.primaryPresets.teal.label', descriptionKey: 'settings.primaryPresets.teal.description', color: '#1fa29a' },
  { id: 'moss', labelKey: 'settings.primaryPresets.moss.label', descriptionKey: 'settings.primaryPresets.moss.description', color: '#568b5f' },
  { id: 'amber', labelKey: 'settings.primaryPresets.amber.label', descriptionKey: 'settings.primaryPresets.amber.description', color: '#c88733' },
  { id: 'ember', labelKey: 'settings.primaryPresets.ember.label', descriptionKey: 'settings.primaryPresets.ember.description', color: '#c45b3c' },
  { id: 'sky', labelKey: 'settings.primaryPresets.sky.label', descriptionKey: 'settings.primaryPresets.sky.description', color: '#5c92d6' },
] as const;

const THEME_FAMILIES: readonly ThemeFamilyDefinition[] = [
  {
    id: 'alloy',
    labelKey: 'settings.themeFamilies.alloy.label',
    descriptionKey: 'settings.themeFamilies.alloy.description',
    preview: ['#d4d4d4', '#7a7a7a', '#141414'],
    defaultVariant: 'neutral',
    variants: [
      {
        id: 'neutral',
        labelKey: 'settings.themeFamilies.alloy.variants.neutral.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.neutral.description',
        preview: ['#d4d4d4', '#7a7a7a', '#141414'],
        overrides: {},
        recommendedPrimaryPresetIds: ['gray', 'violet', 'teal'],
      },
      {
        id: 'warm',
        labelKey: 'settings.themeFamilies.alloy.variants.warm.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.warm.description',
        preview: ['#ddd6cf', '#8f7f73', '#1b1714'],
        overrides: {
          '--palette-neutral-50': 'hsl(28, 18%, 95%)',
          '--palette-neutral-100': 'hsl(26, 15%, 90%)',
          '--palette-neutral-200': 'hsl(24, 12%, 82%)',
          '--palette-neutral-300': 'hsl(22, 10%, 70%)',
          '--palette-neutral-400': 'hsl(20, 8%, 56%)',
          '--palette-neutral-500': 'hsl(18, 8%, 38%)',
          '--palette-neutral-600': 'hsl(16, 9%, 28%)',
          '--palette-neutral-700': 'hsl(14, 10%, 21%)',
          '--palette-neutral-800': 'hsl(12, 11%, 16%)',
          '--palette-neutral-900': 'hsl(10, 13%, 11%)',
          '--palette-neutral-950': 'hsl(8, 14%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(24, 12%, 58%, 0.10), transparent 24%), radial-gradient(circle at bottom right, hsla(16, 10%, 28%, 0.14), transparent 28%)',
          '--theme-dark-surface-base': 'hsl(18, 14%, 8%)',
          '--theme-dark-surface-panel': 'hsl(18, 12%, 10%)',
          '--theme-dark-surface-card': 'hsl(18, 11%, 13%)',
          '--theme-dark-surface-hover': 'hsl(18, 10%, 18%)',
          '--theme-dark-surface-modal': 'hsl(18, 13%, 9%)',
          '--theme-dark-input-bg': 'hsl(18, 10%, 12%)',
          '--theme-light-surface-base': 'hsl(28, 24%, 94%)',
          '--theme-light-surface-panel': 'hsl(28, 18%, 97%)',
          '--theme-light-surface-card': 'hsl(28, 16%, 95%)',
          '--theme-light-surface-hover': 'hsl(26, 14%, 89%)',
          '--theme-light-surface-modal': 'hsl(28, 16%, 98%)',
          '--theme-light-input-bg': 'hsl(30, 14%, 99%)',
        },
        recommendedPrimaryPresetIds: ['warm-gray', 'amber', 'ember'],
      },
      {
        id: 'cool',
        labelKey: 'settings.themeFamilies.alloy.variants.cool.label',
        descriptionKey: 'settings.themeFamilies.alloy.variants.cool.description',
        preview: ['#d8dee7', '#7d8ca2', '#11161c'],
        overrides: {
          '--palette-neutral-50': 'hsl(216, 24%, 96%)',
          '--palette-neutral-100': 'hsl(216, 18%, 91%)',
          '--palette-neutral-200': 'hsl(216, 14%, 82%)',
          '--palette-neutral-300': 'hsl(216, 12%, 71%)',
          '--palette-neutral-400': 'hsl(216, 10%, 58%)',
          '--palette-neutral-500': 'hsl(216, 10%, 40%)',
          '--palette-neutral-600': 'hsl(216, 12%, 29%)',
          '--palette-neutral-700': 'hsl(216, 14%, 22%)',
          '--palette-neutral-800': 'hsl(216, 16%, 17%)',
          '--palette-neutral-900': 'hsl(216, 18%, 11%)',
          '--palette-neutral-950': 'hsl(216, 20%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(216, 18%, 58%, 0.09), transparent 24%), radial-gradient(circle at bottom right, hsla(216, 16%, 26%, 0.13), transparent 28%)',
          '--theme-dark-surface-base': 'hsl(216, 20%, 8%)',
          '--theme-dark-surface-panel': 'hsl(216, 17%, 10%)',
          '--theme-dark-surface-card': 'hsl(216, 15%, 13%)',
          '--theme-dark-surface-hover': 'hsl(216, 13%, 18%)',
          '--theme-dark-surface-modal': 'hsl(216, 18%, 9%)',
          '--theme-dark-input-bg': 'hsl(216, 15%, 12%)',
          '--theme-light-surface-base': 'hsl(216, 24%, 95%)',
          '--theme-light-surface-panel': 'hsl(216, 18%, 98%)',
          '--theme-light-surface-card': 'hsl(216, 16%, 96%)',
          '--theme-light-surface-hover': 'hsl(216, 14%, 90%)',
          '--theme-light-surface-modal': 'hsl(216, 18%, 99%)',
          '--theme-light-input-bg': 'hsl(216, 18%, 99%)',
        },
        recommendedPrimaryPresetIds: ['cool-gray', 'sky', 'teal'],
      },
    ],
  },
  {
    id: 'hearth',
    labelKey: 'settings.themeFamilies.hearth.label',
    descriptionKey: 'settings.themeFamilies.hearth.description',
    preview: ['#ddd6cf', '#8b7f75', '#1b1714'],
    defaultVariant: 'warm',
    variants: [
      {
        id: 'warm',
        labelKey: 'settings.themeFamilies.hearth.variants.warm.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.warm.description',
        preview: ['#ddd6cf', '#8b7f75', '#1b1714'],
        overrides: {},
        recommendedPrimaryPresetIds: ['warm-gray', 'amber', 'ember'],
      },
      {
        id: 'paper',
        labelKey: 'settings.themeFamilies.hearth.variants.paper.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.paper.description',
        preview: ['#ece3db', '#b1a093', '#2a241f'],
        overrides: {
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(28, 16%, 72%, 0.12), transparent 26%), radial-gradient(circle at bottom right, hsla(18, 10%, 38%, 0.12), transparent 30%)',
          '--theme-dark-surface-base': 'hsl(22, 12%, 10%)',
          '--theme-dark-surface-panel': 'hsl(22, 10%, 12%)',
          '--theme-dark-surface-card': 'hsl(22, 10%, 15%)',
          '--theme-dark-surface-hover': 'hsl(22, 9%, 20%)',
          '--theme-dark-surface-modal': 'hsl(22, 11%, 11%)',
          '--theme-light-surface-base': 'hsl(30, 30%, 95%)',
          '--theme-light-surface-panel': 'hsl(30, 22%, 98%)',
          '--theme-light-surface-card': 'hsl(30, 20%, 96%)',
          '--theme-light-surface-hover': 'hsl(28, 16%, 90%)',
          '--theme-light-surface-modal': 'hsl(30, 18%, 99%)',
        },
        recommendedPrimaryPresetIds: ['warm-gray', 'peach', 'amber'],
      },
      {
        id: 'soot',
        labelKey: 'settings.themeFamilies.hearth.variants.soot.label',
        descriptionKey: 'settings.themeFamilies.hearth.variants.soot.description',
        preview: ['#cfc5bc', '#796a60', '#12100e'],
        overrides: {
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(20, 12%, 46%, 0.08), transparent 22%), radial-gradient(circle at bottom right, hsla(12, 12%, 18%, 0.16), transparent 30%)',
          '--theme-dark-surface-base': 'hsl(16, 12%, 7%)',
          '--theme-dark-surface-panel': 'hsl(16, 10%, 9%)',
          '--theme-dark-surface-card': 'hsl(16, 9%, 12%)',
          '--theme-dark-surface-hover': 'hsl(16, 8%, 17%)',
          '--theme-dark-surface-modal': 'hsl(16, 11%, 8%)',
          '--theme-light-surface-base': 'hsl(26, 20%, 94%)',
          '--theme-light-surface-panel': 'hsl(26, 14%, 97%)',
          '--theme-light-surface-card': 'hsl(26, 12%, 95%)',
          '--theme-light-surface-hover': 'hsl(24, 11%, 89%)',
          '--theme-light-surface-modal': 'hsl(26, 12%, 98%)',
        },
        recommendedPrimaryPresetIds: ['ember', 'warm-gray', 'gray'],
      },
    ],
  },
  {
    id: 'pastel',
    labelKey: 'settings.themeFamilies.pastel.label',
    descriptionKey: 'settings.themeFamilies.pastel.description',
    preview: ['#f4e8ff', '#a78bfa', '#cbd5e1'],
    defaultVariant: 'violet',
    variants: [
      {
        id: 'violet',
        labelKey: 'settings.themeFamilies.pastel.variants.violet.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.violet.description',
        preview: ['#f4e8ff', '#a78bfa', '#d9dff3'],
        overrides: {},
        recommendedPrimaryPresetIds: ['violet', 'mint', 'peach'],
      },
      {
        id: 'mint',
        labelKey: 'settings.themeFamilies.pastel.variants.mint.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.mint.description',
        preview: ['#e8fff6', '#7ed7c1', '#d6eae5'],
        overrides: {
          '--palette-neutral-50': 'hsl(165, 34%, 97%)',
          '--palette-neutral-100': 'hsl(167, 28%, 93%)',
          '--palette-neutral-200': 'hsl(169, 20%, 86%)',
          '--palette-neutral-300': 'hsl(171, 15%, 76%)',
          '--palette-neutral-400': 'hsl(173, 12%, 62%)',
          '--palette-neutral-500': 'hsl(175, 12%, 40%)',
          '--palette-neutral-600': 'hsl(178, 14%, 29%)',
          '--palette-neutral-700': 'hsl(180, 16%, 22%)',
          '--palette-neutral-800': 'hsl(182, 18%, 16%)',
          '--palette-neutral-900': 'hsl(184, 21%, 12%)',
          '--palette-neutral-950': 'hsl(186, 24%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(165, 58%, 74%, 0.17), transparent 28%), radial-gradient(circle at bottom right, hsla(186, 34%, 66%, 0.12), transparent 30%)',
          '--theme-dark-surface-base': 'hsl(178, 24%, 10%)',
          '--theme-dark-surface-panel': 'hsl(176, 20%, 12%)',
          '--theme-dark-surface-card': 'hsl(174, 18%, 15%)',
          '--theme-dark-surface-hover': 'hsl(172, 16%, 20%)',
          '--theme-dark-surface-modal': 'hsl(176, 20%, 11%)',
          '--theme-dark-input-bg': 'hsl(174, 18%, 14%)',
          '--theme-light-surface-base': 'hsl(165, 58%, 97%)',
          '--theme-light-surface-panel': 'hsl(164, 28%, 99%)',
          '--theme-light-surface-card': 'hsl(166, 30%, 97%)',
          '--theme-light-surface-hover': 'hsl(166, 24%, 91%)',
          '--theme-light-surface-modal': 'hsl(164, 28%, 99%)',
        },
        recommendedPrimaryPresetIds: ['mint', 'teal', 'sky'],
      },
      {
        id: 'peach',
        labelKey: 'settings.themeFamilies.pastel.variants.peach.label',
        descriptionKey: 'settings.themeFamilies.pastel.variants.peach.description',
        preview: ['#ffefe8', '#e7a77d', '#eedcd1'],
        overrides: {
          '--palette-neutral-50': 'hsl(20, 40%, 97%)',
          '--palette-neutral-100': 'hsl(18, 28%, 93%)',
          '--palette-neutral-200': 'hsl(18, 20%, 86%)',
          '--palette-neutral-300': 'hsl(18, 15%, 76%)',
          '--palette-neutral-400': 'hsl(18, 12%, 62%)',
          '--palette-neutral-500': 'hsl(18, 12%, 40%)',
          '--palette-neutral-600': 'hsl(18, 14%, 29%)',
          '--palette-neutral-700': 'hsl(18, 16%, 22%)',
          '--palette-neutral-800': 'hsl(18, 18%, 16%)',
          '--palette-neutral-900': 'hsl(18, 21%, 12%)',
          '--palette-neutral-950': 'hsl(18, 24%, 8%)',
          '--theme-background-image': 'radial-gradient(circle at top left, hsla(20, 70%, 78%, 0.16), transparent 28%), radial-gradient(circle at bottom right, hsla(8, 46%, 72%, 0.12), transparent 30%)',
          '--theme-dark-surface-base': 'hsl(18, 22%, 10%)',
          '--theme-dark-surface-panel': 'hsl(18, 18%, 12%)',
          '--theme-dark-surface-card': 'hsl(18, 16%, 15%)',
          '--theme-dark-surface-hover': 'hsl(18, 14%, 20%)',
          '--theme-dark-surface-modal': 'hsl(18, 18%, 11%)',
          '--theme-dark-input-bg': 'hsl(18, 16%, 14%)',
          '--theme-light-surface-base': 'hsl(18, 62%, 97%)',
          '--theme-light-surface-panel': 'hsl(18, 30%, 99%)',
          '--theme-light-surface-card': 'hsl(18, 32%, 97%)',
          '--theme-light-surface-hover': 'hsl(18, 24%, 91%)',
          '--theme-light-surface-modal': 'hsl(18, 28%, 99%)',
        },
        recommendedPrimaryPresetIds: ['peach', 'ember', 'amber'],
      },
    ],
  },
  {
    id: 'forest',
    labelKey: 'settings.themeFamilies.forest.label',
    descriptionKey: 'settings.themeFamilies.forest.description',
    preview: ['#c7f0d1', '#34a853', '#14281d'],
    defaultVariant: 'moss',
    variants: [
      {
        id: 'moss',
        labelKey: 'settings.themeFamilies.forest.variants.moss.label',
        descriptionKey: 'settings.themeFamilies.forest.variants.moss.description',
        preview: ['#c7f0d1', '#34a853', '#14281d'],
        overrides: {},
        recommendedPrimaryPresetIds: ['moss', 'teal', 'amber'],
      },
    ],
  },
  {
    id: 'tide',
    labelKey: 'settings.themeFamilies.tide.label',
    descriptionKey: 'settings.themeFamilies.tide.description',
    preview: ['#c8f8f4', '#0f9f95', '#102a33'],
    defaultVariant: 'sea',
    variants: [
      {
        id: 'sea',
        labelKey: 'settings.themeFamilies.tide.variants.sea.label',
        descriptionKey: 'settings.themeFamilies.tide.variants.sea.description',
        preview: ['#c8f8f4', '#0f9f95', '#102a33'],
        overrides: {},
        recommendedPrimaryPresetIds: ['teal', 'sky', 'mint'],
      },
    ],
  },
  {
    id: 'dune',
    labelKey: 'settings.themeFamilies.dune.label',
    descriptionKey: 'settings.themeFamilies.dune.description',
    preview: ['#f5e4c3', '#b7791f', '#2f261c'],
    defaultVariant: 'sand',
    variants: [
      {
        id: 'sand',
        labelKey: 'settings.themeFamilies.dune.variants.sand.label',
        descriptionKey: 'settings.themeFamilies.dune.variants.sand.description',
        preview: ['#f5e4c3', '#b7791f', '#2f261c'],
        overrides: {},
        recommendedPrimaryPresetIds: ['amber', 'warm-gray', 'ember'],
      },
    ],
  },
  {
    id: 'ember',
    labelKey: 'settings.themeFamilies.ember.label',
    descriptionKey: 'settings.themeFamilies.ember.description',
    preview: ['#ffd7c7', '#dd6b38', '#2b1711'],
    defaultVariant: 'ember',
    variants: [
      {
        id: 'ember',
        labelKey: 'settings.themeFamilies.ember.variants.ember.label',
        descriptionKey: 'settings.themeFamilies.ember.variants.ember.description',
        preview: ['#ffd7c7', '#dd6b38', '#2b1711'],
        overrides: {},
        recommendedPrimaryPresetIds: ['ember', 'peach', 'amber'],
      },
    ],
  },
] as const;

const SETTINGS_STORAGE_KEY = 'netior:settings:v3';
const PRIMARY_SCALE_KEYS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const PRIMARY_VAR_NAMES = PRIMARY_SCALE_KEYS.map((key) => `--palette-primary-${key}`);
const VARIANT_VAR_NAMES = Array.from(
  new Set(THEME_FAMILIES.flatMap((family) => family.variants.flatMap((variant) => Object.keys(variant.overrides)))),
);
const MANAGED_THEME_VARS = [...PRIMARY_VAR_NAMES, ...VARIANT_VAR_NAMES];

export const AVAILABLE_THEME_FAMILIES = THEME_FAMILIES;
export const AVAILABLE_PRIMARY_PRESETS = PRIMARY_PRESETS;

function findFamily(familyId: ThemeFamily): ThemeFamilyDefinition {
  return THEME_FAMILIES.find((family) => family.id === familyId) ?? THEME_FAMILIES[0];
}

function findVariant(familyId: ThemeFamily, variantId: string): ThemeVariantDefinition {
  const family = findFamily(familyId);
  return family.variants.find((variant) => variant.id === variantId) ?? family.variants[0];
}

function findPrimaryPreset(presetId: string): PrimaryPresetDefinition {
  return PRIMARY_PRESETS.find((preset) => preset.id === presetId) ?? PRIMARY_PRESETS[0];
}

export function getThemeVariants(familyId: ThemeFamily): readonly ThemeVariantDefinition[] {
  return findFamily(familyId).variants;
}

export function getPrimaryPresets(ids?: readonly string[]): readonly PrimaryPresetDefinition[] {
  if (!ids || ids.length === 0) return PRIMARY_PRESETS;
  return ids.map(findPrimaryPreset);
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safeHex = normalizeHexColor(hex, '#808080').slice(1);
  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(baseHex: string, targetHex: string, amount: number): string {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return rgbToHex(
    base.r + (target.r - base.r) * amount,
    base.g + (target.g - base.g) * amount,
    base.b + (target.b - base.b) * amount,
  );
}

function buildPrimaryPalette(seedHex: string): CssVariableMap {
  const safeSeed = normalizeHexColor(seedHex, '#808080');
  return {
    '--palette-primary-50': mixHex(safeSeed, '#ffffff', 0.92),
    '--palette-primary-100': mixHex(safeSeed, '#ffffff', 0.82),
    '--palette-primary-200': mixHex(safeSeed, '#ffffff', 0.64),
    '--palette-primary-300': mixHex(safeSeed, '#ffffff', 0.46),
    '--palette-primary-400': mixHex(safeSeed, '#ffffff', 0.24),
    '--palette-primary-500': safeSeed,
    '--palette-primary-600': mixHex(safeSeed, '#000000', 0.14),
    '--palette-primary-700': mixHex(safeSeed, '#000000', 0.28),
    '--palette-primary-800': mixHex(safeSeed, '#000000', 0.42),
    '--palette-primary-900': mixHex(safeSeed, '#000000', 0.60),
    '--palette-primary-950': mixHex(safeSeed, '#000000', 0.78),
  };
}

function resolveMode(mode: AppearanceMode): ResolvedThemeMode {
  if (mode === 'dark' || mode === 'light') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getDefaultThemeSlot(mode: ResolvedThemeMode): ThemeSlotConfig {
  return mode === 'light'
    ? {
        family: 'pastel',
        variant: 'violet',
        primaryMode: 'preset',
        primaryPresetId: 'violet',
        primaryCustomColor: '#9b8cff',
      }
    : {
        family: 'hearth',
        variant: 'warm',
        primaryMode: 'preset',
        primaryPresetId: 'warm-gray',
        primaryCustomColor: '#8f7f73',
      };
}

function normalizeThemeSlot(config: ThemeSlotConfig): ThemeSlotConfig {
  const family = findFamily(config.family).id;
  const variant = findVariant(family, config.variant).id;
  const variantDef = findVariant(family, variant);
  const fallbackPreset = findPrimaryPreset(variantDef.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id);
  const preset = findPrimaryPreset(config.primaryPresetId);

  return {
    family,
    variant,
    primaryMode: config.primaryMode === 'custom' ? 'custom' : 'preset',
    primaryPresetId: preset.id || fallbackPreset.id,
    primaryCustomColor: normalizeHexColor(config.primaryCustomColor, fallbackPreset.color),
  };
}

function applyThemeToDocument(state: {
  appearanceMode: AppearanceMode;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
}): ResolvedThemeMode {
  if (typeof document === 'undefined') return resolveMode(state.appearanceMode);

  const resolvedThemeMode = resolveMode(state.appearanceMode);
  const activeTheme = normalizeThemeSlot(resolvedThemeMode === 'light' ? state.lightTheme : state.darkTheme);
  const root = document.documentElement;
  const variant = findVariant(activeTheme.family, activeTheme.variant);
  const preset = findPrimaryPreset(activeTheme.primaryPresetId);
  const primarySeed = activeTheme.primaryMode === 'custom'
    ? normalizeHexColor(activeTheme.primaryCustomColor, preset.color)
    : preset.color;
  const primaryVars = buildPrimaryPalette(primarySeed);
  const themeVars = { ...variant.overrides, ...primaryVars };

  root.setAttribute('data-mode', resolvedThemeMode);
  root.setAttribute('data-concept', activeTheme.family);
  root.setAttribute('data-theme-family', activeTheme.family);
  root.setAttribute('data-theme-variant', activeTheme.variant);
  root.setAttribute('data-theme-primary-mode', activeTheme.primaryMode);

  for (const varName of MANAGED_THEME_VARS) {
    root.style.removeProperty(varName);
  }
  for (const [varName, value] of Object.entries(themeVars)) {
    root.style.setProperty(varName, value);
  }

  return resolvedThemeMode;
}

let systemThemeListenerAttached = false;

export interface SettingsStore {
  appearanceMode: AppearanceMode;
  resolvedThemeMode: ResolvedThemeMode;
  themeRevision: number;
  lightTheme: ThemeSlotConfig;
  darkTheme: ThemeSlotConfig;
  locale: Locale;
  detachedAgentToastMode: DetachedAgentToastMode;

  setAppearanceMode: (mode: AppearanceMode) => void;
  setThemeFamily: (mode: ResolvedThemeMode, family: ThemeFamily) => void;
  setThemeVariant: (mode: ResolvedThemeMode, variant: string) => void;
  setThemePrimaryMode: (mode: ResolvedThemeMode, primaryMode: ThemePrimaryMode) => void;
  setThemePrimaryPreset: (mode: ResolvedThemeMode, presetId: PrimaryPresetId) => void;
  setThemePrimaryCustomColor: (mode: ResolvedThemeMode, color: string) => void;
  setLocale: (locale: Locale) => void;
  setDetachedAgentToastMode: (mode: DetachedAgentToastMode) => void;
}

function applyCurrentThemeSnapshot(
  partial: Pick<SettingsStore, 'appearanceMode' | 'lightTheme' | 'darkTheme'>,
): ResolvedThemeMode {
  return applyThemeToDocument({
    appearanceMode: partial.appearanceMode,
    lightTheme: normalizeThemeSlot(partial.lightTheme),
    darkTheme: normalizeThemeSlot(partial.darkTheme),
  });
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      appearanceMode: 'system',
      resolvedThemeMode: 'dark',
      themeRevision: 0,
      lightTheme: getDefaultThemeSlot('light'),
      darkTheme: getDefaultThemeSlot('dark'),
      locale: 'ko',
      detachedAgentToastMode: 'inactive-only',

      setAppearanceMode: (appearanceMode) => {
        set({ appearanceMode });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemeFamily: (mode, family) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          const current = state[key];
          const nextFamily = findFamily(family);
          const nextVariant = findVariant(nextFamily.id, nextFamily.defaultVariant);
          const nextPresetId = nextVariant.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id;
          return {
            [key]: normalizeThemeSlot({
              ...current,
              family: nextFamily.id,
              variant: nextVariant.id,
              primaryPresetId: nextPresetId,
              primaryCustomColor: findPrimaryPreset(nextPresetId).color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemeVariant: (mode, variant) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          const current = state[key];
          const nextVariant = findVariant(current.family, variant);
          const nextPresetId = nextVariant.recommendedPrimaryPresetIds.includes(current.primaryPresetId)
            ? current.primaryPresetId
            : (nextVariant.recommendedPrimaryPresetIds[0] ?? PRIMARY_PRESETS[0].id);
          return {
            [key]: normalizeThemeSlot({
              ...current,
              variant: nextVariant.id,
              primaryPresetId: nextPresetId,
              primaryCustomColor: current.primaryMode === 'custom'
                ? current.primaryCustomColor
                : findPrimaryPreset(nextPresetId).color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryMode: (mode, primaryMode) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryMode,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryPreset: (mode, primaryPresetId) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryPresetId,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setThemePrimaryCustomColor: (mode, color) => {
        set((state) => {
          const key = mode === 'light' ? 'lightTheme' : 'darkTheme';
          return {
            [key]: normalizeThemeSlot({
              ...state[key],
              primaryMode: 'custom',
              primaryCustomColor: color,
            }),
          } as Pick<SettingsStore, typeof key>;
        });
        const resolvedThemeMode = applyCurrentThemeSnapshot(get());
        set((state) => ({ resolvedThemeMode, themeRevision: state.themeRevision + 1 }));
      },

      setLocale: (locale) => set({ locale }),
      setDetachedAgentToastMode: (detachedAgentToastMode) => set({ detachedAgentToastMode }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appearanceMode: state.appearanceMode,
        lightTheme: state.lightTheme,
        darkTheme: state.darkTheme,
        locale: state.locale,
        detachedAgentToastMode: state.detachedAgentToastMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalizedState = {
          appearanceMode: state.appearanceMode,
          lightTheme: normalizeThemeSlot(state.lightTheme),
          darkTheme: normalizeThemeSlot(state.darkTheme),
        };
        const resolvedThemeMode = applyThemeToDocument(normalizedState);
        state.lightTheme = normalizedState.lightTheme;
        state.darkTheme = normalizedState.darkTheme;
        state.resolvedThemeMode = resolvedThemeMode;
        state.themeRevision += 1;
      },
    },
  ),
);

export function initializeSettingsStore(): void {
  const state = useSettingsStore.getState();
  const resolvedThemeMode = applyCurrentThemeSnapshot(state);
  if (state.resolvedThemeMode !== resolvedThemeMode) {
    useSettingsStore.setState((current) => ({ ...current, resolvedThemeMode, themeRevision: current.themeRevision + 1 }));
  }

  if (systemThemeListenerAttached || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    const current = useSettingsStore.getState();
    if (current.appearanceMode !== 'system') return;
    const nextResolved = applyCurrentThemeSnapshot(current);
    useSettingsStore.setState((stateSnapshot) => ({
      ...stateSnapshot,
      resolvedThemeMode: nextResolved,
      themeRevision: stateSnapshot.themeRevision + 1,
    }));
  };

  media.addEventListener('change', handleChange);
  systemThemeListenerAttached = true;
}
