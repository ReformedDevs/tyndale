import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import * as Diff from "diff";

const IMAGE_WIDTH = 1100;
const COLUMN_GAP = 24;
const PADDING = 28;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 36;
const FONT_SIZE = 15;
const LINE_HEIGHT = 22;
const COLUMN_WIDTH = (IMAGE_WIDTH - PADDING * 2 - COLUMN_GAP) / 2;

const COLORS = {
  background: "#faf8f2",
  header: "#b59b3c",
  headerText: "#ffffff",
  bodyText: "#1f1f1f",
  footerText: "#666666",
  columnLabel: "#3d3d3d",
  highlightRemoveFill: "#fde2e2",
  highlightRemoveText: "#991b1b",
  highlightAddFill: "#dcfce7",
  highlightAddText: "#166534",
  border: "#e5dcc8",
};

interface TextRun {
  text: string;
  highlight: boolean;
  kind: "remove" | "add" | "same";
}

interface LayoutLine {
  runs: TextRun[];
}

interface HighlightRange {
  start: number;
  end: number;
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  if (ranges.length === 0) {
    return [];
  }

  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: HighlightRange[] = [{ ...sorted[0]! }];

  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const last = merged.at(-1)!;

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function buildHighlightRanges(
  leftText: string,
  rightText: string,
): { left: HighlightRange[]; right: HighlightRange[] } {
  const changes = Diff.diffWords(leftText, rightText);
  let leftIndex = 0;
  let rightIndex = 0;
  const left: HighlightRange[] = [];
  const right: HighlightRange[] = [];

  for (const change of changes) {
    if (change.removed) {
      left.push({ start: leftIndex, end: leftIndex + change.value.length });
      leftIndex += change.value.length;
      continue;
    }

    if (change.added) {
      right.push({ start: rightIndex, end: rightIndex + change.value.length });
      rightIndex += change.value.length;
      continue;
    }

    leftIndex += change.value.length;
    rightIndex += change.value.length;
  }

  return { left: mergeRanges(left), right: mergeRanges(right) };
}

function rangesToRuns(
  text: string,
  ranges: HighlightRange[],
  kind: "remove" | "add",
): TextRun[] {
  const runs: TextRun[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (cursor < range.start) {
      runs.push({
        text: text.slice(cursor, range.start),
        highlight: false,
        kind: "same",
      });
    }

    runs.push({
      text: text.slice(range.start, range.end),
      highlight: true,
      kind,
    });
    cursor = range.end;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), highlight: false, kind: "same" });
  }

  return runs;
}

export function buildSideRuns(
  leftText: string,
  rightText: string,
): { left: TextRun[]; right: TextRun[] } {
  const { left, right } = buildHighlightRanges(leftText, rightText);

  return {
    left: rangesToRuns(leftText, left, "remove"),
    right: rangesToRuns(rightText, right, "add"),
  };
}

export function tokenizeForWrap(text: string): string[] {
  if (text.length === 0) {
    return [];
  }

  const tokens: string[] = [];
  const pattern = /\S+\s*|\s+/g;
  let match: RegExpExecArray | null = pattern.exec(text);

  while (match !== null) {
    tokens.push(match[0]);
    match = pattern.exec(text);
  }

  return tokens;
}

function wrapRuns(
  ctx: SKRSContext2D,
  runs: TextRun[],
  maxWidth: number,
): LayoutLine[] {
  ctx.font = `${FONT_SIZE}px sans-serif`;
  const lines: LayoutLine[] = [];
  let currentLine: LayoutLine = { runs: [] };
  let currentWidth = 0;

  const pushLine = (): void => {
    if (currentLine.runs.length > 0) {
      lines.push(currentLine);
    }
    currentLine = { runs: [] };
    currentWidth = 0;
  };

  for (const run of runs) {
    for (const token of tokenizeForWrap(run.text)) {
      const tokenWidth = ctx.measureText(token).width;
      if (currentWidth + tokenWidth > maxWidth && currentLine.runs.length > 0) {
        pushLine();
      }

      const lastRun = currentLine.runs.at(-1);
      if (
        lastRun &&
        lastRun.highlight === run.highlight &&
        lastRun.kind === run.kind
      ) {
        lastRun.text += token;
      } else {
        currentLine.runs.push({
          text: token,
          highlight: run.highlight,
          kind: run.kind,
        });
      }

      currentWidth += tokenWidth;
    }
  }

  pushLine();
  return lines;
}

