/**
 * PostgresPlatformStore — same contract as SqlitePlatformStore.
 * Skips when DATABASE_URL is unset.
 */

import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { createDurablePlatformStore } from "../platform/durable-store";
import { PostgresPlatformStore } from "../platform/postgres-store";
import { assertPlatformStoreContract } from "./platform-store-contract";

const DATABASE_URL = process.env["DATABASE_URL"];

const PLATFORM_TABLES = [
	"aurii_audit_events",
	"aurii_secrets",
	"aurii_project_tokens",
	"aurii_published_routes",
	"aurii_saved_imports",
	"aurii_data_sources",
];

async function truncatePlatform(url: string): Promise<void> {
	const sql = new SQL(url);
	await sql.unsafe(`TRUNCATE ${PLATFORM_TABLES.join(", ")} CASCADE`);
	await sql.close();
}

describe.skipIf(!DATABASE_URL)("PostgresPlatformStore", () => {
	beforeAll(async () => {
		const probe = new PostgresPlatformStore(DATABASE_URL);
		await probe.init();
		await probe.close();
	});

	afterEach(async () => {
		await truncatePlatform(DATABASE_URL!);
	});

	test("persists the platform contract and survives reopen", async () => {
		const store = new PostgresPlatformStore(DATABASE_URL);
		await store.init();
		await assertPlatformStoreContract(store);
		await store.close();

		const reopened = new PostgresPlatformStore(DATABASE_URL);
		await reopened.init();
		const sources = await reopened.listDataSources("proj-1");
		expect(sources).toHaveLength(1);
		expect(sources[0]?.id).toBe("kartverket");
		const route = await reopened.findEnabledRouteByPath("proj-1", "/counties");
		expect(route?.routeId).toBe("counties");
		expect(await reopened.getSecret("sec-1")).toBe("super-secret-value");
		await reopened.close();
	});

	test("createDurablePlatformStore uses postgres when DATABASE_URL is primary", async () => {
		const prevPath = process.env["AURII_DB_PATH"];
		const prevMode = process.env["AURII_PLATFORM_STORE"];
		delete process.env["AURII_DB_PATH"];
		delete process.env["AURII_PLATFORM_STORE"];
		const store = createDurablePlatformStore();
		expect(store?.kind).toBe("postgres");
		if (store instanceof PostgresPlatformStore) await store.close();
		if (prevPath === undefined) delete process.env["AURII_DB_PATH"];
		else process.env["AURII_DB_PATH"] = prevPath;
		if (prevMode === undefined) delete process.env["AURII_PLATFORM_STORE"];
		else process.env["AURII_PLATFORM_STORE"] = prevMode;
	});
});
