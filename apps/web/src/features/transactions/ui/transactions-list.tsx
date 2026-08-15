import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Category, Transaction } from "@moneyflow/shared";
import { formatMoney } from "@moneyflow/shared";
import {
  CategoryIcon,
  resolveCategoryIconName,
} from "@/entities/category/ui/category-icon";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";

type DayGroup = {
  key: string;
  label: string;
  total: number;
  currency: string;
  txs: Transaction[];
};

type TransactionsListProps = {
  groups: DayGroup[];
  catMap: Record<string, Category | undefined>;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  itemsCount: number;
  isDeleting: boolean;
  deleteError: string | null;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onDelete: (id: string) => Promise<void>;
};

function signedAmount(tx: Transaction) {
  return tx.type === "income" ? tx.amount : -tx.amount;
}

function formatSignedMoney(amountMinor: number, currency: string) {
  const abs = formatMoney(Math.abs(amountMinor), currency);
  if (amountMinor > 0) return `+${abs}`;
  if (amountMinor < 0) return `−${abs}`;
  return abs;
}

export function TransactionsList({
  groups,
  catMap,
  isPending,
  isError,
  errorMessage,
  itemsCount,
  isDeleting,
  deleteError,
  isFetchingNextPage,
  hasNextPage,
  sentinelRef,
  onDelete,
}: TransactionsListProps) {
  return (
    <GlassCard className="overflow-hidden p-0">
      {isPending ? (
        <div className="px-5 py-10 text-center text-black/55">Загрузка…</div>
      ) : isError ? (
        <div className="px-5 py-10 text-center text-rose-600">
          {errorMessage}
        </div>
      ) : itemsCount === 0 ? (
        <div className="px-5 py-10 text-center text-black/55">
          Нет операций за период
        </div>
      ) : (
        <div className="divide-y divide-black/10">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-5">
                <h3 className="text-[15px] font-semibold tracking-tight text-black">
                  {group.label}
                </h3>
                <div
                  className={cn(
                    "text-sm tabular-nums",
                    group.total > 0 ? "text-emerald-700" : "text-black/40",
                  )}
                >
                  {formatSignedMoney(group.total, group.currency)}
                </div>
              </div>
              <div className="divide-y divide-black/10">
                {group.txs.map((tx) => {
                  const cat = tx.categoryId ? catMap[tx.categoryId] : null;
                  const isIncome = tx.type === "income";
                  const iconName = cat
                    ? resolveCategoryIconName({
                        icon: cat.icon,
                        categoryName: cat.name,
                        type: cat.type,
                      })
                    : "Circle";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            "bg-[#ffe8b8] border-2 border-black/90",
                          )}
                        >
                          <CategoryIcon
                            name={iconName}
                            className={cn("h-5 w-5", "text-black/70")}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-black">
                            {cat?.name ?? "Без категории"}
                          </div>
                          {tx.note ? (
                            <div className="truncate text-xs text-black/70">
                              {tx.note}
                            </div>
                          ) : null}
                          <div className="truncate text-xs text-black/55">
                            {isIncome ? "Доход" : "Расход"} {" · "} {tx.source}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex items-center gap-1 text-right text-[15px] font-semibold tabular-nums",
                            isIncome ? "text-emerald-600" : "text-rose-600",
                          )}
                        >
                          {isIncome ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                          {formatSignedMoney(signedAmount(tx), tx.currency)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => void onDelete(tx.id)}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {deleteError ? (
        <div className="px-5 py-3 text-sm text-rose-600">{deleteError}</div>
      ) : null}
      {!isPending && !isError ? (
        <div className="px-5 py-3 text-center text-sm text-black/55">
          {isFetchingNextPage
            ? "Подгружаем…"
            : hasNextPage
              ? "Прокрутите вниз для подгрузки"
              : itemsCount > 0
                ? "Все операции загружены"
                : ""}
        </div>
      ) : null}
      <div ref={sentinelRef} className="h-1" />
    </GlassCard>
  );
}
