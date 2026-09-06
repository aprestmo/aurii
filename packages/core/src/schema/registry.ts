import { requireWritableDatasetProject } from "../project/dataset-context";
import { DEFAULT_DATASET, getStorage } from "../storage";
import {
	classifySchemaChange,
} from "./evolution";
import type { SchemaDefinition, StoredSchema } from "./types";
import { validateSchemaDefinition } from "./validator";

export interface RegisterSchemaResult {
	schema: StoredSchema;
	change: ReturnType<typeof classifySchemaChange> | null;
}

/**
 * Register (upsert) a schema on a dataset.
 *
 * This is a runtime mutation: project write policy is enforced via
 * Schema → Dataset → Project. Static YAML files under product trees are not
 * themselves mutations until this function (or CLI/API that calls it) runs.
 *
 * Schema evolution: compares against the previous definition, classifies the
 * change, and bumps schemaVersion when the definition changes. Existing
 * entities are not rewritten. See docs/SCHEMA_EVOLUTION.md.
 */
export async function registerSchema(
	def: SchemaDefinition,
	datasetId: string = DEFAULT_DATASET,
): Promise<StoredSchema> {
	const result = await registerSchemaDetailed(def, datasetId);
	return result.schema;
}

export async function registerSchemaDetailed(
	def: SchemaDefinition,
	datasetId: string = DEFAULT_DATASET,
): Promise<RegisterSchemaResult> {
	const validation = validateSchemaDefinition(def);
	if (!validation.valid) {
		throw new Error(`Invalid schema: ${validation.errors.join("; ")}`);
	}
	await requireWritableDatasetProject(datasetId, "schema.register");
	const storage = await getStorage();
	const dataset = await storage.getDataset(datasetId);
	if (!dataset) {
		throw new Error(`Dataset "${datasetId}" not found`);
	}

	const previous = await storage.getSchema(def.id, datasetId);
	let change: ReturnType<typeof classifySchemaChange> | null = null;
	let version = def.version ?? previous?.version ?? 1;

	if (previous) {
		change = classifySchemaChange(previous, def);
		const fieldsChanged =
			JSON.stringify(previous.fields) !== JSON.stringify(def.fields) ||
			previous.name !== def.name ||
			(previous.description ?? "") !== (def.description ?? "");
		if (fieldsChanged || change.kind !== "compatible" || change.reasons.length > 0) {
			if (def.version !== undefined && def.version > previous.version) {
				version = def.version;
			} else {
				version = previous.version + 1;
			}
		} else {
			version = previous.version;
		}
	}

	const schema = await storage.upsertSchema(
		{ ...def, version },
		datasetId,
	);
	return { schema, change };
}

export async function getSchema(
	id: string,
	datasetId: string = DEFAULT_DATASET,
): Promise<StoredSchema | null> {
	const storage = await getStorage();
	return storage.getSchema(id, datasetId);
}

export async function listSchemas(datasetId?: string): Promise<StoredSchema[]> {
	const storage = await getStorage();
	return storage.listSchemas(datasetId);
}

/**
 * Delete a schema from a dataset (runtime mutation — project must be writable).
 */
export async function deleteSchema(
	id: string,
	datasetId: string = DEFAULT_DATASET,
): Promise<boolean> {
	await requireWritableDatasetProject(datasetId, "schema.delete");
	const storage = await getStorage();
	return storage.deleteSchema(id, datasetId);
}
