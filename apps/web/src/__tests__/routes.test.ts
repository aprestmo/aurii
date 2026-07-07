/**
 * Geo demo site — validates static route generation for reference datasets.
 */

import { describe, expect, it } from "bun:test";
import { resolve } from "path";
import {
  getCounty,
  getKindergarten,
  getMunicipalitiesByCounty,
  getMunicipality,
  getSchool,
  loadCounties,
  loadDatasetSummaries,
  loadHospitals,
  loadKindergartens,
  loadMunicipalities,
  loadPublicHolidays,
  loadSchools,
} from "../lib/data";

const ROOT = resolve(import.meta.dir, "../../../..");

describe("geo demo site routes", () => {
  it("exposes seven reference datasets", async () => {
    const datasets = await loadDatasetSummaries();
    expect(datasets).toHaveLength(7);
    expect(datasets.find((d) => d.id === "school")?.count).toBeGreaterThan(5000);
  });

  it("generates 15 county pages and 357 municipality pages", async () => {
    const counties = await loadCounties();
    const municipalities = await loadMunicipalities();
    expect(counties).toHaveLength(15);
    expect(municipalities).toHaveLength(357);
  });

  it("every /fylker/:id page resolves", async () => {
    const counties = await loadCounties();
    for (const c of counties) {
      const county = await getCounty(c.id);
      expect(county?.name).toBe(c.name);
      const muns = await getMunicipalitiesByCounty(c.id);
      expect(muns.length).toBeGreaterThan(0);
    }
  });

  it("every /kommuner/:id page resolves with parent county", async () => {
    const municipalities = await loadMunicipalities();
    for (const m of municipalities) {
      const mun = await getMunicipality(m.id);
      expect(mun?.name).toBe(m.name);
      const county = await getCounty(m.countyId);
      expect(county).toBeDefined();
    }
  });

  it("school and kindergarten entities resolve with municipality references", async () => {
    const schools = await loadSchools();
    const kindergartens = await loadKindergartens();
    expect(schools.length).toBeGreaterThan(5000);
    expect(kindergartens.length).toBeGreaterThan(5000);

    const school = await getSchool("974587815");
    if (school) {
      const municipality = await getMunicipality(school.municipalityId);
      expect(municipality).toBeDefined();
    }

    const kg = await getKindergarten(kindergartens[0]!.id);
    expect(kg?.municipalityId).toBeDefined();
  });

  it("hospitals and holidays data files are present", async () => {
    const hospitals = await loadHospitals();
    const holidays = await loadPublicHolidays();
    expect(hospitals.length).toBeGreaterThan(100);
    expect(holidays.length).toBeGreaterThan(80);
  });

  it("every municipality has population from SSB", async () => {
    const municipalities = await loadMunicipalities();
    const withPopulation = municipalities.filter((m) => m.population !== undefined);
    expect(withPopulation).toHaveLength(357);
    expect(withPopulation[0]?.populationYear).toBeGreaterThan(2020);

    const oslo = municipalities.find((m) => m.id === "0301");
    expect(oslo?.population).toBeGreaterThan(600_000);
  });

  it("every county has aggregated population", async () => {
    const counties = await loadCounties();
    for (const county of counties) {
      expect(county.population).toBeGreaterThan(0);
      const muns = await getMunicipalitiesByCounty(county.id);
      const sum = muns.reduce((total, m) => total + (m.population ?? 0), 0);
      expect(county.population).toBe(sum);
    }
  });

  it("data files exist at expected path", async () => {
    const path = resolve(ROOT, "demo/norwegian-geo/core/data/counties.json");
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path, "utf-8");
    expect(JSON.parse(text).length).toBeGreaterThan(0);
  });
});
