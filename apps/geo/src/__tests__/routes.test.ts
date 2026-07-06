/**
 * Geo demo site — validates static route generation for all counties and municipalities.
 */

import { describe, expect, it } from "bun:test";
import { resolve } from "path";
import {
  getCounty,
  getMunicipalitiesByCounty,
  getMunicipality,
  loadCounties,
  loadMunicipalities,
} from "../lib/data";

const ROOT = resolve(import.meta.dir, "../../../..");

describe("geo demo site routes", () => {
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

  it("data files exist at expected path", async () => {
    const path = resolve(ROOT, "demo/norwegian-geo/data/counties.json");
    const { access } = await import("node:fs/promises");
    await expect(access(path)).resolves.toBeUndefined();
  });
});
