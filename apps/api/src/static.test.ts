import { describe, expect, it } from "vitest";
import { injectRuntimeHtml } from "./server/static.js";

describe("injectRuntimeHtml", () => {
  it("injects base href and runtime config into head", () => {
    const html = "<html><head><title>x</title></head><body></body></html>";
    const out = injectRuntimeHtml(html, {
      accessKey: "abc12345key",
      telegramBotId: "123456789",
    });
    expect(out).toContain('<base href="/k/abc12345key/">');
    expect(out).toContain("window.__MF_CONFIG__=");
    expect(out).toContain('"telegramBotId":"123456789"');
  });

  it("omits empty telegram bot id", () => {
    const html = "<html><head></head></html>";
    const out = injectRuntimeHtml(html, {
      accessKey: "abc12345key",
      telegramBotId: "",
    });
    expect(out).toContain("window.__MF_CONFIG__={}");
  });
});
