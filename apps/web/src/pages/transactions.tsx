import { useMemo } from "react";
import { useTransactionsPage } from "@/features/transactions/model/use-transactions-page";
import { CreateTransactionForm } from "@/features/transactions/ui/create-transaction-form";
import { TransactionsFilters } from "@/features/transactions/ui/transactions-filters";
import { TransactionsList } from "@/features/transactions/ui/transactions-list";

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
  const transactionsError =
    queries.transactionsQuery.error instanceof Error
      ? queries.transactionsQuery.error.message
      : "Ошибка загрузки операций";

  const onSave = useMemo(
    () => async () => {
      const amount = Number(state.form.amount.replace(",", "."));
      if (!amount) return;
      await mutations.createMutation.mutateAsync({
        type: state.form.type,
        amount,
        categoryId: state.form.categoryId || null,
        occurredAt: new Date(state.form.occurredAt).toISOString(),
        note: state.form.note || null,
        source: "web",
      });
      actions.setForm((prev) => ({ ...prev, amount: "", note: "" }));
    },
    [actions, mutations.createMutation, state.form],
  );

  return (
    <div className="space-y-6">
      <TransactionsFilters
        from={state.from}
        to={state.to}
        type={state.type}
        categoryId={state.categoryId}
        categories={state.categories}
        allTimeFrom={state.allTimeFrom}
        onPeriodChange={({ from, to }) => {
          actions.setFrom(from);
          actions.setTo(to);
        }}
        onTypeChange={actions.setType}
        onCategoryChange={actions.setCategoryId}
      />

      <CreateTransactionForm
        form={state.form}
        categories={state.categories}
        isSaving={mutations.createMutation.isPending}
        error={createError}
        onChange={actions.setForm}
        onSubmit={onSave}
      />

      <TransactionsList
        groups={state.dayGroups}
        catMap={state.catMap}
        isPending={queries.transactionsQuery.isPending}
        isError={queries.transactionsQuery.isError}
        errorMessage={transactionsError}
        itemsCount={state.items.length}
        isDeleting={mutations.deleteMutation.isPending}
        deleteError={deleteError}
        isFetchingNextPage={queries.transactionsQuery.isFetchingNextPage}
        hasNextPage={Boolean(queries.transactionsQuery.hasNextPage)}
        sentinelRef={refs.sentinelRef}
        onDelete={async (id) => {
          await mutations.deleteMutation.mutateAsync(id);
        }}
      />
    </div>
  );
}
