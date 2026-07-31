/**
 * Apply pending Drizzle SQL migrations from packages/db/migrations.
 *
 * Uses a simple aurii_drizzle_migrations journal table so this works
 * without requiring drizzle-kit at runtime.
 */

import { readdir } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");

async function main() {
	const url =
		process.env["DATABASE_URL"] ??
		"postgres://aurii:aurii@localhost:5432/aurii";

	const sql = postgres(url, { max: 1, connect_timeout: 10 });

	await sql`
		CREATE TABLE IF NOT EXISTS aurii_drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash TEXT NOT NULL UNIQUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`;

	const applied = new Set(
		(await sql<{ hash: string }[]>`SELECT hash FROM aurii_drizzle_migrations`).map(
			(r) => r.hash,
		),
	);

	const files = (await readdir(MIGRATIONS_DIR))
		.filter((f) => f.endsWith(".sql"))
		.sort();

	for (const file of files) {
		if (applied.has(file)) {
			console.log(`skip  ${file}`);
			continue;
		}
		const path = join(MIGRATIONS_DIR, file);
		const body = await Bun.file(path).text();
		console.log(`apply ${file}`);
		await sql.begin(async (tx) => {
			await tx.unsafe(body);
			await tx`INSERT INTO aurii_drizzle_migrations (hash) VALUES (${file})`;
		});
	}

	await sql.end({ timeout: 5 });
	console.log("Migrations complete.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
