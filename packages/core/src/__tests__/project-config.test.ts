import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	defineProject,
	loadProjectPackage,
	ProjectConfigError,
	validateProjectReferences,
} from "../project-config";
import { PROJECT_CONFIG_VERSION } from "@aurii/types";

const TMP = join(import.meta.dir, ".tmp-project-config");

describe("defineProject / loadProjectPackage", () => {
	beforeEach(async () => {
		await rm(TMP, { recursive: true, force: true });
		await mkdir(TMP, { recursive: true });
	});
	afterEach(async () => {
		await rm(TMP, { recursive: true, force: true });
	});

	test("valid config can be defined", () => {
		const cfg = defineProject({
			id: "demo",
			title: "Demo",
			core: { projectSlug: "demo", defaultDataset: "production" },
		});
		expect(cfg.version).toBe(PROJECT_CONFIG_VERSION);
		expect(cfg.id).toBe("demo");
	});

	test("invalid shape is rejected", () => {
		expect(() =>
			defineProject({
				id: "",
				title: "X",
				core: { projectSlug: "x", defaultDataset: "d" },
			} as never),
		).toThrow(ProjectConfigError);
	});

	test("valid package loads; missing schema reference fails", async () => {
		await writeFile(
			join(TMP, "aurii.config.ts"),
			`
			import { defineProject } from ${JSON.stringify(
				new URL("../project-config/define.ts", import.meta.url).href,
			)};
			export default defineProject({
				id: "t",
				title: "T",
				core: { projectSlug: "t", defaultDataset: "d" },
				schemas: ["./missing.yaml"],
			});
			`,
		);
		await expect(loadProjectPackage(TMP)).rejects.toThrow(ProjectConfigError);
	});

	test("invalid studio reference is rejected", async () => {
		const cfg = defineProject({
			id: "t",
			title: "T",
			core: { projectSlug: "t", defaultDataset: "d" },
			studio: "./studio/nope.ts",
		});
		await expect(validateProjectReferences(cfg, TMP)).rejects.toThrow(
			ProjectConfigError,
		);
	});

	test("duplicate route ids rejected on load", async () => {
		await mkdir(join(TMP, "routes"), { recursive: true });
		await writeFile(
			join(TMP, "routes/a.ts"),
			`export default { id: "dup", path: "/a", method: "GET", query: { schema: "x" } };`,
		);
		await writeFile(
			join(TMP, "routes/b.ts"),
			`export default { id: "dup", path: "/b", method: "GET", query: { schema: "x" } };`,
		);
		await writeFile(
			join(TMP, "aurii.config.ts"),
			`
			export default {
				version: 1,
				id: "t",
				title: "T",
				core: { projectSlug: "t", defaultDataset: "d" },
				routes: ["./routes/a.ts", "./routes/b.ts"],
			};
			`,
		);
		await expect(loadProjectPackage(TMP)).rejects.toBeInstanceOf(ProjectConfigError);
	});
});
