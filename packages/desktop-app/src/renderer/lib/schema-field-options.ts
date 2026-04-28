export interface SchemaFieldOptionsConfig {
  choices: string[];
  conceptOptionSourceIds: string[];
}

export function parseSchemaFieldOptions(options: string | null): SchemaFieldOptionsConfig {
  if (!options) {
    return { choices: [], conceptOptionSourceIds: [] };
  }

  try {
    const parsed = JSON.parse(options) as Record<string, unknown>;
    const choices = Array.isArray(parsed.choices)
      ? parsed.choices.filter((item): item is string => typeof item === 'string')
      : [];
    const conceptOptionSourceIds = Array.isArray(parsed.conceptOptionSourceIds)
      ? parsed.conceptOptionSourceIds.filter((item): item is string => typeof item === 'string')
      : [];

    return { choices, conceptOptionSourceIds };
  } catch {
    return { choices: [], conceptOptionSourceIds: [] };
  }
}

export function stringifySchemaFieldOptions(config: Partial<SchemaFieldOptionsConfig>): string | null {
  const normalized: Record<string, string[]> = {};
  const choices = config.choices?.filter(Boolean) ?? [];
  const conceptOptionSourceIds = config.conceptOptionSourceIds?.filter(Boolean) ?? [];

  if (choices.length > 0) normalized.choices = choices;
  if (conceptOptionSourceIds.length > 0) normalized.conceptOptionSourceIds = conceptOptionSourceIds;

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : null;
}

export function toConceptOptionValue(conceptId: string): string {
  return `concept:${conceptId}`;
}

export function fromConceptOptionValue(value: string): string | null {
  return value.startsWith('concept:') ? value.slice('concept:'.length) : null;
}
