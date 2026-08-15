import { cors } from "hono/cors";
import { env } from "../../env.js";

export const corsMiddleware = cors({
  origin: [env.WEB_ORIGIN, `http://localhost:${env.PORT}`],
  credentials: true,
});
