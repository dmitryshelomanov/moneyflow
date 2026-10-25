import { describe, expect, it } from "vitest";
import { fillKeys, pickGranularity } from "./chart";

describe("chart utilities", () => {
  it("picks year granularity for ranges longer than a year", () => {
    expect(pickGranularity("2025-01-01", "2026-02-01")).toBe("year");
    expect(pickGranularity("2026-01-01", "2026-08-01")).toBe("month");
  });

  it("fills month keys inclusively", () => {
    expect(fillKeys("2026-01-15", "2026-03-10", "month")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });
});
