import { describe, expect, it } from "vitest";
import {
  parseYmd,
  periodDefaults,
  previousPeriodYmdRange,
  toIsoRange,
} from "./date";

describe("date utilities", () => {
  it("parses ymd into local date components", () => {
    const parsed = parseYmd("2026-08-16");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(16);
  });

  it("builds full-day iso range from local calendar days", () => {
    const { fromIso, toIso } = toIsoRange("2026-08-01", "2026-08-03");
    const from = new Date(fromIso);
    const to = new Date(toIso);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(7);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(to.getFullYear()).toBe(2026);
    expect(to.getMonth()).toBe(7);
    expect(to.getDate()).toBe(3);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });

  it("periodDefaults uses local YMD without UTC slice drift", () => {
    const defaults = periodDefaults();
    expect(defaults.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaults.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const from = parseYmd(defaults.from);
    expect(from.getDate()).toBe(1);
  });

  it("calculates previous period with equal span", () => {
    expect(previousPeriodYmdRange("2026-08-10", "2026-08-12")).toEqual({
      from: "2026-08-07",
      to: "2026-08-09",
    });
  });
});
