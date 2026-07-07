import type { AdministrativeChange, HistoricalCounty } from "./types";
import { makeChangeId } from "./parse-html";

const COUNTY_SOURCE = "https://no.wikipedia.org/wiki/Norges_fylker";

/** Counties merged into intermediate units in the 2020 reform. */
const MERGE_INTO_2020: Array<{
  intermediate: { name: string; number: string };
  members: Array<{ name: string; number: string }>;
}> = [
  {
    intermediate: { name: "Viken", number: "30" },
    members: [
      { name: "Østfold", number: "01" },
      { name: "Akershus", number: "02" },
      { name: "Buskerud", number: "06" },
    ],
  },
  {
    intermediate: { name: "Vestfold og Telemark", number: "38" },
    members: [
      { name: "Vestfold", number: "07" },
      { name: "Telemark", number: "08" },
    ],
  },
  {
    intermediate: { name: "Troms og Finnmark", number: "54" },
    members: [
      { name: "Troms", number: "19" },
      { name: "Finnmark", number: "20" },
    ],
  },
];

function histCountyId(number: string, name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `hist-county-${number.padStart(2, "0")}-${slug}`;
}

export function inferCountyReformChanges(
  counties: HistoricalCounty[],
  existingChanges: AdministrativeChange[],
  changeIndexStart: number,
): AdministrativeChange[] {
  const inferred: AdministrativeChange[] = [];
  let changeIndex = changeIndexStart;

  const existingFromKeys = new Set(
    existingChanges.flatMap((c) =>
      c.from.map((f) => `${f.number ?? ""}:${f.name}`),
    ),
  );

  for (const group of MERGE_INTO_2020) {
    const intermediateId = histCountyId(
      group.intermediate.number,
      group.intermediate.name,
    );

    for (const member of group.members) {
      const fromKey = `${member.number}:${member.name}`;
      if (existingFromKeys.has(fromKey)) continue;

      const historical = counties.find(
        (c) =>
          c.countyNumber === member.number.padStart(2, "0") &&
          c.name === member.name,
      );
      if (!historical) continue;

      inferred.push({
        id: makeChangeId("county", member.name, 2020, changeIndex++),
        entityType: "county",
        changeYear: 2020,
        changeType: "merged",
        from: [
          {
            name: member.name,
            number: member.number.padStart(2, "0"),
            id: historical.id,
          },
        ],
        to: [
          {
            name: group.intermediate.name,
            number: group.intermediate.number,
            id: intermediateId,
          },
        ],
        notes: `Sammenslåing til ${group.intermediate.name} (2020-reformen)`,
        sourceUrl: COUNTY_SOURCE,
      });
      existingFromKeys.add(fromKey);
    }
  }

  return inferred;
}

/** Remove direct reestablished jumps that skip intermediate 2020 units. */
export function filterSkippedReestablishmentChanges(
  changes: AdministrativeChange[],
): AdministrativeChange[] {
  const intermediateNames = new Set(
    MERGE_INTO_2020.map((g) => g.intermediate.name),
  );
  const membersToIntermediate = new Map<string, string>();
  for (const group of MERGE_INTO_2020) {
    for (const member of group.members) {
      membersToIntermediate.set(member.name, group.intermediate.name);
    }
  }

  return changes.filter((change) => {
    if (change.changeType !== "reestablished") return true;
    if (change.from.length !== 1 || change.to.length !== 1) return true;

    const fromName = change.from[0]!.name;
    const toName = change.to[0]!.name;
    const intermediate = membersToIntermediate.get(fromName);

    // Drop Vestfold (07) → Vestfold (39) style jumps; path goes via intermediate.
    if (intermediate && fromName === toName) return false;
    if (intermediate && !intermediateNames.has(toName)) return false;

    return true;
  });
}

/** Split changes (one → many) should be typed as split, not merged. */
export function normalizeSplitChangeTypes(
  changes: AdministrativeChange[],
): AdministrativeChange[] {
  return changes.map((change) => {
    if (change.to.length > 1 && change.from.length === 1) {
      return { ...change, changeType: "split" };
    }
    if (change.from.length > 1 && change.to.length === 1) {
      return { ...change, changeType: "merged" };
    }
    return change;
  });
}
