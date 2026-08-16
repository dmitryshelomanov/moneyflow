import {
  StatsBalanceSeriesQuerySchema,
  StatsCategoryParetoQuerySchema,
  StatsSpendingHeatmapQuerySchema,
  StatsSummaryQuerySchema,
  StatsTimeseriesQuerySchema,
} from "@moneyflow/shared";
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
import { validateQuery } from "../helpers/http.js";

export function registerStatsRoutes(router: Hono<{ Variables: ApiVariables }>) {
  router.get("/stats/summary", (c) => {
    const validated = validateQuery(c, StatsSummaryQuerySchema, c.req.query());
    if (!validated.ok) return validated.response;
    return c.json(
      getSummary(
        validated.data.from,
        validated.data.to,
        validated.data.accountId,
      ),
    );
  });

  router.get("/stats/meta", (c) => {
    const accountId = c.req.query("accountId")?.trim() || undefined;
    return c.json(getStatsMeta(accountId));
  });

  router.get("/stats/timeseries", (c) => {
    const validated = validateQuery(
      c,
      StatsTimeseriesQuerySchema,
      c.req.query(),
    );
    if (!validated.ok) return validated.response;
    return c.json(
      getTimeseries(
        validated.data.from,
        validated.data.to,
        validated.data.granularity,
        validated.data.accountId,
      ),
    );
  });

  router.get("/stats/balance-series", (c) => {
    const validated = validateQuery(
      c,
      StatsBalanceSeriesQuerySchema,
      c.req.query(),
    );
    if (!validated.ok) return validated.response;
    return c.json(
      getBalanceSeries(
        validated.data.from,
        validated.data.to,
        validated.data.granularity,
        validated.data.accountId,
      ),
    );
  });

  router.get("/stats/category-pareto", (c) => {
    const validated = validateQuery(
      c,
      StatsCategoryParetoQuerySchema,
      c.req.query(),
    );
    if (!validated.ok) return validated.response;
    return c.json(
      getCategoryPareto(
        validated.data.from,
        validated.data.to,
        validated.data.type,
        validated.data.accountId,
      ),
    );
  });

  router.get("/stats/spending-heatmap", (c) => {
    const validated = validateQuery(
      c,
      StatsSpendingHeatmapQuerySchema,
      c.req.query(),
    );
    if (!validated.ok) return validated.response;
    return c.json(
      getSpendingHeatmap(
        validated.data.from,
        validated.data.to,
        validated.data.type,
        validated.data.accountId,
      ),
    );
  });
}
