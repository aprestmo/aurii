import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const WEB = resolve(import.meta.dir, "../..");

const FORBIDDEN = ["@aurii/core", "@aurii/db", "@aurii/studio", "@aurii/studio-app"];

describe("web product boundary", () => {
	test("depends only on @aurii/sdk among Aurii packages", async () => {
		const pkg = JSON.parse(await readFile(resolve(WEB, "package.json"), "utf-8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		expect(deps["@aurii/sdk"]).toBeDefined();
		expect(deps["@aurii/sdk"]).not.toMatch(/^workspace:/);
		for (const name of FORBIDDEN) {
			expect(deps[name]).toBeUndefined();
		}
	});

	test("live and data loaders do not import Core/DB/Studio", async () => {
		for (const rel of ["src/lib/live.ts", "src/lib/data.ts"]) {
			const source = await readFile(resolve(WEB, rel), "utf-8");
			for (const pkg of FORBIDDEN) {
				expect(source).not.toContain(`from "${pkg}`);
				expect(source).not.toContain(`from '${pkg}`);
			}
		}
		const live = await readFile(resolve(WEB, "src/lib/live.ts"), "utf-8");
		expect(live).toContain('from "@aurii/sdk"');
	});
});
