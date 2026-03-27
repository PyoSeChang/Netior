import type { Archetype, ArchetypeField, Concept } from '@moc/shared/types';

interface SerializeParams {
  concept: Concept;
  archetype: Archetype | null;
  fields: ArchetypeField[];
  properties: Record<string, string | null>;
}

/**
 * Serialize concept data to agent-readable flat text.
 *
 * Format:
 * # {title}
 * archetype: {name}
 *
 * ## Properties
 * - {field}: {value}
 *
 * ## Content
 * {body}
 */
export function serializeToAgent(params: SerializeParams): string {
  const { concept, archetype, fields, properties } = params;
  const lines: string[] = [];

  lines.push(`# ${concept.title}`);
  if (archetype) {
    lines.push(`archetype: ${archetype.name}`);
  }
  lines.push('');

  if (fields.length > 0) {
    lines.push('## Properties');
    for (const field of fields) {
      const value = properties[field.name] ?? field.default_value ?? '';
      lines.push(`- ${field.name}: ${value}`);
    }
    lines.push('');
  }

  lines.push('## Content');
  lines.push(concept.content ?? '');

  return lines.join('\n');
}

interface ParsedResult {
  title: string | null;
  properties: Record<string, string>;
  content: string | null;
}

/**
 * Parse agent flat text back into structured data.
 */
export function parseFromAgent(agentContent: string, fields: ArchetypeField[]): ParsedResult {
  const result: ParsedResult = {
    title: null,
    properties: {},
    content: null,
  };

  const lines = agentContent.split('\n');
  let section: 'header' | 'properties' | 'content' = 'header';
  const contentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ') && section === 'header') {
      result.title = line.slice(2).trim();
      continue;
    }

    if (line.trim() === '## Properties') {
      section = 'properties';
      continue;
    }

    if (line.trim() === '## Content') {
      section = 'content';
      continue;
    }

    if (section === 'properties' && line.startsWith('- ')) {
      const colonIdx = line.indexOf(':', 2);
      if (colonIdx !== -1) {
        const key = line.slice(2, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        // Match by field name
        const field = fields.find((f) => f.name === key);
        if (field) {
          result.properties[field.id] = value;
        }
      }
    }

    if (section === 'content') {
      contentLines.push(line);
    }
  }

  result.content = contentLines.join('\n').trim() || null;

  return result;
}

/**
 * Render a file template by replacing {{field_name}} placeholders with values.
 */
export function renderTemplate(
  template: string,
  fields: ArchetypeField[],
  properties: Record<string, string | null>,
): string {
  let result = template;
  for (const field of fields) {
    const value = properties[field.name] ?? field.default_value ?? '';
    result = result.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), value);
  }
  return result;
}
