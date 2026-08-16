import { describe, expect, it } from "vitest";
import { parseYmd, previousPeriodYmdRange, toIsoRange } from "./date";

describe("date utilities", () => {
  it("parses ymd into local date components", () => {
    const parsed = parseYmd("2026-08-16");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(16);
  });

  it("builds full-day iso range", () => {
    const { fromIso, toIso } = toIsoRange("2026-08-01", "2026-08-03");
    expect(fromIso.startsWith("2026-08-01")).toBe(true);
    expect(toIso.startsWith("2026-08-03")).toBe(true);
  });

  it("calculates previous period with equal span", () => {
    expect(previousPeriodYmdRange("2026-08-10", "2026-08-12")).toEqual({
      from: "2026-08-07",
      to: "2026-08-09",
    });
  });
});
