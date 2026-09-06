#!/usr/bin/env bun
/**
 * Pack public Aurii packages as independently installable tarballs.
 *
 * Rewrites workspace:* to concrete versions so a clean consumer can
 * `bun install` from the tarballs without a sibling Aurii checkout.
 *
 * Usage:
 *   bun run pack:packages
 *   bun run pack:packages -- --out .tmp/packs
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PUBLIC_PACKAGES, REPO_URL } from "./public-packages";

const ROOT = resolve(import.meta.dir, "..");

export interface PackResult {
	name: string;
	version: string;
	tarball: string;
	files: string[];
}

function parseArgs(argv: string[]): { out: string } {
	const outIdx = argv.indexOf("--out");
	const out =
		outIdx >= 0 && argv[outIdx + 1]
			? resolve(argv[outIdx + 1]!)
			: resolve(ROOT, ".tmp/packs");
	return { out };
}

function rewriteWorkspaceDeps(
	deps: Record<string, string> | undefined,
	versions: Map<string, string>,
): Record<string, string> | undefined {
	if (!deps) return deps;
	const next: Record<string, string> = {};
	for (const [key, value] of Object.entries(deps)) {
		if (value.startsWith("workspace:")) {
			const ver = versions.get(key);
			if (!ver) {
				throw new Error(
					`Cannot rewrite ${key}@${value}: no packed version for that package`,
				);
			}
			next[key] = ver;
		} else {
			next[key] = value;
		}
	}
	return next;
}

async function listTarballFiles(tarball: string): Promise<string[]> {
	const proc = Bun.spawn(["tar", "-tzf", tarball], { stdout: "pipe" });
	const text = await new Response(proc.stdout).text();
	const code = await proc.exited;
	if (code !== 0) throw new Error(`tar -tzf failed for ${tarball}`);
	return text
		.split("\n")
		.map((line) => line.replace(/^package\//, "").trim())
		.filter(Boolean);
}

export async function packPublicPackages(
	outDir = resolve(ROOT, ".tmp/packs"),
): Promise<PackResult[]> {
	await rm(outDir, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });

	const versions = new Map<string, string>();
	for (const pkg of PUBLIC_PACKAGES) {
		const manifest = JSON.parse(
			await readFile(join(ROOT, pkg.dir, "package.json"), "utf-8"),
		) as { name: string; version: string };
		versions.set(manifest.name, manifest.version);
	}

	const results: PackResult[] = [];

	for (const pkg of PUBLIC_PACKAGES) {
		const srcDir = join(ROOT, pkg.dir);
		const manifest = JSON.parse(
			await readFile(join(srcDir, "package.json"), "utf-8"),
		) as {
			name: string;
			version: string;
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			files?: string[];
			repository?: unknown;
			publishConfig?: unknown;
			license?: string;
		};

		const staging = await mkdtemp(join(tmpdir(), "aurii-pack-"));
		try {
			const copy = Bun.spawn(
				["cp", "-a", `${srcDir}/.`, `${staging}/`],
				{ stdout: "inherit", stderr: "inherit" },
			);
			if ((await copy.exited) !== 0) {
				throw new Error(`Failed to stage ${pkg.name}`);
			}
			await rm(join(staging, "node_modules"), { recursive: true, force: true });
			await rm(join(staging, "src", "__tests__"), {
				recursive: true,
				force: true,
			});

			const packedManifest = {
				...manifest,
				license: manifest.license ?? "UNLICENSED",
				repository: manifest.repository ?? {
					type: "git",
					url: REPO_URL,
					directory: pkg.dir,
				},
				publishConfig: manifest.publishConfig ?? { access: "public" },
				files: manifest.files ?? [
					"src",
					"!src/**/__tests__",
					"README.md",
					...(pkg.extraFiles ?? []),
				],
				dependencies: rewriteWorkspaceDeps(manifest.dependencies, versions),
				devDependencies: undefined,
			};
			delete (packedManifest as { scripts?: unknown }).scripts;
			await writeFile(
				join(staging, "package.json"),
				`${JSON.stringify(packedManifest, null, 2)}\n`,
			);

			const tarballName = `${pkg.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`;
			const tarball = join(outDir, tarballName);
			const pack = Bun.spawn(
				["bun", "pm", "pack", "--destination", outDir, "--quiet"],
				{
					cwd: staging,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const stdout = await new Response(pack.stdout).text();
			const stderr = await new Response(pack.stderr).text();
			if ((await pack.exited) !== 0) {
				throw new Error(
					`bun pm pack failed for ${pkg.name}:\n${stdout}\n${stderr}`,
				);
			}

			const files = await listTarballFiles(tarball);
			results.push({
				name: pkg.name,
				version: manifest.version,
				tarball,
				files,
			});
		} finally {
			await rm(staging, { recursive: true, force: true });
		}
	}

	await writeFile(
		join(outDir, "manifest.json"),
		`${JSON.stringify({ packages: results }, null, 2)}\n`,
	);
	return results;
}

if (import.meta.main) {
	const { out } = parseArgs(process.argv.slice(2));
	const results = await packPublicPackages(out);
	for (const r of results) {
		console.log(`${r.name}@${r.version} → ${r.tarball} (${r.files.length} files)`);
	}
}
