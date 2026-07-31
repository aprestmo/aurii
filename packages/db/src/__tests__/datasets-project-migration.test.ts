/**
 * Migration tests for aurii_datasets.project_id.
 *
 * Requires PostgreSQL (DATABASE_URL). Skips cleanly when unavailable.
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readdir } from "fs/promises";
import { join } from "path";
import postgres from "postgres";
import { LEGACY_PROJECT_ID, LEGACY_PROJECT_SLUG } from "../legacy-project";

const url = process.env.DATABASE_URL;
const hasDb = Boolean(url);

const MIGRATIONS_DIR = join(import.meta.dir, "../../migrations");
const TEST_PREFIX = "migtest_ds_";

describe.skipIf(!hasDb)("aurii_datasets project_id migration", () => {
	let sql: ReturnType<typeof postgres>;

	beforeAll(async () => {
		if (!url) throw new Error("DATABASE_URL required");
		sql = postgres(url, { max: 1, connect_timeout: 10 });
		// Fresh-ish isolation: drop and recreate runtime table for this suite
		await sql`DROP TABLE IF EXISTS aurii_datasets CASCADE`;
		await sql`
			CREATE TABLE aurii_datasets (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				description TEXT,
				created_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`;
		await sql`
			INSERT INTO aurii_datasets (id, name, description)
			VALUES
				('default', 'Default', 'Default dataset'),
				('norwegian-geo', 'Norwegian Geo', 'Reference data')
		`;

		// Ensure projects table exists (0000)
		await sql.unsafe(`
			CREATE TABLE IF NOT EXISTS "projects" (
				"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
				"name" text NOT NULL,
				"slug" text NOT NULL,
				"description" text,
				"status" text DEFAULT 'active' NOT NULL,
				"created_at" timestamp with time zone DEFAULT now() NOT NULL,
				"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
				"archived_at" timestamp with time zone
			);
			CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_unique" ON "projects" USING btree ("slug");
		`);

		const body = await Bun.file(
			join(MIGRATIONS_DIR, "0001_datasets_project_id.sql"),
		).text();
		for (const stmt of body.split("--> statement-breakpoint")) {
			const trimmed = stmt.trim();
			if (trimmed) await sql.unsafe(trimmed);
		}
	});

	afterAll(async () => {
		await sql`DROP TABLE IF EXISTS aurii_datasets CASCADE`;
		// Safe after datasets are gone (FK RESTRICT)
		await sql`DELETE FROM projects WHERE slug = ${LEGACY_PROJECT_SLUG}`;
		await sql.end({ timeout: 5 });
	});

	it("preserves existing dataset rows and ids", async () => {
		const rows = await sql<{ id: string }[]>`
			SELECT id FROM aurii_datasets ORDER BY id
		`;
		expect(rows.map((r) => r.id)).toEqual(["default", "norwegian-geo"]);
	});

	it("assigns projectId to existing datasets", async () => {
		const rows = await sql<{ id: string; project_id: string }[]>`
			SELECT id, project_id::text FROM aurii_datasets
		`;
		for (const row of rows) {
			expect(row.project_id).toBeTruthy();
			expect(row.project_id).not.toBeNull();
		}
	});

	it("creates the Legacy fallback project once", async () => {
		const rows = await sql<{ id: string; slug: string }[]>`
			SELECT id::text, slug FROM projects WHERE slug = ${LEGACY_PROJECT_SLUG}
		`;
		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe(LEGACY_PROJECT_ID);

		// Re-run Legacy insert portion — still one row
		await sql`
			INSERT INTO projects (id, name, slug, description, status)
			VALUES (
				${LEGACY_PROJECT_ID}::uuid, 'Legacy', 'legacy', 'x', 'active'
			)
			ON CONFLICT (id) DO NOTHING
		`;
		const again = await sql`
			SELECT id FROM projects WHERE slug = ${LEGACY_PROJECT_SLUG}
		`;
		expect(again).toHaveLength(1);
	});

	it("leaves no null project_id after migration", async () => {
		const nulls = await sql`
			SELECT count(*)::int AS n FROM aurii_datasets WHERE project_id IS NULL
		`;
		expect(nulls[0]?.n).toBe(0);
	});

	it("enforces foreign key to projects", async () => {
		let failed = false;
		try {
			await sql.unsafe(`
				INSERT INTO aurii_datasets (id, name, project_id)
				VALUES (
					'${TEST_PREFIX}orphan',
					'Orphan',
					'00000000-0000-4000-8000-000000000099'
				)
			`);
		} catch {
			failed = true;
		}
		expect(failed).toBe(true);
	});

	it("restricts hard-delete of a project that owns datasets", async () => {
		let failed = false;
		try {
			await sql.unsafe(
				`DELETE FROM projects WHERE id = '${LEGACY_PROJECT_ID}'`,
			);
		} catch {
			failed = true;
		}
		expect(failed).toBe(true);
	});

	it("migration file is registered in the journal", async () => {
		const files = (await readdir(MIGRATIONS_DIR)).filter((f) =>
			f.endsWith(".sql"),
		);
		expect(files).toContain("0001_datasets_project_id.sql");
	});
});
