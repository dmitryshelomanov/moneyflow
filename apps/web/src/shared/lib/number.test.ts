import { describe, expect, it } from "vitest";
import { parseDecimalInput } from "./number";

describe("parseDecimalInput", () => {
  it("parses comma decimal separator", () => {
    expect(parseDecimalInput("123,45")).toBe(123.45);
  });

  it("parses spaced numeric input", () => {
    expect(parseDecimalInput("1 234.50")).toBe(1234.5);
  });

  it("returns null for empty and invalid input", () => {
    expect(parseDecimalInput("   ")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
  });
});
