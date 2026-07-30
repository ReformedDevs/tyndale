import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GuildDevotionalStore } from "./guild-devotionals.js";

describe("GuildDevotionalStore", () => {
  let tempDir = "";
  let filePath = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-guild-devotionals-"));
    filePath = path.join(tempDir, "guild-devotionals.json");
  });

  afterEach(async () => {
    tempDir = "";
    filePath = "";
  });

  it("loads an empty store when the file is missing", async () => {
    const store = await GuildDevotionalStore.load(filePath);

    expect(store.get("guild-1")).toBeUndefined();
  });

  it("persists and reloads schedules", async () => {
    const store = await GuildDevotionalStore.load(filePath);

    await store.set("guild-1", {
      channelId: "channel-1",
      timezone: "America/Chicago",
      morning: { hour: 6, minute: 30 },
      evening: { hour: 18, minute: 0 },
      setBy: "user-1",
    });

    const reloaded = await GuildDevotionalStore.load(filePath);

    expect(reloaded.get("guild-1")).toMatchObject({
      channelId: "channel-1",
      timezone: "America/Chicago",
      morning: { hour: 6, minute: 30 },
      evening: { hour: 18, minute: 0 },
      setBy: "user-1",
    });
  });

  it("tracks last sent dates without clearing the schedule", async () => {
    const store = await GuildDevotionalStore.load(filePath);

    await store.set("guild-1", {
      channelId: "channel-1",
      timezone: "America/Chicago",
      morning: { hour: 6, minute: 30 },
      evening: { hour: 18, minute: 0 },
      setBy: "user-1",
    });
    await store.markSent("guild-1", "morning", "2026-07-30");

    const reloaded = await GuildDevotionalStore.load(filePath);

    expect(reloaded.get("guild-1")?.lastMorningSent).toBe("2026-07-30");
    expect(reloaded.get("guild-1")?.lastEveningSent).toBeUndefined();
  });

  it("clears a schedule", async () => {
    const store = await GuildDevotionalStore.load(filePath);

    await store.set("guild-1", {
      channelId: "channel-1",
      timezone: "America/Chicago",
      morning: { hour: 6, minute: 30 },
      evening: { hour: 18, minute: 0 },
      setBy: "user-1",
    });
    await store.clear("guild-1");

    expect(store.get("guild-1")).toBeUndefined();
  });

  it("reload picks up manual file edits", async () => {
    const store = await GuildDevotionalStore.load(filePath);

    await store.set("guild-1", {
      channelId: "channel-1",
      timezone: "America/Chicago",
      morning: { hour: 6, minute: 30 },
      evening: { hour: 18, minute: 0 },
      setBy: "user-1",
    });
    await store.markSent("guild-1", "morning", "2026-07-30");

    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          "guild-1": {
            channelId: "channel-1",
            timezone: "America/Chicago",
            morning: { hour: 6, minute: 30 },
            evening: { hour: 18, minute: 0 },
            setAt: "2026-07-30T15:31:39.498Z",
            setBy: "user-1",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await store.reload();

    expect(store.get("guild-1")?.lastMorningSent).toBeUndefined();
  });
});
