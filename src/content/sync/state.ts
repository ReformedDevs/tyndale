import { readFile, writeFile } from "node:fs/promises";

import type { SyncFingerprint } from "../registry.js";

export interface SyncEntryState {
  fingerprint: SyncFingerprint;
  syncedAt: string;
}

export interface SyncState {
  translations: Record<string, SyncEntryState>;
  people: Record<string, SyncEntryState>;
  confessions: Record<string, SyncEntryState>;
  devotionals: Record<string, SyncEntryState>;
}

export function fingerprintsEqual(
  left: SyncFingerprint,
  right: SyncFingerprint,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeFingerprint(value: unknown): SyncFingerprint | undefined {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as SyncFingerprint;
    } catch {
      return undefined;
    }
  }

  if (typeof value === "object" && value !== null) {
    return value as SyncFingerprint;
  }

  return undefined;
}

function normalizeEntry(value: unknown): SyncEntryState | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as { fingerprint?: unknown; syncedAt?: unknown };
  const fingerprint = normalizeFingerprint(record.fingerprint);

  if (!fingerprint || typeof record.syncedAt !== "string") {
    return undefined;
  }

  return {
    fingerprint,
    syncedAt: record.syncedAt,
  };
}

function normalizeCategory(
  value: unknown,
): Record<string, SyncEntryState> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const normalized: Record<string, SyncEntryState> = {};

  for (const [entryId, entry] of Object.entries(value)) {
    const parsed = normalizeEntry(entry);
    if (parsed) {
      normalized[entryId] = parsed;
    }
  }

  return normalized;
}

export function emptySyncState(): SyncState {
  return {
    translations: {},
    people: {},
    confessions: {},
    devotionals: {},
  };
}

export async function loadSyncState(filePath: string): Promise<SyncState> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SyncState>;
    return {
      translations: normalizeCategory(parsed.translations),
      people: normalizeCategory(parsed.people),
      confessions: normalizeCategory(parsed.confessions),
      devotionals: normalizeCategory(parsed.devotionals),
    };
  } catch {
    return emptySyncState();
  }
}

export async function saveSyncState(
  filePath: string,
  state: SyncState,
): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
