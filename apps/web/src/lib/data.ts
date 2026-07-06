/**
 * Data access for the geo demo site.
 *
 * Reads bundled snapshots from demo/norwegian-geo/data/ (same data imported into Core).
 * Uses Node fs so Astro's static build works outside the Bun runtime.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../../..");
const DATA = resolve(ROOT, "demo/norwegian-geo/data");

export interface County {
  id: string;
  name: string;
  source?: string;
}

export interface Municipality {
  id: string;
  name: string;
  countyId: string;
  source?: string;
}

export interface PostalCode {
  code: string;
  city: string;
  municipalityId: string;
  municipalityName?: string;
  postalCodeType?: string;
}

async function readJson<T>(file: string): Promise<T> {
  const text = await readFile(resolve(DATA, file), "utf-8");
  return JSON.parse(text) as T;
}

export async function loadCounties(): Promise<County[]> {
  return readJson<County[]>("counties.json");
}

export async function loadMunicipalities(): Promise<Municipality[]> {
  return readJson<Municipality[]>("municipalities.json");
}

export async function loadPostalCodes(): Promise<PostalCode[]> {
  return readJson<PostalCode[]>("postal-codes.json");
}

export async function getCounty(id: string): Promise<County | undefined> {
  const counties = await loadCounties();
  return counties.find((c) => c.id === id);
}

export async function getMunicipality(
  id: string,
): Promise<Municipality | undefined> {
  const municipalities = await loadMunicipalities();
  return municipalities.find((m) => m.id === id);
}

export async function getMunicipalitiesByCounty(
  countyId: string,
): Promise<Municipality[]> {
  const municipalities = await loadMunicipalities();
  return municipalities
    .filter((m) => m.countyId === countyId)
    .sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export async function getPostalCodesByMunicipality(
  municipalityId: string,
  limit = 20,
): Promise<PostalCode[]> {
  const codes = await loadPostalCodes();
  return codes
    .filter((p) => p.municipalityId === municipalityId)
    .sort((a, b) => a.code.localeCompare(b.code))
    .slice(0, limit);
}
