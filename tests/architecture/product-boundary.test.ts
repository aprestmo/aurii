/**
 * Architecture invariant: product clients consume public contracts,
 * not Core/DB internals.
 */

import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

const FORBIDDEN_PRODUCT_IMPORTS = [
	"@aurii/core",
	"@aurii/db",
	"@aurii/studio",
	"@aurii/studio-app",
];

async function sourceOf(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), "utf-8");
}

function assertNoForbiddenImports(source: string, path: string) {
	for (const pkg of FORBIDDEN_PRODUCT_IMPORTS) {
		expect(source, `${path} must not import ${pkg}`).not.toContain(
			`from "${pkg}`,
		);
		expect(source, `${path} must not import ${pkg}`).not.toContain(
			`from '${pkg}`,
		);
	}
}

describe("product-client boundary", () => {
	test("fixture consumer depends only on @aurii/sdk", async () => {
		const source = await sourceOf(
			"tests/fixtures/external-product/consumer.ts",
		);
		expect(source).toContain('from "@aurii/sdk"');
		assertNoForbiddenImports(
			source,
			"tests/fixtures/external-product/consumer.ts",
		);
	});

	test("no in-repo product client imports Core/DB/Studio", async () => {
		// Norwegian Geo left the monorepo. The fixture consumer is the
		// remaining product-client surface Aurii CI owns.
		const live = await sourceOf(
			"tests/fixtures/external-product/consumer.ts",
		);
		expect(live).toContain('from "@aurii/sdk"');
		assertNoForbiddenImports(
			live,
			"tests/fixtures/external-product/consumer.ts",
		);
	});
});
