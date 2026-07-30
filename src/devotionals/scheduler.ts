import {
  Events,
  type Client,
  type GuildTextBasedChannel,
} from "discord.js";

import type { GuildDevotionalStore } from "../preferences/guild-devotionals.js";
import type { GuildFormatStore } from "../preferences/guild-formats.js";
import type { GuildTranslationStore } from "../preferences/guild-translations.js";
import type { Config } from "../config.js";
import type { VerseLookup } from "../citations/bible/lookup.js";
import type { PoetryLayoutLookup } from "../citations/bible/poetry-layout.js";
import { postSpurgeonDevotional, type DevotionalPostDeps } from "./post.js";
import type { DevotionalPeriod, SpurgeonDevotionalLookup } from "./spurgeon-lookup.js";
import {
  getZonedDateKey,
  getZonedParts,
  isScheduledTimeReached,
} from "./time.js";

const TICK_INTERVAL_MS = 60_000;
let schedulerStarted = false;

/** @internal */
export function resetDevotionalSchedulerForTests(): void {
  schedulerStarted = false;
}

export interface DevotionalSchedulerDeps extends DevotionalPostDeps {
  store: GuildDevotionalStore;
  spurgeon: SpurgeonDevotionalLookup;
}

export function startDevotionalScheduler(
  client: Client,
  deps: DevotionalSchedulerDeps,
): void {
  const start = (): void => {
    if (schedulerStarted) {
      return;
    }

    schedulerStarted = true;

    const tick = (): void => {
      void runDevotionalTick(client, deps);
    };

    tick();

    const msUntilNextMinute = TICK_INTERVAL_MS - (Date.now() % TICK_INTERVAL_MS);
    setTimeout(() => {
      tick();
      setInterval(tick, TICK_INTERVAL_MS);
    }, msUntilNextMinute);
  };

  if (client.isReady()) {
    start();
    return;
  }

  client.once(Events.ClientReady, start);
}

async function runDevotionalTick(
  client: Client,
  deps: DevotionalSchedulerDeps,
): Promise<void> {
  await deps.store.reload();

  for (const [guildId] of deps.store.entries()) {
    await runDevotionalCatchUpForGuild(client, deps, guildId);
  }
}

export async function runDevotionalCatchUpForGuild(
  client: Client,
  deps: DevotionalSchedulerDeps,
  guildId: string,
): Promise<void> {
  const schedule = deps.store.get(guildId);
  if (!schedule) {
    return;
  }

  const now = new Date();
  const local = getZonedParts(now, schedule.timezone);
  const dateKey = getZonedDateKey(now, schedule.timezone);

  if (
    isScheduledTimeReached(schedule.morning, local) &&
    schedule.lastMorningSent !== dateKey
  ) {
    await sendDevotional(
      client,
      deps,
      guildId,
      schedule.channelId,
      "morning",
      local.month,
      local.day,
      dateKey,
    );
  }

  const refreshed = deps.store.get(guildId);
  if (!refreshed) {
    return;
  }

  if (
    isScheduledTimeReached(refreshed.evening, local) &&
    refreshed.lastEveningSent !== dateKey
  ) {
    await sendDevotional(
      client,
      deps,
      guildId,
      refreshed.channelId,
      "evening",
      local.month,
      local.day,
      dateKey,
    );
  }
}

async function sendDevotional(
  client: Client,
  deps: DevotionalSchedulerDeps,
  guildId: string,
  channelId: string,
  period: DevotionalPeriod,
  month: number,
  day: number,
  dateKey: string,
): Promise<void> {
  const entry = deps.spurgeon.get(month, day, period);
  if (!entry) {
    console.warn(
      `No Spurgeon ${period} devotional for ${month}/${day}; skipping guild ${guildId}`,
    );
    return;
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      console.warn(
        `Devotional channel ${channelId} unavailable in guild ${guildId}`,
      );
      return;
    }

    const sendable = channel as GuildTextBasedChannel;
    if (!sendable.guild || sendable.guild.id !== guildId) {
      return;
    }

    const posted = await postSpurgeonDevotional(
      client,
      sendable,
      guildId,
      entry,
      deps,
    );
    if (!posted) {
      return;
    }

    await deps.store.markSent(guildId, period, dateKey);
  } catch (error) {
    console.error(
      `Failed to post ${period} devotional in guild ${guildId}:`,
      error,
    );
  }
}
