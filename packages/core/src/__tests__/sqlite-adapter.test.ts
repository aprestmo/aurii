import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { SqliteAdapter } from "../storage/sqlite";

/**
 * Tests for the SQLite storage adapter.
 * Uses in-memory databases (:memory:) to avoid filesystem artefacts.
 */

let db: SqliteAdapter;

beforeEach(async () => {
	db = new SqliteAdapter(":memory:");
	await db.init();
});

afterEach(async () => {
	await db.close();
});

const sampleSchema = {
	id: "article",
	name: "Article",
	fields: [
		{ name: "title", type: "string" as const, required: true },
		{ name: "published", type: "boolean" as const },
		{ name: "views", type: "number" as const },
	],
};

describe("datasets", () => {
	it("always has the default dataset after init", async () => {
		const datasets = await db.listDatasets();
		expect(datasets.some((d) => d.id === "default")).toBe(true);
	});

	it("creates a new dataset", async () => {
		const ds = await db.createDataset({ id: "blog", name: "Blog" });
		expect(ds.id).toBe("blog");
		expect(ds.name).toBe("Blog");
		expect(ds.createdAt).toBeTruthy();
	});

	it("retrieves a dataset by id", async () => {
		await db.createDataset({ id: "test", name: "Test", description: "desc" });
		const ds = await db.getDataset("test");
		expect(ds?.id).toBe("test");
		expect(ds?.description).toBe("desc");
	});

	it("returns null for unknown dataset", async () => {
		expect(await db.getDataset("does-not-exist")).toBeNull();
	});

	it("upserts dataset on duplicate id", async () => {
		await db.createDataset({ id: "blog", name: "Blog" });
		await db.createDataset({ id: "blog", name: "Updated Blog" });
		const ds = await db.getDataset("blog");
		expect(ds?.name).toBe("Updated Blog");
	});
});

describe("schemas", () => {
	beforeEach(async () => {
		await db.createDataset({ id: "test", name: "Test" });
	});

	it("upserts and retrieves a schema", async () => {
		const stored = await db.upsertSchema(sampleSchema, "test");
		expect(stored.id).toBe("article");
		expect(stored.datasetId).toBe("test");
		expect(stored.fields).toHaveLength(3);
	});

	it("returns null for unknown schema", async () => {
		expect(await db.getSchema("unknown", "test")).toBeNull();
	});

	it("lists schemas in a dataset", async () => {
		await db.upsertSchema(sampleSchema, "test");
		await db.upsertSchema(
			{ id: "product", name: "Product", fields: [] },
			"test",
		);
		const list = await db.listSchemas("test");
		expect(list).toHaveLength(2);
	});

	it("lists schemas across all datasets when no datasetId given", async () => {
		await db.upsertSchema(sampleSchema, "test");
		await db.upsertSchema(sampleSchema, "default");
		const all = await db.listSchemas();
		expect(all.length).toBeGreaterThanOrEqual(2);
	});

	it("deletes a schema", async () => {
		await db.upsertSchema(sampleSchema, "test");
		const deleted = await db.deleteSchema("article", "test");
		expect(deleted).toBe(true);
		expect(await db.getSchema("article", "test")).toBeNull();
	});

	it("returns false when deleting non-existent schema", async () => {
		expect(await db.deleteSchema("ghost", "test")).toBe(false);
	});
});

describe("entities", () => {
	beforeEach(async () => {
		await db.createDataset({ id: "test", name: "Test" });
		await db.upsertSchema(sampleSchema, "test");
	});

	it("inserts and retrieves entities", async () => {
		const inserted = await db.insertEntities(
			[
				{
					schemaId: "article",
					data: { title: "Hello", published: true, views: 100 },
				},
				{
					schemaId: "article",
					data: { title: "World", published: false, views: 50 },
				},
			],
			"test",
		);
		expect(inserted).toHaveLength(2);

		// insertEntities fetches via IN (...) which has no guaranteed order,
		// so find the entity by matching data instead of assuming array position.
		const titles = inserted.map((e) => e.data["title"] as string);
		expect(titles).toContain("Hello");
		expect(titles).toContain("World");

		const hello = inserted.find((e) => e.data["title"] === "Hello")!;
		const fetched = await db.getEntity(hello.id);
		expect(fetched?.data["title"]).toBe("Hello");
	});

	it("returns null for unknown entity", async () => {
		expect(
			await db.getEntity("00000000-0000-0000-0000-000000000000"),
		).toBeNull();
	});

	it("lists entities by schema", async () => {
		await db.insertEntities(
			[
				{ schemaId: "article", data: { title: "A" } },
				{ schemaId: "article", data: { title: "B" } },
			],
			"test",
		);
		const list = await db.listEntities("article", "test");
		expect(list).toHaveLength(2);
	});

	it("respects limit and offset", async () => {
		for (let i = 0; i < 5; i++) {
			await db.insertEntities(
				[{ schemaId: "article", data: { title: `Article ${i}` } }],
				"test",
			);
		}
		const page1 = await db.listEntities("article", "test", 2, 0);
		const page2 = await db.listEntities("article", "test", 2, 2);
		expect(page1).toHaveLength(2);
		expect(page2).toHaveLength(2);
		expect(page1[0]!.id).not.toBe(page2[0]!.id);
	});

	it("counts entities", async () => {
		await db.insertEntities(
			[
				{ schemaId: "article", data: { title: "A" } },
				{ schemaId: "article", data: { title: "B" } },
				{ schemaId: "article", data: { title: "C" } },
			],
			"test",
		);
		expect(await db.countEntities("article", "test")).toBe(3);
	});
});

