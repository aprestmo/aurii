#!/usr/bin/env bun
/**
 * Validates the historical Norwegian geo dataset.
 * Run: bun run demo/norwegian-geo/historical/validate.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  AdministrativeChange,
  HistoricalCounty,
  HistoricalMunicipality,
} from "./types";

const ROOT = resolve(import.meta.dir, "../../..");
const DATA_DIR = resolve(ROOT, "data/historical");
const PUBLIC_ROOT = resolve(ROOT, "apps/geo/public");

interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number>;
}

async function loadJson<T>(file: string): Promise<T> {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) {
    throw new Error(`Missing data file: ${path}`);
  }
  return (await Bun.file(path).json()) as T;
}

function validateDataset(
  municipalities: HistoricalMunicipality[],
  counties: HistoricalCounty[],
  changes: AdministrativeChange[],
  currentCounties: import("./types").WikiCurrentCounty[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const mun of municipalities) {
    if (!mun.name?.trim()) {
      errors.push(`Municipality ${mun.id} missing name`);
    }
    if (mun.validFrom !== undefined && (mun.validFrom < 1000 || mun.validFrom > 2100)) {
      errors.push(`${mun.name}: invalid validFrom ${mun.validFrom}`);
    }
    if (mun.validTo !== undefined && (mun.validTo < 1000 || mun.validTo > 2100)) {
      errors.push(`${mun.name}: invalid validTo ${mun.validTo}`);
    }
    if (
      mun.validFrom !== undefined &&
      mun.validTo !== undefined &&
      mun.validFrom > mun.validTo
    ) {
      errors.push(`${mun.name}: validFrom > validTo`);
    }
    if (mun.coatOfArms?.localPath) {
      const filePath = resolve(PUBLIC_ROOT, mun.coatOfArms.localPath.replace(/^\//, ""));
      if (!existsSync(filePath)) {
        errors.push(`${mun.name}: missing coat file ${mun.coatOfArms.localPath}`);
      }
    }
  }

  for (const county of counties) {
    if (!county.name?.trim()) {
      errors.push(`County ${county.id} missing name`);
    }
    if (county.validTo !== undefined && (county.validTo < 1000 || county.validTo > 2100)) {
      errors.push(`${county.name}: invalid validTo ${county.validTo}`);
    }
    if (county.coatOfArms?.localPath) {
      const filePath = resolve(PUBLIC_ROOT, county.coatOfArms.localPath.replace(/^\//, ""));
      if (!existsSync(filePath)) {
        errors.push(`${county.name}: missing coat file ${county.coatOfArms.localPath}`);
      }
    }
  }

  for (const county of currentCounties) {
    if (!county.name?.trim()) {
      errors.push(`Current county ${county.id} missing name`);
    }
    if (county.coatOfArms?.localPath) {
      const filePath = resolve(PUBLIC_ROOT, county.coatOfArms.localPath.replace(/^\//, ""));
      if (!existsSync(filePath)) {
        errors.push(`${county.name}: missing coat file ${county.coatOfArms.localPath}`);
      }
    }
  }

  for (const change of changes) {
    if (change.from.length === 0) {
      errors.push(`Change ${change.id} has empty from`);
    }
    if (change.to.length === 0) {
      errors.push(`Change ${change.id} has empty to`);
    }
  }

  if (municipalities.length < 300) {
    warnings.push(`Only ${municipalities.length} municipalities — expected 300+`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      municipalities: municipalities.length,
      counties: counties.length,
      changes: changes.length,
      withCoats:
        municipalities.filter((m) => m.coatOfArms).length +
        counties.filter((c) => c.coatOfArms).length +
        currentCounties.filter((c) => c.coatOfArms).length,
    },
  };
}

async function main(): Promise<void> {
  const [municipalities, counties, changes, currentCounties] = await Promise.all([
    loadJson<HistoricalMunicipality[]>("municipalities.json"),
    loadJson<HistoricalCounty[]>("counties.json"),
    loadJson<AdministrativeChange[]>("administrative-changes.json"),
    loadJson<import("./types").WikiCurrentCounty[]>("current-counties.json"),
  ]);

  const result = validateDataset(
    municipalities,
    counties,
    changes,
    currentCounties,
  );

  console.log("Historical dataset validation");
  console.log("Stats:", result.stats);

  for (const warning of result.warnings) {
    console.warn("WARN:", warning);
  }

  if (result.ok) {
    console.log("✓ All checks passed");
    process.exit(0);
  }

  for (const error of result.errors) {
    console.error("ERROR:", error);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
