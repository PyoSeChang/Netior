import {
  getSemanticModelDescriptionKey,
  getSemanticModelLabelKey,
} from '@netior/shared/constants';
import type { TranslationKey } from '@netior/shared/i18n';
import type { SemanticModel, SemanticModelKey } from '@netior/shared/types';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
type SemanticModelDisplaySource = Pick<SemanticModel, 'key' | 'name' | 'description' | 'built_in'>;

export function getSemanticModelDisplayName(model: SemanticModelDisplaySource, t: Translate): string {
  if (!model.built_in) return model.name;
  return t(getSemanticModelLabelKey(model.key as SemanticModelKey) as TranslationKey);
}

export function getSemanticModelDisplayDescription(
  model: SemanticModelDisplaySource,
  t: Translate,
): string | null {
  if (!model.built_in) return model.description;
  return t(getSemanticModelDescriptionKey(model.key as SemanticModelKey) as TranslationKey);
}
