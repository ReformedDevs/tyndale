import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";

import {
  confessionSyncFingerprint,
  entrySyncFingerprint,
  loadContentRegistry,
  remoteContentFingerprint,
  translationSyncFingerprint,
  type ContentRegistry,
} from "../registry.js";
import {
  contentPaths,
  resolveContentDir,
  resolveRegistryDir,
  type ContentPaths,
} from "../../paths.js";
import { loadSyncState, saveSyncState, fingerprintsEqual, type SyncState } from "./state.js";
import type { SyncFingerprint } from "../registry.js";
import { syncConfession } from "./confessions.js";
import { syncDevotional } from "./devotionals.js";
import { syncPerson } from "./people.js";
import { syncTranslation } from "./translations.js";
import { migrateLegacyContent } from "../migrate.js";
import { fetchRemoteText } from "./remote.js";

export interface SyncContentOptions {
  contentDir?: string;
  registryDir?: string;
  full?: boolean;
  prune?: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function translationOutputsExist(
  entryId: string,
  paths: ContentPaths,
): Promise<boolean> {
  return (
    (await fileExists(path.join(paths.bibles, `${entryId}.json`))) &&
    (await fileExists(path.join(paths.poetry, `${entryId}.json`)))
  );
}

async function bootstrapSyncState(
  registry: ContentRegistry,
  paths: ContentPaths,
  state: SyncState,
): Promise<void> {
  for (const entry of registry.translations) {
    if (
      !state.translations[entry.id] &&
      (await translationOutputsExist(entry.id, paths))
    ) {
      markSynced(
        state,
        "translations",
        entry.id,
        translationSyncFingerprint(entry),
      );
    }
  }

  for (const entry of registry.people) {
    const rawPath = path.join(paths.peopleRaw, `${entry.id}.json`);
    const fingerprint = entrySyncFingerprint(entry.source);
    if (!state.people[entry.id] && (await fileExists(rawPath))) {
      markSynced(state, "people", entry.id, fingerprint);
    }
  }
}

async function shouldSyncTranslation(
  entry: ContentRegistry["translations"][number],
  state: SyncState,
  paths: ContentPaths,
  full: boolean,
): Promise<boolean> {
  if (full) {
    return true;
  }

  const fingerprint = translationSyncFingerprint(entry);
  const previous = state.translations[entry.id];
  if (!previous || !fingerprintsEqual(previous.fingerprint, fingerprint)) {
    return true;
  }

  return !(await translationOutputsExist(entry.id, paths));
}

async function shouldSyncEntry(
  category: keyof SyncState,
  entryId: string,
  fingerprint: SyncFingerprint,
  outputPath: string,
  state: SyncState,
  full: boolean,
): Promise<boolean> {
  if (full) {
    return true;
  }

  const previous = state[category][entryId];
  if (!previous || !fingerprintsEqual(previous.fingerprint, fingerprint)) {
    return true;
  }

  return !(await fileExists(outputPath));
}

function markSynced(
  state: SyncState,
  category: keyof SyncState,
  entryId: string,
  fingerprint: SyncFingerprint,
): void {
  state[category][entryId] = {
    fingerprint,
    syncedAt: new Date().toISOString(),
  };
}

async function pruneCategory(
  state: SyncState,
  category: keyof SyncState,
  validIds: Set<string>,
  removeOutput: (id: string) => Promise<void>,
): Promise<void> {
  for (const id of Object.keys(state[category])) {
    if (validIds.has(id)) {
      continue;
    }

    delete state[category][id];
    await removeOutput(id);
    console.info(`Pruned ${category}/${id}`);
  }
}

export async function syncContent(
  options: SyncContentOptions = {},
): Promise<void> {
  const contentDir = options.contentDir ?? resolveContentDir();
  const registryDir = options.registryDir ?? resolveRegistryDir();
  const paths = contentPaths(contentDir);
  const full = options.full ?? false;

  console.info(`Content directory: ${contentDir}`);

  await mkdir(contentDir, { recursive: true });
  await mkdir(paths.bibles, { recursive: true });
  await mkdir(paths.poetry, { recursive: true });
  await mkdir(paths.confessions, { recursive: true });
  await mkdir(paths.devotionals, { recursive: true });
  await mkdir(path.dirname(paths.people), { recursive: true });
  await mkdir(paths.peopleRaw, { recursive: true });

  await migrateLegacyContent(contentDir);

  const registry = await loadContentRegistry(registryDir);
  const state = await loadSyncState(paths.syncState);
  await bootstrapSyncState(registry, paths, state);
  await saveSyncState(paths.syncState, state);

  for (const entry of registry.translations) {
    if (
      !(await shouldSyncTranslation(entry, state, paths, full))
    ) {
      console.info(`Skipping translation ${entry.id} (up to date)`);
      continue;
    }

    await syncTranslation(entry, paths);
    markSynced(
      state,
      "translations",
      entry.id,
      translationSyncFingerprint(entry),
    );
    await saveSyncState(paths.syncState, state);
  }

  for (const entry of registry.confessions) {
    const outputPath = path.join(paths.confessions, `${entry.id}.json`);
    const fetched = await fetchRemoteText(entry.source);
    const fingerprint = confessionSyncFingerprint(entry, fetched.contentHash);
    if (
      !(await shouldSyncEntry(
        "confessions",
        entry.id,
        fingerprint,
        outputPath,
        state,
        full,
      ))
    ) {
      console.info(`Skipping confession ${entry.id} (up to date)`);
      continue;
    }

    await syncConfession(entry, paths, fetched);
    markSynced(state, "confessions", entry.id, fingerprint);
    await saveSyncState(paths.syncState, state);
  }

  for (const entry of registry.devotionals) {
    const outputPath = path.join(paths.devotionals, `${entry.id}.json`);
    const fetched = await fetchRemoteText(entry.source);
    const fingerprint = remoteContentFingerprint(entry.source, fetched.contentHash);
    if (
      !(await shouldSyncEntry(
        "devotionals",
        entry.id,
        fingerprint,
        outputPath,
        state,
        full,
      ))
    ) {
      console.info(`Skipping devotional ${entry.id} (up to date)`);
      continue;
    }

    await syncDevotional(entry, paths, fetched);
    markSynced(state, "devotionals", entry.id, fingerprint);
    await saveSyncState(paths.syncState, state);
  }

  for (const entry of registry.people) {
    const fingerprint = entrySyncFingerprint(entry.source);
    const rawPath = path.join(paths.peopleRaw, `${entry.id}.json`);
    if (
      !(await shouldSyncEntry(
        "people",
        entry.id,
        fingerprint,
        rawPath,
        state,
        full,
      ))
    ) {
      console.info(`Skipping person ${entry.id} (up to date)`);
      continue;
    }

    await syncPerson(entry, paths);
    markSynced(state, "people", entry.id, fingerprint);
    await saveSyncState(paths.syncState, state);
  }

  if (options.prune) {
    await pruneCategory(
      state,
      "translations",
      new Set(registry.translations.map((entry) => entry.id)),
      async (id) => {
        await unlink(path.join(paths.bibles, `${id}.json`)).catch(() => undefined);
        await unlink(path.join(paths.poetry, `${id}.json`)).catch(() => undefined);
      },
    );
    await pruneCategory(
      state,
      "confessions",
      new Set(registry.confessions.map((entry) => entry.id)),
      async (id) => {
        await unlink(path.join(paths.confessions, `${id}.json`)).catch(() => undefined);
      },
    );
    await pruneCategory(
      state,
      "devotionals",
      new Set(registry.devotionals.map((entry) => entry.id)),
      async (id) => {
        await unlink(path.join(paths.devotionals, `${id}.json`)).catch(() => undefined);
      },
    );
    await pruneCategory(
      state,
      "people",
      new Set(registry.people.map((entry) => entry.id)),
      async (id) => {
        await unlink(path.join(paths.peopleRaw, `${id}.json`)).catch(() => undefined);
      },
    );
    await saveSyncState(paths.syncState, state);
  }

  console.info("Content sync complete.");
}
