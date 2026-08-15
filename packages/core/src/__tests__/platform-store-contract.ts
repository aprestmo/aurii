/**
 * Shared PlatformStore contract used by sqlite and postgres adapters.
 */

import { expect } from "bun:test";
import type { PlatformStore } from "../platform/store";

export async function assertPlatformStoreContract(
	store: PlatformStore,
): Promise<void> {
	await store.insertDataSource({
		id: "kartverket",
		projectId: "proj-1",
		datasetId: "norwegian-geo",
		name: "Kartverket",
		kind: "file",
		status: "active",
		config: { targetSchemas: ["county"] },
		lastSuccessAt: null,
		lastFailureAt: null,
		lastError: null,
		nextRunAt: null,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	});

	await store.insertSavedImport({
		id: "counties",
		projectId: "proj-1",
		datasetId: "norwegian-geo",
		sourceId: "kartverket",
		name: "Counties",
		schemaId: "county",
		status: "active",
		triggerMode: "manual",
		definitionPath: "/tmp/counties.yaml",
		pipeline: null,
		filePath: null,
		fileFormat: null,
		schedule: {
			enabled: false,
			spec: { type: "cron", expression: "0 4 * * *", timezone: "Europe/Oslo" },
			nextRunAt: null,
			lastRunAt: null,
		},
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	});

	await store.upsertPublishedRoute({
		routeId: "counties",
		projectId: "proj-1",
		datasetId: "norwegian-geo",
		enabled: true,
		access: "public",
		cacheTtl: 60,
		version: "1",
		definition: {
			id: "counties",
			path: "/counties",
			method: "GET",
			query: { schema: "county", select: ["id", "name"] },
		},
		lastError: null,
		hitCount: 0,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	});

	await store.putSecret("sec-1", "super-secret-value");
	await store.insertToken({
		id: "tok-1",
		projectId: "proj-1",
		name: "ops",
		tokenHash: "hash-1",
		scopes: ["project:read"],
		tokenPrefix: "aur_ab",
		createdAt: "2026-01-01T00:00:00.000Z",
		revokedAt: null,
	});
	await store.appendAudit({
		id: "aud-1",
		projectId: "proj-1",
		action: "source.created",
		actor: "test",
		resourceType: "data_source",
		resourceId: "kartverket",
		detail: null,
		createdAt: "2026-01-01T00:00:00.000Z",
	});

	const sources = await store.listDataSources("proj-1");
	expect(sources).toHaveLength(1);
	expect(sources[0]?.id).toBe("kartverket");

	const imports = await store.listSavedImports("proj-1");
	expect(imports[0]?.schedule?.spec.expression).toBe("0 4 * * *");

	const route = await store.findEnabledRouteByPath("proj-1", "/counties");
	expect(route?.routeId).toBe("counties");

	expect(await store.getSecret("sec-1")).toBe("super-secret-value");
	expect(JSON.stringify(await store.listDataSources("proj-1"))).not.toContain(
		"super-secret-value",
	);

	const token = await store.findTokenByHash("hash-1");
	expect(token?.name).toBe("ops");
	const revoked = await store.revokeToken("proj-1", "tok-1");
	expect(revoked?.revokedAt).toBeTruthy();
	expect(await store.findTokenByHash("hash-1")).toBeNull();

	const audit = await store.listAudit("proj-1");
	expect(audit[0]?.action).toBe("source.created");

	expect(await store.tryAcquireRunLock("def-1")).toBe(true);
	expect(await store.tryAcquireRunLock("def-1")).toBe(false);
	await store.releaseRunLock("def-1");
	expect(await store.tryAcquireRunLock("def-1")).toBe(true);
}
