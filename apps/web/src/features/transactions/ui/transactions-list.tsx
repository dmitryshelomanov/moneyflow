import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckSquare,
  Trash2,
} from "lucide-react";
import type { Account, Category, Transaction } from "@moneyflow/shared";
import { formatMoney } from "@moneyflow/shared";
import {
  CategoryIcon,
  resolveCategoryIconName,
} from "@/entities/category/ui/category-icon";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Combobox } from "@/shared/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
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
  accounts: Account[];
  categories: Category[];
  catMap: Record<string, Category | undefined>;
  accountMap: Record<string, Account | undefined>;
  hasActiveSearch: boolean;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  itemsCount: number;
  incomeTotalMinor: number;
  expenseTotalMinor: number;
  currency: string;
  isDeleting: boolean;
  deleteError: string | null;
  selectionMode: boolean;
  selectedIds: string[];
  selectedCount: number;
  isBulkUpdating: boolean;
  bulkUpdateError: string | null;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  infiniteRef: React.RefCallback<HTMLElement>;
  onDelete: (id: string) => Promise<void>;
  onToggleSelectionMode: () => void;
  onToggleSelected: (id: string) => void;
  onClearSelected: () => void;
  onApplyBulkCategory: (categoryId: string | null) => Promise<void>;
  onChangeAccount: (id: string, accountId: string) => Promise<void>;
  isUpdatingAccount: boolean;
  updateAccountError: string | null;
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
  accounts,
  categories,
  catMap,
  accountMap,
  hasActiveSearch,
  isPending,
  isError,
  errorMessage,
  itemsCount,
  incomeTotalMinor,
  expenseTotalMinor,
  currency,
  isDeleting,
  deleteError,
  selectionMode,
  selectedIds,
  selectedCount,
  isBulkUpdating,
  bulkUpdateError,
  isFetchingNextPage,
  hasNextPage,
  infiniteRef,
  onDelete,
  onToggleSelectionMode,
  onToggleSelected,
  onClearSelected,
  onApplyBulkCategory,
  onChangeAccount,
  isUpdatingAccount,
  updateAccountError,
}: TransactionsListProps) {
  const emptyStateMessage = hasActiveSearch
    ? "Ничего не найдено"
    : "Нет операций за период";
  const showTotals = !isPending && !isError && itemsCount > 0;
  const categoryOptions = [
    { value: "none", label: "Без категории" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const defaultAccountId =
    accounts.find((account) => account.isDefault)?.id ?? accounts[0]?.id ?? "";
  const defaultAccountName =
    accounts.find((account) => account.isDefault)?.name ?? "Main";
  const [bulkCategoryValue, setBulkCategoryValue] = React.useState("none");
  const [editingTx, setEditingTx] = React.useState<Transaction | null>(null);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  React.useEffect(() => {
    if (!selectionMode) setBulkCategoryValue("none");
  }, [selectionMode]);

  const editingAccountId =
    editingTx?.accountId && accountMap[editingTx.accountId]
      ? editingTx.accountId
      : defaultAccountId;

  return (
    <>
      <GlassCard className="overflow-anchor-none overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3 md:px-5">
          <div className="text-sm font-medium text-black/75">
            {selectionMode ? `Выбрано: ${selectedCount}` : "Операции"}
          </div>
          <Button
            variant={selectionMode ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleSelectionMode}
          >
            {selectionMode ? "Отмена" : "Выбрать"}
          </Button>
        </div>
        {selectionMode ? (
          <div className="space-y-2 border-b border-black/10 px-4 py-3 md:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                value={bulkCategoryValue}
                options={categoryOptions}
                disabled={isBulkUpdating}
                className="h-9 min-w-[13rem] rounded-xl border border-black/20 bg-white px-3 py-1.5 text-sm shadow-none"
                onValueChange={setBulkCategoryValue}
              />
              <Button
                size="sm"
                disabled={isBulkUpdating || selectedCount === 0}
                onClick={() =>
                  void onApplyBulkCategory(
                    bulkCategoryValue === "none" ? null : bulkCategoryValue,
                  )
                }
              >
                Применить к {selectedCount}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isBulkUpdating || selectedCount === 0}
                onClick={onClearSelected}
              >
                Очистить
              </Button>
            </div>
          </div>
        ) : null}
        {isPending ? (
          <div className="px-4 py-9 text-center text-black/55 md:px-5 md:py-10">
            Загрузка…
          </div>
        ) : isError ? (
          <div className="px-4 py-9 text-center text-rose-600 md:px-5 md:py-10">
            {errorMessage}
          </div>
        ) : itemsCount === 0 ? (
          <div className="px-4 py-9 text-center text-black/55 md:px-5 md:py-10">
            {emptyStateMessage}
          </div>
        ) : (
          <div className="divide-y divide-black/10">
            {showTotals ? (
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3 md:px-5 md:py-3.5">
                <div className="text-sm font-medium text-black/70">
                  Итого по загруженным
                </div>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm tabular-nums">
                  <div className="text-emerald-700">
                    Доход: {formatSignedMoney(incomeTotalMinor, currency)}
                  </div>
                  <div className="text-rose-600">
                    Расход: {formatSignedMoney(-expenseTotalMinor, currency)}
                  </div>
                </div>
              </div>
            ) : null}
            {groups.map((group) => (
              <section key={group.key}>
                <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4 md:px-5 md:pt-5">
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
                    const accountName =
                      (tx.accountId ? accountMap[tx.accountId]?.name : null) ??
                      defaultAccountName;
                    const isIncome = tx.type === "income";
                    const isSelected = selectedSet.has(tx.id);
                    const iconName = cat
                      ? resolveCategoryIconName({
                          icon: cat.icon,
                          categoryName: cat.name,
                        })
                      : "Circle";
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 md:gap-4 md:px-5 md:py-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {selectionMode ? (
                            <button
                              type="button"
                              aria-label="Выбрать операцию"
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
                                isSelected
                                  ? "border-black bg-[#d8fb88] text-black"
                                  : "border-black/30 bg-white text-transparent",
                              )}
                              onClick={() => onToggleSelected(tx.id)}
                            >
                              <CheckSquare className="h-4 w-4" />
                            </button>
                          ) : null}
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
                            <div className="break-words font-medium text-black">
                              {cat?.name ?? "Без категории"}
                            </div>
                            {tx.note ? (
                              <div className="break-words whitespace-normal text-xs text-black/70">
                                {tx.note}
                              </div>
                            ) : null}
                            <div className="truncate text-xs text-black/55">
                              {isIncome ? "Доход" : "Расход"}
                              {" · "}
                              {selectionMode ? (
                                accountName
                              ) : (
                                <button
                                  type="button"
                                  className="underline decoration-black/25 underline-offset-2 hover:text-black"
                                  onClick={() => setEditingTx(tx)}
                                >
                                  {accountName}
                                </button>
                              )}
                              {" · "}
                              {tx.source}
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
                          {selectionMode ? null : (
                            <>
                              <Button
                                className="md:hidden"
                                variant="ghost"
                                size="icon"
                                disabled={isDeleting}
                                aria-label="Удалить операцию"
                                onClick={() => {
                                  if (!window.confirm("Удалить эту операцию?"))
                                    return;
                                  void onDelete(tx.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                className="hidden md:inline-flex"
                                variant="ghost"
                                size="sm"
                                disabled={isDeleting}
                                onClick={() => {
                                  if (!window.confirm("Удалить эту операцию?"))
                                    return;
                                  void onDelete(tx.id);
                                }}
                              >
                                Удалить
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {bulkUpdateError ? (
          <div className="px-4 py-3 text-sm text-rose-600 md:px-5">
            {bulkUpdateError}
          </div>
        ) : null}
        {updateAccountError ? (
          <div className="px-4 py-3 text-sm text-rose-600 md:px-5">
            {updateAccountError}
          </div>
        ) : null}
        {deleteError ? (
          <div className="px-4 py-3 text-sm text-rose-600 md:px-5">
            {deleteError}
          </div>
        ) : null}
        {!isPending &&
        !isError &&
        (hasNextPage || isFetchingNextPage || itemsCount > 0) ? (
          <div className="px-4 py-3 text-center text-sm text-black/55 md:px-5">
            {isFetchingNextPage
              ? "Подгружаем…"
              : !hasNextPage
                ? "Все операции загружены"
                : null}
            {hasNextPage ? <div ref={infiniteRef} className="h-1" /> : null}
          </div>
        ) : null}
      </GlassCard>

      <Dialog
        open={editingTx !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTx(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Счет</DialogTitle>
            <DialogDescription>
              Выберите счет для этой операции
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {accounts.map((account) => {
              const isActive = account.id === editingAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={isUpdatingAccount}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left text-sm transition",
                    isActive
                      ? "border-black bg-[#d8fb88]"
                      : "border-black/20 bg-white hover:border-black/50",
                    isUpdatingAccount && "opacity-60",
                  )}
                  onClick={async () => {
                    if (!editingTx || account.id === editingAccountId) {
                      setEditingTx(null);
                      return;
                    }
                    try {
                      await onChangeAccount(editingTx.id, account.id);
                      setEditingTx(null);
                    } catch {
                      // Error is rendered by mutation state in the list.
                    }
                  }}
                >
                  <span className="font-medium">{account.name}</span>
                  {isActive ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
