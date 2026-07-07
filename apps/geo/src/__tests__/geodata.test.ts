import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { geoAssetPaths, loadGeoManifest } from "../lib/geodata";

const ROOT = resolve(import.meta.dir, "../../../..");
const GEODATA_DIR = resolve(ROOT, "apps/geo/public/assets/geodata");

describe("geodata assets", () => {
  it("exposes county and municipality boundary files", () => {
    const paths = geoAssetPaths();
    expect(existsSync(resolve(ROOT, "apps/geo/public", paths.counties))).toBe(true);
    expect(existsSync(resolve(ROOT, "apps/geo/public", paths.municipalities))).toBe(
      true,
    );
    expect(existsSync(resolve(ROOT, "apps/geo/public", paths.manifest))).toBe(true);
  });

  it("manifest covers all current counties and municipalities", async () => {
    const manifest = await loadGeoManifest();
    expect(Object.keys(manifest.counties)).toHaveLength(15);
    expect(Object.keys(manifest.municipalities)).toHaveLength(357);
    expect(manifest.counties["03"]?.name).toBeTruthy();
    expect(manifest.municipalities["0301"]?.countyId).toBe("03");
  });

  it("geojson features use Aurii ids", async () => {
    const municipalities = JSON.parse(
      await Bun.file(resolve(GEODATA_DIR, "municipalities.geojson")).text(),
    );
    const counties = JSON.parse(
      await Bun.file(resolve(GEODATA_DIR, "counties.geojson")).text(),
    );

    expect(municipalities.features.length).toBe(357);
    expect(counties.features.length).toBe(15);
    expect(municipalities.features[0].properties.id).toMatch(/^\d{4}$/);
    expect(counties.features[0].properties.id).toMatch(/^\d{2}$/);
  });
});
