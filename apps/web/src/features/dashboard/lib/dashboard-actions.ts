import type { TimeseriesPoint } from "@moneyflow/shared";

export function exportDashboardCsv({
  series,
  from,
  to,
}: {
  series: TimeseriesPoint[];
  from: string;
  to: string;
}) {
  const rows = [
    ["date", "income_minor", "expense_minor"],
    ...series.map((point) => [
      point.date,
      String(point.income),
      String(point.expense),
    ]),
  ];
  const csv = rows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moneyflow-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildTransactionsQuery(params: {
  from: string;
  to: string;
  type: "income" | "expense";
  categoryId?: string;
  accountId?: string;
}) {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
    type: params.type,
  });
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.accountId) search.set("accountId", params.accountId);
  return `/transactions?${search.toString()}`;
}
