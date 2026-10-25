import {
  FinancePulseRequestSchema,
  SavingsAdviceRequestSchema,
} from "@moneyflow/shared";
import { Hono } from "hono";
import { env } from "../../env.js";
import { log } from "../../log.js";
import {
  buildFinancePulse,
  buildSavingsAdvice,
} from "../../services/advice.js";
import type { ApiVariables } from "../context.js";
import { badRequest, readJsonBody, validateBody } from "../helpers/http.js";

export function registerAdviceRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.post("/advice/savings", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, SavingsAdviceRequestSchema, body);
    if (!validated.ok) return validated.response;

    if (!env.ROUTERAI_API_KEY) {
      return c.json(
        {
          error:
            "ROUTERAI_API_KEY is not configured. AI advice is unavailable.",
        },
        503,
      );
    }

    try {
      const advice = await buildSavingsAdvice({
        from: validated.data.from,
        to: validated.data.to,
        maxTips: validated.data.maxTips ?? 5,
        userKey: String(c.var.user.telegramId),
      });
      return c.json(advice);
    } catch (error) {
      log.error(
        "advice",
        "savings advice failed",
        error instanceof Error ? error.message : error,
      );
      return c.json(
        {
          error:
            env.NODE_ENV === "production"
              ? "Advice generation failed"
              : error instanceof Error
                ? error.message
                : "Advice generation failed",
        },
        502,
      );
    }
  });

  router.post("/advice/pulse", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return badRequest(c, "Invalid JSON body");

    const validated = validateBody(c, FinancePulseRequestSchema, body);
    if (!validated.ok) return validated.response;

    if (!env.ROUTERAI_API_KEY) {
      return c.json(
        {
          error:
            "ROUTERAI_API_KEY is not configured. AI advice is unavailable.",
        },
        503,
      );
    }

    try {
      const pulse = await buildFinancePulse({
        from: validated.data.from,
        to: validated.data.to,
        userKey: String(c.var.user.telegramId),
      });
      return c.json(pulse);
    } catch (error) {
      log.error(
        "advice",
        "finance pulse failed",
        error instanceof Error ? error.message : error,
      );
      return c.json(
        {
          error:
            env.NODE_ENV === "production"
              ? "Pulse generation failed"
              : error instanceof Error
                ? error.message
                : "Pulse generation failed",
        },
        502,
      );
    }
  });
}
