/**
 * Norwegian Geo → Norge Data classification.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../../../../demo/norwegian-geo/lib/project";
import { getDatasetId, loadManifest } from "../../../../demo/norwegian-geo/lib/manifest";
import { LEGACY_PROJECT_ID } from "@aurii/types";
import {
	createDatasetService,
	createProjectService,
	ensureLegacyProject,
	MemoryProjectRepository,
	ProjectNotFoundError,
	configureProjectService,
	resetProjectService,
	registerSchema,
	runImport,
} from "../index";
import { closeStorage, getStorage } from "../storage";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

async function ensureNorgeData(
	projects: ReturnType<typeof createProjectService>,
) {
	try {
		return await projects.getProjectBySlug(NORGE_DATA_PROJECT_SLUG);
	} catch (error) {
		if (!(error instanceof ProjectNotFoundError)) throw error;
		return projects.createProject({
			name: NORGE_DATA_PROJECT_NAME,
			slug: NORGE_DATA_PROJECT_SLUG,
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

describe("Norwegian Geo project classification", () => {
	it("creates Norge Data idempotently and moves norwegian-geo from Legacy", async () => {
		const storage = await getStorage();
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const datasets = createDatasetService(storage, projects);

		const manifest = loadManifest();
		const datasetId = getDatasetId(manifest);
		expect(datasetId).toBe("norwegian-geo");
		expect(manifest.project.slug).toBe(NORGE_DATA_PROJECT_SLUG);

		await storage.createDataset({
			id: datasetId,
			name: manifest.dataset.name,
			projectId: LEGACY_PROJECT_ID,
		});
		await registerSchema(
			{
				id: "county",
				name: "County",
				fields: [{ name: "id", type: "string", required: true }],
			},
			datasetId,
		);

		const first = await ensureNorgeData(projects);
		const moved = await datasets.reassignDatasetProject(datasetId, first.id);
		expect(moved.projectId).toBe(first.id);
		expect(moved.id).toBe(datasetId);

		const second = await ensureNorgeData(projects);
		expect(second.id).toBe(first.id);

		const again = await storage.getDataset(datasetId);
		expect(again?.projectId).toBe(first.id);
		// Idempotent reassignment to same project
		const removed = await datasets.reassignDatasetProject(datasetId, first.id);
		expect(removed.projectId).toBe(first.id);

		expect(await storage.getSchema("county", datasetId)).not.toBeNull();
	});

	it("preserves entities and import history across reassignment", async () => {
		const storage = await getStorage();
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const datasets = createDatasetService(storage, projects);
		const norge = await ensureNorgeData(projects);

		const datasetId = "norwegian-geo";
		await storage.createDataset({
			id: datasetId,
			name: "Norwegian Public Reference Data",
			projectId: LEGACY_PROJECT_ID,
		});
		await registerSchema(
			{
				id: "county",
				name: "County",
				fields: [
					{ name: "id", type: "string", required: true },
					{ name: "name", type: "string", required: true },
				],
			},
			datasetId,
		);

		const tmp = await mkdtemp(join(tmpdir(), "aurii-geo-mig-"));
		const dataPath = join(tmp, "counties.json");
		await writeFile(
			dataPath,
			JSON.stringify([{ id: "03", name: "Oslo" }]),
		);
		await runImport(
			{
				id: "counties",
				name: "Counties",
				schema: "county",
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

		expect(await storage.countEntities("county", datasetId)).toBe(1);
		const historyBefore = await storage.listImportRuns(datasetId, 10);
		expect(historyBefore).toHaveLength(1);

		await datasets.reassignDatasetProject(datasetId, norge.id);

		expect(await storage.countEntities("county", datasetId)).toBe(1);
		expect(await storage.getSchema("county", datasetId)).not.toBeNull();
		const historyAfter = await storage.listImportRuns(datasetId, 10);
		expect(historyAfter).toHaveLength(1);
		expect((await storage.getDataset(datasetId))?.projectId).toBe(norge.id);
	});

	it("reports missing expected datasets without creating duplicates", async () => {
		const storage = await getStorage();
		const repo = new MemoryProjectRepository();
		await ensureLegacyProject(repo);
		const projects = createProjectService(repo);
		const norge = await ensureNorgeData(projects);
		const expected = getDatasetId(loadManifest());
		const existing = await storage.getDataset(expected);
		expect(existing).toBeNull();
		// No duplicate project
		const again = await ensureNorgeData(projects);
		expect(again.id).toBe(norge.id);
		expect(await storage.listDatasets(norge.id)).toHaveLength(0);
	});
});
