/**
 * Adjacent-entity navigation for county and municipality detail pages.
 */

import { getMunicipalitiesByCounty, loadCounties, type Municipality } from "./data";

export interface AdjacentEntity {
  id: string;
  name: string;
}

export interface AdjacentPair {
  previous?: AdjacentEntity;
  next?: AdjacentEntity;
}

function adjacentInList<T extends { id: string; name: string }>(
  items: T[],
  currentId: string,
): AdjacentPair {
  const index = items.findIndex((item) => item.id === currentId);
  if (index === -1) return {};

  return {
    previous:
      index > 0
        ? { id: items[index - 1]!.id, name: items[index - 1]!.name }
        : undefined,
    next:
      index < items.length - 1
        ? { id: items[index + 1]!.id, name: items[index + 1]!.name }
        : undefined,
  };
}

export async function getAdjacentCounties(currentId: string): Promise<AdjacentPair> {
  const counties = (await loadCounties()).sort((a, b) => a.name.localeCompare(b.name, "nb"));
  return adjacentInList(counties, currentId);
}

export async function getAdjacentMunicipalities(
  currentId: string,
  countyId: string,
): Promise<AdjacentPair> {
  const municipalities = await getMunicipalitiesByCounty(countyId);
  return adjacentInList(municipalities, currentId);
}

export async function getRelatedMunicipalities(
  currentId: string,
  countyId: string,
  limit = 5,
): Promise<Municipality[]> {
  const municipalities = await getMunicipalitiesByCounty(countyId);
  const others = municipalities.filter((m) => m.id !== currentId);
  const currentIndex = municipalities.findIndex((m) => m.id === currentId);

  if (currentIndex === -1) {
    return others.slice(0, limit);
  }

  const nearby: Municipality[] = [];
  for (let offset = 1; nearby.length < limit && offset < municipalities.length; offset++) {
    const before = municipalities[currentIndex - offset];
    const after = municipalities[currentIndex + offset];
    if (after) nearby.push(after);
    if (before && nearby.length < limit) nearby.push(before);
  }

  return nearby.slice(0, limit);
}
