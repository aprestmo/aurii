import { DEFAULT_DATASET, getStorage } from "../storage";
import type { Entity, EntityInput } from "./types";

export async function createEntity(
	input: EntityInput,
	datasetId: string = DEFAULT_DATASET,
): Promise<Entity> {
	const storage = await getStorage();
	const [entity] = await storage.insertEntities([input], datasetId);
	return entity!;
}

export async function createEntities(
	inputs: EntityInput[],
	datasetId: string = DEFAULT_DATASET,
): Promise<Entity[]> {
	const storage = await getStorage();
	return storage.insertEntities(inputs, datasetId);
}

export async function getEntity(id: string): Promise<Entity | null> {
	const storage = await getStorage();
	return storage.getEntity(id);
}

export async function listEntities(
	schemaId: string,
	datasetId: string = DEFAULT_DATASET,
	limit?: number,
	offset?: number,
): Promise<Entity[]> {
	const storage = await getStorage();
	return storage.listEntities(schemaId, datasetId, limit, offset);
}

export async function countEntities(
	schemaId: string,
	datasetId: string = DEFAULT_DATASET,
): Promise<number> {
	const storage = await getStorage();
	return storage.countEntities(schemaId, datasetId);
}
