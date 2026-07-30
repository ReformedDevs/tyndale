import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GuildTranslationStore } from "./guild-translations.js";

describe("GuildTranslationStore", () => {
  let tempDir = "";
  let filePath = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-guild-prefs-"));
    filePath = path.join(tempDir, "guild-translations.json");
  });

  afterEach(async () => {
    tempDir = "";
    filePath = "";
  });

  it("loads an empty store when the file is missing", async () => {
    const store = await GuildTranslationStore.load(filePath);

    expect(store.get("guild-1")).toBeUndefined();
  });

  it("persists and reloads guild preferences", async () => {
    const store = await GuildTranslationStore.load(filePath);

    await store.set("guild-1", "asv", "user-1");

    const reloaded = await GuildTranslationStore.load(filePath);

    expect(reloaded.get("guild-1")).toBe("asv");
    expect(reloaded.getPreference("guild-1")).toMatchObject({
      translation: "asv",
      setBy: "user-1",
    });
  });

  it("clears a guild preference", async () => {
    const store = await GuildTranslationStore.load(filePath);

    await store.set("guild-1", "ylt", "user-1");
    await store.clear("guild-1");

    expect(store.get("guild-1")).toBeUndefined();
  });
});
