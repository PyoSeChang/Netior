import {
  getModelDescriptionKey,
  getModelLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import type { Model, ModelKey } from '@netior/shared/types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
type ModelDisplaySource = Pick<Model, 'key' | 'name' | 'description' | 'built_in'>;

export function getModelDisplayName(model: ModelDisplaySource, t: Translate): string {
  if (!model.built_in) return model.name;
  return t(getModelLabelKey(model.key as ModelKey) as TranslationKey);
}

export function getModelDisplayDescription(
  model: ModelDisplaySource,
  t: Translate,
): string | null {
  if (!model.built_in) return model.description;
  return t(getModelDescriptionKey(model.key as ModelKey) as TranslationKey);
}
