import { DEFAULT_DATASET, getStorage } from "../storage";
import { getSchema } from "../schema/registry";
import {
	ConcurrencyConflictError,
	type EntityRevisionSnapshot,
} from "./revision";
import type { Entity, EntityInput, EntityUpdateInput } from "./types";

export async function createEntity(
	input: EntityInput,
	datasetId: string = DEFAULT_DATASET,
): Promise<Entity> {
	const storage = await getStorage();
	const enriched = await enrichSchemaVersion(input, datasetId);
	const [entity] = await storage.insertEntities([enriched], datasetId);
	return entity!;
}

export async function createEntities(
	inputs: EntityInput[],
	datasetId: string = DEFAULT_DATASET,
): Promise<Entity[]> {
	const storage = await getStorage();
	const enriched: EntityInput[] = [];
	for (const input of inputs) {
		enriched.push(await enrichSchemaVersion(input, datasetId));
	}
	return storage.insertEntities(enriched, datasetId);
}

export async function updateEntity(
	id: string,
	input: EntityUpdateInput,
): Promise<Entity> {
	const storage = await getStorage();
	const existing = await storage.getEntity(id);
	if (!existing) {
		throw new Error(`Entity "${id}" not found`);
	}
	const schemaVersion =
		input.schemaVersion ??
		(await resolveSchemaVersion(existing.schemaId, existing.datasetId));
	const updated = await storage.updateEntity(id, {
		data: input.data,
		expectedRevision: input.expectedRevision,
		state: input.state,
		schemaVersion,
	});
	if (!updated) {
		const current = await storage.getEntity(id);
		throw new ConcurrencyConflictError(
			id,
			input.expectedRevision,
			current?.entityRevision ?? input.expectedRevision,
		);
	}
	return updated;
}

export async function getEntity(id: string): Promise<Entity | null> {
	const storage = await getStorage();
	return storage.getEntity(id);
}

export async function getEntityRevision(
	id: string,
	entityRevision: number,
): Promise<EntityRevisionSnapshot | null> {
	const storage = await getStorage();
	return storage.getEntityRevision(id, entityRevision);
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

async function enrichSchemaVersion(
	input: EntityInput,
	datasetId: string,
): Promise<EntityInput> {
	if (input.schemaVersion !== undefined) return input;
	const version = await resolveSchemaVersion(input.schemaId, datasetId);
	return { ...input, schemaVersion: version };
}

async function resolveSchemaVersion(
	schemaId: string,
	datasetId: string,
): Promise<number> {
	const schema = await getSchema(schemaId, datasetId);
	return schema?.version ?? 1;
}
