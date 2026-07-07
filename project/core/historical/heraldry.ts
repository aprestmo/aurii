import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CoatOfArms, HeraldryManifestEntry } from "./types";
import { slugify } from "./parse-html";

const USER_AGENT = "AuriiHistoricalGeoBot/1.0 (https://github.com/aprestmo/aurii; research)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

export interface HeraldryTarget {
  entityType: "municipality" | "county";
  name: string;
  number?: string;
  sourceUrl: string;
}

function heraldryFilename(target: HeraldryTarget, extension: string): string {
  const prefix = target.entityType === "municipality" ? "municipality" : "county";
  const numberPart = target.number ? `-${target.number}` : "";
  return `${prefix}${numberPart}-${slugify(target.name)}.${extension}`;
}

function localPathFor(target: HeraldryTarget, extension: string): string {
  const folder =
    target.entityType === "municipality" ? "municipalities" : "counties";
  return `/assets/heraldry/${folder}/${heraldryFilename(target, extension)}`;
}

function mimeForExtension(ext: string): CoatOfArms["mimeType"] {
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  return "image/jpeg";
}

async function fetchWithRetry(
  url: string,
  retries = 5,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response;
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      const retryAfter = Number.parseInt(
        response.headers.get("retry-after") ?? "",
        10,
      );
      const delayMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    return null;
  }
  return null;
}

async function resolveCommonsFileUrl(sourceUrl: string): Promise<{
  downloadUrl: string;
  extension: string;
  attribution?: string;
  license?: string;
} | null> {
  let fileTitle: string | undefined;

  const commonsWikiMatch = sourceUrl.match(
    /commons\.wikimedia\.org\/wiki\/((?:Fil|File):.+)/i,
  );
  if (commonsWikiMatch) {
    let title = decodeURIComponent(commonsWikiMatch[1]!);
    if (title.startsWith("Fil:")) {
      title = `File:${title.slice(4)}`;
    }
    fileTitle = title;
  }

  const thumbMatch = sourceUrl.match(
    /upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+\.(?:svg|png|jpe?g))\//i,
  );
  if (!fileTitle && thumbMatch) {
    fileTitle = `File:${decodeURIComponent(thumbMatch[1]!)}`;
  }

  const directMatch = sourceUrl.match(
    /upload\.wikimedia\.org\/wikipedia\/commons\/([a-f0-9]\/[a-f0-9]{2}\/[^"'\s]+\.(?:svg|png|jpe?g))/i,
  );
  if (!fileTitle && directMatch) {
    const filename = decodeURIComponent(directMatch[1]!.split("/").pop()!);
    fileTitle = `File:${filename}`;
  }

  if (!fileTitle) return null;

  const params = new URLSearchParams({
    action: "query",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    format: "json",
  });

  const response = await fetchWithRetry(`${COMMONS_API}?${params}`);
  if (!response) return null;

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          missing?: string;
          imageinfo?: Array<{
            url: string;
            mime?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };

  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;

  const info = page.imageinfo?.[0];
  if (!info?.url) return null;

  const ext = info.url.split(".").pop()?.toLowerCase() ?? "svg";
  const license = info.extmetadata?.LicenseShortName?.value;
  const attribution = info.extmetadata?.Artist?.value
    ?.replace(/<[^>]+>/g, "")
    .trim();

  return { downloadUrl: info.url, extension: ext, attribution, license };
}

async function downloadBinary(url: string): Promise<ArrayBuffer | null> {
  const response = await fetchWithRetry(url);
  if (!response) return null;
  return response.arrayBuffer();
}

export async function downloadHeraldry(
  target: HeraldryTarget,
  publicAssetsRoot: string,
): Promise<{ coatOfArms?: CoatOfArms; manifest?: HeraldryManifestEntry }> {
  for (const extension of ["svg", "png", "jpg", "jpeg"] as const) {
    const localPath = localPathFor(target, extension);
    const absolutePath = resolve(publicAssetsRoot, localPath.replace(/^\//, ""));
    if (!existsSync(absolutePath)) continue;

    const coatOfArms: CoatOfArms = {
      sourceUrl: target.sourceUrl,
      localPath,
      mimeType: mimeForExtension(extension),
    };
    const manifest: HeraldryManifestEntry = {
      entityType: target.entityType,
      name: target.name,
      number: target.number,
      sourceUrl: target.sourceUrl,
      localPath,
    };
    return { coatOfArms, manifest };
  }

  const resolved = await resolveCommonsFileUrl(target.sourceUrl);
  if (!resolved) return {};

  const { downloadUrl, extension, attribution, license } = resolved;
  const localPath = localPathFor(target, extension);
  const absolutePath = resolve(publicAssetsRoot, localPath.replace(/^\//, ""));

  const binary = await downloadBinary(downloadUrl);
  if (!binary) return {};

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(binary));

  const coatOfArms: CoatOfArms = {
    sourceUrl: target.sourceUrl,
    localPath,
    mimeType: mimeForExtension(extension),
    attribution,
    license,
  };

  const manifest: HeraldryManifestEntry = {
    entityType: target.entityType,
    name: target.name,
    number: target.number,
    sourceUrl: target.sourceUrl,
    localPath,
    license,
    attribution,
  };

  return { coatOfArms, manifest };
}

export async function downloadHeraldryBatch(
  targets: HeraldryTarget[],
  publicAssetsRoot: string,
  options?: { delayMs?: number },
): Promise<{ coats: Map<string, CoatOfArms>; manifest: HeraldryManifestEntry[] }> {
  const coats = new Map<string, CoatOfArms>();
  const manifest: HeraldryManifestEntry[] = [];
  const delayMs = options?.delayMs ?? 150;

  for (const target of targets) {
    const key = `${target.entityType}:${target.number ?? ""}:${target.name}`;
    if (coats.has(key)) continue;

    const result = await downloadHeraldry(target, publicAssetsRoot);
    if (result.coatOfArms) {
      coats.set(key, result.coatOfArms);
      // Del samme fil for samme nummer+navn på tvers av kilder
      coats.set(`${target.entityType}::${target.name}`, result.coatOfArms);
    }
    if (result.manifest) {
      manifest.push(result.manifest);
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { coats, manifest };
}
