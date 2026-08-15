/**
 * Platform services: DataSource, saved imports, published routes, scheduling.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	computeNextCronRun,
	createDataSourceService,
	createPublishedRouteService,
	createSavedImportService,
	defineRoute,
	ImportScheduler,
	MemoryPlatformStore,
	MemoryProjectRepository,
	configurePlatformStore,
	configureProjectService,
	createProjectService,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
} from "../index";
import { createEntities } from "../entity/store";
import { closeStorage, getStorage } from "../storage";

async function setup() {
	resetPlatformStore();
	resetProjectService();
	await closeStorage().catch(() => undefined);
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	const storage = await getStorage();
	const repo = new MemoryProjectRepository();
	const projects = createProjectService(repo);
	configureProjectService(projects);
	const store = new MemoryPlatformStore();
	configurePlatformStore(store);
	const project = await projects.createProject({
		name: "Norge Data",
		slug: "norge-data",
	});
	await storage.createDataset({
		id: "norwegian-geo",
		name: "NG",
		projectId: project.id,
	});
	return { storage, projects, project, store };
}

describe("DataSource + saved imports", () => {
	beforeEach(async () => {
		await closeStorage().catch(() => undefined);
	});
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("source can be created and listed; secrets redacted", async () => {
		const { project } = await setup();
		const sources = createDataSourceService();
		const created = await sources.create(project.id, {
			id: "kartverket",
			datasetId: "norwegian-geo",
			name: "Kartverket",
			kind: "file",
			config: {
				targetSchemas: ["county"],
				secrets: [{ secretId: "s1", label: "API key" }],
			},
		});
		expect(created.config.secrets?.[0]?.secretId).toBe("s1");
		expect(JSON.stringify(created)).not.toContain("supersecret");
		const list = await sources.list(project.id, "norwegian-geo");
		expect(list).toHaveLength(1);
	});

	test("import links to project and dataset", async () => {
		const { project, store } = await setup();
		const imports = createSavedImportService(store);
		const def = await imports.create(project.id, {
			id: "counties",
			datasetId: "norwegian-geo",
			sourceId: "kartverket",
			name: "Counties",
			schemaId: "county",
			definitionPath: "/tmp/does-not-matter-for-create.yaml",
		});
		expect(def.projectId).toBe(project.id);
		expect(def.datasetId).toBe("norwegian-geo");
		expect(def.sourceId).toBe("kartverket");
	});
});

describe("cron scheduling", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("cron expression next run is computed", () => {
		const next = computeNextCronRun(
			"0 4 * * *",
			"Europe/Oslo",
			new Date("2026-08-01T10:00:00Z"),
		);
		expect(typeof next).toBe("string");
		expect(new Date(next).getTime()).toBeGreaterThan(
			Date.parse("2026-08-01T10:00:00Z"),
		);
	});

	test("disabled schedule is not collected as due", async () => {
		const { project, store } = await setup();
		const imports = createSavedImportService(store);
		await imports.create(project.id, {
			id: "nightly",
			datasetId: "norwegian-geo",
			name: "Nightly",
			schemaId: "postal-code",
			filePath: "/tmp/x.json",
			fileFormat: "json",
			pipeline: { mapping: { id: "id" } },
			schedule: {
				enabled: false,
				spec: {
					type: "cron",
					expression: "0 4 * * *",
					timezone: "Europe/Oslo",
				},
				nextRunAt: new Date(0).toISOString(),
				lastRunAt: null,
			},
		});
		const scheduler = new ImportScheduler({ store, manual: true });
		expect(scheduler.isStarted()).toBe(false);
		scheduler.start();
		expect(scheduler.isStarted()).toBe(true);
		scheduler.stop();
		expect(scheduler.isStarted()).toBe(false);
		const due = await scheduler.collectDueForProjects([project.id], new Date());
		expect(due).toHaveLength(0);
	});

	test("overlapping runs prevented", async () => {
		const { store } = await setup();
		const ok = await store.tryAcquireRunLock("def-1");
		expect(ok).toBe(true);
		const again = await store.tryAcquireRunLock("def-1");
		expect(again).toBe(false);
		await store.releaseRunLock("def-1");
		expect(await store.tryAcquireRunLock("def-1")).toBe(true);
	});
});

describe("published routes", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("disabled route execute returns null", async () => {
		const { project } = await setup();
		await registerSchema(
			{
				id: "county",
				name: "County",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "name", type: "string", required: true },
				],
			},
			"norwegian-geo",
		);
		const routes = createPublishedRouteService();
		const def = defineRoute({
			id: "counties",
			path: "/counties",
			method: "GET",
			query: { schema: "county", select: ["id", "name"] },
			defaults: { enabled: false, access: "public" },
		});
		await routes.upsert(project.id, {
			routeId: def.id,
			datasetId: "norwegian-geo",
			definition: def,
			enabled: false,
		});
		const result = await routes.execute(project.id, "/counties", {
			authenticated: false,
		});
		expect(result).toBeNull();
	});

	test("enabled public route returns selected fields", async () => {
		const { project } = await setup();
		await registerSchema(
			{
				id: "county",
				name: "County",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "name", type: "string", required: true },
					{ name: "secret", type: "string" },
				],
			},
			"norwegian-geo",
		);
		await createEntities(
			[{ schemaId: "county", data: { id: "03", name: "Oslo", secret: "nope" } }],
			"norwegian-geo",
		);
		const routes = createPublishedRouteService();
		const def = defineRoute({
			id: "counties",
			path: "/counties",
			method: "GET",
			query: { schema: "county", select: ["id", "name"] },
		});
		await routes.upsert(project.id, {
			routeId: def.id,
			datasetId: "norwegian-geo",
			definition: def,
			enabled: true,
			access: "public",
		});
		const result = await routes.execute(project.id, "/counties");
		expect(result).not.toBeNull();
		expect(result!.data).toEqual([{ id: "03", name: "Oslo" }]);
		expect(JSON.stringify(result!.data)).not.toContain("nope");
	});

	test("private route requires auth", async () => {
		const { project } = await setup();
		await registerSchema(
			{
				id: "county",
				name: "County",
				fields: [{ name: "id", type: "string", required: true }],
			},
			"norwegian-geo",
		);
		const routes = createPublishedRouteService();
		const def = defineRoute({
			id: "counties",
			path: "/counties",
			method: "GET",
			query: { schema: "county" },
		});
		await routes.upsert(project.id, {
			routeId: def.id,
			datasetId: "norwegian-geo",
			definition: def,
			enabled: true,
			access: "private",
		});
		await expect(
			routes.execute(project.id, "/counties", { authenticated: false }),
		).rejects.toMatchObject({ status: 401 });
	});

	test("invalid route cannot be activated when schema missing", async () => {
		const { project } = await setup();
		const routes = createPublishedRouteService();
		await expect(
			routes.upsert(project.id, {
				routeId: "bad",
				datasetId: "norwegian-geo",
				definition: {
					id: "bad",
					path: "/x",
					method: "GET",
					query: { schema: "missing" },
				},
				enabled: true,
			}),
		).rejects.toMatchObject({ code: "validation_error" });
	});
});

describe("schedule audit", () => {
	beforeEach(async () => {
		await closeStorage().catch(() => undefined);
	});
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("schedule enable/disable is audited", async () => {
		const { project, store } = await setup();
		const imports = createSavedImportService(store);
		await imports.create(project.id, {
			id: "nightly",
			datasetId: "norwegian-geo",
			name: "Nightly",
			schemaId: "postal-code",
			triggerMode: "scheduled",
			definitionPath: "/tmp/x.yaml",
			schedule: {
				enabled: false,
				spec: { type: "cron", expression: "0 4 * * *", timezone: "Europe/Oslo" },
				nextRunAt: null,
				lastRunAt: null,
			},
		});
		await imports.update(
			project.id,
			"nightly",
			{
				schedule: {
					enabled: true,
					spec: { type: "cron", expression: "0 4 * * *", timezone: "Europe/Oslo" },
					nextRunAt: null,
					lastRunAt: null,
				},
			},
			"test-actor",
		);
		const audit = await store.listAudit(project.id);
		expect(audit.some((e) => e.action === "schedule.updated")).toBe(true);
	});
});
