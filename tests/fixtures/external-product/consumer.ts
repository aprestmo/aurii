/**
 * Product-client surface for the fixture.
 *
 * This module is the stand-in for an Astro/frontend app. It may import
 * @aurii/sdk and talk to HTTP/public delivery APIs. It must not import
 * @aurii/core, @aurii/db, or @aurii/studio.
 */
import { createClient, type AuriiClient } from "@aurii/sdk";

export interface Region {
	id: string;
	name: string;
}

export interface City {
	id: string;
	name: string;
	regionId: string;
}

export function createCatalogClient(baseUrl: string): AuriiClient {
	return createClient({
		baseUrl,
		defaultDataset: "catalog",
	});
}

export async function loadRegions(
	client: AuriiClient,
	projectSlug = "catalog",
): Promise<Region[]> {
	const page = await client.published.get<Region>(projectSlug, "/regions");
	return page.data;
}

export async function loadCities(
	client: AuriiClient,
	projectSlug = "catalog",
): Promise<City[]> {
	const page = await client.published.get<City>(projectSlug, "/cities");
	return page.data;
}

export async function loadCity(
	client: AuriiClient,
	id: string,
	projectSlug = "catalog",
): Promise<City[]> {
	const page = await client.published.get<City>(projectSlug, `/cities/${id}`);
	return page.data;
}
