import { copyFile, mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

import { contentPaths, repoRoot } from "../paths.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function dirHasJsonFiles(dir: string): Promise<boolean> {
  try {
    const files = await readdir(dir);
    return files.some((fileName) => fileName.endsWith(".json"));
  } catch {
    return false;
  }
}

export async function migrateLegacyContent(contentDir: string): Promise<void> {
  const legacyDir = path.join(repoRoot, "data");
  const paths = contentPaths(contentDir);

  if (!(await fileExists(legacyDir))) {
    return;
  }

  if (await dirHasJsonFiles(paths.bibles)) {
    return;
  }

  console.info("Migrating built content from data/ to content/…");
  await mkdir(paths.bibles, { recursive: true });
  await mkdir(paths.poetry, { recursive: true });
  await mkdir(paths.confessions, { recursive: true });
  await mkdir(paths.devotionals, { recursive: true });
  await mkdir(path.dirname(paths.people), { recursive: true });
  await mkdir(paths.peopleRaw, { recursive: true });

  const legacyFiles = await readdir(legacyDir);
  const translationIds = new Set([
    "web",
    "asv",
    "ylt",
    "kjv",
    "geneva",
    "tyndale",
    "wyc",
  ]);

  for (const fileName of legacyFiles) {
    if (!fileName.endsWith(".json")) {
      continue;
    }

    const id = fileName.slice(0, -".json".length);
    const legacyPath = path.join(legacyDir, fileName);

    if (translationIds.has(id)) {
      await copyFile(legacyPath, path.join(paths.bibles, fileName));
      continue;
    }

    if (id.startsWith("poetry-")) {
      const translationId = id.slice("poetry-".length);
      await copyFile(
        legacyPath,
        path.join(paths.poetry, `${translationId}.json`),
      );
      continue;
    }

    if (id === "wcf" || id === "lbcf") {
      await copyFile(legacyPath, path.join(paths.confessions, fileName));
      continue;
    }

    if (id === "spurgeon-morn-eve") {
      await copyFile(legacyPath, path.join(paths.devotionals, fileName));
      continue;
    }

    if (id === "church-people") {
      await copyFile(legacyPath, paths.people);
    }
  }

  const rawCachePath = path.join(legacyDir, "church-people-raw.json");
  if (await fileExists(rawCachePath)) {
    const parsed = JSON.parse(await readFile(rawCachePath, "utf8")) as {
      people: Array<{ id: string; intro?: string; text?: string; imageUrl?: string }>;
    };

    for (const entry of parsed.people) {
      await writeFile(
        path.join(paths.peopleRaw, `${entry.id}.json`),
        `${JSON.stringify({
          id: entry.id,
          intro: entry.intro ?? entry.text ?? "",
          ...(entry.imageUrl ? { imageUrl: entry.imageUrl } : {}),
        }, null, 2)}\n`,
        "utf8",
      );
    }
  }

  console.info("Legacy content migration complete.");
}
