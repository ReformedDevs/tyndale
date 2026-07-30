export interface TimeOfDay {
  hour: number;
  minute: number;
}

const TIME_PATTERN =
  /^(?<hours>0?[1-9]|1[0-2]|00|1[3-9]|2[0-3])\s*:\s*(?<minutes>[0-5][0-9])\s*(?<ampm>[ap]m)?$/i;

export function parseTimeOfDay(input: string): TimeOfDay | undefined {
  const match = input.trim().match(TIME_PATTERN);
  if (!match?.groups) {
    return undefined;
  }

  const { hours, minutes, ampm: ampmRaw } = match.groups;
  if (!hours || !minutes) {
    return undefined;
  }

  let hour = Number.parseInt(hours, 10);
  const minute = Number.parseInt(minutes, 10);
  const ampm = ampmRaw?.toLowerCase();

  if (ampm) {
    if (ampm === "am" && hour === 12) {
      hour = 0;
    } else if (ampm === "pm" && hour < 12) {
      hour += 12;
    }
  } else if (hour >= 13) {
    // 24-hour style already handled by regex allowing 13-23
  } else if (hour === 12 && !ampm) {
    // Bare 12:00 without am/pm is noon.
  }

  if (hour > 23 || minute > 59) {
    return undefined;
  }

  return { hour, minute };
}

export function formatTimeOfDay(time: TimeOfDay): string {
  const meridian = time.hour >= 12 ? "PM" : "AM";
  const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${hour12}:${String(time.minute).padStart(2, "0")} ${meridian}`;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getZonedParts(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  let hour = read("hour");
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
  };
}

export function getZonedDateKey(date: Date, timezone: string): string {
  const { year, month, day } = getZonedParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function timesMatch(
  left: TimeOfDay,
  right: { hour: number; minute: number },
): boolean {
  return left.hour === right.hour && left.minute === right.minute;
}

/** True when local clock time is at or past the scheduled time today. */
export function isScheduledTimeReached(
  scheduled: TimeOfDay,
  local: { hour: number; minute: number },
): boolean {
  return (
    local.hour > scheduled.hour ||
    (local.hour === scheduled.hour && local.minute >= scheduled.minute)
  );
}

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Australia/Sydney",
  "Asia/Singapore",
  "UTC",
] as const;

export function filterTimezones(query: string): string[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) {
    return [...COMMON_TIMEZONES];
  }

  return COMMON_TIMEZONES.filter(
    (zone) =>
      zone.toLowerCase().includes(normalized) ||
      zone.replaceAll("_", " ").toLowerCase().includes(query.trim().toLowerCase()),
  );
}
