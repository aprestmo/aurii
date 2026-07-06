import { DEFAULT_DATASET, getStorage } from "../storage";
import type { SchemaDefinition, StoredSchema } from "./types";
import { validateSchemaDefinition } from "./validator";

export async function registerSchema(
	def: SchemaDefinition,
	datasetId: string = DEFAULT_DATASET,
): Promise<StoredSchema> {
	const validation = validateSchemaDefinition(def);
	if (!validation.valid) {
		throw new Error(`Invalid schema: ${validation.errors.join("; ")}`);
	}
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

export async function deleteSchema(
	id: string,
	datasetId: string = DEFAULT_DATASET,
): Promise<boolean> {
	const storage = await getStorage();
	return storage.deleteSchema(id, datasetId);
}