function drawLines(
  ctx: SKRSContext2D,
  lines: LayoutLine[],
  x: number,
  y: number,
): number {
  ctx.font = `${FONT_SIZE}px sans-serif`;

  for (const line of lines) {
    let cursorX = x;

    for (const run of line.runs) {
      const width = ctx.measureText(run.text).width;
      if (run.highlight) {
        const fill =
          run.kind === "remove"
            ? COLORS.highlightRemoveFill
            : COLORS.highlightAddFill;
        ctx.fillStyle = fill;
        ctx.fillRect(cursorX - 1, y - FONT_SIZE, width + 2, LINE_HEIGHT);
      }

      ctx.fillStyle = run.highlight
        ? run.kind === "remove"
          ? COLORS.highlightRemoveText
          : COLORS.highlightAddText
        : COLORS.bodyText;
      ctx.fillText(run.text, cursorX, y);
      cursorX += width;
    }

    y += LINE_HEIGHT;
  }

  return y;
}

function estimateHeight(leftLines: LayoutLine[], rightLines: LayoutLine[]): number {
  const bodyLines = Math.max(leftLines.length, rightLines.length);
  return HEADER_HEIGHT + 40 + bodyLines * LINE_HEIGHT + FOOTER_HEIGHT + PADDING;
}

export interface ConfessionDiffImageOptions {
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftText: string;
  rightText: string;
  footer?: string;
}

export async function renderConfessionDiffPng(
  options: ConfessionDiffImageOptions,
): Promise<Buffer> {
  const probe = createCanvas(IMAGE_WIDTH, 100);
  const probeCtx = probe.getContext("2d");
  const { left, right } = buildSideRuns(options.leftText, options.rightText);
  const leftLines = wrapRuns(probeCtx, left, COLUMN_WIDTH);
  const rightLines = wrapRuns(probeCtx, right, COLUMN_WIDTH);
  const height = estimateHeight(leftLines, rightLines);

  const canvas = createCanvas(IMAGE_WIDTH, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, IMAGE_WIDTH, height);

  ctx.fillStyle = COLORS.header;
  ctx.fillRect(0, 0, IMAGE_WIDTH, HEADER_HEIGHT);
  ctx.fillStyle = COLORS.headerText;
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(options.title, PADDING, 35);

  const leftX = PADDING;
  const rightX = PADDING + COLUMN_WIDTH + COLUMN_GAP;
  let y = HEADER_HEIGHT + 24;

  ctx.fillStyle = COLORS.columnLabel;
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(options.leftLabel, leftX, y);
  ctx.fillText(options.rightLabel, rightX, y);
  y += 18;

  ctx.strokeStyle = COLORS.border;
  ctx.beginPath();
  ctx.moveTo(leftX + COLUMN_WIDTH + COLUMN_GAP / 2, y - 8);
  ctx.lineTo(leftX + COLUMN_WIDTH + COLUMN_GAP / 2, height - FOOTER_HEIGHT);
  ctx.stroke();

  const bodyY = y + FONT_SIZE;
  const leftBottom = drawLines(ctx, leftLines, leftX, bodyY);
  const rightBottom = drawLines(ctx, rightLines, rightX, bodyY);

  ctx.fillStyle = COLORS.footerText;
  ctx.font = "12px sans-serif";
  ctx.fillText(
    "Red = changed in left   ·   Green = changed in right",
    leftX,
    Math.max(leftBottom, rightBottom) + 12,
  );

  if (options.footer) {
    ctx.fillText(options.footer, leftX, height - 14);
  }

  return canvas.toBuffer("image/png");
}

export function textsAreIdentical(left: string, right: string): boolean {
  return left === right;
}
