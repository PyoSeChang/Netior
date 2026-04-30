import type {
  Schema,
  SchemaField,
  SchemaMeaning,
  SchemaMeaningSlotBinding,
  Concept,
  FieldType,
  ObjectRecord,
  Model,
  TypeGroup,
  TypeGroupKind,
} from '@netior/shared/types';

export type AgentFieldType = Exclude<FieldType, 'schema_ref'> | 'schema_ref';
export type AgentTypeGroupKind = 'schema';
export type AgentObjectType = Exclude<ObjectRecord['object_type'], 'schema'> | 'schema';

export function toAgentFieldType(fieldType: FieldType): AgentFieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function fromAgentFieldType(fieldType: AgentFieldType): FieldType {
  return fieldType === 'schema_ref' ? 'schema_ref' : fieldType;
}

export function toAgentTypeGroupKind(kind: TypeGroupKind): AgentTypeGroupKind {
  return kind;
}

export function fromAgentTypeGroupKind(kind: AgentTypeGroupKind): TypeGroupKind {
  return kind;
}

export function toAgentObjectType(objectType: ObjectRecord['object_type']): AgentObjectType {
  return objectType === 'schema' ? 'schema' : objectType;
}

export function fromAgentObjectType(objectType: AgentObjectType): ObjectRecord['object_type'] {
  return objectType === 'schema' ? 'schema' : objectType;
}

export function toAgentSchema(schema: Schema) {
  const {
    ...rest
  } = schema;

  return {
    ...rest,
  };
}

export function toAgentSchemaField(field: SchemaField) {
  const {
    schema_id,
    ref_schema_id,
    slot_binding_locked: _slotBindingLocked,
    generated_by_model: _generatedByModel,
    ...schemaField
  } = field;

  return {
    ...schemaField,
    schema_id: schema_id,
    field_type: toAgentFieldType(field.field_type),
    ref_schema_id: ref_schema_id,
  };
}

export function toAgentMeaningSlot(slot: SchemaMeaningSlotBinding) {
  const {
    meaning_id,
    ...rest
  } = slot;

  return {
    ...rest,
    schema_meaning_id: meaning_id,
  };
}

export function toAgentSchemaMeaning(meaning: SchemaMeaning) {
  const {
    schema_id,
    source_model: _sourceModel,
    slots,
    ...schemaMeaning
  } = meaning;

  return {
    ...schemaMeaning,
    schema_id: schema_id,
    slots: slots.map(toAgentMeaningSlot),
  };
}

export function toAgentConcept(concept: Concept) {
  const {
    schema_id,
    ...rest
  } = concept;

  return {
    ...rest,
    schema_id: schema_id,
  };
}

export function toAgentTypeGroup(group: TypeGroup) {
  return {
    ...group,
    kind: toAgentTypeGroupKind(group.kind),
  };
}

export function toAgentObject(record: ObjectRecord) {
  return {
    ...record,
    object_type: toAgentObjectType(record.object_type),
  };
}

export function toAgentModel(model: Model) {
  return {
    ...model,
    recipe: {
      ...model.recipe,
      meanings: model.recipe.meanings.map((meaning) => ({
        ...meaning,
        fields: meaning.fields.map((field) => ({
          ...field,
          field_types: field.field_types.map(toAgentFieldType),
        })),
      })),
    },
  };
}
