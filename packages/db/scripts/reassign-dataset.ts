/**
 * Administrative script: move a dataset from one project to another.
 *
 * Not exposed on the public API. Use after migration to classify Legacy
 * datasets into real projects (e.g. norwegian-geo → Norge Data).
 *
 * Usage:
 *   DATABASE_URL=postgres://… bun run packages/db/scripts/reassign-dataset.ts \
 *     --dataset norwegian-geo --to-project norge-data
 *
 * `--to-project` accepts a project UUID or slug.
 */

import postgres from "postgres";
import { LEGACY_PROJECT_ID } from "../src/legacy-project";

function arg(name: string): string | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1) return undefined;
	return process.argv[idx + 1];
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
	const datasetId = arg("--dataset");
	const toProject = arg("--to-project");

	if (!datasetId || !toProject) {
		console.error(
			"Usage: bun run packages/db/scripts/reassign-dataset.ts --dataset <id> --to-project <uuid|slug>",
		);
		process.exit(1);
	}

	const url =
		process.env["DATABASE_URL"] ??
		"postgres://aurii:aurii@localhost:5432/aurii";
	const sql = postgres(url, { max: 1, connect_timeout: 10 });

	const projects = UUID_RE.test(toProject)
		? await sql`
				SELECT id, slug, status FROM projects
				WHERE id = ${toProject}::uuid OR slug = ${toProject}
				LIMIT 1
			`
		: await sql`
				SELECT id, slug, status FROM projects WHERE slug = ${toProject} LIMIT 1
			`;

	const project = projects[0];
	if (!project) {
		console.error(`Target project "${toProject}" not found.`);
		await sql.end({ timeout: 5 });
		process.exit(1);
	}
	if (project.status !== "active") {
		console.error(
			`Target project "${project.slug}" is ${project.status}; only active projects accept datasets.`,
		);
		await sql.end({ timeout: 5 });
		process.exit(1);
	}

	const datasets = await sql`
		SELECT id, project_id FROM aurii_datasets WHERE id = ${datasetId}
	`;
	const dataset = datasets[0];
	if (!dataset) {
		console.error(`Dataset "${datasetId}" not found.`);
		await sql.end({ timeout: 5 });
		process.exit(1);
	}

	const fromId = String(dataset.project_id);
	await sql`
		UPDATE aurii_datasets
		SET project_id = ${project.id}::uuid
		WHERE id = ${datasetId}
	`;

	console.log(
		`Reassigned dataset "${datasetId}" from project ${fromId}${
			fromId === LEGACY_PROJECT_ID ? " (Legacy)" : ""
		} → ${project.slug} (${project.id})`,
	);

	await sql.end({ timeout: 5 });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
