import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GuildAnalyticsStore } from "./guild-analytics.js";

describe("GuildAnalyticsStore", () => {
  let tempDir = "";
  let filePath = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-guild-analytics-"));
    filePath = path.join(tempDir, "guild-analytics.json");
  });

  afterEach(async () => {
    tempDir = "";
    filePath = "";
  });

  it("records citation totals and top books", async () => {
    const store = await GuildAnalyticsStore.load(filePath);

    await store.recordCitations("guild-1", [
      {
        kind: "bible",
        raw: "[Gen 1:1]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1],
      },
      {
        kind: "bible",
        raw: "[Gen 1:2]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [2],
      },
      {
        kind: "bible",
        raw: "[John 3:16]",
        book: "john",
        bookName: "John",
        chapter: 3,
        verses: [16],
      },
    ]);

    const summary = store.getSummary("guild-1");

    expect(summary.citationsTotal).toBe(3);
    expect(summary.citationsThisWeek).toBe(3);
    expect(summary.topBooks).toEqual([
      { bookName: "Genesis", count: 2 },
      { bookName: "John", count: 1 },
    ]);
  });
});
