import { readFile, writeFile } from "node:fs/promises";

export interface SyncEntryState {
  fingerprint: string;
  syncedAt: string;
}

export interface SyncState {
  translations: Record<string, SyncEntryState>;
  people: Record<string, SyncEntryState>;
  confessions: Record<string, SyncEntryState>;
  devotionals: Record<string, SyncEntryState>;
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
      translations: parsed.translations ?? {},
      people: parsed.people ?? {},
      confessions: parsed.confessions ?? {},
      devotionals: parsed.devotionals ?? {},
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
