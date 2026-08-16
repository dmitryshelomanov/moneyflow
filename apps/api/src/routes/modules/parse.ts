import { ParseRequestSchema, formatMoney } from "@moneyflow/shared";
import { Hono } from "hono";
import { applyParseBatch } from "../../services/apply-parse.js";
import { parseSmart } from "../../services/ai.js";
import type { ApiVariables } from "../context.js";
import { badRequest, readJsonBody, validateBody } from "../helpers/http.js";

export function registerParseRoutes(router: Hono<{ Variables: ApiVariables }>) {
  router.post("/parse", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) {
      return badRequest(c, "Invalid JSON body");
    }

    const validated = validateBody(c, ParseRequestSchema, body);
    if (!validated.ok) return validated.response;
    const { text, imageBase64, imageMime, save } = validated.data;

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
  });
}
