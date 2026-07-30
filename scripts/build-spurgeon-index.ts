import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/OpenChristianData/open-christian-data/main/data/devotionals/spurgeons-morning-evening/morning-evening.json";

interface SourceEntry {
  month: number;
  day: number;
  period: "morning" | "evening";
  title: string;
  primary_reference?: {
    raw?: string;
  };
  content_blocks?: string[];
}

interface SourceFile {
  data: SourceEntry[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");
const outputPath = path.join(dataDir, "spurgeon-morn-eve.json");

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download Spurgeon devotional data (${response.status})`);
  }

  const source = (await response.json()) as SourceFile;
  const entries: Record<
    string,
    { title: string; reference: string; paragraphs: string[] }
  > = {};

  for (const entry of source.data) {
    const key = `${String(entry.month).padStart(2, "0")}-${String(entry.day).padStart(2, "0")}-${entry.period}`;
    const reference = entry.primary_reference?.raw?.trim() ?? "";
    const paragraphs = (entry.content_blocks ?? [])
      .map((block) => block.trim())
      .filter(Boolean);

    entries[key] = {
      title: entry.title,
      reference,
      paragraphs,
    };
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ entries }, null, 2)}\n`,
    "utf8",
  );

  console.info(`Wrote ${Object.keys(entries).length} Spurgeon entries to ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error("Failed to build Spurgeon devotional index:", error);
  process.exit(1);
});
