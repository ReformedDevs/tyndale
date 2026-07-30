import type {
  ParsedCitation,
  ParsedConfessionCitation,
  ParsedConfessionDiffCitation,
} from "../types.js";
import {
  formatConfessionCodes,
  normalizeConfession,
  type Confession,
  type ConfessionLookup,
} from "./lookup.js";

const CONFESSION_PREFIX_PATTERN = /^(wcf|lbcf)\s+(.+)$/i;
const CONFESSION_DIFF_PATTERN = /^(wcf|lbcf)\s+vs\.?\s+(wcf|lbcf)\s+(.+)$/i;

function errorCitation(raw: string, message: string): ParsedCitation {
  return { kind: "error", raw, message };
}

function parseLocationFields(locationPart: string):
  | {
      locations: ParsedConfessionCitation["locations"];
      wholeChapter?: number;
      chapterEndFrom?: ParsedConfessionCitation["chapterEndFrom"];
      range?: ParsedConfessionCitation["range"];
    }
  | { error: string } {
  const normalized = locationPart.trim();

  const wholeChapterMatch = /^(\d+)$/.exec(normalized);
  if (wholeChapterMatch) {
    const chapter = Number.parseInt(wholeChapterMatch[1] ?? "", 10);
    if (Number.isNaN(chapter)) {
      return { error: "Invalid chapter number." };
    }

    return { locations: [], wholeChapter: chapter };
  }

  const chapterEndMatch = /^(\d+)\.(?:(\d+)-)?end$/i.exec(normalized);
  if (chapterEndMatch) {
    const chapter = Number.parseInt(chapterEndMatch[1] ?? "", 10);
    const paragraph = chapterEndMatch[2]
      ? Number.parseInt(chapterEndMatch[2] ?? "", 10)
      : 1;

    if (Number.isNaN(chapter) || Number.isNaN(paragraph)) {
      return { error: "Invalid chapter end reference." };
    }

    return {
      locations: [],
      chapterEndFrom: { chapter, paragraph },
    };
  }

  const singleMatch = /^(\d+)\.(\d+)$/.exec(normalized);
  if (singleMatch) {
    const chapter = Number.parseInt(singleMatch[1] ?? "", 10);
    const paragraph = Number.parseInt(singleMatch[2] ?? "", 10);
    if (Number.isNaN(chapter) || Number.isNaN(paragraph)) {
      return { error: "Invalid paragraph reference." };
    }

    return { locations: [{ chapter, paragraph }] };
  }

  const rangeMatch = /^(\d+)\.(\d+)-(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (rangeMatch) {
    const startChapter = Number.parseInt(rangeMatch[1] ?? "", 10);
    const startParagraph = Number.parseInt(rangeMatch[2] ?? "", 10);
    const endChapter = rangeMatch[4]
      ? Number.parseInt(rangeMatch[3] ?? "", 10)
      : startChapter;
    const endParagraph = Number.parseInt(
      (rangeMatch[4] ? rangeMatch[4] : rangeMatch[3]) ?? "",
      10,
    );

    if (
      Number.isNaN(startChapter) ||
      Number.isNaN(startParagraph) ||
      Number.isNaN(endChapter) ||
      Number.isNaN(endParagraph)
    ) {
      return { error: "Invalid paragraph range." };
    }

    return {
      locations: [],
      range: {
        startChapter,
        startParagraph,
        endChapter,
        endParagraph,
      },
    };
  }

  return { error: "Invalid citation format." };
}

function parseLocationPart(
  raw: string,
  confession: Confession,
  locationPart: string,
): ParsedCitation {
  const parsed = parseLocationFields(locationPart);
  if ("error" in parsed) {
    return errorCitation(
      raw,
      `${parsed.error} Use ${confession.toUpperCase()} 1, ${confession.toUpperCase()} 1.1, or ${confession.toUpperCase()} 1.1-3.`,
    );
  }

  return {
    kind: "confession",
    raw,
    confession,
    locations: parsed.locations,
    wholeChapter: parsed.wholeChapter,
    chapterEndFrom: parsed.chapterEndFrom,
    range: parsed.range,
  };
}

export function parseConfessionDiffBracket(
  raw: string,
  content: string,
): ParsedCitation | undefined {
  const match = CONFESSION_DIFF_PATTERN.exec(content.trim());
  if (!match) {
    return undefined;
  }

  const left = normalizeConfession(match[1] ?? "");
  const right = normalizeConfession(match[2] ?? "");
  if (!left || !right) {
    return errorCitation(
      raw,
      `Unknown confession in ${raw}. Use WCF and LBCF only.`,
    );
  }

  if (left === right) {
    return errorCitation(
      raw,
      `Compare WCF and LBCF, not ${left.toUpperCase()} and ${right.toUpperCase()}.`,
    );
  }

  const parsed = parseLocationFields(match[3] ?? "");
  if ("error" in parsed) {
    return errorCitation(
      raw,
      `${parsed.error} Use WCF vs LBCF 1.1, WCF vs LBCF 1, or WCF vs LBCF 1.1-3.`,
    );
  }

  const diffCitation: ParsedConfessionDiffCitation = {
    kind: "confessionDiff",
    raw,
    left,
    right,
    locations: parsed.locations,
    wholeChapter: parsed.wholeChapter,
    chapterEndFrom: parsed.chapterEndFrom,
    range: parsed.range,
  };

  return diffCitation;
}

export function parseConfessionBracket(
  raw: string,
  content: string,
): ParsedCitation | undefined {
  const prefixMatch = CONFESSION_PREFIX_PATTERN.exec(content.trim());
  if (!prefixMatch) {
    return undefined;
  }

  const confession = normalizeConfession(prefixMatch[1] ?? "");
  if (!confession) {
    return errorCitation(
      raw,
      `Unknown confession "${prefixMatch[1]}". Use ${formatConfessionCodes()}.`,
    );
  }

  return parseLocationPart(raw, confession, prefixMatch[2] ?? "");
}

export function resolveConfessionLocations(
  citation: ParsedConfessionCitation,
  lookup: ConfessionLookup,
): ParsedConfessionCitation | { error: string } {
  const abbrev = lookup.getDocument(citation.confession).abbrev;

  if (citation.wholeChapter !== undefined) {
    const chapter = citation.wholeChapter;
    const endParagraph = lookup.getParagraphCount(citation.confession, chapter);
    if (endParagraph === 0) {
      return {
        error: `Chapter ${chapter} is not in ${abbrev}.`,
      };
    }

    const expanded = lookup.expandRange(
      citation.confession,
      chapter,
      1,
      chapter,
      endParagraph,
    );

    if ("error" in expanded) {
      return expanded;
    }

    return {
      ...citation,
      locations: expanded,
      range: undefined,
    };
  }

  if (citation.chapterEndFrom) {
    const { chapter, paragraph } = citation.chapterEndFrom;
    const endParagraph = lookup.getParagraphCount(citation.confession, chapter);
    if (endParagraph === 0) {
      return {
        error: `Chapter ${chapter} is not in ${abbrev}.`,
      };
    }

    if (paragraph > endParagraph) {
      return {
        error: `Paragraph ${paragraph} is beyond chapter ${chapter} in ${abbrev}.`,
      };
    }

    const expanded = lookup.expandRange(
      citation.confession,
      chapter,
      paragraph,
      chapter,
      endParagraph,
    );

    if ("error" in expanded) {
      return expanded;
    }

    return {
      ...citation,
      locations: expanded,
      range: undefined,
    };
  }

  if (citation.locations.length === 1 && !citation.range) {
    const location = citation.locations[0]!;
    const expanded = lookup.expandRange(
      citation.confession,
      location.chapter,
      location.paragraph,
      location.chapter,
      location.paragraph,
    );

    if ("error" in expanded) {
      return expanded;
    }

    return citation;
  }

  if (citation.locations.length > 0) {
    return citation;
  }

  if (!citation.range) {
    return { error: `No paragraphs specified in ${citation.raw}` };
  }

  const expanded = lookup.expandRange(
    citation.confession,
    citation.range.startChapter,
    citation.range.startParagraph,
    citation.range.endChapter,
    citation.range.endParagraph,
  );

  if ("error" in expanded) {
    return expanded;
  }

  return {
    ...citation,
    locations: expanded,
    range: undefined,
  };
}
