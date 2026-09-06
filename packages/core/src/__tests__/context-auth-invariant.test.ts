/**
 * Context / retrieval authorization invariant (Pre–Phase 5).
 *
 * Context must only operate over information the principal is authorized to access.
 * Reject: retrieve everything → rank/AI → filter afterwards.
 *
 * See Phase5.md Context authorization invariant.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createDatasetService,
	createEntities,
	createProjectService,
	createPublishedRouteService,
	defineRoute,
	executeQuery,
	getStorage,
	listEntities,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	type ProjectService,
	type StorageAdapter,
} from "../index";

let testStorage: StorageAdapter;
let testProjects: ProjectService;

beforeEach(async () => {
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	delete process.env["DATABASE_URL"];
	resetProjectService();
	resetPlatformStore();
	await closeStorage().catch(() => undefined);
	testStorage = await getStorage();
	const repo = new MemoryProjectRepository();
	testProjects = createProjectService(repo);
	configureProjectService(testProjects);
	configurePlatformStore(new MemoryPlatformStore());
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
	resetPlatformStore();
});

function harness() {
	const datasets = createDatasetService(testStorage, testProjects);
	return { storage: testStorage, projects: testProjects, datasets };
}

describe("authorization / Context invariant", () => {
	it("query and list are dataset-scoped — entities in another dataset are not returned", async () => {
		const { projects, datasets } = harness();
		const project = await projects.createProject({
			name: "Auth Test",
			slug: `auth-${crypto.randomUUID().slice(0, 8)}`,
		});
		await datasets.createDataset(project.id, {
			id: "public-ds",
			name: "Public",
		});
		await datasets.createDataset(project.id, {
			id: "private-ds",
			name: "Private",
		});

		await registerSchema(
			{
				id: "secret",
				name: "Secret",
				fields: [{ name: "title", type: "string", required: true }],
			},
			"private-ds",
		);
		await registerSchema(
			{
				id: "page",
				name: "Page",
				fields: [{ name: "title", type: "string", required: true }],
			},
			"public-ds",
		);

		await createEntities(
			[{ schemaId: "secret", data: { title: "classified" } }],
			"private-ds",
		);
		await createEntities(
			[{ schemaId: "page", data: { title: "hello" } }],
			"public-ds",
		);

		const publicList = await listEntities("secret", "public-ds");
		expect(publicList).toHaveLength(0);

		const publicQuery = await executeQuery("from secret", "public-ds");
		expect(publicQuery.entities).toHaveLength(0);

		const privateList = await listEntities("secret", "private-ds");
		expect(privateList).toHaveLength(1);
	});

	it("relation traversal cannot expose an unauthorized target dataset via public query scope", async () => {
		const { projects, datasets } = harness();
		const project = await projects.createProject({
			name: "Rel Auth",
			slug: `rel-${crypto.randomUUID().slice(0, 8)}`,
		});
		await datasets.createDataset(project.id, {
			id: "open",
			name: "Open",
		});
		await datasets.createDataset(project.id, {
			id: "closed",
			name: "Closed",
		});

		await registerSchema(
			{
				id: "company",
				name: "Company",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "name", type: "string", required: true },
				],
			},
			"closed",
		);
		await registerSchema(
			{
				id: "article",
				name: "Article",
				fields: [
					{ name: "title", type: "string", required: true },
					{ name: "companyId", type: "reference", to: "company" },
				],
			},
			"open",
		);

		await createEntities(
			[{ schemaId: "company", data: { id: "c1", name: "Hidden Co" } }],
			"closed",
		);
		await createEntities(
			[
				{
					schemaId: "article",
					data: { title: "About Hidden", companyId: "c1" },
				},
			],
			"open",
		);

		const result = await executeQuery(
			"from article join company on article.companyId = company.id",
			"open",
		);
		const leaked = result.entities.some((e) =>
			JSON.stringify(e.data).includes("Hidden Co"),
		);
		expect(leaked).toBe(false);
	});

	it("private published routes are not executable on the public delivery surface", async () => {
		const { projects, datasets } = harness();
		const project = await projects.createProject({
			name: "Route Auth",
			slug: `route-${crypto.randomUUID().slice(0, 8)}`,
		});
		await datasets.createDataset(project.id, {
			id: "private-data",
			name: "Private Data",
		});
		await registerSchema(
			{
				id: "item",
				name: "Item",
				fields: [{ name: "title", type: "string", required: true }],
			},
			"private-data",
		);
		await createEntities(
			[{ schemaId: "item", data: { title: "secret-item" } }],
			"private-data",
		);

		const routes = createPublishedRouteService();
		const definition = defineRoute({
			id: "private-items",
			path: "/items",
			method: "GET",
			query: { schema: "item" },
			defaults: { access: "private", enabled: true },
		});
		await routes.upsert(project.id, {
			routeId: definition.id,
			datasetId: "private-data",
			enabled: true,
			access: "private",
			definition,
		});

		await expect(
			routes.execute(project.id, "/items", { authenticated: true }),
		).rejects.toMatchObject({ code: "forbidden", status: 403 });
	});

	it("public published routes only return entities from their bound dataset", async () => {
		const { projects, datasets } = harness();
		const project = await projects.createProject({
			name: "Public Route",
			slug: `pub-${crypto.randomUUID().slice(0, 8)}`,
		});
		await datasets.createDataset(project.id, { id: "a", name: "A" });
		await datasets.createDataset(project.id, { id: "b", name: "B" });

		for (const ds of ["a", "b"] as const) {
			await registerSchema(
				{
					id: "thing",
					name: "Thing",
					fields: [{ name: "title", type: "string", required: true }],
				},
				ds,
			);
		}
		await createEntities(
			[{ schemaId: "thing", data: { title: "from-a" } }],
			"a",
		);
		await createEntities(
			[{ schemaId: "thing", data: { title: "from-b" } }],
			"b",
		);

		const routes = createPublishedRouteService();
		const definition = defineRoute({
			id: "things-a",
			path: "/things",
			method: "GET",
			query: { schema: "thing" },
			defaults: { access: "public", enabled: true },
		});
		await routes.upsert(project.id, {
			routeId: definition.id,
			datasetId: "a",
			enabled: true,
			access: "public",
			definition,
		});

		const result = await routes.execute(project.id, "/things", {});
		expect(result).not.toBeNull();
		const titles = (result!.data as Array<{ title: string }>).map(
			(r) => r.title,
		);
		expect(titles).toContain("from-a");
		expect(titles).not.toContain("from-b");
	});
});
