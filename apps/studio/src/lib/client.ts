/**
 * Studio SDK client factory.
 *
 * Returns an AuriiClient configured from the Studio connection settings
 * stored in localStorage (set on the /login page).
 */

import { createClient, type AuriiClient } from "@aurii/sdk";
import { getApiUrl, getDataset, getToken } from "./api";

/**
 * Build an AuriiClient from the current Studio connection settings.
 * Should be called inside client-side scripts where localStorage is available.
 */
export function getClient(): AuriiClient {
	const token = getToken();
	return createClient({
		baseUrl: getApiUrl(),
		...(token ? { token } : {}),
		defaultDataset: getDataset(),
	});
}
