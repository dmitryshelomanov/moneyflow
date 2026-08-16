import { Hono } from "hono";
import type { ApiVariables } from "./context.js";
import {
  aiRateLimitMiddleware,
  authRateLimitMiddleware,
} from "../server/middleware/rate-limit.js";
import { contentLengthLimitMiddleware } from "../server/middleware/content-length-limit.js";
import { sessionAuthMiddleware } from "../server/middleware/session-auth.js";
import { registerAdviceRoutes } from "./modules/advice.js";
import { registerPublicAuthRoutes } from "./modules/auth.js";
import { registerCategoryRoutes } from "./modules/categories.js";
import { registerImportCsvAiRoutes } from "./modules/import-csv-ai.js";
import { registerParseRoutes } from "./modules/parse.js";
import { registerSettingsRoutes } from "./modules/settings.js";
import { registerStatsRoutes } from "./modules/stats.js";
import { registerTransactionRoutes } from "./modules/transactions.js";

export const api = new Hono<{ Variables: ApiVariables }>();
const publicApi = new Hono();
const privateApi = new Hono<{ Variables: ApiVariables }>();

privateApi.use("*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return contentLengthLimitMiddleware(1024 * 1024)(c, next);
  }
  await next();
});

publicApi.use("/auth/*", authRateLimitMiddleware);
registerPublicAuthRoutes(publicApi);
registerSettingsRoutes(privateApi);
registerCategoryRoutes(privateApi);
registerTransactionRoutes(privateApi);
registerStatsRoutes(privateApi);
privateApi.use("/parse", aiRateLimitMiddleware);
privateApi.use("/parse", contentLengthLimitMiddleware(6 * 1024 * 1024));
privateApi.use("/import/csv-ai", aiRateLimitMiddleware);
privateApi.use("/import/csv-ai", contentLengthLimitMiddleware(6 * 1024 * 1024));
privateApi.use("/advice/*", aiRateLimitMiddleware);
registerParseRoutes(privateApi);
registerImportCsvAiRoutes(privateApi);
registerAdviceRoutes(privateApi);

api.route("/", publicApi);
api.use("*", sessionAuthMiddleware);
api.route("/", privateApi);
