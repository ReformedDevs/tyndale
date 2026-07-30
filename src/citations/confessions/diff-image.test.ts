import { describe, expect, it } from "vitest";

import {
  buildSideRuns,
  textsAreIdentical,
  tokenizeForWrap,
} from "./diff-image.js";

function reconstruct(
  runs: Array<{ text: string; highlight: boolean; kind: string }>,
): string {
  return runs.map((run) => run.text).join("");
}

function highlightedByKind(
  runs: Array<{ text: string; highlight: boolean; kind: string }>,
  kind: string,
): string {
  return runs
    .filter((run) => run.highlight && run.kind === kind)
    .map((run) => run.text)
    .join("");
}

describe("textsAreIdentical", () => {
  it("requires exact equality", () => {
    expect(textsAreIdentical("abc", "abc")).toBe(true);
    expect(textsAreIdentical("abc", "abd")).toBe(false);
  });
});

describe("tokenizeForWrap", () => {
  it("preserves leading whitespace", () => {
    expect(tokenizeForWrap(" all life").join("")).toBe(" all life");
  });
});

describe("buildSideRuns", () => {
  it("reconstructs the full original text on each side", () => {
    const left = "The cat sat on the mat";
    const right = "The dog sat on the mat";
    const { left: leftRuns, right: rightRuns } = buildSideRuns(left, right);

    expect(reconstruct(leftRuns)).toBe(left);
    expect(reconstruct(rightRuns)).toBe(right);
    expect(highlightedByKind(leftRuns, "remove")).toBe("cat");
    expect(highlightedByKind(rightRuns, "add")).toBe("dog");
  });

  it("preserves spaces when only one side has added punctuation", () => {
    const left = "for the better preserving and propagating of the truth";
    const right = "for the better preserving, and propagating of the Truth";
    const { left: leftRuns } = buildSideRuns(left, right);

    expect(reconstruct(leftRuns)).toBe(left);
    expect(reconstruct(leftRuns)).toContain("preserving and propagating");
  });

  it("highlights changed words independently on each side", () => {
    const left = "and of his will";
    const right = "and His will";
    const { left: leftRuns, right: rightRuns } = buildSideRuns(left, right);

    expect(reconstruct(leftRuns)).toBe(left);
    expect(reconstruct(rightRuns)).toBe(right);
    expect(highlightedByKind(leftRuns, "remove")).toBe("of his");
    expect(highlightedByKind(rightRuns, "add")).toBe("His");
  });
});
