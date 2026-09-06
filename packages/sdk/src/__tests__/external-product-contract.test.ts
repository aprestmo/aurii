/**
 * SDK consumption of the generic external-product fixture.
 *
 * Published routes live on `@aurii/api`; this file proves the product client
 * (`consumer.ts`) can query the same catalog through `@aurii/sdk` against
 * Core's HTTP surface. The API contract test covers `/public/...` delivery.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildApp } from "../../../core/src/api/server";
import {
	closeStorage,
	getStorage,
	loadImportDefinition,
	loadProjectPackage,
	registerSchema,
	resetPlatformStore,
	resetProjectService,
	runImport,
	type SchemaDefinition,
} from "../../../core/src/index";
import { createCatalogClient } from "../../../../tests/fixtures/external-product/consumer";
import { EXTERNAL_PRODUCT_ROOT } from "../../../../tests/fixtures/external-product/paths";

const FIXTURE = EXTERNAL_PRODUCT_ROOT;
const DATASET = "catalog";
const MOCK_BASE = "http://localhost:3000";

const originalFetch = globalThis.fetch;

describe("SDK external-product contract", () => {
	beforeAll(async () => {
		process.env["AURII_STORAGE"] = "sqlite";
		process.env["AURII_DB_PATH"] = ":memory:";
		delete process.env["DATABASE_URL"];
		resetProjectService();
		resetPlatformStore();
		await closeStorage().catch(() => undefined);

		const pkg = await loadProjectPackage(FIXTURE);
		const storage = await getStorage();
		await storage.init();
		await storage.createDataset({
			id: DATASET,
			name: "Catalog",
		});

		for (const schemaPath of pkg.schemaPaths) {
			const def = Bun.YAML.parse(
				await readFile(schemaPath, "utf-8"),
			) as SchemaDefinition;
			await registerSchema(def, DATASET);
		}
		for (const name of ["regions", "cities"]) {
			const file = resolve(FIXTURE, "imports", `${name}.yaml`);
			const def = await loadImportDefinition(file);
			await runImport(def, resolve(file, ".."), { datasetId: DATASET });
		}

		const app = buildApp();
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
		// @ts-expect-error — test fetch shim
		globalThis.fetch = mockFetch;
	});

	afterAll(async () => {
		globalThis.fetch = originalFetch;
		await closeStorage().catch(() => undefined);
		resetPlatformStore();
		resetProjectService();
	});

	test("product client queries cities and regions through the SDK", async () => {
		const client = createCatalogClient(MOCK_BASE);
		const schemas = await client.schemas.list();
		expect(schemas.map((s) => s.id).sort()).toEqual(["city", "region"]);

		const result = await client.query.run(
			'from city where regionId == "south"',
		);
		expect(result.entities.length).toBe(1);
		expect(result.entities[0]?.data["id"]).toBe("beta");

		const regions = await client.query.run("from region order by name asc");
		expect(regions.entities.map((e) => e.data["name"])).toEqual([
			"North",
			"South",
		]);
	});
});
