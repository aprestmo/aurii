/**
 * Prove public packages can be packed and installed in a clean consumer
 * that has no workspace:* and no sibling Aurii checkout.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packPublicPackages } from "../../scripts/pack-public-packages";

let workDir: string | undefined;

afterAll(async () => {
	if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("pack public packages for an external consumer", () => {
	test("tarballs contain source and rewrite workspace protocol", async () => {
		workDir = await mkdtemp(join(tmpdir(), "aurii-pack-test-"));
		const out = join(workDir, "packs");
		const packed = await packPublicPackages(out);

		const names = packed.map((p) => p.name);
		expect(names).toEqual([
			"@aurii/types",
			"@aurii/validation",
			"@aurii/db",
			"@aurii/core",
			"@aurii/sdk",
			"@aurii/studio",
		]);

		for (const pkg of packed) {
			expect(pkg.files.some((f) => f === "package.json" || f.endsWith("package.json"))).toBe(
				true,
			);
			expect(pkg.files.some((f) => f.includes("src/index.ts"))).toBe(true);
			expect(pkg.files.some((f) => f.includes("__tests__"))).toBe(false);
		}

		const core = packed.find((p) => p.name === "@aurii/core")!;
		const extractDir = join(workDir, "extract-core");
		await mkdir(extractDir, { recursive: true });
		const extract = Bun.spawn(["tar", "-xzf", core.tarball, "-C", extractDir], {
			stdout: "inherit",
			stderr: "inherit",
		});
		expect(await extract.exited).toBe(0);
		const coreManifest = JSON.parse(
			await readFile(join(extractDir, "package", "package.json"), "utf-8"),
		) as { dependencies?: Record<string, string> };
		for (const value of Object.values(coreManifest.dependencies ?? {})) {
			expect(value.startsWith("workspace:")).toBe(false);
		}
		expect(coreManifest.dependencies?.["@aurii/types"]).toMatch(/^\d+\./);
	}, 120_000);

	test("clean consumer can install packed tarballs and import SDK + defineProject", async () => {
		if (!workDir) workDir = await mkdtemp(join(tmpdir(), "aurii-pack-test-"));
		const out = join(workDir, "packs");
		const packed = await packPublicPackages(out);
		const byName = Object.fromEntries(packed.map((p) => [p.name, p]));
		const fileDeps = Object.fromEntries(
			packed.map((p) => [p.name, `file:${p.tarball}`]),
		);

		const consumer = join(workDir, "consumer");
		await mkdir(consumer, { recursive: true });
		await writeFile(
			join(consumer, "package.json"),
			`${JSON.stringify(
				{
					name: "aurii-external-consumer-smoke",
					private: true,
					type: "module",
					dependencies: {
						"@aurii/core": fileDeps["@aurii/core"],
						"@aurii/sdk": fileDeps["@aurii/sdk"],
						"@aurii/studio": fileDeps["@aurii/studio"],
					},
					overrides: fileDeps,
				},
				null,
				2,
			)}\n`,
		);

		const install = Bun.spawn(["bun", "install"], {
			cwd: consumer,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, BUN_INSTALL_FROZEN_LOCKFILE: "0" },
		});
		const installOut = await new Response(install.stdout).text();
		const installErr = await new Response(install.stderr).text();
		expect(await install.exited, `${installOut}\n${installErr}`).toBe(0);

		const consumerLock = await readFile(join(consumer, "package.json"), "utf-8");
		expect(consumerLock).not.toContain("workspace:");

		await writeFile(
			join(consumer, "smoke.ts"),
			`
			import { createClient } from "@aurii/sdk";
			import { defineProject } from "@aurii/core";
			import { defineStudio } from "@aurii/studio";

			const client = createClient({ baseUrl: "http://example.test" });
			if (typeof client.published.get !== "function") {
				throw new Error("SDK published.get missing");
			}

			const project = defineProject({
				id: "smoke",
				title: "Smoke",
				core: { projectSlug: "smoke", defaultDataset: "smoke" },
			});
			if (project.id !== "smoke") throw new Error("defineProject failed");

			const studio = defineStudio({ title: "Smoke Studio" });
			if (studio.title !== "Smoke Studio") throw new Error("defineStudio failed");

			console.log("ok");
			`,
		);

		const run = Bun.spawn(["bun", "run", "smoke.ts"], {
			cwd: consumer,
			stdout: "pipe",
			stderr: "pipe",
		});
		const runOut = await new Response(run.stdout).text();
		const runErr = await new Response(run.stderr).text();
		expect(await run.exited, `${runOut}\n${runErr}`).toBe(0);
		expect(runOut).toContain("ok");
	}, 180_000);
});
