import { requireWritableDatasetProject } from "../project/dataset-context";
import { DEFAULT_DATASET, getStorage } from "../storage";
import type { SchemaDefinition, StoredSchema } from "./types";
import { validateSchemaDefinition } from "./validator";

/**
 * Register (upsert) a schema on a dataset.
 *
 * This is a runtime mutation: project write policy is enforced via
 * Schema → Dataset → Project. Static YAML files under product trees are not
 * themselves mutations until this function (or CLI/API that calls it) runs.
 */
export async function registerSchema(
	def: SchemaDefinition,
	datasetId: string = DEFAULT_DATASET,
): Promise<StoredSchema> {
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
	return storage.upsertSchema(def, datasetId);
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
