/**
 * Durable SqlitePlatformStore — survives reopen of the same DB file.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createDurablePlatformStore,
	SqlitePlatformStore,
} from "../platform/sqlite-store";

describe("SqlitePlatformStore", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const d of dirs.splice(0)) {
			rmSync(d, { recursive: true, force: true });
		}
	});

	test("persists sources, imports, routes across reopen", async () => {
		const dir = mkdtempSync(join(tmpdir(), "aurii-platform-"));
		dirs.push(dir);
		const dbPath = join(dir, "platform.db");

		const store = new SqlitePlatformStore(dbPath);
		store.init();

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

		store.close();

		const reopened = new SqlitePlatformStore(dbPath);
		reopened.init();
		const sources = await reopened.listDataSources("proj-1");
		expect(sources).toHaveLength(1);
		expect(sources[0]?.id).toBe("kartverket");

		const imports = await reopened.listSavedImports("proj-1");
		expect(imports[0]?.schedule?.spec.expression).toBe("0 4 * * *");

		const route = await reopened.findEnabledRouteByPath("proj-1", "/counties");
		expect(route?.routeId).toBe("counties");
		reopened.close();
	});

	test("createDurablePlatformStore skips :memory:", () => {
		const prev = process.env["AURII_DB_PATH"];
		process.env["AURII_DB_PATH"] = ":memory:";
		expect(createDurablePlatformStore()).toBeNull();
		if (prev === undefined) delete process.env["AURII_DB_PATH"];
		else process.env["AURII_DB_PATH"] = prev;
	});

	test("secrets never appear in list payloads", async () => {
		const dir = mkdtempSync(join(tmpdir(), "aurii-platform-"));
		dirs.push(dir);
		const store = new SqlitePlatformStore(join(dir, "s.db"));
		store.init();
		await store.putSecret("sec-1", "super-secret-value");
		expect(await store.getSecret("sec-1")).toBe("super-secret-value");
		const listed = await store.listDataSources("p");
		expect(JSON.stringify(listed)).not.toContain("super-secret-value");
		store.close();
	});
});
