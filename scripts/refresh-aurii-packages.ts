#!/usr/bin/env bun
/**
 * Copy packed @aurii/* tarballs from an Aurii `bun run pack:packages` output
 * into vendor/aurii/ and rewrite root package.json overrides if versions changed.
 *
 * Usage:
 *   AURII_PACK_DIR=/path/to/aurii/.tmp/packs bun run refresh:aurii
 *
 * This does not require a sibling checkout at ../aurii. The pack directory
 * may live anywhere.
 */

import { copyFile, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const VENDOR = resolve(ROOT, "vendor/aurii");
const packDir = process.env["AURII_PACK_DIR"];

if (!packDir) {
	console.error(
		"Set AURII_PACK_DIR to the directory produced by `bun run pack:packages` in aprestmo/aurii.",
	);
	process.exit(1);
}

const src = resolve(packDir);
const files = await readdir(src);
const tarballs = files.filter((name) => name.endsWith(".tgz"));
if (tarballs.length === 0) {
	console.error(`No .tgz files in ${src}`);
	process.exit(1);
}

for (const name of tarballs) {
	await copyFile(join(src, name), join(VENDOR, name));
	console.log(`copied ${name}`);
}

const manifestSrc = join(src, "manifest.json");
try {
	await copyFile(manifestSrc, join(VENDOR, "manifest.json"));
	console.log("copied manifest.json");
} catch {
	console.warn("no manifest.json in pack dir (optional)");
}

const rootPkgPath = join(ROOT, "package.json");
const rootPkg = JSON.parse(await readFile(rootPkgPath, "utf-8")) as {
	overrides?: Record<string, string>;
};
const overrides: Record<string, string> = { ...rootPkg.overrides };
const nameFromTarball = (file: string) => {
	const match = file.match(/^(aurii-[a-z]+)-(\d+\.\d+\.\d+)\.tgz$/);
	if (!match) return null;
	return { pkg: `@${match[1]!.replace("-", "/")}`, file };
};

for (const file of tarballs) {
	const parsed = nameFromTarball(file);
	if (!parsed) continue;
	overrides[parsed.pkg] = `file:./vendor/aurii/${parsed.file}`;
}

rootPkg.overrides = overrides;
await writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`);
console.log("updated package.json overrides");
console.log("Next: bun install && commit vendor/aurii package.json bun.lock");
