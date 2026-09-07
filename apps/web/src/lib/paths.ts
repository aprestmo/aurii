import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Walk up from cwd (or a start path) until the norwegian-geo repo root is found.
 * Astro prerender nests compiled chunks, so import.meta.dirname is unreliable.
 */
export function findRepoRoot(start = process.cwd()): string {
	let dir = start;
	for (let i = 0; i < 12; i++) {
		if (
			existsSync(resolve(dir, "project/aurii.config.ts")) &&
			existsSync(resolve(dir, "apps/web"))
		) {
			return dir;
		}
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error(
		`norwegian-geo repository root not found (started at ${start})`,
	);
}

export function productRoot(): string {
	return resolve(findRepoRoot(), "project");
}

export function webPublicDir(): string {
	return resolve(findRepoRoot(), "apps/web/public");
}
