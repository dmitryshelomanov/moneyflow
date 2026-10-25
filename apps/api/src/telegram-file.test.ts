import { describe, expect, it } from "vitest";
import { isSafeTelegramFilePath } from "./telegram-file.js";

describe("isSafeTelegramFilePath", () => {
  it("accepts a relative telegram file path", () => {
    expect(isSafeTelegramFilePath("photos/file_123.jpg")).toBe(true);
  });

  it("rejects traversal, absolute paths, and URLs", () => {
    expect(isSafeTelegramFilePath("../secret")).toBe(false);
    expect(isSafeTelegramFilePath("/etc/passwd")).toBe(false);
    expect(isSafeTelegramFilePath("https://evil.example/a")).toBe(false);
    expect(isSafeTelegramFilePath("photos/file@evil")).toBe(false);
    expect(isSafeTelegramFilePath("")).toBe(false);
    expect(isSafeTelegramFilePath("a\\b")).toBe(false);
  });
});
