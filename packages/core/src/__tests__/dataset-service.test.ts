/**
 * Project-scoped DatasetService tests (in-memory projects + SQLite storage).
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { LEGACY_PROJECT_ID } from "@aurii/types";
import {
	DatasetIdConflictError,
	DatasetNotFoundError,
	DatasetService,
	DatasetValidationError,
} from "../dataset";
import {
	ensureLegacyProject,
	MemoryProjectRepository,
	ProjectNotFoundError,
	ProjectNotWritableError,
	ProjectService,
} from "../project";
import { SqliteAdapter } from "../storage/sqlite";

let storage: SqliteAdapter;
let projects: ProjectService;
let datasets: DatasetService;
let activeProjectId: string;

beforeEach(async () => {
	storage = new SqliteAdapter(":memory:");
	await storage.init();
	const repo = new MemoryProjectRepository();
	await ensureLegacyProject(repo);
	projects = new ProjectService(repo);
	datasets = new DatasetService(storage, projects);
	const active = await projects.createProject({
		name: "Norge Data",
		slug: "norge-data",
	});
	activeProjectId = active.id;
});

afterEach(async () => {
	await storage.close();
});

describe("createDataset", () => {
	it("creates a dataset in an active project", async () => {
		const ds = await datasets.createDataset(activeProjectId, {
			id: "municipalities",
			name: "Municipalities",
		});
		expect(ds.id).toBe("municipalities");
		expect(ds.projectId).toBe(activeProjectId);
		expect(ds.name).toBe("Municipalities");
	});

	it("rejects duplicate id in the same project", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "municipalities",
			name: "Municipalities",
		});
		expect(
			datasets.createDataset(activeProjectId, {
				id: "municipalities",
				name: "Again",
			}),
		).rejects.toBeInstanceOf(DatasetIdConflictError);
	});

	it("rejects duplicate id globally (uniqueness model keeps id as PK)", async () => {
		const other = await projects.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await datasets.createDataset(activeProjectId, {
			id: "shared-id",
			name: "One",
		});
		expect(
			datasets.createDataset(other.id, {
				id: "shared-id",
				name: "Two",
			}),
		).rejects.toBeInstanceOf(DatasetIdConflictError);
	});

	it("rejects creation in an inactive project", async () => {
		await projects.setProjectStatus(activeProjectId, "inactive");
		expect(
			datasets.createDataset(activeProjectId, {
				id: "x",
				name: "X",
			}),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
	});

	it("rejects creation in an archived project", async () => {
		await projects.archiveProject(activeProjectId);
		expect(
			datasets.createDataset(activeProjectId, {
				id: "x",
				name: "X",
			}),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
	});

	it("rejects invalid dataset id", async () => {
		expect(
			datasets.createDataset(activeProjectId, {
				id: "Not Valid!",
				name: "Bad",
			}),
		).rejects.toBeInstanceOf(DatasetValidationError);
	});
});

describe("listDatasets / getDataset", () => {
	it("lists only datasets in the selected project", async () => {
		const other = await projects.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		await datasets.createDataset(other.id, {
			id: "elections",
			name: "Elections",
		});

		const listed = await datasets.listDatasets(activeProjectId);
		expect(listed.map((d) => d.id)).toEqual(["counties"]);
	});

	it("returns 404-equivalent when dataset is opened via the wrong project", async () => {
		const other = await projects.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		expect(
			datasets.getDataset(other.id, "counties"),
		).rejects.toBeInstanceOf(DatasetNotFoundError);
	});

	it("allows reading in an inactive project", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		await projects.setProjectStatus(activeProjectId, "inactive");
		const ds = await datasets.getDataset(activeProjectId, "counties");
		expect(ds.id).toBe("counties");
		const listed = await datasets.listDatasets(activeProjectId);
		expect(listed).toHaveLength(1);
	});

	it("allows reading in an archived project", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		await projects.archiveProject(activeProjectId);
		const ds = await datasets.getDataset(activeProjectId, "counties");
		expect(ds.id).toBe("counties");
	});

	it("rejects unknown project", async () => {
		expect(
			datasets.listDatasets("00000000-0000-0000-0000-000000000099"),
		).rejects.toBeInstanceOf(ProjectNotFoundError);
	});
});

describe("updateDataset", () => {
	it("updates name within the owning project", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		const updated = await datasets.updateDataset(activeProjectId, "counties", {
			name: "Fylker",
		});
		expect(updated.name).toBe("Fylker");
		expect(updated.projectId).toBe(activeProjectId);
	});

	it("cannot update through the wrong project", async () => {
		const other = await projects.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		expect(
			datasets.updateDataset(other.id, "counties", { name: "Nope" }),
		).rejects.toBeInstanceOf(DatasetNotFoundError);
	});

	it("rejects projectId in update payload", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		expect(
			datasets.updateDataset(activeProjectId, "counties", {
				name: "X",
				projectId: LEGACY_PROJECT_ID,
			} as { name: string; projectId: string }),
		).rejects.toBeInstanceOf(DatasetValidationError);
	});

	it("rejects update in inactive project", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "counties",
			name: "Counties",
		});
		await projects.setProjectStatus(activeProjectId, "inactive");
		expect(
			datasets.updateDataset(activeProjectId, "counties", { name: "X" }),
		).rejects.toBeInstanceOf(ProjectNotWritableError);
	});
});

describe("reassignDatasetProject", () => {
	it("moves a dataset to another active project (admin)", async () => {
		const target = await projects.createProject({
			name: "Norge Data 2",
			slug: "norge-data-2",
		});
		await datasets.createDataset(activeProjectId, {
			id: "postal-codes",
			name: "Postal codes",
		});
		const moved = await datasets.reassignDatasetProject(
			"postal-codes",
			target.id,
		);
		expect(moved.projectId).toBe(target.id);
		expect(
			datasets.getDataset(activeProjectId, "postal-codes"),
		).rejects.toBeInstanceOf(DatasetNotFoundError);
		const found = await datasets.getDataset(target.id, "postal-codes");
		expect(found.id).toBe("postal-codes");
	});
});

describe("legacy / storage compatibility", () => {
	it("default dataset is owned by Legacy after init", async () => {
		const ds = await storage.getDataset("default");
		expect(ds?.projectId).toBe(LEGACY_PROJECT_ID);
	});

	it("storage createDataset without projectId uses Legacy", async () => {
		const ds = await storage.createDataset({
			id: "import-owned",
			name: "Import Owned",
		});
		expect(ds.projectId).toBe(LEGACY_PROJECT_ID);
	});

	it("existing dataset functionality still works (schema scoping)", async () => {
		await datasets.createDataset(activeProjectId, {
			id: "blog",
			name: "Blog",
		});
		await storage.upsertSchema(
			{
				id: "article",
				name: "Article",
				fields: [{ name: "title", type: "string", required: true }],
			},
			"blog",
		);
		const schema = await storage.getSchema("article", "blog");
		expect(schema?.datasetId).toBe("blog");
	});
});
