import type { QueryClient } from "@tanstack/react-query";
import { accountKeys } from "@/entities/account/model/queries";
import { categoryKeys } from "@/entities/category/model/queries";
import { statsKeys } from "@/entities/stats/model/queries";
import { transactionKeys } from "@/entities/transaction/model/queries";

export type InvalidateFinancialFlags = {
  transactions?: boolean;
  categories?: boolean;
  accounts?: boolean;
  statsMeta?: boolean;
  dashboard?: boolean;
};

export async function invalidateFinancialData(
  queryClient: QueryClient,
  flags: InvalidateFinancialFlags,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (flags.transactions) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: transactionKeys.root }),
    );
  }
  if (flags.categories) {
    tasks.push(queryClient.invalidateQueries({ queryKey: categoryKeys.all }));
  }
  if (flags.accounts) {
    tasks.push(queryClient.invalidateQueries({ queryKey: accountKeys.all }));
  }
  if (flags.statsMeta) {
    tasks.push(queryClient.invalidateQueries({ queryKey: statsKeys.meta }));
  }
  if (flags.dashboard) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: statsKeys.dashboardRoot }),
    );
  }
  await Promise.all(tasks);
}
