/**
 * Aurii Studio API client.
 *
 * Studio is a pure client of the Aurii Runtime.
 * It talks to the public HTTP API and nothing else.
 */

import { emptyStudioOpsConfig, type StudioOpsConfig } from "./ops-format";

export function getApiUrl(): string {
  return localStorage.getItem("aurii.apiUrl") ?? "http://localhost:3000";
}

export function getToken(): string | null {
  return localStorage.getItem("aurii.token");
}

export function setConnection(apiUrl: string, token: string | null): void {
  localStorage.setItem("aurii.apiUrl", apiUrl);
  if (token) localStorage.setItem("aurii.token", token);
  else localStorage.removeItem("aurii.token");
}

export function getDataset(): string {
  return localStorage.getItem("aurii.dataset") ?? "default";
}

export function setDataset(id: string): void {
  localStorage.setItem("aurii.dataset", id);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: headers({
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    }),
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data;
}

export type StudioHealth = {
  status: string;
  storage: string;
  scheduler?: { enabled: boolean };
  platformStore?: { mode: "memory" | "sqlite" | "postgres" };
};

export async function checkHealth(): Promise<StudioHealth | null> {
  try {
    const res = await fetch(`${getApiUrl()}/health`);
    return (await res.json()) as StudioHealth;
  } catch {
    return null;
  }
}

export function readStudioOpsConfig(): StudioOpsConfig {
  const el = document.getElementById("studio-ops-config");
  if (!el?.textContent) return emptyStudioOpsConfig();
  try {
    return JSON.parse(el.textContent) as StudioOpsConfig;
  } catch {
    return emptyStudioOpsConfig();
  }
}
