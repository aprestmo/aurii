/**
 * N1 live delivery proof:
 * Import → Core → published routes → apps/geo loaders.
 *
 * Uses the same geo consumer loaders as the public site. Live mode must not
 * silently fall back to snapshot files.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
	closeStorage,
	configurePlatformStore,
	configureProjectService,
	createProjectService,
	getStorage,
	loadImportDefinition,
	loadProjectPackage,
	MemoryPlatformStore,
	MemoryProjectRepository,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	runImport,
} from "../../../../packages/core/src/index";
import { buildApiApp } from "../../../api/src/server";
import { PRODUCT_ROOT } from "../../../../demo/norwegian-geo/lib/paths";
import {
	loadCountiesLoaded,
	loadMunicipalitiesLoaded,
	loadPostalCodesLoaded,
} from "../lib/data";
import { LiveDeliveryError } from "../lib/live";

const DEMO = PRODUCT_ROOT;
const CORE_IMPORTS = resolve(DEMO, "core/imports");
const MOCK_BASE = "http://localhost:3000";
const DATASET = "norwegian-geo";

const originalFetch = globalThis.fetch;
const envKeys = [
	"AURII_CORE_URL",
	"PUBLIC_AURII_CORE_URL",
	"AURII_PROJECT_SLUG",
	"AURII_DELIVERY_MODE",
	"PUBLIC_AURII_DELIVERY_MODE",
] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of envKeys) originalEnv[key] = process.env[key];

function restoreEnv() {
	for (const key of envKeys) {
		const previous = originalEnv[key];
		if (previous === undefined) delete process.env[key];
		else process.env[key] = previous;
	}
}

async function registerPackageSchemas(
	pkg: Awaited<ReturnType<typeof loadProjectPackage>>,
) {
	const { readFile } = await import("node:fs/promises");
	const { parse } = await import("yaml");
	for (const schemaPath of pkg.schemaPaths) {
		const def = parse(await readFile(schemaPath, "utf-8"));
		await registerSchema(def, DATASET);
	}
}

describe("live geo delivery (N1)", () => {
	afterEach(async () => {
		globalThis.fetch = originalFetch;
		restoreEnv();
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("apps/geo loaders read counties, municipalities, and postal codes from Core", async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		await closeStorage().catch(() => undefined);

		const pkg = await loadProjectPackage(DEMO);
		const repo = new MemoryProjectRepository();
		const projects = createProjectService(repo);
		configureProjectService(projects);
		const store = new MemoryPlatformStore();
		configurePlatformStore(store);

		const storage = await getStorage();
		const project = await projects.createProject({
			name: "Norge Data",
			slug: "norge-data",
			description: "live delivery test",
		});
		await storage.createDataset({
			id: DATASET,
			name: "Norwegian Public Reference Data",
			projectId: project.id,
		});

		await registerPackageSchemas(pkg);

		for (const name of ["counties", "municipalities", "postal-codes"] as const) {
			const def = await loadImportDefinition(
				resolve(CORE_IMPORTS, `${name}.yaml`),
			);
			const result = await runImport(def, CORE_IMPORTS, {
				dryRun: false,
				datasetId: DATASET,
			});
			expect(result.imported).toBeGreaterThan(0);
		}

		const app = buildApiApp({
			projectService: projects,
			skipPlatformStoreInit: true,
		});

		const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: (input as Request).url;
			if (url.startsWith(MOCK_BASE)) {
				return app.handle(new Request(url, init as RequestInit));
			}
			return originalFetch(input as RequestInfo, init);
		};
		// @ts-expect-error — replacing with a compatible subset for testing
		globalThis.fetch = mockFetch;

		for (const route of pkg.routes) {
			if (!["counties", "municipalities", "postal-codes"].includes(route.id)) {
				continue;
			}
			const upsert = await app.handle(
				new Request(`http://localhost/api/projects/${project.id}/routes`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						routeId: route.id,
						datasetId: DATASET,
						definition: route,
						enabled: true,
						access: "public",
						cacheTtl: 60,
						version: route.version ?? "1",
					}),
				}),
			);
			expect(upsert.status).toBe(201);
		}

		process.env["AURII_CORE_URL"] = MOCK_BASE;
		process.env["AURII_PROJECT_SLUG"] = "norge-data";
		process.env["AURII_DELIVERY_MODE"] = "live";
		delete process.env["PUBLIC_AURII_CORE_URL"];

		const counties = await loadCountiesLoaded();
		const municipalities = await loadMunicipalitiesLoaded();
		const postalCodes = await loadPostalCodesLoaded();

		expect(counties.source).toBe("live");
		expect(municipalities.source).toBe("live");
		expect(postalCodes.source).toBe("live");

		expect(counties.data.length).toBe(15);
		expect(municipalities.data.length).toBe(357);
		expect(postalCodes.data.length).toBeGreaterThan(5000);

		expect(counties.data.some((c) => c.id === "03" && c.name === "Oslo")).toBe(
			true,
		);
		expect(
			municipalities.data.some((m) => m.id === "0301" && m.countyId === "03"),
		).toBe(true);
		expect(postalCodes.data.some((p) => p.municipalityId === "0301")).toBe(
			true,
		);
		expect(postalCodes.data.every((p) => p.code && p.city)).toBe(true);
	});

	test("live mode fails closed instead of reading snapshots", async () => {
		process.env["AURII_CORE_URL"] = MOCK_BASE;
		process.env["AURII_PROJECT_SLUG"] = "norge-data";
		process.env["AURII_DELIVERY_MODE"] = "live";
		// @ts-expect-error — replacing with a compatible subset for testing
		globalThis.fetch = async () => new Response("down", { status: 503 });

		await expect(loadCountiesLoaded()).rejects.toBeInstanceOf(LiveDeliveryError);
	});
});
