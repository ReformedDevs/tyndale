import { EventEmitter } from "node:events";

import { Events, PermissionFlagsBits, type Client } from "discord.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerseLookup } from "../citations/bible/lookup.js";
import { PoetryLayoutLookup } from "../citations/bible/poetry-layout.js";
import type { Config } from "../config.js";
import { GuildDevotionalStore } from "../preferences/guild-devotionals.js";
import {
  resetDevotionalSchedulerForTests,
  runDevotionalCatchUpForGuild,
  startDevotionalScheduler,
  type DevotionalSchedulerDeps,
} from "./scheduler.js";
import type { SpurgeonDevotionalLookup } from "./spurgeon-lookup.js";
import { getZonedParts } from "./time.js";

function createSchedulerDeps(
  store: GuildDevotionalStore,
  spurgeon: SpurgeonDevotionalLookup,
): DevotionalSchedulerDeps {
  return {
    store,
    spurgeon,
    lookup: VerseLookup.fromIndexes({
      web: {
        "josh.5.12": "They did eat of the fruit of the land of Canaan that year.",
      },
      asv: {},
      ylt: {},
      kjv: {},
      geneva: {},
      tyndale: {},
      wyc: {},
    }),
    poetryLayout: PoetryLayoutLookup.fromIndex({}),
    config: {
      DEFAULT_TRANSLATION: "web",
      DEFAULT_TEXT_FORMAT: "literary",
      DISCORD_BOT_TOKEN: "test-token",
      LOG_LEVEL: "info",
    } as Config,
    guildTranslations: { get: vi.fn() } as unknown as DevotionalSchedulerDeps["guildTranslations"],
    guildFormats: { get: vi.fn() } as unknown as DevotionalSchedulerDeps["guildFormats"],
  };
}

function threadPermissions() {
  return {
    has: (permission: string | bigint) =>
      permission === PermissionFlagsBits.SendMessages ||
      permission === "SendMessages" ||
      permission === PermissionFlagsBits.CreatePublicThreads ||
      permission === PermissionFlagsBits.SendMessagesInThreads,
  };
}

describe("startDevotionalScheduler", () => {
  afterEach(() => {
    resetDevotionalSchedulerForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts immediately when the client is already ready", async () => {
    vi.useFakeTimers();

    const emitter = new EventEmitter();
    const client = Object.assign(emitter, {
      isReady: () => true,
      user: { id: "bot-id" },
      channels: { fetch: vi.fn() },
    }) as unknown as Client;

    const store = await GuildDevotionalStore.load(
      "/tmp/tyndale-missing-guild-devotionals.json",
    );
    const spurgeon = {
      get: vi.fn(),
    } as unknown as SpurgeonDevotionalLookup;

    startDevotionalScheduler(
      client,
      createSchedulerDeps(store, spurgeon),
    );

    await vi.runOnlyPendingTimersAsync();

    expect(client.listenerCount(Events.ClientReady)).toBe(0);
  });

  it("waits for ClientReady when the client is not ready yet", () => {
    const emitter = new EventEmitter();
    const client = Object.assign(emitter, {
      isReady: () => false,
      user: { id: "bot-id" },
      channels: { fetch: vi.fn() },
    }) as unknown as Client;

    const store = {
      entries: () => [],
      reload: vi.fn().mockResolvedValue(undefined),
    } as unknown as GuildDevotionalStore;
    const spurgeon = {
      get: vi.fn(),
    } as unknown as SpurgeonDevotionalLookup;

    startDevotionalScheduler(
      client,
      createSchedulerDeps(store, spurgeon),
    );

    expect(client.listenerCount(Events.ClientReady)).toBe(1);

    emitter.emit(Events.ClientReady, client);

    expect(client.listenerCount(Events.ClientReady)).toBe(0);
  });
});

describe("runDevotionalCatchUpForGuild", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts missed morning readings and threads the verse reference", async () => {
    const threadSend = vi.fn().mockResolvedValue(undefined);
    const startThread = vi.fn().mockResolvedValue({ send: threadSend });
    const channel = {
      isTextBased: () => true,
      guild: { id: "guild-1" },
      permissionsFor: threadPermissions,
      send: vi.fn().mockResolvedValue({
        startThread,
        guild: { id: "guild-1" },
        channel: {
          permissionsFor: threadPermissions,
        },
      }),
    };

    const client = {
      user: { id: "bot-id" },
      channels: {
        fetch: vi.fn().mockResolvedValue(channel),
      },
    } as unknown as Client;

    const markSent = vi.fn().mockResolvedValue(undefined);
    const store = {
      get: vi.fn(() => ({
        channelId: "channel-1",
        timezone: "UTC",
        morning: { hour: 6, minute: 30 },
        evening: { hour: 18, minute: 0 },
      })),
      markSent,
      reload: vi.fn().mockResolvedValue(undefined),
    } as unknown as GuildDevotionalStore;

    const spurgeon = {
      get: vi.fn(() => ({
        title: "January 1 -- Morning",
        reference: "Joshua 5:12",
        paragraphs: ["Sample devotional body."],
      })),
    } as unknown as SpurgeonDevotionalLookup;

    vi.setSystemTime(new Date("2026-07-30T10:00:00.000Z"));

    const local = getZonedParts(new Date(), "UTC");
    expect(local.hour).toBeGreaterThanOrEqual(10);

    await runDevotionalCatchUpForGuild(
      client,
      createSchedulerDeps(store, spurgeon),
      "guild-1",
    );

    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(startThread).toHaveBeenCalledTimes(1);
    expect(threadSend).toHaveBeenCalledTimes(1);
    expect(markSent).toHaveBeenCalledWith("guild-1", "morning", "2026-07-30");
  });

  it("does not post before the scheduled time", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const client = {
      user: { id: "bot-id" },
      channels: {
        fetch: vi.fn(),
      },
    } as unknown as Client;

    const store = {
      get: vi.fn(() => ({
        channelId: "channel-1",
        timezone: "UTC",
        morning: { hour: 23, minute: 59 },
        evening: { hour: 23, minute: 59 },
      })),
      markSent: vi.fn(),
      reload: vi.fn().mockResolvedValue(undefined),
    } as unknown as GuildDevotionalStore;

    vi.setSystemTime(new Date("2026-07-30T10:00:00.000Z"));

    await runDevotionalCatchUpForGuild(
      client,
      createSchedulerDeps(store, { get: vi.fn() } as unknown as SpurgeonDevotionalLookup),
      "guild-1",
    );

    expect(send).not.toHaveBeenCalled();
    expect(client.channels.fetch).not.toHaveBeenCalled();
  });
});
