import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
	AuriiProjectConfig,
	AuriiStudioConfig,
	PublishedRouteDefinition,
} from "@aurii/types";
import { validateProjectConfigShape } from "@aurii/validation";
import { ProjectConfigError } from "./define";

export interface LoadedProjectPackage {
	root: string;
	config: AuriiProjectConfig;
	studio: AuriiStudioConfig | null;
	/** Resolved absolute paths for schema files. */
	schemaPaths: string[];
	sourcePaths: string[];
	importPaths: string[];
	syncPaths: string[];
	routePaths: string[];
	/** Loaded route definitions (from route modules that export default). */
	routes: PublishedRouteDefinition[];
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function resolveRef(root: string, rel: string): string {
	return isAbsolute(rel) ? rel : resolve(root, rel);
}

/**
 * Validate that all referenced files exist. Does not start Studio.
 */
export async function validateProjectReferences(
	config: AuriiProjectConfig,
	root: string,
): Promise<void> {
	const issues: Array<{ path: string; message: string }> = [];
	const seenIds = new Set<string>();

	const checkList = async (
		field: string,
		paths: string[] | undefined,
	): Promise<string[]> => {
		const resolved: string[] = [];
		if (!paths) return resolved;
		for (let i = 0; i < paths.length; i++) {
			const rel = paths[i]!;
			const abs = resolveRef(root, rel);
			if (!(await fileExists(abs))) {
				issues.push({
					path: `${field}[${i}]`,
					message: `File not found: ${rel}`,
				});
			} else {
				resolved.push(abs);
			}
		}
		return resolved;
	};

	await checkList("schemas", config.schemas);
	await checkList("sources", config.sources);
	await checkList("imports", config.imports);
	await checkList("sync", config.sync);
	await checkList("routes", config.routes);

	if (config.studio) {
		const abs = resolveRef(root, config.studio);
		if (!(await fileExists(abs))) {
			issues.push({
				path: "studio",
				message: `Studio config not found: ${config.studio}`,
			});
		}
	}

	// Duplicate package id check is trivial; also reject empty id collisions in lists later
	if (seenIds.has(config.id)) {
		issues.push({ path: "id", message: `Duplicate project id "${config.id}"` });
	}
	seenIds.add(config.id);

	if (issues.length) throw new ProjectConfigError(issues);
}

/**
 * Load and validate an Aurii project package from its root directory
 * (expects `aurii.config.ts` or `aurii.config.js`).
 */
export async function loadProjectPackage(
	rootOrConfigPath: string,
): Promise<LoadedProjectPackage> {
	const abs = resolve(rootOrConfigPath);
	let root: string;
	let configPath: string;

	if (abs.endsWith("aurii.config.ts") || abs.endsWith("aurii.config.js")) {
		configPath = abs;
		root = dirname(abs);
	} else {
		root = abs;
		const ts = join(root, "aurii.config.ts");
		const js = join(root, "aurii.config.js");
		if (await fileExists(ts)) configPath = ts;
		else if (await fileExists(js)) configPath = js;
		else {
			throw new ProjectConfigError([
				{ path: "", message: `No aurii.config.ts found in ${root}` },
			]);
		}
	}

	const mod = await import(pathToFileURL(configPath).href);
	const raw = mod.default ?? mod.config;
	const shape = validateProjectConfigShape(raw);
	if (!shape.success) throw new ProjectConfigError(shape.issues);

	await validateProjectReferences(shape.data, root);

	let studio: AuriiStudioConfig | null = null;
	if (shape.data.studio) {
		const studioPath = resolveRef(root, shape.data.studio);
		const studioMod = await import(pathToFileURL(studioPath).href);
		studio = (studioMod.default ?? studioMod.config) as AuriiStudioConfig;
	}

	const resolveAll = (paths?: string[]) =>
		(paths ?? []).map((p) => resolveRef(root, p));

	const routePaths = resolveAll(shape.data.routes);
	const routes: PublishedRouteDefinition[] = [];
	const routeIds = new Set<string>();
	for (const rp of routePaths) {
		const rm = await import(pathToFileURL(rp).href);
		const def = (rm.default ?? rm.route) as PublishedRouteDefinition;
		if (!def?.id) {
			throw new ProjectConfigError([
				{ path: "routes", message: `Route module ${rp} missing id` },
			]);
		}
		if (routeIds.has(def.id)) {
			throw new ProjectConfigError([
				{ path: "routes", message: `Duplicate route id "${def.id}"` },
			]);
		}
		routeIds.add(def.id);
		routes.push(def);
	}

	return {
		root,
		config: shape.data,
		studio,
		schemaPaths: resolveAll(shape.data.schemas),
		sourcePaths: resolveAll(shape.data.sources),
		importPaths: resolveAll(shape.data.imports),
		syncPaths: resolveAll(shape.data.sync),
		routePaths,
		routes,
	};
}

/** Read a JSON/YAML-ish sidecar if present (for tests without dynamic import). */
export async function loadProjectConfigJson(
	path: string,
): Promise<AuriiProjectConfig> {
	const text = await readFile(path, "utf-8");
	const raw = JSON.parse(text) as unknown;
	const shape = validateProjectConfigShape(raw);
	if (!shape.success) throw new ProjectConfigError(shape.issues);
	return shape.data;
}
