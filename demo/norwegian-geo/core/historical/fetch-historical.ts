import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  AdministrativeChange,
  HistoricalCounty,
  HistoricalMunicipality,
  WikiCurrentCounty,
} from "./types";
import {
  createMatchContext,
  matchCountyName,
  matchMunicipalityName,
  registerHistoricalCounty,
  registerHistoricalMunicipality,
} from "./match-entities";
import {
  extractCoatOfArmsSource,
  extractLinkTexts,
  extractTableRows,
  extractWikipediaUrl,
  makeChangeId,
  makeCountyId,
  makeMunicipalityId,
  parseChangeTypeFromNotes,
  parseCountyChangeType,
  parseYear,
  stripTags,
} from "./parse-html";
import { downloadHeraldryBatch, type HeraldryTarget } from "./heraldry";
import {
  filterSkippedReestablishmentChanges,
  inferCountyReformChanges,
  normalizeSplitChangeTypes,
} from "./infer-county-changes";

const USER_AGENT =
  "AuriiHistoricalGeoBot/1.0 (https://github.com/aprestmo/aurii; research)";
const MUNICIPALITY_SOURCE =
  "https://no.wikipedia.org/wiki/Liste_over_tidligere_norske_kommuner";
const COUNTY_SOURCE = "https://no.wikipedia.org/wiki/Norges_fylker";

const ROOT = resolve(import.meta.dir, "../../../..");
const DATA_DIR = resolve(import.meta.dir, "data");
const PUBLIC_ASSETS = resolve(ROOT, "apps/geo/public");
const CURRENT_DATA = resolve(import.meta.dir, "../data");

async function fetchWikipediaHtml(page: string): Promise<string> {
  const params = new URLSearchParams({
    action: "parse",
    page,
    prop: "text",
    format: "json",
  });
  const response = await fetch(
    `https://no.wikipedia.org/w/api.php?${params}`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!response.ok) {
    throw new Error(`Wikipedia API failed for ${page}: ${response.status}`);
  }
  const data = (await response.json()) as {
    parse?: { text?: { "*": string } };
  };
  const html = data.parse?.text?.["*"];
  if (!html) throw new Error(`No HTML returned for ${page}`);
  return html;
}

function parseMunicipalityPage(html: string): HistoricalMunicipality[] {
  const municipalities: HistoricalMunicipality[] = [];
  const sectionRegex =
    /<div class="mw-heading mw-heading3"><h3 id="([^"]+)">([^<]+)<\/h3>[\s\S]*?(?=<div class="mw-heading mw-heading3">|<div class="mw-heading mw-heading2">|$)/gi;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(html)) !== null) {
    const countyNameAtSource = sectionMatch[2]!.trim();
    const sectionHtml = sectionMatch[0]!;
    const tableMatch = sectionHtml.match(
      /<table class="wikitable[^>]*>([\s\S]*?)<\/table>/i,
    );
    if (!tableMatch) continue;

    const rows = extractTableRows(tableMatch[1]!);
    for (const row of rows) {
      if (row.cells.length < 7) continue;

      const numberCell = stripTags(row.cells[0]!);
      if (!/^\d{4}$/.test(numberCell)) continue;

      const nameCell = row.cells[1]!;
      const nameLinks = extractLinkTexts(nameCell);
      const name = nameLinks[0] ?? stripTags(nameCell);
      if (!name) continue;

      const coatSource =
        (row.cells[7] ? extractCoatOfArmsSource(row.cells[7]) : undefined) ??
        extractCoatOfArmsSource(row.cells[2]!);
      const validFrom = parseYear(stripTags(row.cells[3]!));
      const validTo = parseYear(stripTags(row.cells[4]!));
      const notes = stripTags(row.cells[5]!);
      const resultCell = row.cells[6]!;
      const resultNames = extractLinkTexts(resultCell);
      const resultFallback = stripTags(resultCell);
      const finalResultNames =
        resultNames.length > 0
          ? resultNames
          : resultFallback
            ? [resultFallback]
            : [];

      const { changeType } = parseChangeTypeFromNotes(notes);
      const wikipediaUrl = extractWikipediaUrl(nameCell);

      municipalities.push({
        id: makeMunicipalityId(numberCell, name),
        type: "municipality",
        name,
        municipalityNumber: numberCell,
        countyNameAtSource,
        validFrom,
        validTo,
        changeType,
        notes: notes || undefined,
        resultNames: finalResultNames,
        sourceUrl: MUNICIPALITY_SOURCE,
        wikipediaUrl,
        ...(coatSource
          ? { _coatSource: coatSource }
          : ({} as { _coatSource?: string })),
      } as HistoricalMunicipality & { _coatSource?: string });
    }
  }

  return municipalities;
}

