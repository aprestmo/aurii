export type EntityState = "active" | "archived" | "deleted";

export interface Entity {
  id: string;
  schemaId: string;
  data: Record<string, unknown>;
  state: EntityState;
  createdAt: string;
  updatedAt: string;
}

export interface EntityInput {
  schemaId: string;
  data: Record<string, unknown>;
  state?: EntityState;
}

export interface EntityPage {
  entities: Entity[];
  total: number;
  offset: number;
  limit: number | null;
}
