/** Base URL prefix for GitHub Pages (`/aurii/`) or `/` locally. */
export const base = import.meta.env.BASE_URL;

export function url(path: string): string {
	const normalized = path.startsWith("/") ? path.slice(1) : path;
	return `${base}${normalized}`;
}
