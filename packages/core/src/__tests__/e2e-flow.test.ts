/**
 * End-to-end test: the full import-first loop.
 *
 *   schema apply → import dry-run → import → query → entity list
 *
 * Runs against an in-memory SQLite database so there are no filesystem
 * artefacts and each test starts with a clean state.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "path";
import { countEntities, getEntity, listEntities } from "../entity/store";
import { runImport } from "../import/engine";
import type { ImportDefinition } from "../import/types";
import { executeQuery } from "../query/executor";
import { parseQuery } from "../query/parser";
import { getSchema, registerSchema } from "../schema/registry";
import type { SchemaDefinition } from "../schema/types";
import { closeStorage, DEFAULT_DATASET } from "../storage";

// Point the singleton at a fresh in-memory database for every test.
beforeEach(() => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
});

afterEach(async () => {
	await closeStorage();
});

const articleSchema: SchemaDefinition = {
	id: "article",
	name: "Article",
	fields: [
		{ name: "title", type: "string", required: true },
		{ name: "author", type: "string", required: true },
		{ name: "published", type: "boolean" },
		{ name: "views", type: "number" },
	],
};

// Inline CSV that doesn't depend on the filesystem.
const csvContent = [
	"Title,Author,Published,Views",
	"Hello Aurii,Alice,yes,100",
	"Second Post,Bob,no,50",
	"Third Article,Alice,yes,200",
].join("\n");

async function writeTempCsv(): Promise<string> {
	const path = join(import.meta.dir, `__tmp_e2e_${crypto.randomUUID()}.csv`);
	await Bun.write(path, csvContent);
	return path;
}

async function deleteTempCsv(path: string) {
	try {
		if (await Bun.file(path).exists()) {
			await (await import("fs/promises")).unlink(path);
		}
	} catch {
		/* ignore */
	}
}

