import type { ImportCsvAiResponse } from "@moneyflow/shared";
import { request } from "@/shared/api/http";

export const importCsvAiApi = {
  importCsv: (body: {
    csv: string;
    filename?: string;
    promptExtension?: string;
  }) =>
    request<ImportCsvAiResponse>("/import/csv-ai", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
