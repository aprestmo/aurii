/**
 * Product/client dependency boundary (Pre–Phase 5).
 *
 * Product applications must not import @aurii/core or @aurii/db internals.
 * They may consume @aurii/sdk, HTTP APIs, and documented public client packages.
 *
 * See docs/PRODUCT_STRATEGY.md and Phase5.md.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(import.meta.dir, "../../../..");

/** Product apps that must stay on the public client boundary. */
const PRODUCT_APPS = [
	{ dir: "apps/geo", packageName: "@aurii/geo" },
	{ dir: "apps/studio", packageName: "@aurii/studio-app" },
	// Future Phase 5 scaffold — rule reserved now:
	{ dir: "apps/editorial", packageName: "@aurii/editorial", optional: true },
] as const;

const FORBIDDEN_DEPS = ["@aurii/core", "@aurii/db"];

/** Packages that may depend on Core (runtime / API adapter). */
const ALLOWED_CORE_CONSUMERS = new Set([
	"@aurii/api",
	"@aurii/core",
	"@aurii/db",
]);

function readPackageJson(relDir: string): {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
} | null {
	try {
		const raw = readFileSync(join(REPO_ROOT, relDir, "package.json"), "utf8");
		return JSON.parse(raw) as {
			name?: string;
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
	} catch {
		return null;
	}
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			if (entry === "node_modules" || entry === "dist" || entry === ".astro") {
				continue;
			}
			collectSourceFiles(full, out);
		} else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

const FORBIDDEN_IMPORT_RE =
	/from\s+["'](@aurii\/core(?:\/[^"']*)?|@aurii\/db(?:\/[^"']*)?)["']|require\(\s*["'](@aurii\/core(?:\/[^"']*)?|@aurii\/db(?:\/[^"']*)?)["']\s*\)/;

describe("product client isolation", () => {
	it("product package.json files do not depend on @aurii/core or @aurii/db", () => {
		for (const app of PRODUCT_APPS) {
			const pkg = readPackageJson(app.dir);
			if (!pkg) {
				if ("optional" in app && app.optional) continue;
				throw new Error(`Missing package.json for ${app.dir}`);
			}
			const deps = {
				...pkg.dependencies,
				...pkg.devDependencies,
			};
			for (const forbidden of FORBIDDEN_DEPS) {
				expect(deps[forbidden]).toBeUndefined();
			}
		}
	});

	it("product source files do not import @aurii/core or @aurii/db", () => {
		for (const app of PRODUCT_APPS) {
			const root = join(REPO_ROOT, app.dir);
			const files = collectSourceFiles(root);
			if (files.length === 0 && "optional" in app && app.optional) continue;
			for (const file of files) {
				const text = readFileSync(file, "utf8");
				expect(FORBIDDEN_IMPORT_RE.test(text)).toBe(false);
			}
		}
	});

	it("fails when a fixture deliberately imports Core from a product path", () => {
		const fixture = `
import { createEntity } from "@aurii/core";
export const bad = createEntity;
`;
		expect(FORBIDDEN_IMPORT_RE.test(fixture)).toBe(true);
	});

	it("documents that API may depend on Core while products may not", () => {
		const api = readPackageJson("apps/api");
		expect(api?.dependencies?.["@aurii/core"]).toBeDefined();
		expect(ALLOWED_CORE_CONSUMERS.has(api!.name!)).toBe(true);
	});
});
