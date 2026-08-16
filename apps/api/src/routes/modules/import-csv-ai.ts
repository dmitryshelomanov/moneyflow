import {
  ImportCsvAiRequestSchema,
  ImportCsvAiResponseSchema,
} from "@moneyflow/shared";
import { Hono } from "hono";
import { importCsvWithAi } from "../../services/import-csv-ai.js";
import type { ApiVariables } from "../context.js";
import { badRequest, readJsonBody, validateBody } from "../helpers/http.js";

export function registerImportCsvAiRoutes(
  router: Hono<{ Variables: ApiVariables }>,
) {
  router.post("/import/csv-ai", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) {
      return badRequest(c, "Invalid JSON body");
    }

    const validated = validateBody(c, ImportCsvAiRequestSchema, body);
    if (!validated.ok) return validated.response;

    const result = await importCsvWithAi(validated.data);
    return c.json(ImportCsvAiResponseSchema.parse(result));
  });
}
