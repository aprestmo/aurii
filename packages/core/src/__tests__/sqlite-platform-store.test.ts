/**
 * Durable SqlitePlatformStore — survives reopen of the same DB file.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDurablePlatformStore } from "../platform/durable-store";
import { SqlitePlatformStore } from "../platform/sqlite-store";
import { assertPlatformStoreContract } from "./platform-store-contract";

describe("SqlitePlatformStore", () => {
	const dirs: string[] = [];

	afterEach(() => {
		for (const d of dirs.splice(0)) {
			rmSync(d, { recursive: true, force: true });
		}
	});

	test("persists sources, imports, routes, tokens, secrets across reopen", async () => {
		const dir = mkdtempSync(join(tmpdir(), "aurii-platform-"));
		dirs.push(dir);
		const dbPath = join(dir, "platform.db");

		const store = new SqlitePlatformStore(dbPath);
		store.init();
		await assertPlatformStoreContract(store);
		store.close();

		const reopened = new SqlitePlatformStore(dbPath);
		reopened.init();
		const sources = await reopened.listDataSources("proj-1");
		expect(sources).toHaveLength(1);
		expect(sources[0]?.id).toBe("kartverket");
		const route = await reopened.findEnabledRouteByPath("proj-1", "/counties");
		expect(route?.routeId).toBe("counties");
		expect(await reopened.getSecret("sec-1")).toBe("super-secret-value");
		reopened.close();
	});

	test("createDurablePlatformStore skips :memory:", () => {
		const prevPath = process.env["AURII_DB_PATH"];
		const prevUrl = process.env["DATABASE_URL"];
		const prevMode = process.env["AURII_PLATFORM_STORE"];
		process.env["AURII_DB_PATH"] = ":memory:";
		delete process.env["DATABASE_URL"];
		delete process.env["AURII_PLATFORM_STORE"];
		expect(createDurablePlatformStore()).toBeNull();
		if (prevPath === undefined) delete process.env["AURII_DB_PATH"];
		else process.env["AURII_DB_PATH"] = prevPath;
		if (prevUrl === undefined) delete process.env["DATABASE_URL"];
		else process.env["DATABASE_URL"] = prevUrl;
		if (prevMode === undefined) delete process.env["AURII_PLATFORM_STORE"];
		else process.env["AURII_PLATFORM_STORE"] = prevMode;
	});

	test("createDurablePlatformStore prefers memory path over DATABASE_URL", () => {
		const prevPath = process.env["AURII_DB_PATH"];
		const prevUrl = process.env["DATABASE_URL"];
		const prevMode = process.env["AURII_PLATFORM_STORE"];
		process.env["AURII_DB_PATH"] = ":memory:";
		process.env["DATABASE_URL"] = "postgres://example.invalid/aurii";
		delete process.env["AURII_PLATFORM_STORE"];
		expect(createDurablePlatformStore()).toBeNull();
		if (prevPath === undefined) delete process.env["AURII_DB_PATH"];
		else process.env["AURII_DB_PATH"] = prevPath;
		if (prevUrl === undefined) delete process.env["DATABASE_URL"];
		else process.env["DATABASE_URL"] = prevUrl;
		if (prevMode === undefined) delete process.env["AURII_PLATFORM_STORE"];
		else process.env["AURII_PLATFORM_STORE"] = prevMode;
	});
});
