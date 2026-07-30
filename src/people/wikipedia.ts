export const WIKIPEDIA_SOURCE_LABEL = "Wikipedia (CC BY-SA 4.0)";
export const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
export const WIKIPEDIA_USER_AGENT =
  "TyndaleBot/0.1 (Discord church history bot; +https://github.com/TheReformedDevs/tyndale)";
export const WIKIPEDIA_THUMBNAIL_SIZE = 400;

const MAX_SUMMARY_LENGTH = 480;

export interface PersonSummary {
  dates?: string;
  summary: string;
}

export interface WikipediaPageData {
  intro: string;
  imageUrl?: string;
}

function normalizeDash(value: string): string {
  return value.replace(/[—–-]/g, "–");
}

export function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

function simplifyLeadParenthetical(text: string): string {
  return text.replace(
    /\(\s*;[^)]+\)\s*(?=\s*(?:was|is|were)\b)/i,
    (match) => {
      const rangeMatch = match.match(
        /((?:AD\s*)?(?:[c]?\.\s*)?\d{1,4}\s*[–—-]\s*(?:AD\s*)?(?:[c]?\.\s*)?(?:(?:\d{1,2}\s+\w+|\w+)\s+)?\d{1,4})/i,
      );
      if (rangeMatch?.[1]) {
        return `(${normalizeDash(rangeMatch[1].trim())}) `;
      }

      const singleMatch = match.match(
        /((?:AD\s*)?(?:[c]?\.\s*)?(?:\d{1,2}\s+\w+\s+)?\d{3,4})/i,
      );
      if (singleMatch?.[1]) {
        return `(${normalizeDash(singleMatch[1].trim())}) `;
      }

      return match;
    },
  );
}

function extractDateRangeFromClause(clause: string): string | undefined {
  const trimmed = clause.trim();
  if (/^(?:;|Middle French|French|Greek|Latin|Czech|Ancient Greek|romanized)/i.test(trimmed)) {
    const rangeOnly = trimmed.match(
      /((?:AD\s*)?(?:[c]?\.\s*)?(?:\d{1,2}\s+\w+\s+)?\d{1,4}[?]?(?:\s*[–—-]\s*(?:[c]?\.\s*)?(?:(?:\d{1,2}\s+\w+|\w+)\s+)?(?:\d{1,4}[?]?|[A-Z][a-z]+\s+\d{1,4}))?)/i,
    );
    if (rangeOnly?.[1]) {
      return normalizeDash(rangeOnly[1].replace(/\s+/g, " ").trim());
    }
  }

  const rangeMatch = trimmed.match(
    /((?:AD\s*)?(?:[c]?\.\s*)?(?:\d{1,2}\s+\w+\s+)?\d{1,4}[?]?(?:\s*[–—-]\s*(?:[c]?\.\s*)?(?:(?:\d{1,2}\s+\w+|\w+)\s+)?(?:\d{1,4}[?]?|[A-Z][a-z]+\s+\d{1,4}))?)/i,
  );
  if (rangeMatch?.[1]) {
    return normalizeDash(rangeMatch[1].replace(/\s+/g, " ").trim());
  }

  const birthMatch = trimmed.match(/\b(?:born|b\.)\s*([^;)]+)/i);
  if (birthMatch?.[1] && /\d{3,4}/.test(birthMatch[1])) {
    return normalizeDash(birthMatch[1].trim());
  }

  const deathMatch = trimmed.match(/\b(?:died|d\.)\s*([^;)]+)/i);
  if (deathMatch?.[1] && /\d{3,4}/.test(deathMatch[1])) {
    return `d. ${normalizeDash(deathMatch[1].trim())}`;
  }

  return undefined;
}

export function extractDatesFromIntro(intro: string): string | undefined {
  const head = intro.slice(0, 500);
  const wasIndex = head.search(/\b(?:was|is|were)\b/i);
  if (wasIndex < 0) {
    return undefined;
  }

  const beforeWas = head.slice(0, wasIndex);
  const parenMatches = [...beforeWas.matchAll(/\(([^)]*)\)/g)];

  for (let index = parenMatches.length - 1; index >= 0; index -= 1) {
    const clause = parenMatches[index]?.[1];
    if (!clause || !/\d{1,4}/.test(clause)) {
      continue;
    }

    const dates = extractDateRangeFromClause(clause);
    if (dates) {
      return dates;
    }
  }

  return undefined;
}

function truncateSummary(text: string, maxLength = MAX_SUMMARY_LENGTH): string {
  if (text.length <= maxLength) {
    return text.trim();
  }

  const slice = text.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );

  if (lastSentenceEnd > maxLength * 0.5) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  return `${lastSpace > 0 ? slice.slice(0, lastSpace) : slice}…`.trim();
}

export function cleanWikipediaExtract(text: string): string {
  return simplifyLeadParenthetical(
    text
      .replace(/\[(?:\d+[a-z]?(?:\s*,\s*\d+[a-z]?)*|[a-z])\]/gi, "")
      .replace(
        /\[(?:citation needed|better source needed|clarification needed|dubious[\s-]*discuss|note\s+\d+)\]/gi,
        "",
      )
      .replace(/\s*\((?:listen|help(?:·|-)info)\)/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim(),
  );
}

export function parseWikipediaIntro(rawIntro: string): PersonSummary {
  const dates = extractDatesFromIntro(rawIntro);
  const summary = truncateSummary(cleanWikipediaExtract(rawIntro));

  return { dates, summary };
}

export function validateSummaryQuality(
  summary: string,
  dates?: string,
): string[] {
  const problems: string[] = [];

  if (!summary || summary.length < 40) {
    problems.push("too_short");
  }

  if (summary.length > 520) {
    problems.push("too_long");
  }

  if (/\[\d+[a-z]?\]/i.test(summary)) {
    problems.push("citation_markers");
  }

  if (/may refer to:/i.test(summary)) {
    problems.push("disambiguation");
  }

  if (!dates) {
    problems.push("missing_dates");
  }

  if (!/[.!?]["'”]?\s*$/.test(summary.trim()) && !summary.trim().endsWith("…")) {
    problems.push("truncated");
  }

  return problems;
}

interface WikipediaApiPage {
  title?: string;
  missing?: boolean;
  extract?: string;
  thumbnail?: { source?: string };
}

export function parseWikipediaPagePayload(
  page: WikipediaApiPage | undefined,
  requestedTitle: string,
): WikipediaPageData {
  if (!page || page.missing) {
    throw new Error(`Wikipedia page not found: ${requestedTitle}`);
  }

  const intro = page.extract?.trim();
  if (!intro) {
    throw new Error(`Wikipedia page has no intro extract: ${requestedTitle}`);
  }

  const imageUrl = page.thumbnail?.source?.trim();

  return imageUrl ? { intro, imageUrl } : { intro };
}

export async function fetchWikipediaPage(title: string): Promise<WikipediaPageData> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts|pageimages",
    explaintext: "1",
    exintro: "1",
    exsentences: "2",
    piprop: "thumbnail",
    pithumbsize: String(WIKIPEDIA_THUMBNAIL_SIZE),
    redirects: "1",
    titles: title,
  });

  const response = await fetch(`${WIKIPEDIA_API}?${params}`, {
    headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia request failed for "${title}" (${response.status})`);
  }

  const payload = (await response.json()) as {
    query?: {
      pages?: Record<string, WikipediaApiPage>;
    };
  };

  const page = Object.values(payload.query?.pages ?? {})[0];
  return parseWikipediaPagePayload(page, title);
}