describe("e2e import-first flow", () => {
	it("registers a schema and retrieves it", async () => {
		const stored = await registerSchema(articleSchema, DEFAULT_DATASET);
		expect(stored.id).toBe("article");
		expect(stored.datasetId).toBe(DEFAULT_DATASET);
		expect(stored.fields).toHaveLength(4);

		const fetched = await getSchema("article", DEFAULT_DATASET);
		expect(fetched?.id).toBe("article");
	});

	it("dry-run import returns a sample without persisting", async () => {
		const csvPath = await writeTempCsv();
		try {
			await registerSchema(articleSchema, DEFAULT_DATASET);

			const def: ImportDefinition = {
				id: "test-import",
				name: "Test Import",
				schema: "article",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								title: "Title",
								author: "Author",
								published: "Published",
								views: "Views",
							},
						},
						{
							type: "transform",
							transforms: [
								{ field: "published", fn: "toBoolean" },
								{ field: "views", fn: "toNumber" },
							],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			const result = await runImport(def, "/", { dryRun: true });

			expect(result.dryRun).toBe(true);
			expect(result.total).toBe(3);
			expect(result.imported).toBe(3);
			expect(result.failed).toBe(0);
			expect(result.sample).toBeDefined();
			expect(result.sample).toHaveLength(3);

			// Nothing should be persisted
			const count = await countEntities("article", DEFAULT_DATASET);
			expect(count).toBe(0);
		} finally {
			await deleteTempCsv(csvPath);
		}
	});

	it("full import persists entities", async () => {
		const csvPath = await writeTempCsv();
		try {
			await registerSchema(articleSchema, DEFAULT_DATASET);

			const def: ImportDefinition = {
				id: "test-import",
				name: "Test Import",
				schema: "article",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								title: "Title",
								author: "Author",
								published: "Published",
								views: "Views",
							},
						},
						{
							type: "transform",
							transforms: [
								{ field: "published", fn: "toBoolean" },
								{ field: "views", fn: "toNumber" },
							],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			const result = await runImport(def, "/", { dryRun: false });

			expect(result.dryRun).toBe(false);
			expect(result.total).toBe(3);
			expect(result.imported).toBe(3);
			expect(result.failed).toBe(0);

			const count = await countEntities("article", DEFAULT_DATASET);
			expect(count).toBe(3);
		} finally {
			await deleteTempCsv(csvPath);
		}
	});

	it("entity list returns all imported entities", async () => {
		const csvPath = await writeTempCsv();
		try {
			await registerSchema(articleSchema, DEFAULT_DATASET);

			const def: ImportDefinition = {
				id: "test-import",
				name: "Test",
				schema: "article",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								title: "Title",
								author: "Author",
								published: "Published",
								views: "Views",
							},
						},
						{
							type: "transform",
							transforms: [
								{ field: "published", fn: "toBoolean" },
								{ field: "views", fn: "toNumber" },
							],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			await runImport(def, "/", { dryRun: false });

			const entities = await listEntities("article", DEFAULT_DATASET, 50, 0);
			expect(entities).toHaveLength(3);

			const firstEntity = await getEntity(entities[0]!.id);
			expect(firstEntity).not.toBeNull();
			expect(firstEntity?.data["title"]).toBeTruthy();
		} finally {
			await deleteTempCsv(csvPath);
		}
	});

	it("query filters entities by field value", async () => {
		const csvPath = await writeTempCsv();
		try {
			await registerSchema(articleSchema, DEFAULT_DATASET);

			const def: ImportDefinition = {
				id: "test-import",
				name: "Test",
				schema: "article",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								title: "Title",
								author: "Author",
								published: "Published",
								views: "Views",
							},
						},
						{
							type: "transform",
							transforms: [
								{ field: "published", fn: "toBoolean" },
								{ field: "views", fn: "toNumber" },
							],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			await runImport(def, "/", { dryRun: false });

			// Query: published articles only
			const publishedQuery = parseQuery("from article where published == true");
			const publishedResult = await executeQuery(
				publishedQuery,
				DEFAULT_DATASET,
			);
			expect(publishedResult.entities).toHaveLength(2);
			expect(
				publishedResult.entities.every((e) => e.data["published"] === true),
			).toBe(true);

			// Query: articles by Alice
			const aliceQuery = parseQuery('from article where author == "Alice"');
			const aliceResult = await executeQuery(aliceQuery, DEFAULT_DATASET);
			expect(aliceResult.entities).toHaveLength(2);

			// Query: with views > 60
			const viewsQuery = parseQuery("from article where views > 60");
			const viewsResult = await executeQuery(viewsQuery, DEFAULT_DATASET);
			expect(viewsResult.entities).toHaveLength(2); // 100 and 200
		} finally {
			await deleteTempCsv(csvPath);
		}
	});

	it("query with select returns only requested fields", async () => {
		const csvPath = await writeTempCsv();
		try {
			await registerSchema(articleSchema, DEFAULT_DATASET);

			const def: ImportDefinition = {
				id: "test-import",
				name: "Test",
				schema: "article",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{
							type: "map",
							mapping: {
								title: "Title",
								author: "Author",
								published: "Published",
								views: "Views",
							},
						},
						{
							type: "transform",
							transforms: [
								{ field: "published", fn: "toBoolean" },
								{ field: "views", fn: "toNumber" },
							],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			await runImport(def, "/", { dryRun: false });

			const q = parseQuery("from article select title, author");
			const result = await executeQuery(q, DEFAULT_DATASET);
			expect(result.entities).toHaveLength(3);
			expect(
				result.entities.every((e) => Object.keys(e.data).length === 2),
			).toBe(true);
			expect(
				result.entities.every((e) => "title" in e.data && "author" in e.data),
			).toBe(true);
		} finally {
			await deleteTempCsv(csvPath);
		}
	});

	it("reports validation failures without aborting the run", async () => {
		await registerSchema(
			{
				id: "strict",
				name: "Strict",
				fields: [
					{ name: "name", type: "string", required: true },
					{ name: "score", type: "number", required: true },
				],
			},
			DEFAULT_DATASET,
		);

		// Mix of valid and invalid rows (missing required `score`)
		const badCsvContent = "name,score\nAlice,10\nBob,\nCarol,30";
		const csvPath = join(
			import.meta.dir,
			`__tmp_e2e_strict_${crypto.randomUUID()}.csv`,
		);
		await Bun.write(csvPath, badCsvContent);

		try {
			const def: ImportDefinition = {
				id: "strict-import",
				name: "Strict Import",
				schema: "strict",
				source: { type: "csv", path: csvPath },
				pipeline: {
					steps: [
						{ type: "map", mapping: { name: "name", score: "score" } },
						{
							type: "transform",
							transforms: [{ field: "score", fn: "toNumber" }],
						},
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			};

			const result = await runImport(def, "/", { dryRun: false });
			expect(result.total).toBe(3);
			expect(result.imported).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.errors[0]!.row).toBe(2);
		} finally {
			await deleteTempCsv(csvPath);
		}
	});
});
