const USER_AGENT =
  "AuriiHistoricalGeoBot/1.0 (https://github.com/aprestmo/aurii; research)";

const WIKI_API = "https://no.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function wikipediaTitleFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match) return undefined;
  return decodeURIComponent(match[1]!);
}

async function fetchJson<T>(url: string, retries = 5): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (response.ok) {
      return (await response.json()) as T;
    }
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
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  throw new Error(`Request failed after retries: ${url}`);
}

async function fetchWikibaseIdsByTitles(
  titles: string[],
): Promise<Map<string, string>> {
  const titleToQid = new Map<string, string>();

  for (const batch of chunk(titles, 20)) {
    const params = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "pageprops",
      ppprop: "wikibase_item",
      format: "json",
    });

    const data = await fetchJson<{
      query?: {
        pages?: Record<
          string,
          { title?: string; pageprops?: { wikibase_item?: string } }
        >;
      };
    }>(`${WIKI_API}?${params}`);

    for (const page of Object.values(data.query?.pages ?? {})) {
      const qid = page.pageprops?.wikibase_item;
      if (page.title && qid) {
        titleToQid.set(page.title, qid);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return titleToQid;
}

async function fetchOfficialWebsitesByQid(
  qids: string[],
): Promise<Map<string, string>> {
  const qidToWebsite = new Map<string, string>();
  const uniqueQids = [...new Set(qids)];

  for (const batch of chunk(uniqueQids, 50)) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "claims",
      format: "json",
    });

    const data = await fetchJson<{
      entities?: Record<
        string,
        {
          missing?: string;
          claims?: {
            P856?: Array<{
              mainsnak?: { datavalue?: { value?: string } };
            }>;
          };
        }
      >;
    }>(`${WIKIDATA_API}?${params}`);

    for (const [qid, entity] of Object.entries(data.entities ?? {})) {
      if (entity.missing !== undefined) continue;
      const website = entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
      if (website) {
        qidToWebsite.set(qid, website);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return qidToWebsite;
}

export async function fetchOfficialWebsitesByWikipediaUrls(
  wikipediaUrls: string[],
): Promise<Map<string, string>> {
  const titleByUrl = new Map<string, string>();
  for (const url of wikipediaUrls) {
    const title = wikipediaTitleFromUrl(url);
    if (title) titleByUrl.set(url, title);
  }

  const titles = [...new Set(titleByUrl.values())];
  if (titles.length === 0) return new Map();

  const titleToQid = await fetchWikibaseIdsByTitles(titles);
  const qidToWebsite = await fetchOfficialWebsitesByQid([...titleToQid.values()]);

  const websiteByUrl = new Map<string, string>();
  for (const [url, title] of titleByUrl) {
    const qid = titleToQid.get(title);
    const website = qid ? qidToWebsite.get(qid) : undefined;
    if (website) websiteByUrl.set(url, website);
  }

  return websiteByUrl;
}
