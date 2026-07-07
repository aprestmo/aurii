/**
 * Lightweight HTML parsing helpers for Wikipedia wikitables.
 */

const WIKI_BASE = "https://no.wikipedia.org";

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function extractLinkTexts(html: string): string[] {
  const names: string[] = [];
  const linkRegex = /<a[^>]+title="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const title = decodeHtmlEntities(match[1]!);
    const text = decodeHtmlEntities(match[2]!);
    const name = text.trim() || title;
    if (
      !name.startsWith("Fil:") &&
      !name.startsWith("Category:") &&
      !names.includes(name)
    ) {
      names.push(name);
    }
  }
  return names;
}

export function extractWikipediaUrl(html: string): string | undefined {
  const match = html.match(/<a[^>]+href="(\/wiki\/[^"#]+)"[^>]*>/i);
  if (!match) return undefined;
  return `${WIKI_BASE}${match[1]}`;
}

export function extractCoatOfArmsSource(html: string): string | undefined {
  if (/Blank_shield/i.test(html)) return undefined;

  const fileLink = html.match(
    /href="(?:\/wiki\/|https:\/\/commons\.wikimedia\.org\/wiki\/)(Fil:[^"]+\.(?:svg|png|jpe?g))"/i,
  );
  if (fileLink) {
    return `https://commons.wikimedia.org/wiki/${fileLink[1]}`;
  }

  // Wikipedia viser ofte våpen som miniatyr: .../thumb/HASH/FILENAME.svg/NNpx-...
  const thumbMatch = html.match(
    /\/commons\/thumb\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+\.(?:svg|png|jpe?g))\//i,
  );
  if (thumbMatch) {
    const filename = decodeURIComponent(thumbMatch[1]!);
    return `https://commons.wikimedia.org/wiki/File:${filename}`;
  }

  // Direkte SVG-lenke uten /thumb/
  const directSvg = html.match(
    /\/commons\/([a-f0-9]\/[a-f0-9]{2}\/[^"'\s]+\.svg)/i,
  );
  if (directSvg) {
    const filename = decodeURIComponent(directSvg[1]!.split("/").pop()!);
    return `https://commons.wikimedia.org/wiki/File:${filename}`;
  }

  return undefined;
}

export function parseYear(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "–" || trimmed === "-") return undefined;
  const year = Number.parseInt(trimmed, 10);
  return Number.isFinite(year) && year >= 1000 && year <= 2100 ? year : undefined;
}

export function parseChangeTypeFromNotes(notes: string): {
  changeType: import("./types").ChangeType;
  relatedNames: string[];
} {
  const normalized = notes.trim();

  const mergedMatch = normalized.match(/^Slått sammen med (.+)$/i);
  if (mergedMatch) {
    return {
      changeType: "merged",
      relatedNames: splitEntityList(mergedMatch[1]!),
    };
  }

  const incorporatedMatch = normalized.match(/^Innlemmet i (.+)$/i);
  if (incorporatedMatch) {
    return {
      changeType: "incorporated",
      relatedNames: splitEntityList(incorporatedMatch[1]!),
    };
  }

  const splitBetweenMatch = normalized.match(/^Delt mellom (.+)$/i);
  if (splitBetweenMatch) {
    return {
      changeType: "split_between",
      relatedNames: splitEntityList(splitBetweenMatch[1]!),
    };
  }

  const splitMatch = normalized.match(/^Delt i (?:to |tre |fire )?(.+)$/i);
  if (splitMatch) {
    return {
      changeType: "split",
      relatedNames: splitEntityList(splitMatch[1]!),
    };
  }

  if (/gjenopprettet/i.test(normalized)) {
    return { changeType: "reestablished", relatedNames: [] };
  }

  if (/navneendring|omdøpt/i.test(normalized)) {
    return { changeType: "renamed", relatedNames: [] };
  }

  return { changeType: "unknown", relatedNames: [] };
}

function splitEntityList(text: string): string[] {
  return text
    .split(/\s+og\s+|,\s*/i)
    .map((part) => part.replace(/\s*\(.*\)\s*/g, "").trim())
    .filter(Boolean);
}

export function parseCountyChangeType(
  todayPartOf: string,
  todayPartOfNames: string[],
): import("./types").ChangeType {
  if (/gjenopprettet/i.test(todayPartOf)) return "reestablished";
  if (todayPartOfNames.length > 1) return "merged";
  if (todayPartOfNames.length === 1) return "merged";
  return "unknown";
}

export interface WikitableRow {
  cells: string[];
}

export function extractTableRows(tableHtml: string): WikitableRow[] {
  const rows: WikitableRow[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1]!;
    if (/<th[\s>]/i.test(rowHtml)) continue;

    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]!);
    }
    if (cells.length > 0) rows.push({ cells });
  }
  return rows;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeMunicipalityId(number: string, name: string): string {
  return `hist-mun-${number}-${slugify(name)}`;
}

export function makeCountyId(number: string, name: string): string {
  return `hist-county-${number}-${slugify(name)}`;
}

export function makeChangeId(
  entityType: string,
  fromName: string,
  year: number | undefined,
  index: number,
): string {
  return `change-${entityType}-${slugify(fromName)}-${year ?? "unknown"}-${index}`;
}