describe("executeQuery", () => {
	beforeEach(async () => {
		await db.createDataset({ id: "test", name: "Test" });
		await db.upsertSchema(sampleSchema, "test");
		await db.insertEntities(
			[
				{
					schemaId: "article",
					data: { title: "Alpha", published: true, views: 10 },
				},
				{
					schemaId: "article",
					data: { title: "Beta", published: false, views: 50 },
				},
				{
					schemaId: "article",
					data: { title: "Gamma", published: true, views: 30 },
				},
			],
			"test",
		);
	});

	it("returns all entities with just from clause", async () => {
		const result = await db.executeQuery({ from: "article" }, "test");
		expect(result).toHaveLength(3);
	});

	it("filters with == condition", async () => {
		const result = await db.executeQuery(
			{
				from: "article",
				where: [{ field: "published", op: "==", value: true }],
			},
			"test",
		);
		expect(result).toHaveLength(2);
		expect(result.every((e) => e.data["published"] === true)).toBe(true);
	});

	it("filters with > condition", async () => {
		const result = await db.executeQuery(
			{ from: "article", where: [{ field: "views", op: ">", value: 20 }] },
			"test",
		);
		expect(result).toHaveLength(2);
	});

	it("filters with contains condition", async () => {
		const result = await db.executeQuery(
			{
				from: "article",
				where: [{ field: "title", op: "contains", value: "lph" }],
			},
			"test",
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.data["title"]).toBe("Alpha");
	});

	it("applies limit", async () => {
		const result = await db.executeQuery({ from: "article", limit: 2 }, "test");
		expect(result).toHaveLength(2);
	});

	it("applies select projection", async () => {
		const result = await db.executeQuery(
			{ from: "article", select: ["title"] },
			"test",
		);
		expect(result.every((e) => Object.keys(e.data).length === 1)).toBe(true);
		expect(result.every((e) => "title" in e.data)).toBe(true);
	});
});

describe("import runs", () => {
	it("records and lists import runs", async () => {
		await db.recordImportRun({
			id: "run-1",
			definitionId: "def-1",
			datasetId: "default",
			schemaId: "article",
			status: "completed",
			dryRun: false,
			total: 10,
			imported: 10,
			failed: 0,
			errors: [],
			startedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		});

		const runs = await db.listImportRuns("default");
		expect(runs).toHaveLength(1);
		expect(runs[0]!.id).toBe("run-1");
		expect(runs[0]!.imported).toBe(10);
	});

	it("updates an import run", async () => {
		await db.recordImportRun({
			id: "run-2",
			definitionId: null,
			datasetId: "default",
			schemaId: null,
			status: "running",
			dryRun: false,
			total: 0,
			imported: 0,
			failed: 0,
			errors: [],
			startedAt: new Date().toISOString(),
			completedAt: null,
		});

		await db.updateImportRun("run-2", {
			status: "completed",
			imported: 5,
			total: 5,
		});
		const runs = await db.listImportRuns("default");
		const run = runs.find((r) => r.id === "run-2");
		expect(run?.status).toBe("completed");
		expect(run?.imported).toBe(5);
	});
});

describe("stats", () => {
	it("returns stats for empty dataset", async () => {
		const stats = await db.getStats("default");
		expect(stats.datasetId).toBe("default");
		expect(stats.totalEntities).toBe(0);
		expect(stats.schemas).toHaveLength(0);
	});

	it("returns correct total and field coverage", async () => {
		await db.createDataset({ id: "stats-test", name: "Stats Test" });
		await db.upsertSchema(sampleSchema, "stats-test");
		await db.insertEntities(
			[
				{ schemaId: "article", data: { title: "A", published: true } },
				{ schemaId: "article", data: { title: "B" } },
			],
			"stats-test",
		);

		const stats = await db.getStats("stats-test");
		expect(stats.totalEntities).toBe(2);
		const articleStats = stats.schemas.find((s) => s.schemaId === "article");
		expect(articleStats?.count).toBe(2);
		const titleCoverage = articleStats?.fieldCoverage.find(
			(f) => f.field === "title",
		);
		expect(titleCoverage?.pct).toBe(100);
		const publishedCoverage = articleStats?.fieldCoverage.find(
			(f) => f.field === "published",
		);
		expect(publishedCoverage?.pct).toBe(50);
	});
});
