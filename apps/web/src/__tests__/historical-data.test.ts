import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  buildMunicipalityTimeline,
  loadAdministrativeChanges,
  loadHistoricalCounties,
  loadHistoricalMunicipalities,
  loadMunicipalityEnrichment,
} from "../lib/historical-data";

const ROOT = resolve(import.meta.dir, "../../../..");
const DATA_DIR = resolve(ROOT, "demo/norwegian-geo/core/historical/data");
const HERALDRY_ROOT = resolve(ROOT, "apps/geo/public/assets/heraldry");

describe("historical norwegian geo dataset", () => {
  it("data files exist", () => {
    for (const file of [
      "municipalities.json",
      "counties.json",
      "current-counties.json",
      "current-municipalities.json",
      "administrative-changes.json",
      "municipality-enrichment.json",
      "unresolved-matches.json",
      "heraldry-manifest.json",
    ]) {
      expect(existsSync(resolve(DATA_DIR, file))).toBe(true);
    }
  });

  it("all records have names and valid years", async () => {
    const municipalities = await loadHistoricalMunicipalities();
    const counties = await loadHistoricalCounties();

    expect(municipalities.length).toBeGreaterThan(300);
    expect(counties.length).toBeGreaterThan(10);

    for (const mun of municipalities) {
      expect(mun.name.length).toBeGreaterThan(0);
      if (mun.validFrom !== undefined) {
        expect(mun.validFrom).toBeGreaterThanOrEqual(1000);
        expect(mun.validFrom).toBeLessThanOrEqual(2100);
      }
      if (mun.validTo !== undefined) {
        expect(mun.validTo).toBeGreaterThanOrEqual(1000);
        expect(mun.validTo).toBeLessThanOrEqual(2100);
      }
      if (mun.validFrom !== undefined && mun.validTo !== undefined) {
        expect(mun.validFrom).toBeLessThanOrEqual(mun.validTo);
      }
    }

    for (const county of counties) {
      expect(county.name.length).toBeGreaterThan(0);
      if (county.validTo !== undefined) {
        expect(county.validTo).toBeGreaterThanOrEqual(1000);
        expect(county.validTo).toBeLessThanOrEqual(2100);
      }
    }
  });

  it("administrative changes have from and to entities", async () => {
    const changes = await loadAdministrativeChanges();
    expect(changes.length).toBeGreaterThan(100);

    for (const change of changes) {
      expect(change.from.length).toBeGreaterThan(0);
      expect(change.to.length).toBeGreaterThan(0);
    }
  });

  it("coat of arms local files exist when declared", async () => {
    const municipalities = await loadHistoricalMunicipalities();
    const counties = await loadHistoricalCounties();
    const withCoats = [
      ...municipalities.filter((m) => m.coatOfArms),
      ...counties.filter((c) => c.coatOfArms),
    ];

    expect(withCoats.length).toBeGreaterThan(0);

    for (const entity of withCoats) {
      const localPath = entity.coatOfArms!.localPath.replace(/^\//, "");
      const absolute = resolve(ROOT, "apps/geo/public", localPath);
      expect(existsSync(absolute)).toBe(true);
    }
  });

  it("Austre Moland → Moland → Arendal timeline", async () => {
    const timeline = await buildMunicipalityTimeline(
      "hist-mun-0918-austre-moland",
    );
    const names = timeline.map((step) => step.name);
    expect(names).toContain("Austre Moland");
    expect(names).toContain("Moland");
    expect(names).toContain("Arendal");
    expect(timeline.at(-1)?.isCurrent).toBe(true);
  });

  it("Hedmark merged into Innlandet", async () => {
    const counties = await loadHistoricalCounties();
    const hedmark = counties.find((c) => c.name === "Hedmark");
    expect(hedmark?.validTo).toBe(2020);
    expect(hedmark?.todayPartOfNames).toContain("Innlandet");
    expect(hedmark?.todayPartOfIds).toContain("34");
  });

  it("heraldry assets directory is populated", () => {
    expect(existsSync(HERALDRY_ROOT)).toBe(true);
    expect(existsSync(resolve(HERALDRY_ROOT, "municipalities"))).toBe(true);
    expect(existsSync(resolve(HERALDRY_ROOT, "counties"))).toBe(true);
  });

  it("all historical and current counties have coat of arms from Wikipedia", async () => {
    const { loadCurrentCountiesWiki } = await import("../lib/historical-data");
    const historical = await loadHistoricalCounties();
    const current = await loadCurrentCountiesWiki();
    expect(historical.every((c) => c.coatOfArms?.localPath)).toBe(true);
    expect(current.every((c) => c.coatOfArms?.localPath)).toBe(true);
    expect(current).toHaveLength(15);
  });

  it("current municipalities dataset exists with optional coats and websites", async () => {
    const { loadCurrentMunicipalitiesWiki } = await import("../lib/historical-data");
    const current = await loadCurrentMunicipalitiesWiki();
    expect(current).toHaveLength(357);
    expect(current.filter((m) => m.websiteUrl).length).toBeGreaterThan(200);
    // Coat downloads are best-effort (Commons rate limits); show when available.
    expect(current.filter((m) => m.coatOfArms?.localPath).length).toBeGreaterThan(0);
  });

  it("Trondheim enrichment lists Klæbu as direct predecessor", async () => {
    const enrichments = await loadMunicipalityEnrichment();
    const trondheim = enrichments.find((e) => e.id === "5001");
    expect(trondheim?.directPredecessors?.some((p) => p.name === "Klæbu")).toBe(
      true,
    );
    expect(trondheim?.predecessors?.some((p) => p.name === "Klæbu")).toBe(true);
    expect(trondheim?.websiteUrl).toMatch(/^https?:\/\//);
  });

  it("municipality enrichment covers all current municipalities", async () => {
    const enrichments = await loadMunicipalityEnrichment();
    expect(enrichments).toHaveLength(357);
    expect(enrichments.every((e) => e.id.length === 4 && e.name.length > 0)).toBe(
      true,
    );

    const arendal = enrichments.find((e) => e.id === "4203");
    expect(arendal?.predecessors?.length).toBeGreaterThanOrEqual(5);
    expect(arendal?.formedFrom?.some((p) => p.name === "Tromøy")).toBe(true);
    expect(arendal?.timeline?.some((t) => t.year === 2020)).toBe(true);
  });
});
