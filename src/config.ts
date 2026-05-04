import { sql } from "./db/client.js";

async function loadSettings(): Promise<Record<string, string>> {
  try {
    const rows = await sql<{ key: string; value: string }[]>`SELECT key, value FROM settings`;
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

let cached: Record<string, string> | null = null;

export async function getConfig(): Promise<Record<string, string>> {
  if (cached) return cached;
  cached = await loadSettings();
  return cached;
}

export async function reloadConfig(): Promise<void> {
  cached = await loadSettings();
}
