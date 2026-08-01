/**
 * Register Norwegian Geo project-package resources into a running Core API:
 * data sources, saved imports (incl. disabled nightly sync), published routes.
 *
 * Prerequisites:
 *   bun run import:norwegian-geo   # schemas + entities
 *   bun run serve                  # Core API on :3000
 *
 * Usage:
 *   AURII_CORE_URL=http://localhost:3000 \
 *   AURII_API_TOKEN=... \
 *   bun run demo/norwegian-geo/scripts/register-via-api.ts
 */

import { resolve } from "node:path";
import { loadProjectPackage } from "@aurii/core";
import {
	NORGE_DATA_PROJECT_DESCRIPTION,
	NORGE_DATA_PROJECT_NAME,
	NORGE_DATA_PROJECT_SLUG,
} from "../lib/project";
import { PRODUCT_ROOT } from "../lib/paths";

const CORE_URL = (process.env["AURII_CORE_URL"] ?? "http://localhost:3000").replace(
	/\/$/,
	"",
);
const TOKEN = process.env["AURII_API_TOKEN"];

function headers(): HeadersInit {
	const h: Record<string, string> = { "Content-Type": "application/json" };
	if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
	return h;
}

async function api<T>(
	path: string,
	init?: RequestInit,
): Promise<{ status: number; body: T }> {
	const res = await fetch(`${CORE_URL}${path}`, {
		...init,
		headers: { ...headers(), ...(init?.headers ?? {}) },
	});
	const body = (await res.json().catch(() => ({}))) as T;
	return { status: res.status, body };
}

async function ensureProject(): Promise<{ id: string; slug: string }> {
	const list = await api<{ data: Array<{ id: string; slug: string }> }>(
		"/api/projects",
	);
	const existing = list.body.data?.find((p) => p.slug === NORGE_DATA_PROJECT_SLUG);
	if (existing) return existing;

	const created = await api<{ data: { id: string; slug: string } }>(
		"/api/projects",
		{
			method: "POST",
			body: JSON.stringify({
				name: NORGE_DATA_PROJECT_NAME,
				slug: NORGE_DATA_PROJECT_SLUG,
				description: NORGE_DATA_PROJECT_DESCRIPTION,
			}),
		},
	);
	if (created.status !== 201 && created.status !== 200) {
		throw new Error(
			`Failed to create project: ${created.status} ${JSON.stringify(created.body)}`,
		);
	}
	return created.body.data;
}

async function main() {
	const root = PRODUCT_ROOT;
	const pkg = await loadProjectPackage(root);
	const project = await ensureProject();
	const datasetId = pkg.config.core.defaultDataset;

	console.log(`Core: ${CORE_URL}`);
	console.log(`Project: ${project.slug} (${project.id})`);
	console.log(`Dataset: ${datasetId}`);
	console.log(`Package: ${pkg.config.id}`);

	for (const sp of pkg.sourcePaths) {
		const mod = await import(sp);
		const def = mod.default;
		const res = await api(`/api/projects/${project.id}/sources`, {
			method: "POST",
			body: JSON.stringify({
				id: def.id,
				datasetId: def.datasetId ?? datasetId,
				name: def.name,
				kind: def.kind,
				config: def.config,
			}),
		});
		console.log(
			`source ${def.id}: ${res.status === 201 ? "created" : res.status === 409 ? "exists" : res.status}`,
		);
	}

	const importMods = [...pkg.importPaths, ...pkg.syncPaths];
	for (const ip of importMods) {
		const mod = await import(ip);
		const def = mod.default;
		const definitionPath = resolve(root, def.definitionPath);
		const res = await api(`/api/projects/${project.id}/saved-imports`, {
			method: "POST",
			body: JSON.stringify({
				id: def.id,
				datasetId: def.datasetId ?? datasetId,
				sourceId: def.sourceId,
				name: def.name,
				schemaId: def.schemaId,
				status: def.status ?? "active",
				triggerMode: def.triggerMode,
				definitionPath,
				schedule: def.schedule
					? {
							enabled: def.schedule.enabled,
							spec: def.schedule.spec,
							nextRunAt: null,
							lastRunAt: null,
						}
					: null,
			}),
		});
		console.log(
			`import ${def.id}: ${res.status === 201 ? "created" : res.status === 409 ? "exists" : res.status}`,
		);
	}

	for (const route of pkg.routes) {
		const res = await api(`/api/projects/${project.id}/routes`, {
			method: "POST",
			body: JSON.stringify({
				routeId: route.id,
				datasetId,
				definition: route,
				enabled: route.defaults?.enabled ?? false,
				access: route.defaults?.access ?? "public",
				cacheTtl: route.defaults?.cacheTtl ?? 3600,
				version: route.version ?? "1",
			}),
		});
		console.log(
			`route ${route.id}: ${res.status === 201 || res.status === 200 ? "upserted" : res.status}`,
		);
	}

	console.log("Done. Enable routes in Studio or via PATCH /api/projects/:id/routes/:routeId");
	console.log(`Studio: AURII_PROJECT_ROOT=${root} AURII_PROJECT_SLUG=${NORGE_DATA_PROJECT_SLUG} bun run studio`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
