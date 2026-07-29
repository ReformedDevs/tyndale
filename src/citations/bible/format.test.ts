import { describe, expect, it } from "vitest";

import {
  formatReferenceLabel,
  splitDiscordMessages,
} from "./format.js";

describe("formatReferenceLabel", () => {
  it("formats a single verse", () => {
    expect(formatReferenceLabel("Genesis", 1, [1])).toBe("Genesis 1:1");
  });

  it("formats a contiguous range", () => {
    expect(formatReferenceLabel("Genesis", 1, [1, 2, 3])).toBe(
      "Genesis 1:1-3",
    );
  });

  it("formats non-contiguous verses", () => {
    expect(formatReferenceLabel("Genesis", 1, [1, 3, 5])).toBe(
      "Genesis 1:1,3,5",
    );
  });
});

describe("splitDiscordMessages", () => {
  it("returns a single chunk when under the limit", () => {
    expect(splitDiscordMessages("hello")).toEqual(["hello"]);
  });

  it("splits long content on newlines when possible", () => {
    const line = "x".repeat(1000);
    const content = `${line}\n${line}`;
    const chunks = splitDiscordMessages(content, 1500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
  });
});
