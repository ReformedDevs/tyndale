import { describe, expect, it } from "vitest";

import {
  confessionSyncFingerprint,
  remoteContentFingerprint,
} from "../registry.js";
import {
  fingerprintsEqual,
  loadSyncState,
  saveSyncState,
} from "./state.js";
import { hashRemoteContent } from "./remote.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("hashRemoteContent", () => {
  it("returns a stable sha256 hex digest", () => {
    expect(hashRemoteContent('{"meta":{"id":"wcf"}}')).toBe(
      "fc1aca0753afa1688b00aa7a68f87535294044dcd10b07b10e3b7ec73ee0dfcf",
    );
  });

  it("changes when remote content changes", () => {
    expect(hashRemoteContent("v1")).not.toBe(hashRemoteContent("v2"));
  });
});

describe("content-hash fingerprints", () => {
  it("includes the remote content hash for confessions", () => {
    expect(
      confessionSyncFingerprint(
        {
          id: "wcf",
          name: "Westminster Confession of Faith",
          abbrev: "WCF",
          source: "https://example.com/wcf.json",
        },
        "abc123",
      ),
    ).toEqual({
      source: "https://example.com/wcf.json",
      format: "christian-standards-v1",
      contentHash: "abc123",
    });
  });

  it("includes the remote content hash for other URL sources", () => {
    expect(
      remoteContentFingerprint("https://example.com/devotional.json", "def456"),
    ).toEqual({
      source: "https://example.com/devotional.json",
      contentHash: "def456",
    });
  });
});

describe("sync state fingerprints", () => {
  it("compares structured fingerprints for equality", () => {
    const left = remoteContentFingerprint("https://example.com/a.json", "hash");
    const right = remoteContentFingerprint("https://example.com/a.json", "hash");
    expect(fingerprintsEqual(left, right)).toBe(true);
    expect(
      fingerprintsEqual(left, remoteContentFingerprint("https://example.com/a.json", "other")),
    ).toBe(false);
  });

  it("loads legacy string fingerprints and saves structured JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tyndale-sync-state-"));
    const filePath = path.join(dir, ".sync-state.json");

    try {
      await saveSyncState(filePath, {
        translations: {},
        people: {},
        confessions: {
          wcf: {
            fingerprint: {
              source: "https://example.com/wcf.json",
              format: "christian-standards-v1",
              contentHash: "abc123",
            },
            syncedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        devotionals: {},
      });

      const raw = await readFile(filePath, "utf8");
      expect(raw).toContain('"contentHash": "abc123"');
      expect(raw).not.toContain('"{\\"source\\"');

      const legacy = JSON.parse(raw) as {
        confessions: { wcf: { fingerprint: string; syncedAt: string } };
      };
      legacy.confessions.wcf.fingerprint = JSON.stringify(
        legacy.confessions.wcf.fingerprint,
      );
      await saveSyncState(filePath, legacy as never);

      const loaded = await loadSyncState(filePath);
      expect(loaded.confessions.wcf?.fingerprint).toEqual({
        source: "https://example.com/wcf.json",
        format: "christian-standards-v1",
        contentHash: "abc123",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
