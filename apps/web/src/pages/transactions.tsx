import { useState } from "react";
import { useTransactionsPage } from "@/features/transactions/model/use-transactions-page";
import { CreateTransactionForm } from "@/features/transactions/ui/create-transaction-form";
import { TransactionsFilters } from "@/features/transactions/ui/transactions-filters";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";
import { parseDecimalInput } from "@/shared/lib/number";

export function TransactionsPage() {
  const { state, refs, actions, queries, mutations } = useTransactionsPage();

  const createError =
    mutations.createMutation.error instanceof Error
      ? mutations.createMutation.error.message
      : null;
  const deleteError =
    mutations.deleteMutation.error instanceof Error
      ? mutations.deleteMutation.error.message
      : null;
  const transactionsErrorMessage =
    queries.transactionsQuery.error instanceof Error
      ? queries.transactionsQuery.error.message
      : "Ошибка загрузки операций";
  const isDeleting = mutations.deleteMutation.isPending;
  const isBulkUpdating = mutations.bulkUpdateMutation.isPending;
  const isUpdatingAccount = mutations.updateAccountMutation.isPending;
  const bulkUpdateError =
    mutations.bulkUpdateMutation.error instanceof Error
      ? mutations.bulkUpdateMutation.error.message
      : null;
  const updateAccountError =
    mutations.updateAccountMutation.error instanceof Error
      ? mutations.updateAccountMutation.error.message
      : null;
  const hasNextPage = Boolean(queries.transactionsQuery.hasNextPage);
  const [amountError, setAmountError] = useState<string | null>(null);

  const onSave = async () => {
    const amount = parseDecimalInput(state.form.amount);
    if (amount == null || amount <= 0) {
      setAmountError("Введите сумму больше 0");
      return;
    }
    setAmountError(null);

    try {
      await mutations.createMutation.mutateAsync({
        type: state.form.type,
        amount,
        accountId: state.form.accountId || null,
        categoryId: state.form.categoryId || null,
        occurredAt: new Date(state.form.occurredAt).toISOString(),
        note: state.form.note || null,
        source: "web",
      });

      actions.setForm((prev) => ({ ...prev, amount: "", note: "" }));
    } catch {
      // Error is rendered by mutation state below the form.
    }
  };

  const onPeriodChange = ({ from, to }: { from: string; to: string }) => {
    actions.setPeriod({ from, to });
  };

  const onDelete = async (id: string) => {
    try {
      await mutations.deleteMutation.mutateAsync(id);
    } catch {
      // Error is rendered by mutation state in the list.
    }
  };

  const onApplyBulkCategory = async (categoryId: string | null) => {
    try {
      await mutations.bulkUpdateMutation.mutateAsync({
        categoryId,
        selectedIds: state.selectedIds,
      });
    } catch {
      // Error is rendered by mutation state in the list.
    }
  };

  const onChangeAccount = async (id: string, accountId: string) => {
    try {
      await mutations.updateAccountMutation.mutateAsync({ id, accountId });
    } catch {
      // Error is rendered by mutation state in the list.
    }
  };

  return (
    <div className="space-y-6">
      <TransactionsFilters
        q={state.q}
        from={state.from}
        to={state.to}
        type={state.type}
        accountId={state.accountId}
        categoryId={state.categoryId}
        accounts={state.accounts}
        categories={state.categories}
        allTimeFrom={state.allTimeFrom}
        onQChange={actions.setQ}
        onPeriodChange={onPeriodChange}
        onTypeChange={actions.setType}
        onAccountChange={actions.setAccountId}
        onCategoryChange={actions.setCategoryId}
      />

      <CreateTransactionForm
        form={state.form}
        accounts={state.accounts}
        categories={state.categories}
        isSaving={mutations.createMutation.isPending}
        error={amountError ?? createError}
        onChange={(next) => {
          setAmountError(null);
          actions.setForm(next);
        }}
        onSubmit={onSave}
      />

      <TransactionsList
        groups={state.dayGroups}
        categories={state.categories}
        accounts={state.accounts}
        catMap={state.catMap}
        accountMap={state.accountMap}
        hasActiveSearch={state.hasActiveSearch}
        isPending={queries.transactionsQuery.isPending}
        isError={queries.transactionsQuery.isError}
        errorMessage={transactionsErrorMessage}
        itemsCount={state.items.length}
        incomeTotalMinor={state.loadedTotals.incomeTotalMinor}
        expenseTotalMinor={state.loadedTotals.expenseTotalMinor}
        currency={state.loadedTotals.currency}
        isDeleting={isDeleting}
        deleteError={deleteError}
        selectionMode={state.selectionMode}
        selectedIds={state.selectedIds}
        selectedCount={state.selectedCount}
        isBulkUpdating={isBulkUpdating}
        bulkUpdateError={bulkUpdateError}
        isUpdatingAccount={isUpdatingAccount}
        updateAccountError={updateAccountError}
        isFetchingNextPage={queries.transactionsQuery.isFetchingNextPage}
        hasNextPage={hasNextPage}
        infiniteRef={refs.infiniteRef}
        onDelete={onDelete}
        onToggleSelectionMode={actions.toggleSelectionMode}
        onToggleSelected={actions.toggleSelected}
        onClearSelected={actions.clearSelected}
        onApplyBulkCategory={onApplyBulkCategory}
        onChangeAccount={onChangeAccount}
      />
    </div>
  );
}
