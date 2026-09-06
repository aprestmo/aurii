/**
 * Generic dataset classification: move a dataset from Legacy to a real project
 * without losing schemas, entities, or import history.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { LEGACY_PROJECT_ID } from "@aurii/types";
import {
	configureProjectService,
	createDatasetService,
	createProjectService,
	ensureLegacyProject,
	MemoryProjectRepository,
	ProjectNotFoundError,
	registerSchema,
	resetProjectService,
	runImport,
} from "../index";
import { closeStorage, getStorage } from "../storage";

async function ensureCatalogProject(
	projects: ReturnType<typeof createProjectService>,
) {
	try {
		return await projects.getProjectBySlug("catalog");
	} catch (error) {
		if (!(error instanceof ProjectNotFoundError)) throw error;
		return projects.createProject({
			name: "Catalog",
			slug: "catalog",
		});
	}
}

beforeEach(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	resetProjectService();
	await closeStorage();
	await getStorage();
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
});

describe("dataset reassignment", () => {
	it("creates a target project idempotently and moves a dataset from Legacy", async () => {
		const storage = await getStorage();
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const datasets = createDatasetService(storage, projects);

		const datasetId = "catalog";
		await storage.createDataset({
			id: datasetId,
			name: "Catalog",
			projectId: LEGACY_PROJECT_ID,
		});
		await registerSchema(
			{
				id: "region",
				name: "Region",
				fields: [{ name: "id", type: "string", required: true }],
			},
			datasetId,
		);

		const first = await ensureCatalogProject(projects);
		const moved = await datasets.reassignDatasetProject(datasetId, first.id);
		expect(moved.projectId).toBe(first.id);
		expect(moved.id).toBe(datasetId);

		const second = await ensureCatalogProject(projects);
		expect(second.id).toBe(first.id);
		expect((await storage.getDataset(datasetId))?.projectId).toBe(first.id);
		const again = await datasets.reassignDatasetProject(datasetId, first.id);
		expect(again.projectId).toBe(first.id);
		expect(await storage.getSchema("region", datasetId)).not.toBeNull();
	});

	it("preserves entities and import history across reassignment", async () => {
		const storage = await getStorage();
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const datasets = createDatasetService(storage, projects);
		const catalog = await ensureCatalogProject(projects);

		const datasetId = "catalog";
		await storage.createDataset({
			id: datasetId,
			name: "Catalog",
			projectId: LEGACY_PROJECT_ID,
		});
		await registerSchema(
			{
				id: "region",
				name: "Region",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "name", type: "string", required: true },
				],
			},
			datasetId,
		);

		const tmp = await mkdtemp(join(tmpdir(), "aurii-reassign-"));
		const dataPath = join(tmp, "regions.json");
		await writeFile(dataPath, JSON.stringify([{ id: "north", name: "North" }]));
		await runImport(
			{
				id: "regions",
				name: "Regions",
				schema: "region",
				source: { type: "json", path: dataPath },
				pipeline: {
					steps: [
						{ type: "map", mapping: { id: "id", name: "name" } },
						{ type: "validate" },
						{ type: "persist" },
					],
				},
			},
			tmp,
			{ datasetId },
		);

		expect(await storage.countEntities("region", datasetId)).toBe(1);
		expect(await storage.listImportRuns(datasetId, 10)).toHaveLength(1);

		await datasets.reassignDatasetProject(datasetId, catalog.id);

		expect(await storage.countEntities("region", datasetId)).toBe(1);
		expect(await storage.getSchema("region", datasetId)).not.toBeNull();
		expect(await storage.listImportRuns(datasetId, 10)).toHaveLength(1);
		expect((await storage.getDataset(datasetId))?.projectId).toBe(catalog.id);
	});
});
