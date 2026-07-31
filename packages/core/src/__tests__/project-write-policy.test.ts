/**
 * Project write policy for dataset-bound resources (imports + schemas).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import {
	DatasetService,
} from "../dataset";
import { runImport } from "../import/engine";
import type { ImportDefinition } from "../import/types";
import {
	assertProjectWritable,
	configureProjectService,
	ensureLegacyProject,
	isProjectWritable,
	MemoryProjectRepository,
	ProjectNotWritableError,
	ProjectService,
	resetProjectService,
} from "../project";
import {
	deleteSchema,
	getSchema,
	listSchemas,
	registerSchema,
} from "../schema/registry";
import { closeStorage, getStorage } from "../storage";

const schemaDef = {
	id: "item",
	name: "Item",
	fields: [
		{ name: "id", type: "string" as const, required: true },
		{ name: "name", type: "string" as const, required: true },
	],
};

let projects: ProjectService;
let datasets: DatasetService;
let projectId: string;
let tmpDir: string;

beforeEach(async () => {
	delete process.env["DATABASE_URL"];
	process.env["AURII_STORAGE"] = "sqlite";
	process.env["AURII_DB_PATH"] = ":memory:";
	resetProjectService();
	await closeStorage();
	const storage = await getStorage();

	const repo = new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	projects = new ProjectService(repo);
	configureProjectService(projects);
	datasets = new DatasetService(storage, projects);

	const project = await projects.createProject({
		name: "Norge Data",
		slug: "norge-data-policy",
	});
	projectId = project.id;
	await datasets.createDataset(projectId, {
		id: "policy-ds",
		name: "Policy Dataset",
	});
	tmpDir = await mkdtemp(join(tmpdir(), "aurii-policy-"));
});

afterEach(async () => {
	await closeStorage();
	resetProjectService();
});

describe("assertProjectWritable", () => {
	it("allows active projects", async () => {
		const project = await projects.getProjectById(projectId);
		expect(isProjectWritable(project)).toBe(true);
		expect(() => assertProjectWritable(project, "test")).not.toThrow();
	});

	it("rejects inactive projects", async () => {
		await projects.setProjectStatus(projectId, "inactive");
		const project = await projects.getProjectById(projectId);
		expect(isProjectWritable(project)).toBe(false);
		expect(() => assertProjectWritable(project, "import.run")).toThrow(
			ProjectNotWritableError,
		);
	});

	it("rejects archived projects", async () => {
		await projects.archiveProject(projectId);
		const project = await projects.getProjectById(projectId);
		expect(() => assertProjectWritable(project, "schema.register")).toThrow(
			ProjectNotWritableError,
		);
	});

	it("error includes projectId, status, and operation", async () => {
		await projects.setProjectStatus(projectId, "inactive");
		const project = await projects.getProjectById(projectId);
		try {
			assertProjectWritable(project, "import.run");
			expect(true).toBe(false);
		} catch (e) {
			expect(e).toBeInstanceOf(ProjectNotWritableError);
			const err = e as ProjectNotWritableError;
			expect(err.projectId).toBe(projectId);
			expect(err.projectStatus).toBe("inactive");
			expect(err.operation).toBe("import.run");
			expect(err.httpStatus).toBe(409);
		}
	});
});

describe("schema mutations", () => {
	it("registers and updates schema in an active project", async () => {
		const created = await registerSchema(schemaDef, "policy-ds");
		expect(created.id).toBe("item");
		const updated = await registerSchema(
			{
				...schemaDef,
				fields: [
					...schemaDef.fields,
					{ name: "extra", type: "string" as const },
				],
			},
			"policy-ds",
		);
		expect(updated.fields).toHaveLength(3);
	});

	it("rejects schema registration in inactive project", async () => {
		await projects.setProjectStatus(projectId, "inactive");
		await expect(registerSchema(schemaDef, "policy-ds")).rejects.toBeInstanceOf(
			ProjectNotWritableError,
		);
	});

	it("rejects schema mutation in archived project", async () => {
		await registerSchema(schemaDef, "policy-ds");
		await projects.archiveProject(projectId);
		await expect(
			registerSchema(
				{
					...schemaDef,
					fields: [{ name: "id", type: "string" as const, required: true }],
				},
				"policy-ds",
			),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
	});

	it("rejects schema delete in inactive project", async () => {
		await registerSchema(schemaDef, "policy-ds");
		await projects.setProjectStatus(projectId, "inactive");
		await expect(deleteSchema("item", "policy-ds")).rejects.toBeInstanceOf(
			ProjectNotWritableError,
		);
	});

	it("allows reading schemas in inactive and archived projects", async () => {
		await registerSchema(schemaDef, "policy-ds");
		await projects.setProjectStatus(projectId, "inactive");
		expect(await getSchema("item", "policy-ds")).not.toBeNull();
		expect(await listSchemas("policy-ds")).toHaveLength(1);

		await projects.setProjectStatus(projectId, "active");
		await projects.archiveProject(projectId);
		expect(await getSchema("item", "policy-ds")).not.toBeNull();
	});

	it("does not partially write schema when project is not writable", async () => {
		await registerSchema(schemaDef, "policy-ds");
		await projects.setProjectStatus(projectId, "inactive");
		await expect(
			registerSchema(
				{
					...schemaDef,
					fields: [
						{ name: "id", type: "string" as const, required: true },
						{ name: "changed", type: "number" as const },
					],
				},
				"policy-ds",
			),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
		const current = await getSchema("item", "policy-ds");
		expect(current?.fields.map((f) => f.name)).toEqual(["id", "name"]);
	});
});

describe("import mutations", () => {
	async function writeImportFixture(): Promise<ImportDefinition> {
		const dataPath = join(tmpDir, "items.json");
		await writeFile(
			dataPath,
			JSON.stringify([
				{ id: "1", name: "One" },
				{ id: "2", name: "Two" },
			]),
		);
		return {
			id: "items-import",
			name: "Items",
			schema: "item",
			dataset: "policy-ds",
			source: { type: "json", path: dataPath },
			pipeline: {
				steps: [
					{
						type: "map",
						mapping: { id: "id", name: "name" },
					},
					{ type: "validate" },
					{ type: "persist" },
				],
			},
			deduplicateBy: "id",
		};
	}

	it("creates and runs import in an active project", async () => {
		await registerSchema(schemaDef, "policy-ds");
		const def = await writeImportFixture();
		const result = await runImport(def, tmpDir, { datasetId: "policy-ds" });
		expect(result.imported).toBe(2);
		expect(result.failed).toBe(0);
		const storage = await getStorage();
		expect(await storage.countEntities("item", "policy-ds")).toBe(2);
	});

	it("rejects import run in inactive project", async () => {
		await registerSchema(schemaDef, "policy-ds");
		const def = await writeImportFixture();
		await projects.setProjectStatus(projectId, "inactive");
		await expect(
			runImport(def, tmpDir, { datasetId: "policy-ds" }),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
		const storage = await getStorage();
		expect(await storage.countEntities("item", "policy-ds")).toBe(0);
	});

	it("rejects import run in archived project", async () => {
		await registerSchema(schemaDef, "policy-ds");
		const def = await writeImportFixture();
		await projects.archiveProject(projectId);
		await expect(
			runImport(def, tmpDir, { datasetId: "policy-ds" }),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
	});

	it("allows reading import history in inactive and archived projects", async () => {
		await registerSchema(schemaDef, "policy-ds");
		const def = await writeImportFixture();
		await runImport(def, tmpDir, { datasetId: "policy-ds" });
		const storage = await getStorage();

		await projects.setProjectStatus(projectId, "inactive");
		const inactiveHistory = await storage.listImportRuns("policy-ds", 10);
		expect(inactiveHistory.length).toBeGreaterThan(0);

		await projects.setProjectStatus(projectId, "active");
		await projects.archiveProject(projectId);
		const archivedHistory = await storage.listImportRuns("policy-ds", 10);
		expect(archivedHistory.length).toBeGreaterThan(0);
	});

	it("rejects a job when project is deactivated before persist", async () => {
		await registerSchema(schemaDef, "policy-ds");
		const def = await writeImportFixture();
		await expect(
			runImport(def, tmpDir, {
				datasetId: "policy-ds",
				beforePersist: async () => {
					await projects.setProjectStatus(projectId, "inactive");
				},
			}),
		).rejects.toBeInstanceOf(ProjectNotWritableError);

		const storage = await getStorage();
		expect(await storage.countEntities("item", "policy-ds")).toBe(0);
		const runs = await storage.listImportRuns("policy-ds", 5);
		expect(runs[0]?.status).toBe("failed");
	});
});
