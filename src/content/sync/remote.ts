import { createHash } from "node:crypto";

export interface RemoteFetchResult {
  body: string;
  contentHash: string;
}

export function hashRemoteContent(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function fetchRemoteText(url: string): Promise<RemoteFetchResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const body = await response.text();
  return {
    body,
    contentHash: hashRemoteContent(body),
  };
}
