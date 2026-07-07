#!/usr/bin/env bun
/**
 * Fetches SSB Klass municipality and county identifier periods.
 *
 * Run: bun run fetch:ssb-identifiers-norwegian-geo
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildIdentifierPeriods } from "./build-identifier-periods";
import {
  COUNTY_CLASSIFICATION_ID,
  MUNICIPALITY_CLASSIFICATION_ID,
} from "./ssb-klass";

const DATA_DIR = resolve(import.meta.dir, "data");
const FROM = process.env.SSB_FROM ?? "2008-01-01";
const TO = process.env.SSB_TO ?? "2026-12-31";

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  console.log(`Fetching SSB Klass identifier periods (${FROM} – ${TO})…`);

  const [municipalities, counties] = await Promise.all([
    buildIdentifierPeriods({
      classificationId: MUNICIPALITY_CLASSIFICATION_ID,
      entityType: "municipality",
      from: FROM,
      to: TO,
    }),
    buildIdentifierPeriods({
      classificationId: COUNTY_CLASSIFICATION_ID,
      entityType: "county",
      from: FROM,
      to: TO,
    }),
  ]);

  const municipalityPeriodsPath = resolve(
    DATA_DIR,
    "municipality-identifier-periods.json",
  );
  const countyPeriodsPath = resolve(DATA_DIR, "county-identifier-periods.json");
  const municipalityChangesPath = resolve(
    DATA_DIR,
    "municipality-code-changes.json",
  );
  const countyChangesPath = resolve(DATA_DIR, "county-code-changes.json");

  await Promise.all([
    writeFile(
      municipalityPeriodsPath,
      `${JSON.stringify(municipalities.periods, null, 2)}\n`,
    ),
    writeFile(
      countyPeriodsPath,
      `${JSON.stringify(counties.periods, null, 2)}\n`,
    ),
    writeFile(
      municipalityChangesPath,
      `${JSON.stringify(municipalities.changes, null, 2)}\n`,
    ),
    writeFile(
      countyChangesPath,
      `${JSON.stringify(counties.changes, null, 2)}\n`,
    ),
  ]);

  const munNumbers = new Set(municipalities.periods.map((p) => p.number));
  const munGeographic = new Set(
    municipalities.periods.map((p) => p.geographicId),
  );
  const renumbered = municipalities.changes.filter(
    (c) => c.oldCode !== c.newCode,
  ).length;

  console.log(`  Municipality periods: ${municipalities.periods.length}`);
  console.log(`  Municipality codes:   ${munNumbers.size}`);
  console.log(`  Geographic units:     ${munGeographic.size}`);
  console.log(`  Municipality changes: ${renumbered} number changes`);
  console.log(`  County periods:       ${counties.periods.length}`);
  console.log(`  County changes:       ${counties.changes.filter((c) => c.oldCode !== c.newCode).length}`);
  console.log(`  Output: ${DATA_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
