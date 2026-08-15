import { Hono } from "hono";
import {
  getBalanceSeries,
  getCategoryPareto,
  getSpendingHeatmap,
  getStatsMeta,
  getSummary,
  getTimeseries,
} from "../../services/money.js";
import type { ApiVariables } from "../context.js";
import { badRequest } from "../helpers/http.js";

export function registerStatsRoutes(router: Hono<{ Variables: ApiVariables }>) {
  router.get("/stats/summary", (c) => {
    return c.json(
      getSummary(
        c.req.query("from") ?? undefined,
        c.req.query("to") ?? undefined,
      ),
    );
  });

  router.get("/stats/meta", (c) => {
    return c.json(getStatsMeta());
  });

  router.get("/stats/timeseries", (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return badRequest(c, "from and to required");

    const granularity =
      (c.req.query("granularity") as "day" | "week" | "month" | "year") ??
      "day";
    return c.json(getTimeseries(from, to, granularity));
  });

  router.get("/stats/balance-series", (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return badRequest(c, "from and to required");

    const granularity =
      (c.req.query("granularity") as "day" | "week" | "month" | "year") ??
      "month";
    return c.json(getBalanceSeries(from, to, granularity));
  });

  router.get("/stats/category-pareto", (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return badRequest(c, "from and to required");
    const type = (c.req.query("type") as "expense" | "income") ?? "expense";
    return c.json(getCategoryPareto(from, to, type));
  });

  router.get("/stats/spending-heatmap", (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!from || !to) return badRequest(c, "from and to required");
    const type = (c.req.query("type") as "expense" | "income") ?? "expense";
    return c.json(getSpendingHeatmap(from, to, type));
  });
}
