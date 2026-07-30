import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UserTranslationStore } from "./user-translations.js";

describe("UserTranslationStore", () => {
  let tempDir = "";
  let filePath = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-prefs-"));
    filePath = path.join(tempDir, "user-translations.json");
  });

  afterEach(async () => {
    tempDir = "";
    filePath = "";
  });

  it("loads an empty store when the file is missing", async () => {
    const store = await UserTranslationStore.load(filePath);

    expect(store.get("user-1")).toBeUndefined();
    expect(store.resolve("user-1", "web")).toBe("web");
  });

  it("persists and reloads user preferences", async () => {
    const store = await UserTranslationStore.load(filePath);

    await store.set("user-1", "asv", "guild-1");
    await store.set("user-2", "ylt");

    const reloaded = await UserTranslationStore.load(filePath);

    expect(reloaded.get("user-1")).toBe("asv");
    expect(reloaded.resolve("user-2", "web")).toBe("ylt");
    expect(reloaded.countForGuild("guild-1")).toBe(1);
  });

  it("clears a user preference", async () => {
    const store = await UserTranslationStore.load(filePath);

    await store.set("user-1", "ylt");
    await store.clear("user-1");

    expect(store.get("user-1")).toBeUndefined();

    const raw = await readFile(filePath, "utf8");
    expect(raw).toBe("{}\n");
  });

  it("ignores invalid entries when loading", async () => {
    const store = await UserTranslationStore.load(filePath);

    await store.set("user-1", "web");

    const invalid = JSON.stringify({
      "user-1": "web",
      "user-2": "kjv",
      "user-3": 123,
    });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, invalid, "utf8");

    const reloaded = await UserTranslationStore.load(filePath);

    expect(reloaded.get("user-1")).toBe("web");
    expect(reloaded.get("user-2")).toBeUndefined();
    expect(reloaded.get("user-3")).toBeUndefined();
  });
});
