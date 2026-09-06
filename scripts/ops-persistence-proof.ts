#!/usr/bin/env bun
/**
 * Persistent Core + Postgres restart / backup / restore proof (Pre–Phase 5).
 *
 * Usage:
 *   bun run scripts/ops-persistence-proof.ts
 *
 * Prefers local Postgres when DATABASE_URL is set or localhost:5432 accepts
 * connections. Falls back to `docker compose up -d postgres` when needed.
 *
 * See docs/OPERATIONS.md.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BACKUP = join(ROOT, ".tmp", "aurii-ops-proof.dump");
const MARKER_SCHEMA = "ops-proof-note";
const DATASET_PREFIX = "ops-proof";

function sh(
	cmd: string,
	args: string[],
	opts: { env?: NodeJS.ProcessEnv; input?: string } = {},
): { status: number; stdout: string; stderr: string } {
	const res = spawnSync(cmd, args, {
		cwd: ROOT,
		encoding: "utf8",
		env: { ...process.env, ...opts.env },
		input: opts.input,
	});
	return {
		status: res.status ?? 1,
		stdout: res.stdout ?? "",
		stderr: res.stderr ?? "",
	};
}

function must(ok: boolean, msg: string): void {
	if (!ok) {
		console.error(`FAIL: ${msg}`);
		process.exit(1);
	}
	console.log(`OK: ${msg}`);
}

async function ensurePostgres(): Promise<string> {
	const existing =
		process.env["DATABASE_URL"] ??
		"postgres://aurii:aurii@127.0.0.1:5432/aurii";

	const probe = sh("psql", [existing, "-c", "SELECT 1"], {
		env: process.env,
	});
	if (probe.status === 0) {
		console.log(`Using existing Postgres at ${existing}`);
		return existing;
	}

	console.log("== Starting postgres via docker compose ==");
	const up = sh("docker", ["compose", "up", "-d", "postgres"]);
	must(up.status === 0, `postgres up (${up.stderr || up.stdout})`);

	const databaseUrl = "postgres://aurii:aurii@127.0.0.1:5432/aurii";
	for (let i = 0; i < 30; i++) {
		const ready = sh("docker", [
			"compose",
			"exec",
			"-T",
			"postgres",
			"pg_isready",
			"-U",
			"aurii",
			"-d",
			"aurii",
		]);
		if (ready.status === 0) break;
		await Bun.sleep(1000);
	}
	return databaseUrl;
}

function backupDatabase(databaseUrl: string): void {
	if (existsSync(BACKUP)) unlinkSync(BACKUP);
	const viaDocker = sh("docker", ["compose", "ps", "-q", "postgres"]);
	if (viaDocker.status === 0 && viaDocker.stdout.trim()) {
		const dumpFile = sh("sh", [
			"-c",
			`docker compose exec -T postgres pg_dump -U aurii -d aurii -Fc > "${BACKUP}"`,
		]);
		must(dumpFile.status === 0 && existsSync(BACKUP), "backup file written (docker)");
		return;
	}
	const dump = sh("sh", [
		"-c",
		`pg_dump --format=custom --file="${BACKUP}" "${databaseUrl}"`,
	]);
	must(dump.status === 0 && existsSync(BACKUP), `backup file written (${dump.stderr})`);
}

function restoreDatabase(databaseUrl: string): void {
	const viaDocker = sh("docker", ["compose", "ps", "-q", "postgres"]);
	if (viaDocker.status === 0 && viaDocker.stdout.trim()) {
		const restore = sh("sh", [
			"-c",
			`docker compose exec -T postgres pg_restore -U aurii -d aurii --clean --if-exists --no-owner < "${BACKUP}"`,
		]);
		console.log(`pg_restore (docker) status=${restore.status}`);
		return;
	}
	const restore = sh("sh", [
		"-c",
		`pg_restore --clean --if-exists --no-owner --dbname="${databaseUrl}" "${BACKUP}"`,
	]);
	console.log(`pg_restore status=${restore.status} ${restore.stderr}`);
}

async function main(): Promise<void> {
	mkdirSync(join(ROOT, ".tmp"), { recursive: true });

	const databaseUrl = await ensurePostgres();
	process.env["DATABASE_URL"] = databaseUrl;
	process.env["AURII_STORAGE"] = "postgres";

	console.log("== Running migrations ==");
	const migrate = sh("bun", ["run", "packages/db/scripts/migrate.ts"], {
		env: process.env,
	});
	must(migrate.status === 0, `db migrate (${migrate.stderr || migrate.stdout})`);

	const {
		closeStorage,
		createEntity,
		createDatasetService,
		getEntity,
		getProjectService,
		getStorage,
		registerSchema,
		resetProjectService,
		updateEntity,
	} = await import("../packages/core/src/index");

	await closeStorage().catch(() => undefined);
	resetProjectService();
	const storage = await getStorage();
	const projects = await getProjectService();
	const project = await projects.createProject({
		name: "Ops Proof",
		slug: `ops-proof-${Date.now()}`,
	});
	const datasetId = `${DATASET_PREFIX}-${Date.now()}`;
	const datasets = createDatasetService(storage, projects);
	await datasets.createDataset(project.id, {
		id: datasetId,
		name: "Ops Proof Dataset",
	});

	await registerSchema(
		{
			id: MARKER_SCHEMA,
			name: "Ops Proof Note",
			fields: [
				{ name: "title", type: "string", required: true },
				{ name: "marker", type: "string", required: true },
			],
		},
		datasetId,
	);

	const marker = `proof-${Date.now()}`;
	const entity = await createEntity(
		{
			schemaId: MARKER_SCHEMA,
			data: { title: "before-restart", marker },
		},
		datasetId,
	);
	must(entity.entityRevision === 1, "created entity at revision 1");

	const updated = await updateEntity(entity.id, {
		data: { title: "after-mutation", marker },
		expectedRevision: 1,
	});
	must(updated.entityRevision === 2, "mutated entity to revision 2");

	const liveCheck = await getEntity(entity.id);
	must(
		liveCheck?.data["marker"] === marker &&
			liveCheck.data["title"] === "after-mutation",
		"query/get finds mutated entity",
	);

	console.log("== Restarting storage adapter (simulates Core restart) ==");
	await closeStorage();
	resetProjectService();
	await getStorage();
	await getProjectService();

	const afterRestart = await getEntity(entity.id);
	must(
		!!(
			afterRestart?.data["title"] === "after-mutation" &&
			afterRestart.entityRevision === 2
		),
		"state survived Core/storage restart",
	);

	console.log("== Re-running migrations (idempotent) ==");
	const migrate2 = sh("bun", ["run", "packages/db/scripts/migrate.ts"], {
		env: process.env,
	});
	must(migrate2.status === 0, "migrations re-run successfully");

	console.log("== Backup ==");
	backupDatabase(databaseUrl);

	console.log("== Destructive modification ==");
	await updateEntity(entity.id, {
		data: { title: "DESTROYED", marker },
		expectedRevision: 2,
	});
	const destroyed = await getEntity(entity.id);
	must(destroyed?.data["title"] === "DESTROYED", "destructive change applied");

	console.log("== Restore backup ==");
	await closeStorage();
	restoreDatabase(databaseUrl);

	resetProjectService();
	await getStorage();
	await getProjectService();
	const restored = await getEntity(entity.id);
	must(
		!!(
			restored?.data["title"] === "after-mutation" &&
			restored.entityRevision === 2 &&
			restored.data["marker"] === marker
		),
		"restored state matches pre-damage Aurii entity",
	);

	await closeStorage();
	console.log("\nPersistence proof PASSED.");
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
