import { useCallback } from 'react';
import { translate, type TranslationKey } from '@moc/shared/i18n';
import { useSettingsStore } from '../stores/settings-store';

export function useI18n() {
  const locale = useSettingsStore((s) => s.locale);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  return { t, locale };
}
