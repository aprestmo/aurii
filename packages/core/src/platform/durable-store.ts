/**
 * Choose a durable PlatformStore for ops (sources, schedules, routes).
 *
 * Precedence:
 * 1. AURII_PLATFORM_STORE=memory → ephemeral (tests)
 * 2. AURII_DB_PATH=:memory: → ephemeral (tests win even if DATABASE_URL is set)
 * 3. AURII_PLATFORM_STORE=sqlite → SqlitePlatformStore (file path required)
 * 4. AURII_PLATFORM_STORE=postgres or DATABASE_URL → PostgresPlatformStore
 * 5. AURII_DB_PATH file / default aurii.db → SqlitePlatformStore
 */

import { join } from "node:path";
import { PostgresPlatformStore } from "./postgres-store";
import { SqlitePlatformStore } from "./sqlite-store";
import type { PlatformStore } from "./store";

export function createDurablePlatformStore(
	path?: string,
): PlatformStore | null {
	if (process.env["AURII_PLATFORM_STORE"] === "memory") return null;

	const dbPath =
		path ?? process.env["AURII_DB_PATH"] ?? join(process.cwd(), "aurii.db");
	if (dbPath === ":memory:") return null;

	const explicit = process.env["AURII_PLATFORM_STORE"];
	const databaseUrl = process.env["DATABASE_URL"];

	if (explicit === "sqlite") {
		const store = new SqlitePlatformStore(dbPath);
		store.init();
		return store;
	}

	if (explicit === "postgres" || databaseUrl) {
		if (!databaseUrl) {
			throw new Error(
				"AURII_PLATFORM_STORE=postgres requires DATABASE_URL",
			);
		}
		return new PostgresPlatformStore(databaseUrl);
	}

	const store = new SqlitePlatformStore(dbPath);
	store.init();
	return store;
}
