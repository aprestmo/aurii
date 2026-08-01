/**
 * Project-bound tokens and AuthScope enforcement on platform routes.
 */

import { afterEach, describe, expect, test } from "bun:test";
import {
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createProjectService,
	createProjectTokenService,
	getStorage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	resetPlatformStore,
	resetProjectService,
} from "@aurii/core";
import { buildApiApp } from "../server";

describe("platform AuthScope enforcement", () => {
	afterEach(async () => {
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("read-scoped token cannot manage routes; admin can", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		await closeStorage().catch(() => undefined);

		const store = new MemoryPlatformStore();
		configurePlatformStore(store);
		const repo = new MemoryProjectRepository();
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const project = await projects.createProject({
			name: "Norge Data",
			slug: "norge-data",
		});
		const storage = await getStorage();
		await storage.createDataset({
			id: "norwegian-geo",
			name: "NG",
			projectId: project.id,
		});

		const legacy = "legacy-admin-token";
		const tokens = createProjectTokenService(store);
		const reader = await tokens.create(project.id, {
			name: "reader",
			scopes: ["project:read", "dataset:read"],
		});

		const app = buildApiApp({
			projectService: projects,
			apiToken: legacy,
			skipPlatformStoreInit: true,
		});

		const listWithReader = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/routes`, {
				headers: { Authorization: `Bearer ${reader.rawToken}` },
			}),
		);
		expect(listWithReader.status).toBe(200);

		const mutateWithReader = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/routes`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${reader.rawToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					routeId: "x",
					datasetId: "norwegian-geo",
					definition: {
						id: "x",
						path: "/x",
						method: "GET",
						query: { schema: "county" },
					},
					enabled: false,
				}),
			}),
		);
		expect(mutateWithReader.status).toBe(403);

		const mutateWithLegacy = await app.handle(
			new Request(`http://localhost/api/projects/${project.id}/sources`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${legacy}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					id: "s1",
					datasetId: "norwegian-geo",
					name: "Source",
					kind: "file",
					config: {},
				}),
			}),
		);
		expect(mutateWithLegacy.status).toBe(201);
	});
});
