import { formatMoney } from "@moneyflow/shared";
import { Hono } from "hono";
import { applyParseBatch } from "../../services/apply-parse.js";
import { parseSmart } from "../../services/ai.js";
import type { ApiVariables } from "../context.js";
import { badRequest, readJsonBody } from "../helpers/http.js";

export function registerParseRoutes(router: Hono<{ Variables: ApiVariables }>) {
  router.post("/parse", async (c) => {
    const body = await readJsonBody(c);
    if (body === null || typeof body !== "object") {
      return badRequest(c, "Invalid JSON body");
    }

    const requestBody = body as Record<string, unknown>;
    const text =
      typeof requestBody.text === "string" ? requestBody.text : undefined;
    const imageBase64 =
      typeof requestBody.imageBase64 === "string"
        ? requestBody.imageBase64
        : undefined;
    const imageMime =
      typeof requestBody.imageMime === "string"
        ? requestBody.imageMime
        : undefined;
    const save = requestBody.save !== false;

    if (!text && !imageBase64) {
      return badRequest(c, "text or imageBase64 required");
    }

    try {
      const batch = await parseSmart({ text, imageBase64, imageMime });
      if (!save) {
        return c.json({
          kind: batch.kind,
          parse: batch.transactions[0],
          parses: batch.transactions,
        });
      }

      const result = applyParseBatch(batch, {
        source: "web",
        rawText: text ?? "[image]",
      });
      return c.json({
        kind: result.kind,
        transaction: result.transaction,
        transactions: result.transactions,
        parse: result.parse,
        parses: result.parses,
        balance: result.balance,
        settings: result.settings,
        balanceFormatted: formatMoney(result.balance, result.settings.currency),
      });
    } catch (err) {
      return badRequest(c, err instanceof Error ? err.message : "Parse failed");
    }
  });
}
