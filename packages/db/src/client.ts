import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type AuriiDb = ReturnType<typeof createDb>;

/**
 * Create a Drizzle client backed by postgres.js.
 *
 * Uses DATABASE_URL when `connectionString` is omitted.
 */
export function createDb(connectionString?: string) {
	const url =
		connectionString ??
		process.env["DATABASE_URL"] ??
		"postgres://aurii:aurii@localhost:5432/aurii";
	const client = postgres(url, { max: 10, connect_timeout: 10 });
	const db = drizzle(client, { schema });
	return Object.assign(db, {
		/** Close the underlying connection pool. */
		async $close(): Promise<void> {
			await client.end({ timeout: 5 });
		},
		/** Expose the raw postgres.js client for migrations. */
		$client: client,
	});
}

export { schema };
