/**
 * Builds identifier periods and geographic lineage from SSB Klass data.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IdentifierPeriod, SsbCodeChange } from "./types";
import {
  clampDate,
  fetchClassification,
  fetchCodeChanges,
  fetchCodesInRange,
  lastValidDay,
  SSB_KLASS_SOURCE,
  versionsInRange,
  type KlassCode,
  type KlassVersion,
} from "./ssb-klass";

const CURRENT_DATA = resolve(import.meta.dir, "../data");

interface RawPeriod {
  number: string;
  name: string;
  countyNumber: string;
  validFrom: string;
  validTo: string;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(code: string): string {
    if (!this.parent.has(code)) this.parent.set(code, code);
    const parent = this.parent.get(code)!;
    if (parent !== code) {
      const root = this.find(parent);
      this.parent.set(code, root);
      return root;
    }
    return code;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }

  codes(): string[] {
    return [...this.parent.keys()];
  }
}

function countyNumberFromCode(
  code: string,
  entityType: "municipality" | "county",
): string {
  return entityType === "municipality" ? code.slice(0, 2) : code;
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function mergeAdjacentPeriods(periods: RawPeriod[]): RawPeriod[] {
  const sorted = [...periods].sort((a, b) => {
    const byNumber = a.number.localeCompare(b.number);
    if (byNumber !== 0) return byNumber;
    return a.validFrom.localeCompare(b.validFrom);
  });

  const merged: RawPeriod[] = [];
  for (const period of sorted) {
    const last = merged.at(-1);
    if (
      last &&
      last.number === period.number &&
      last.name === period.name &&
      last.countyNumber === period.countyNumber &&
      dayAfter(last.validTo) === period.validFrom
    ) {
      last.validTo = period.validTo;
      continue;
    }
    merged.push({ ...period });
  }
  return merged;
}

function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function applyLineageUnions(
  changes: SsbCodeChange[],
  uf: UnionFind,
): void {
  const numericChanges = changes.filter((c) => c.oldCode !== c.newCode);
  const byDate = new Map<string, SsbCodeChange[]>();

  for (const change of numericChanges) {
    const bucket = byDate.get(change.changeOccurred) ?? [];
    bucket.push(change);
    byDate.set(change.changeOccurred, bucket);
  }

  for (const dateChanges of byDate.values()) {
    const splitOldCodes = new Set<string>();
    const byOld = new Map<string, SsbCodeChange[]>();

    for (const change of dateChanges) {
      const bucket = byOld.get(change.oldCode) ?? [];
      bucket.push(change);
      byOld.set(change.oldCode, bucket);
    }

    for (const [oldCode, oldChanges] of byOld) {
      const newCodes = new Set(oldChanges.map((c) => c.newCode));
      if (newCodes.size > 1) splitOldCodes.add(oldCode);
    }

    for (const change of dateChanges) {
      if (splitOldCodes.has(change.oldCode)) continue;
      uf.union(change.oldCode, change.newCode);
    }
  }
}

function resolveGeographicIds(
  uf: UnionFind,
  currentIds: Set<string>,
): Map<string, string> {
  const groups = new Map<string, string[]>();
  for (const code of uf.codes()) {
    const root = uf.find(code);
    const bucket = groups.get(root) ?? [];
    bucket.push(code);
    groups.set(root, bucket);
  }

  const geographicIdByCode = new Map<string, string>();
  for (const codes of groups.values()) {
    const sorted = [...codes].sort();
    const current = sorted.find((code) => currentIds.has(code));
    const geographicId = current ?? sorted.at(-1)!;
    for (const code of codes) {
      geographicIdByCode.set(code, geographicId);
    }
  }
  return geographicIdByCode;
}

async function loadCurrentIds(
  entityType: "municipality" | "county",
): Promise<Set<string>> {
  const file =
    entityType === "municipality" ? "municipalities.json" : "counties.json";
  const records = JSON.parse(
    await readFile(resolve(CURRENT_DATA, file), "utf-8"),
  ) as Array<{ id: string }>;
  return new Set(records.map((record) => record.id));
}

async function collectRawPeriods(
  classificationId: number,
  versions: KlassVersion[],
  from: string,
  to: string,
  entityType: "municipality" | "county",
): Promise<RawPeriod[]> {
  const periods: RawPeriod[] = [];

  for (const version of versionsInRange(versions, from, to)) {
    const rangeFrom = clampDate(version.validFrom, from, to);
    const rangeTo = clampDate(lastValidDay(version.validTo), from, to);
    if (rangeFrom > rangeTo) continue;

    const codes = await fetchCodesInRange(classificationId, rangeFrom, rangeTo);
    for (const code of codes) {
      const validFrom = code.validFromInRequestedRange ?? rangeFrom;
      const validTo = code.validToInRequestedRange ?? rangeTo;
      periods.push({
        number: code.code.padStart(entityType === "municipality" ? 4 : 2, "0"),
        name: normalizeName(code.name),
        countyNumber: countyNumberFromCode(code.code, entityType),
        validFrom,
        validTo,
      });
    }
  }

  return mergeAdjacentPeriods(periods);
}

function toIdentifierPeriod(
  period: RawPeriod,
  geographicId: string,
  entityType: "municipality" | "county",
  currentIds: Set<string>,
): IdentifierPeriod {
  const currentId = currentIds.has(geographicId) ? geographicId : undefined;
  return {
    id: `${entityType}-${period.number}-${period.validFrom}`,
    entityType,
    number: period.number,
    name: period.name,
    countyNumber:
      entityType === "municipality" ? period.countyNumber : period.number,
    validFrom: period.validFrom,
    validTo: period.validTo >= "2099-01-01" ? null : period.validTo,
    geographicId,
    currentMunicipalityId:
      entityType === "municipality" ? currentId : undefined,
    currentCountyId: entityType === "county" ? currentId : undefined,
    sourceUrl: SSB_KLASS_SOURCE,
  };
}

export interface BuildIdentifierPeriodsResult {
  periods: IdentifierPeriod[];
  changes: SsbCodeChange[];
}

export async function buildIdentifierPeriods(options: {
  classificationId: number;
  entityType: "municipality" | "county";
  from: string;
  to: string;
}): Promise<BuildIdentifierPeriodsResult> {
  const { classificationId, entityType, from, to } = options;
  const classification = await fetchClassification(classificationId);
  const changes = (await fetchCodeChanges(classificationId, from, to)).map(
    (change) => ({
      ...change,
      oldCode: change.oldCode.padStart(
        entityType === "municipality" ? 4 : 2,
        "0",
      ),
      newCode: change.newCode.padStart(
        entityType === "municipality" ? 4 : 2,
        "0",
      ),
      oldName: normalizeName(change.oldName),
      newName: normalizeName(change.newName),
    }),
  );

  const rawPeriods = await collectRawPeriods(
    classificationId,
    classification.versions,
    from,
    to,
    entityType,
  );

  const currentIds = await loadCurrentIds(entityType);
  const uf = new UnionFind();
  for (const period of rawPeriods) uf.find(period.number);
  for (const change of changes) {
    uf.find(change.oldCode);
    uf.find(change.newCode);
  }
  applyLineageUnions(changes, uf);
  const geographicIdByCode = resolveGeographicIds(uf, currentIds);

  const periods = rawPeriods.map((period) =>
    toIdentifierPeriod(
      period,
      geographicIdByCode.get(period.number) ?? period.number,
      entityType,
      currentIds,
    ),
  );

  return { periods, changes };
}
