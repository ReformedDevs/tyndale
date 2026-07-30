import { describe, expect, it } from "vitest";

import {
  formatTimeOfDay,
  getZonedDateKey,
  getZonedParts,
  isScheduledTimeReached,
  isValidTimezone,
  parseTimeOfDay,
  timesMatch,
} from "./time.js";

describe("parseTimeOfDay", () => {
  it("parses 12-hour times with am/pm", () => {
    expect(parseTimeOfDay("6:30 am")).toEqual({ hour: 6, minute: 30 });
    expect(parseTimeOfDay("6:30pm")).toEqual({ hour: 18, minute: 30 });
    expect(parseTimeOfDay("12:00 am")).toEqual({ hour: 0, minute: 0 });
    expect(parseTimeOfDay("12:15 PM")).toEqual({ hour: 12, minute: 15 });
  });

  it("parses 24-hour times", () => {
    expect(parseTimeOfDay("18:00")).toEqual({ hour: 18, minute: 0 });
    expect(parseTimeOfDay("06:05")).toEqual({ hour: 6, minute: 5 });
  });

  it("rejects invalid input", () => {
    expect(parseTimeOfDay("noon")).toBeUndefined();
    expect(parseTimeOfDay("25:00")).toBeUndefined();
  });
});

describe("formatTimeOfDay", () => {
  it("formats times for display", () => {
    expect(formatTimeOfDay({ hour: 6, minute: 30 })).toBe("6:30 AM");
    expect(formatTimeOfDay({ hour: 18, minute: 0 })).toBe("6:00 PM");
  });
});

describe("timezone helpers", () => {
  it("validates IANA timezones", () => {
    expect(isValidTimezone("America/Chicago")).toBe(true);
    expect(isValidTimezone("Not/A_Zone")).toBe(false);
  });

  it("reads zoned date parts", () => {
    const date = new Date("2026-01-01T12:00:00.000Z");
    const parts = getZonedParts(date, "America/Chicago");

    expect(parts.month).toBe(1);
    expect(parts.day).toBe(1);
    expect(getZonedDateKey(date, "America/Chicago")).toBe("2026-01-01");
  });

  it("matches scheduled times", () => {
    expect(timesMatch({ hour: 6, minute: 30 }, { hour: 6, minute: 30 })).toBe(
      true,
    );
    expect(timesMatch({ hour: 6, minute: 30 }, { hour: 6, minute: 31 })).toBe(
      false,
    );
  });

  it("detects when a scheduled time has been reached or passed", () => {
    expect(
      isScheduledTimeReached({ hour: 6, minute: 30 }, { hour: 6, minute: 30 }),
    ).toBe(true);
    expect(
      isScheduledTimeReached({ hour: 6, minute: 30 }, { hour: 10, minute: 15 }),
    ).toBe(true);
    expect(
      isScheduledTimeReached({ hour: 6, minute: 30 }, { hour: 6, minute: 29 }),
    ).toBe(false);
  });
});
