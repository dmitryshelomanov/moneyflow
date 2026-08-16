import { categoryApi } from "@/entities/category/api/category-api";
import { sessionApi } from "@/entities/session/api/session-api";
import { settingsApi } from "@/entities/settings/api/settings-api";
import { statsApi } from "@/entities/stats/api/stats-api";
import { transactionApi } from "@/entities/transaction/api/transaction-api";
import { quickParseApi } from "@/features/quick-parse/api/quick-parse-api";
import { importCsvAiApi } from "@/features/settings-import/api/import-csv-ai-api";

export const api = {
  ...sessionApi,
  ...settingsApi,
  ...categoryApi,
  ...transactionApi,
  ...statsApi,
  ...quickParseApi,
  ...importCsvAiApi,
};
