/**
 * Core project service tests (in-memory repository — no database required).
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
	InvalidProjectStatusTransitionError,
	MemoryProjectRepository,
	ProjectNotFoundError,
	ProjectService,
	ProjectSlugConflictError,
	ProjectValidationError,
} from "../project";

let service: ProjectService;

beforeEach(() => {
	service = new ProjectService(new MemoryProjectRepository());
});

describe("createProject", () => {
	it("creates a project with an explicit slug", async () => {
		const project = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
			description: "Offisielle valgdata.",
		});
		expect(project.id).toBeTruthy();
		expect(project.name).toBe("Valgdata");
		expect(project.slug).toBe("valgdata");
		expect(project.description).toBe("Offisielle valgdata.");
		expect(project.status).toBe("active");
		expect(project.archivedAt).toBeNull();
		expect(project.createdAt).toBeTruthy();
		expect(project.updatedAt).toBeTruthy();
	});

	it("generates a slug from name when slug is omitted", async () => {
		const project = await service.createProject({ name: "News CMS" });
		expect(project.slug).toBe("news-cms");
	});

	it("rejects a duplicate slug", async () => {
		await service.createProject({ name: "One", slug: "valgdata" });
		expect(service.createProject({ name: "Two", slug: "valgdata" })).rejects.toBeInstanceOf(
			ProjectSlugConflictError,
		);
	});

	it("rejects an invalid slug", async () => {
		expect(
			service.createProject({ name: "Test", slug: "News CMS" }),
		).rejects.toBeInstanceOf(ProjectValidationError);
	});
});

describe("getProject", () => {
	it("gets a project by id", async () => {
		const created = await service.createProject({
			name: "Norge Data",
			slug: "norge-data",
		});
		const found = await service.getProjectById(created.id);
		expect(found.id).toBe(created.id);
		expect(found.slug).toBe("norge-data");
	});

	it("gets a project by slug", async () => {
		await service.createProject({ name: "Norge Data", slug: "norge-data" });
		const found = await service.getProjectBySlug("norge-data");
		expect(found.name).toBe("Norge Data");
	});

	it("returns not found for an unknown project", async () => {
		expect(
			service.getProjectById("00000000-0000-0000-0000-000000000000"),
		).rejects.toBeInstanceOf(ProjectNotFoundError);
		expect(service.getProjectBySlug("missing")).rejects.toBeInstanceOf(
			ProjectNotFoundError,
		);
	});
});

describe("updateProject", () => {
	it("updates name and description", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		const updated = await service.updateProject(created.id, {
			name: "Valgdata 2026",
			description: "Updated description",
		});
		expect(updated.name).toBe("Valgdata 2026");
		expect(updated.description).toBe("Updated description");
		expect(updated.slug).toBe("valgdata");
		expect(updated.updatedAt >= created.updatedAt).toBe(true);
	});
});

describe("status transitions", () => {
	it("changes status from active to inactive", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		const updated = await service.setProjectStatus(created.id, "inactive");
		expect(updated.status).toBe("inactive");
		expect(updated.archivedAt).toBeNull();
	});

	it("archives a project and sets archivedAt", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		const archived = await service.archiveProject(created.id);
		expect(archived.status).toBe("archived");
		expect(archived.archivedAt).toBeTruthy();
	});

	it("reactivates an archived project and clears archivedAt", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await service.archiveProject(created.id);
		const reactivated = await service.setProjectStatus(created.id, "active");
		expect(reactivated.status).toBe("active");
		expect(reactivated.archivedAt).toBeNull();
	});

	it("rejects an invalid status transition", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		await service.archiveProject(created.id);
		expect(
			service.setProjectStatus(created.id, "inactive"),
		).rejects.toBeInstanceOf(InvalidProjectStatusTransitionError);
	});

	it("rejects an unknown status", async () => {
		const created = await service.createProject({
			name: "Valgdata",
			slug: "valgdata",
		});
		expect(
			service.setProjectStatus(created.id, "deleted" as "active"),
		).rejects.toBeInstanceOf(ProjectValidationError);
	});
});

describe("listProjects", () => {
	it("lists all statuses by default", async () => {
		const a = await service.createProject({
			name: "Active Proj",
			slug: "active-proj",
		});
		await service.setProjectStatus(a.id, "inactive");
		await service.createProject({ name: "Still Active", slug: "still-active" });
		const all = await service.listProjects();
		expect(all.length).toBe(2);
	});

	it("filters by status", async () => {
		const a = await service.createProject({ name: "Project A", slug: "a" });
		await service.createProject({ name: "Project B", slug: "b" });
		await service.setProjectStatus(a.id, "inactive");
		const inactive = await service.listProjects({ status: "inactive" });
		expect(inactive.map((p) => p.slug)).toEqual(["a"]);
	});
});
