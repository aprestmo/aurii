#!/usr/bin/env bun
/**
 * Fetch fresh Norwegian geographic reference data from authoritative open sources.
 *
 * Usage (from repo root):
 *   bun run fetch:norwegian-geo
 */

import { resolve } from "path";

const ROOT = resolve(import.meta.dir, "../../..");
const DATA_DIR = resolve(ROOT, "demo/norwegian-geo/data");

const KARTVERKET_COUNTIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/fylker";
const KARTVERKET_MUNICIPALITIES_URL =
	"https://ws.geonorge.no/kommuneinfo/v1/kommuner";
const BRING_POSTNUMMER_TSV_URL =
	"https://www.bring.no/tjenester/adressetjenester/postnummer/_/attachment/download/7f0186f6-cf90-4657-8b5b-70707abeb789:62b42f1b8274a60db4bba965e64c7cf2c43143e9/Postnummerregister-ansi.txt";

interface KartverketCounty {
	fylkesnummer: string;
	fylkesnavn: string;
}

interface KartverketMunicipality {
	kommunenummer: string;
	kommunenavnNorsk: string;
}

async function fetchCounties() {
	const res = await fetch(KARTVERKET_COUNTIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket counties: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketCounty[];
	return data.map((c) => ({
		id: c.fylkesnummer,
		name: c.fylkesnavn,
		source: "kartverket",
	}));
}

async function fetchMunicipalities() {
	const res = await fetch(KARTVERKET_MUNICIPALITIES_URL, {
		headers: { Accept: "application/json" },
	});
	if (!res.ok) throw new Error(`Kartverket municipalities: HTTP ${res.status}`);
	const data = (await res.json()) as KartverketMunicipality[];
	return data.map((m) => ({
		id: m.kommunenummer,
		name: m.kommunenavnNorsk,
		countyId: m.kommunenummer.slice(0, 2),
		source: "kartverket",
	}));
}

async function fetchPostalCodes() {
	const res = await fetch(BRING_POSTNUMMER_TSV_URL);
	if (!res.ok) throw new Error(`Bring postnummer TSV: HTTP ${res.status}`);

	const bytes = new Uint8Array(await res.arrayBuffer());
	const text = new TextDecoder("latin1" as "utf-8").decode(bytes);
	const lines = text.trim().split("\n");

	return lines.map((line) => {
		const [postnummer, poststed, kommunenummer, kommunenavn, type] =
			line.split("\t");
		return {
			code: String(postnummer ?? "").padStart(4, "0"),
			city: String(poststed ?? ""),
			municipalityId: String(kommunenummer ?? ""),
			municipalityName: String(kommunenavn ?? ""),
			postalCodeType: String(type ?? ""),
			source: "bring",
		};
	});
}

const [counties, municipalities, postalCodes] = await Promise.all([
	fetchCounties(),
	fetchMunicipalities(),
	fetchPostalCodes(),
]);

await Bun.write(
	resolve(DATA_DIR, "counties.json"),
	JSON.stringify(counties, null, 2),
);
await Bun.write(
	resolve(DATA_DIR, "municipalities.json"),
	JSON.stringify(municipalities, null, 2),
);
await Bun.write(
	resolve(DATA_DIR, "postal-codes.json"),
	JSON.stringify(postalCodes, null, 2),
);

console.log(`Wrote ${counties.length} counties`);
console.log(`Wrote ${municipalities.length} municipalities`);
console.log(`Wrote ${postalCodes.length} postal codes`);
console.log(`Output: ${DATA_DIR}`);
