import { Hono } from "hono";
import type { ApiVariables } from "./context.js";
import { sessionAuthMiddleware } from "../server/middleware/session-auth.js";
import { registerAdviceRoutes } from "./modules/advice.js";
import { registerPublicAuthRoutes } from "./modules/auth.js";
import { registerCategoryRoutes } from "./modules/categories.js";
import { registerParseRoutes } from "./modules/parse.js";
import { registerSettingsRoutes } from "./modules/settings.js";
import { registerStatsRoutes } from "./modules/stats.js";
import { registerTransactionRoutes } from "./modules/transactions.js";

export const api = new Hono<{ Variables: ApiVariables }>();
const publicApi = new Hono();
const privateApi = new Hono<{ Variables: ApiVariables }>();

registerPublicAuthRoutes(publicApi);
registerSettingsRoutes(privateApi);
registerCategoryRoutes(privateApi);
registerTransactionRoutes(privateApi);
registerStatsRoutes(privateApi);
registerParseRoutes(privateApi);
registerAdviceRoutes(privateApi);

api.route("/", publicApi);
api.use("*", sessionAuthMiddleware);
api.route("/", privateApi);
