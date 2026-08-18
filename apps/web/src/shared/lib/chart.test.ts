import { describe, expect, it } from "vitest";
import { formatAxisMoney } from "./chart";

describe("formatAxisMoney", () => {
  it("formats thousands in compact Russian notation", () => {
    const label = formatAxisMoney(150000, "RUB");
    expect(label).toMatch(/150/);
    expect(label.toLowerCase()).toMatch(/тыс/);
  });

  it("formats millions in compact Russian notation", () => {
    const label = formatAxisMoney(1_200_000, "RUB");
    expect(label).toMatch(/1[.,]2/);
    expect(label.toLowerCase()).toMatch(/млн/);
  });
});
