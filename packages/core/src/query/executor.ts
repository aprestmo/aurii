import type { Entity } from "../entity/types";
import { DEFAULT_DATASET, getStorage } from "../storage";
import type { ParsedQuery } from "./parser";

export interface QueryResult {
	entities: Entity[];
	count: number;
	query: ParsedQuery;
}

export async function executeQuery(
	query: ParsedQuery,
	datasetId: string = DEFAULT_DATASET,
): Promise<QueryResult> {
	const storage = await getStorage();
	const entities = await storage.executeQuery(query, datasetId);
	return { entities, count: entities.length, query };
}
