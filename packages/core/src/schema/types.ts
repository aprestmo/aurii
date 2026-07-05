export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "reference"
  | "string[]"
  | "number[]";

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  default?: unknown;
  label?: string;
  description?: string;
  /** For reference fields: the id of the referenced schema */
  schema?: string;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  description?: string;
  version?: number;
  fields: FieldDefinition[];
}

export interface StoredSchema {
  id: string;
  name: string;
  description?: string;
  version: number;
  fields: FieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
