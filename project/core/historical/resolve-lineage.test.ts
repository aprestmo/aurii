#!/usr/bin/env bun
import { describe, expect, it } from "bun:test";
import {
  buildRenumberLineage,
  isRenumberChange,
  periodsForMunicipality,
} from "./resolve-lineage";
import type { IdentifierPeriod, SsbCodeChange } from "./types";

const sampleChanges: SsbCodeChange[] = [
  {
    oldCode: "1601",
    oldName: "Trondheim",
    newCode: "5001",
    newName: "Trondheim",
    changeOccurred: "2018-01-01",
  },
  {
    oldCode: "5030",
    oldName: "Klæbu",
    newCode: "5001",
    newName: "Trondheim",
    changeOccurred: "2020-01-01",
  },
];

describe("resolve-lineage", () => {
  it("detects 1:1 renumber changes", () => {
    expect(isRenumberChange(sampleChanges[0]!, sampleChanges)).toBe(true);
    expect(isRenumberChange(sampleChanges[1]!, sampleChanges)).toBe(false);
  });

  it("builds renumber lineage without merged neighbours", () => {
    const lineage = buildRenumberLineage("5001", sampleChanges);
    expect(lineage.has("5001")).toBe(true);
    expect(lineage.has("1601")).toBe(true);
    expect(lineage.has("5030")).toBe(false);
  });

  it("filters periods to renumber lineage only", () => {
    const periods: IdentifierPeriod[] = [
      {
        id: "a",
        entityType: "municipality",
        number: "1601",
        name: "Trondheim",
        countyNumber: "16",
        validFrom: "2008-01-01",
        validTo: "2017-12-31",
        geographicId: "5001",
        currentMunicipalityId: "5001",
        sourceUrl: "https://example.com",
      },
      {
        id: "b",
        entityType: "municipality",
        number: "5030",
        name: "Klæbu",
        countyNumber: "50",
        validFrom: "2018-01-01",
        validTo: "2019-12-31",
        geographicId: "5001",
        currentMunicipalityId: "5001",
        sourceUrl: "https://example.com",
      },
    ];

    const filtered = periodsForMunicipality("5001", periods, sampleChanges);
    expect(filtered.map((p) => p.number)).toEqual(["1601"]);
  });
});
