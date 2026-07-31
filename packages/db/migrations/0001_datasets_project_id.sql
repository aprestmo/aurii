-- Link aurii_datasets to projects (ADR-0012).
-- Multi-step, idempotent migration that preserves existing dataset rows and IDs.
--
-- Uniqueness model: dataset `id` remains the global PRIMARY KEY (stable identity
-- used by APIs, SDK, imports, and schemas). project_id is mandatory ownership;
-- listing is indexed by project_id. Per-project slug reuse would require a
-- separate identity redesign and is intentionally not introduced here.

-- ── Step 1: Ensure Legacy fallback project exists (stable UUID) ───────────────
-- Prefer inserting by stable id. If slug "legacy" already exists under another
-- id, the ON CONFLICT (slug) path is handled by a separate upsert-by-slug below.
INSERT INTO "projects" ("id", "name", "slug", "description", "status")
VALUES (
	'a0000000-0000-4000-8000-000000000001',
	'Legacy',
	'legacy',
	'Fallback project for datasets that existed before project scoping. Reclassify datasets into real projects when ready.',
	'active'
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

-- If someone created slug=legacy with a different UUID, keep that row (no duplicate).
-- Backfill resolves Legacy by slug so either path works.
INSERT INTO "projects" ("id", "name", "slug", "description", "status")
SELECT
	'a0000000-0000-4000-8000-000000000001',
	'Legacy',
	'legacy',
	'Fallback project for datasets that existed before project scoping. Reclassify datasets into real projects when ready.',
	'active'
WHERE NOT EXISTS (SELECT 1 FROM "projects" WHERE "slug" = 'legacy');
--> statement-breakpoint

-- ── Ensure aurii_datasets exists (may be created later by Core adapters) ─────
CREATE TABLE IF NOT EXISTS "aurii_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ── Step 2: Add nullable project_id if missing (pre-existing tables) ─────────
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'aurii_datasets' AND column_name = 'project_id'
	) THEN
		ALTER TABLE "aurii_datasets" ADD COLUMN "project_id" uuid;
	END IF;
END $$;
--> statement-breakpoint

-- ── Step 3: Backfill existing rows to Legacy (by slug, stable) ───────────────
UPDATE "aurii_datasets" AS d
SET "project_id" = p."id"
FROM "projects" AS p
WHERE p."slug" = 'legacy'
  AND d."project_id" IS NULL;
--> statement-breakpoint

-- Verify no nulls remain
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "aurii_datasets" WHERE "project_id" IS NULL) THEN
		RAISE EXCEPTION 'aurii_datasets.project_id backfill incomplete — Legacy project missing or update failed';
	END IF;
END $$;
--> statement-breakpoint

-- ── Step 4: Make project_id required ─────────────────────────────────────────
ALTER TABLE "aurii_datasets" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint

-- ── Step 5: Foreign key (RESTRICT — no cascade delete) + index ───────────────
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'aurii_datasets_project_id_fkey'
	) THEN
		ALTER TABLE "aurii_datasets"
			ADD CONSTRAINT "aurii_datasets_project_id_fkey"
			FOREIGN KEY ("project_id") REFERENCES "projects"("id")
			ON DELETE RESTRICT;
	END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "aurii_datasets_project_id_idx"
	ON "aurii_datasets" USING btree ("project_id");
--> statement-breakpoint

-- Composite index for common project-scoped listing ordered by created_at
CREATE INDEX IF NOT EXISTS "aurii_datasets_project_id_created_at_idx"
	ON "aurii_datasets" USING btree ("project_id", "created_at");
