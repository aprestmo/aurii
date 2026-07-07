/**
 * Resolves municipality/county number lineages from SSB code changes.
 */

import type { IdentifierPeriod, SsbCodeChange } from "./types";

function changesOnDate(
  changes: SsbCodeChange[],
  date: string,
): SsbCodeChange[] {
  return changes.filter((change) => change.changeOccurred === date);
}

function normalizeName(name: string): string {
  return name.split(" - ")[0]!.split(" / ")[0]!.trim().toLowerCase();
}

/** True when a change is a pure 1:1 number change (not a merge or split). */
export function isRenumberChange(
  change: SsbCodeChange,
  changes: SsbCodeChange[],
): boolean {
  if (change.oldCode === change.newCode) return false;
  if (normalizeName(change.oldName) !== normalizeName(change.newName)) {
    return false;
  }

  const sameDate = changesOnDate(changes, change.changeOccurred);
  const toSameNew = sameDate.filter(
    (c) => c.newCode === change.newCode && c.oldCode !== c.newCode,
  );
  const fromSameOld = sameDate.filter(
    (c) => c.oldCode === change.oldCode && c.oldCode !== c.newCode,
  );

  if (toSameNew.length > 1 || fromSameOld.length > 1) return false;

  return toSameNew.length === 1 && fromSameOld.length === 1;
}

/** All numbers in the 1:1 renumber chain leading to `currentNumber`. */
export function buildRenumberLineage(
  currentNumber: string,
  changes: SsbCodeChange[],
): Set<string> {
  const numericChanges = changes.filter((c) => c.oldCode !== c.newCode);
  const lineage = new Set([currentNumber]);
  let expanded = true;

  while (expanded) {
    expanded = false;
    for (const change of numericChanges) {
      if (!lineage.has(change.newCode)) continue;
      if (!isRenumberChange(change, numericChanges)) continue;
      if (!lineage.has(change.oldCode)) {
        lineage.add(change.oldCode);
        expanded = true;
      }
    }
  }

  return lineage;
}

export function periodsForMunicipality(
  municipalityId: string,
  periods: IdentifierPeriod[],
  changes: SsbCodeChange[],
): IdentifierPeriod[] {
  const lineage = buildRenumberLineage(municipalityId, changes);
  return periods
    .filter(
      (period) =>
        period.entityType === "municipality" && lineage.has(period.number),
    )
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}

export function isoYear(isoDate: string): number {
  return Number.parseInt(isoDate.slice(0, 4), 10);
}

export function isoToValidToYear(validTo: string | null): number | undefined {
  if (!validTo) return undefined;
  return isoYear(validTo);
}

export function isoToValidFromYear(validFrom: string): number {
  return isoYear(validFrom);
}