function parseHistoricalCountiesPage(html: string): HistoricalCounty[] {
  const sectionIdx = html.indexOf("Tidligere fylker");
  if (sectionIdx === -1) throw new Error("Could not find 'Tidligere fylker' section");

  const sectionHtml = html.slice(sectionIdx);
  const tableMatch = sectionHtml.match(
    /<table class="wikitable[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) throw new Error("Could not find historical counties table");

  const counties: HistoricalCounty[] = [];
  const rows = extractTableRows(tableMatch[1]!);

  for (const row of rows) {
    if (row.cells.length < 6) continue;

    const numberCell = stripTags(row.cells[0]!);
    if (!/^\d{1,2}$/.test(numberCell)) continue;

    const nameCell = row.cells[1]!;
    const name =
      extractLinkTexts(nameCell).find((n) => !n.includes("våpen")) ??
      stripTags(nameCell);
    if (!name) continue;

    const coatSource = extractCoatOfArmsSource(nameCell);
    const administrativeCenter =
      extractLinkTexts(row.cells[2]!)[0] ?? stripTags(row.cells[2]!);
    const validTo = parseYear(stripTags(row.cells[3]!));
    const todayPartOfCell = row.cells[4]!;
    const todayPartOfRaw = stripTags(todayPartOfCell);
    const todayPartOfNames = extractLinkTexts(todayPartOfCell);
    const newCountyNumber = stripTags(row.cells[5]!) || undefined;
    const changeType = parseCountyChangeType(todayPartOfRaw, todayPartOfNames);
    const wikipediaUrl = extractWikipediaUrl(nameCell);

    counties.push({
      id: makeCountyId(numberCell.padStart(2, "0"), name),
      type: "county",
      name,
      countyNumber: numberCell.padStart(2, "0"),
      administrativeCenter: administrativeCenter || undefined,
      validTo,
      todayPartOfNames:
        todayPartOfNames.length > 0
          ? todayPartOfNames
          : todayPartOfRaw
            ? [todayPartOfRaw]
            : [],
      newCountyNumber,
      changeType,
      status: "historical",
      sourceUrl: COUNTY_SOURCE,
      wikipediaUrl,
      ...(coatSource
        ? { _coatSource: coatSource }
        : ({} as { _coatSource?: string })),
    } as HistoricalCounty & { _coatSource?: string });
  }

  return counties;
}

function parseCurrentCountiesPage(html: string): WikiCurrentCounty[] {
  const sectionIdx = html.indexOf("Norges_fylker_2024");
  if (sectionIdx === -1) {
    throw new Error("Could not find 'Norges fylker 2024–' section");
  }

  const endIdx = html.indexOf("Tidligere_fylker", sectionIdx);
  const sectionHtml = html.slice(sectionIdx, endIdx > 0 ? endIdx : undefined);
  const tableMatch = sectionHtml.match(
    /<table class="sortable wikitable">([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) throw new Error("Could not find current counties table");

  const counties: WikiCurrentCounty[] = [];
  const rows = extractTableRows(tableMatch[1]!);

  for (const row of rows) {
    if (row.cells.length < 3) continue;

    const numberCell = stripTags(row.cells[0]!);
    if (!/^\d{1,2}$/.test(numberCell)) continue;

    const nameCell = row.cells[1]!;
    const name =
      extractLinkTexts(nameCell).find((n) => !n.includes("våpen")) ??
      stripTags(nameCell);
    if (!name) continue;

    const coatSource = extractCoatOfArmsSource(nameCell);
    const administrativeCenter =
      extractLinkTexts(row.cells[2]!)[0] ?? stripTags(row.cells[2]!);
    const wikipediaUrl = extractWikipediaUrl(nameCell);
    const padded = numberCell.padStart(2, "0");

    counties.push({
      id: padded,
      type: "county",
      name,
      countyNumber: padded,
      administrativeCenter: administrativeCenter || undefined,
      validFrom: 2024,
      status: "current",
      sourceUrl: COUNTY_SOURCE,
      wikipediaUrl,
      ...(coatSource
        ? { _coatSource: coatSource }
        : ({} as { _coatSource?: string })),
    } as WikiCurrentCounty & { _coatSource?: string });
  }

  return counties;
}

function markIntermediateCounties(counties: HistoricalCounty[]): void {
  const intermediateNumbers = new Set(["30", "38", "54"]);
  for (const county of counties) {
    if (intermediateNumbers.has(county.countyNumber ?? "")) {
      county.status = "intermediate";
      county.validFrom = 2020;
    }
  }
}
function buildAdministrativeChanges(
  municipalities: HistoricalMunicipality[],
  counties: HistoricalCounty[],
  matchCtx: ReturnType<typeof createMatchContext>,
): AdministrativeChange[] {
  const changes: AdministrativeChange[] = [];
  let changeIndex = 0;

  for (const mun of municipalities) {
    if (!mun.changeType || mun.changeType === "unknown") continue;

    const fromEntities = [
      {
        name: mun.name,
        number: mun.municipalityNumber,
        id: mun.id,
      },
    ];

    const relatedFromNotes = mun.notes
      ? parseChangeTypeFromNotes(mun.notes).relatedNames
      : [];

    const toNames =
      mun.resultNames.length > 0 ? mun.resultNames : relatedFromNotes;
    if (toNames.length === 0) continue;

    const toEntities = toNames
      .map((name) => ({
        name,
        id: matchMunicipalityName(matchCtx, name, {
          historicalId: mun.id,
          historicalName: mun.name,
          historicalNumber: mun.municipalityNumber,
          countyNameAtSource: mun.countyNameAtSource,
        }),
      }))
      .filter((entity) => entity.id !== mun.id);

    changes.push({
      id: makeChangeId("municipality", mun.name, mun.validTo, changeIndex++),
      entityType: "municipality",
      changeYear: mun.validTo,
      changeType: mun.changeType,
      from: fromEntities,
      to: toEntities,
      notes: mun.notes,
      sourceUrl: mun.sourceUrl,
    });
  }

  for (const county of counties) {
    if (!county.changeType || county.changeType === "unknown") continue;

    // Re-establishments via 2020 intermediate units are modelled separately.
    if (county.todayPartOfNames.some((n) => /gjenopprettet/i.test(n))) {
      continue;
    }

    const fromEntities = [
      {
        name: county.name,
        number: county.countyNumber,
        id: county.id,
      },
    ];

    const toNames = county.todayPartOfNames.filter(
      (n) => !/gjenopprettet/i.test(n),
    );
    if (toNames.length === 0 && county.changeType === "reestablished") {
      toNames.push(county.name);
    }
    if (toNames.length === 0) continue;

    const toEntities = toNames.map((name) => ({
      name,
      number:
        county.changeType === "reestablished" ? county.newCountyNumber : undefined,
      id: matchCountyName(matchCtx, name, {
        historicalId: county.id,
        historicalName: county.name,
        historicalNumber: county.countyNumber,
        preferNumber:
          county.changeType === "reestablished" ? county.newCountyNumber : undefined,
      }),
    }));

    changes.push({
      id: makeChangeId("county", county.name, county.validTo, changeIndex++),
      entityType: "county",
      changeYear: county.validTo,
      changeType: county.changeType,
      from: fromEntities,
      to: toEntities,
      notes: county.todayPartOfNames.join(", "),
      sourceUrl: county.sourceUrl,
    });
  }

  return changes;
}

function resolveResultIds(
  municipalities: HistoricalMunicipality[],
  matchCtx: ReturnType<typeof createMatchContext>,
): void {
  for (const mun of municipalities) {
    mun.resultIds = mun.resultNames
      .map((name) =>
        matchMunicipalityName(matchCtx, name, {
          historicalId: mun.id,
          historicalName: mun.name,
          historicalNumber: mun.municipalityNumber,
          countyNameAtSource: mun.countyNameAtSource,
        }),
      )
      .filter((id): id is string => id !== undefined && id !== mun.id);
  }

  for (const county of [] as HistoricalCounty[]) {
    void county;
  }
}

function resolveCountyPartOfIds(
  counties: HistoricalCounty[],
  matchCtx: ReturnType<typeof createMatchContext>,
): void {
  for (const county of counties) {
    county.todayPartOfIds = county.todayPartOfNames
      .filter((n) => !/gjenopprettet/i.test(n))
      .map((name) =>
        matchCountyName(matchCtx, name, {
          historicalId: county.id,
          historicalName: county.name,
          historicalNumber: county.countyNumber,
          preferNumber:
            county.changeType === "reestablished" ? county.newCountyNumber : undefined,
        }),
      )
      .filter((id): id is string => id !== undefined);
  }
}

async function main(): Promise<void> {
  console.log("Fetching Wikipedia pages…");
  const [munHtml, countyHtml] = await Promise.all([
    fetchWikipediaHtml("Liste_over_tidligere_norske_kommuner"),
    fetchWikipediaHtml("Norges_fylker"),
  ]);

  console.log("Parsing municipalities…");
  const rawMunicipalities = parseMunicipalityPage(munHtml);
  console.log(`  Found ${rawMunicipalities.length} historical municipalities`);

  console.log("Parsing counties…");
  const rawHistoricalCounties = parseHistoricalCountiesPage(countyHtml);
  markIntermediateCounties(rawHistoricalCounties);
  console.log(`  Found ${rawHistoricalCounties.length} historical/intermediate counties`);

  const rawCurrentCountiesWiki = parseCurrentCountiesPage(countyHtml);
  console.log(`  Found ${rawCurrentCountiesWiki.length} current counties (Wikipedia 2024–)`);

  const rawCounties = rawHistoricalCounties;

  const currentMunicipalities = JSON.parse(
    await readFile(resolve(CURRENT_DATA, "municipalities.json"), "utf-8"),
  ) as Array<{ id: string; name: string; countyId: string }>;
  const currentCounties = JSON.parse(
    await readFile(resolve(CURRENT_DATA, "counties.json"), "utf-8"),
  ) as Array<{ id: string; name: string }>;

  const matchCtx = createMatchContext(currentMunicipalities, currentCounties);

  for (const mun of rawMunicipalities) {
    registerHistoricalMunicipality(
      matchCtx,
      mun.id,
      mun.name,
      mun.municipalityNumber,
    );
  }
  for (const county of rawCounties) {
    registerHistoricalCounty(matchCtx, county.id, county.name, county.countyNumber);
  }

  resolveResultIds(rawMunicipalities, matchCtx);
  resolveCountyPartOfIds(rawCounties, matchCtx);

  const baseChanges = buildAdministrativeChanges(
    rawMunicipalities,
    rawCounties,
    matchCtx,
  );
  const filteredChanges = filterSkippedReestablishmentChanges(baseChanges);
  const inferredChanges = inferCountyReformChanges(
    rawCounties,
    filteredChanges,
    filteredChanges.length,
  );
  const changes = normalizeSplitChangeTypes([
    ...filteredChanges,
    ...inferredChanges,
  ]);

  console.log("Downloading heraldry…");
  const heraldryTargets: HeraldryTarget[] = [];

  // Counties first — avoids Commons rate limits after large municipality batches.
  for (const county of rawCounties) {
    const coatSource = (county as HistoricalCounty & { _coatSource?: string })
      ._coatSource;
    if (coatSource) {
      heraldryTargets.push({
        entityType: "county",
        name: county.name,
        number: county.countyNumber,
        sourceUrl: coatSource,
      });
    }
  }
  for (const county of rawCurrentCountiesWiki) {
    const coatSource = (county as WikiCurrentCounty & { _coatSource?: string })
      ._coatSource;
    if (coatSource) {
      heraldryTargets.push({
        entityType: "county",
        name: county.name,
        number: county.countyNumber,
        sourceUrl: coatSource,
      });
    }
  }

  for (const mun of rawMunicipalities) {
    const coatSource = (mun as HistoricalMunicipality & { _coatSource?: string })
      ._coatSource;
    if (coatSource) {
      heraldryTargets.push({
        entityType: "municipality",
        name: mun.name,
        number: mun.municipalityNumber,
        sourceUrl: coatSource,
      });
    }
  }

  const { coats, manifest } = await downloadHeraldryBatch(
    heraldryTargets,
    PUBLIC_ASSETS,
    { delayMs: 50 },
  );

  const municipalities: HistoricalMunicipality[] = rawMunicipalities.map((mun) => {
    const coatSource = (mun as HistoricalMunicipality & { _coatSource?: string })
      ._coatSource;
    const coatKey = `municipality:${mun.municipalityNumber ?? ""}:${mun.name}`;
    const coatOfArms = coatSource ? coats.get(coatKey) : undefined;
    const { _coatSource: _, ...rest } = mun as HistoricalMunicipality & {
      _coatSource?: string;
    };
    return { ...rest, coatOfArms };
  });

  const counties: HistoricalCounty[] = rawCounties.map((county) => {
    const coatSource = (county as HistoricalCounty & { _coatSource?: string })
      ._coatSource;
    const coatKey = `county:${county.countyNumber ?? ""}:${county.name}`;
    const coatOfArms = coatSource ? coats.get(coatKey) : undefined;
    const { _coatSource: _, ...rest } = county as HistoricalCounty & {
      _coatSource?: string;
    };
    return { ...rest, coatOfArms };
  });

  const currentCountiesWiki: WikiCurrentCounty[] = rawCurrentCountiesWiki.map(
    (county) => {
      const coatSource = (county as WikiCurrentCounty & { _coatSource?: string })
        ._coatSource;
      const coatKey = `county:${county.countyNumber}:${county.name}`;
      const coatOfArms = coatSource ? coats.get(coatKey) : undefined;
      const { _coatSource: _, ...rest } = county as WikiCurrentCounty & {
        _coatSource?: string;
      };
      return { ...rest, coatOfArms };
    },
  );

  const unresolvedMatches = matchCtx.unresolved;

  await mkdir(DATA_DIR, { recursive: true });

  await writeFile(
    resolve(DATA_DIR, "municipalities.json"),
    JSON.stringify(municipalities, null, 2) + "\n",
  );
  await writeFile(
    resolve(DATA_DIR, "counties.json"),
    JSON.stringify(counties, null, 2) + "\n",
  );
  await writeFile(
    resolve(DATA_DIR, "current-counties.json"),
    JSON.stringify(currentCountiesWiki, null, 2) + "\n",
  );
  await writeFile(
    resolve(DATA_DIR, "administrative-changes.json"),
    JSON.stringify(changes, null, 2) + "\n",
  );
  await writeFile(
    resolve(DATA_DIR, "unresolved-matches.json"),
    JSON.stringify(unresolvedMatches, null, 2) + "\n",
  );
  await writeFile(
    resolve(DATA_DIR, "heraldry-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log("\nDone!");
  console.log(`  Municipalities: ${municipalities.length}`);
  console.log(`  Counties (historical): ${counties.length}`);
  console.log(`  Counties (current wiki): ${currentCountiesWiki.length}`);
  console.log(`  Administrative changes: ${changes.length}`);
  console.log(`  Unresolved matches: ${unresolvedMatches.length}`);
  console.log(`  Heraldry assets: ${manifest.length}`);
  console.log(`  Output: ${DATA_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
