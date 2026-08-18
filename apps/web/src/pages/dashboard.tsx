import { formatMoney } from "@moneyflow/shared";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { useDashboard } from "@/features/dashboard/model/use-dashboard";
import { DateRangePicker } from "@/widgets/date-range/date-range-picker";
import { CashflowChart } from "@/widgets/charts/cashflow-chart";
import { CategoryPieChart } from "@/widgets/charts/category-pie-chart";
import { TotalMoneyChart } from "@/widgets/charts/total-money-chart";
import { ParetoChart } from "@/widgets/charts/pareto-chart";
import { SpendingHeatmapChart } from "@/widgets/charts/spending-heatmap-chart";
import { useAiSavings } from "@/features/ai-savings/model/use-ai-savings";
import { SavingsAdvicePanel } from "@/features/ai-savings/ui/savings-advice-panel";
import { useAiPulse } from "@/features/ai-pulse/model/use-ai-pulse";
import { FinancePulsePanel } from "@/features/ai-pulse/ui/finance-pulse-panel";
import { bucketToYmdRange } from "@/shared/lib/chart";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function AccountChoiceList({
  accounts,
  selectedId,
  onSelect,
  includeAll = false,
}: {
  accounts: Array<{ id: string; name: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  includeAll?: boolean;
}) {
  const items = includeAll
    ? [{ id: "", name: "Все счета" }, ...accounts]
    : accounts;

  return (
    <div className="space-y-2">
      {items.map((account) => {
        const isActive = account.id === selectedId;
        return (
          <button
            key={account.id || "all"}
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left text-sm transition",
              isActive
                ? "border-black bg-[#d8fb88]"
                : "border-black/20 bg-white hover:border-black/50",
            )}
            onClick={() => onSelect(account.id)}
          >
            <span className="font-medium">{account.name}</span>
            {isActive ? <Check className="h-4 w-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { state, actions, mutations, queries } = useDashboard();
  const aiSavings = useAiSavings();
  const aiPulse = useAiPulse();
  const navigate = useNavigate();
  const currency = state.summary?.currency ?? "RUB";
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const selectedAccountName =
    state.accounts.find((account) => account.id === state.selectedAccountId)
      ?.name ?? "Все счета";

  const exportCsv = () => {
    const rows = [
      ["date", "income_minor", "expense_minor"],
      ...state.series.map((point) => [
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
    a.download = `moneyflow-${state.from}-${state.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openTransactions = (query: {
    from?: string;
    to?: string;
    type: "income" | "expense";
    categoryId?: string;
  }) => {
    const params = new URLSearchParams({
      from: query.from ?? state.from,
      to: query.to ?? state.to,
      type: query.type,
    });
    if (query.categoryId) params.set("categoryId", query.categoryId);
    if (state.selectedAccountId) {
      params.set("accountId", state.selectedAccountId);
    }
    navigate(`/transactions?${params.toString()}`);
  };

  const submitQuickParse = async () => {
    if (mutations.parseMutation.isPending || !state.quickText.trim()) return;
    actions.setMessage(null);
    try {
      await mutations.parseMutation.mutateAsync();
      setQuickOpen(false);
    } catch (err) {
      actions.setMessage(err instanceof Error ? err.message : "Ошибка");
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <DateRangePicker
        from={state.from}
        to={state.to}
        allTimeFrom={state.allTimeFrom}
        large
        onChange={({ from: nextFrom, to: nextTo }) => {
          actions.setPeriod({ from: nextFrom, to: nextTo });
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-between rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-4 text-sm text-black shadow-[0_3px_0_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:w-auto sm:min-w-[12rem]"
          onClick={() => setAccountOpen(true)}
        >
          <span className="truncate">{selectedAccountName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-black/60" />
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="default"
            disabled={state.accounts.length === 0}
            onClick={() => {
              actions.setMessage(null);
              setQuickOpen(true);
            }}
          >
            Быстрая запись
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="default"
            disabled={!state.summary || aiPulse.isPending}
            onClick={async () => {
              try {
                await aiPulse.requestPulse({
                  from: state.from,
                  to: state.to,
                });
              } catch {
                // Error state is rendered below action buttons.
              }
            }}
          >
            {aiPulse.isPending ? "Смотрю..." : "Как дела?"}
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="secondary"
            disabled={!state.summary || aiSavings.isPending}
            onClick={async () => {
              try {
                await aiSavings.requestAdvice({
                  from: state.from,
                  to: state.to,
                  maxTips: 5,
                });
              } catch {
                // Error state is rendered below action buttons.
              }
            }}
          >
            {aiSavings.isPending ? "Ищу варианты..." : "Где сэкономить?"}
          </Button>
          <Button
            className="w-full sm:w-auto"
            size="sm"
            variant="ghost"
            onClick={exportCsv}
          >
            Экспорт CSV
          </Button>
        </div>
      </div>
      {aiPulse.error && (
        <p className="text-sm text-rose-600">
          {aiPulse.error instanceof Error
            ? aiPulse.error.message
            : "Не удалось получить оценку"}
        </p>
      )}
      {aiSavings.error && (
        <p className="text-sm text-rose-600">
          {aiSavings.error instanceof Error
            ? aiSavings.error.message
            : "Не удалось получить советы"}
        </p>
      )}
      {queries.dashboardQuery.isPending && !state.summary && (
        <GlassCard>
          <p className="text-sm text-black/60">Загрузка данных дашборда...</p>
        </GlassCard>
      )}
      {queries.dashboardQuery.isError && (
        <GlassCard className="space-y-3">
          <p className="text-sm text-rose-600">
            {queries.dashboardQuery.error instanceof Error
              ? queries.dashboardQuery.error.message
              : "Не удалось загрузить дашборд"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void queries.dashboardQuery.refetch()}
          >
            Повторить
          </Button>
        </GlassCard>
      )}
      {state.isLongRange ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
            Группировка
          </span>
          <Button
            size="sm"
            variant={
              state.longRangeGranularity === "year" ? "secondary" : "ghost"
            }
            onClick={() => actions.setLongRangeGranularity("year")}
          >
            По годам
          </Button>
          <Button
            size="sm"
            variant={
              state.longRangeGranularity === "month" ? "secondary" : "ghost"
            }
            onClick={() => actions.setLongRangeGranularity("month")}
          >
            По месяцам
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="flex gap-2.5 md:gap-3">
            <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#22c55e]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#16a34a] md:text-xs">
                Баланс
              </div>
              <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
                {state.summary
                  ? formatMoney(state.summary.balance, state.summary.currency)
                  : "—"}
              </div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="flex gap-2.5 md:gap-3">
            <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#4F6BED]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4F6BED] md:text-xs">
                Доход за период
              </div>
              <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
                {state.summary
                  ? formatMoney(
                      state.summary.periodIncome,
                      state.summary.currency,
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="flex gap-2.5 md:gap-3">
            <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#E67E22]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E67E22] md:text-xs">
                Расход за период
              </div>
              <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
                {state.summary
                  ? formatMoney(
                      state.summary.periodExpense,
                      state.summary.currency,
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="flex gap-2.5 md:gap-3">
            <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#6B7280]" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7280] md:text-xs">
                Доля расходов
              </div>
              <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
                {state.ratio == null ? "—" : `${state.ratio}%`}
              </div>
              <div className="mt-1 text-[11px] text-black/55 md:text-xs">
                {state.ratio == null
                  ? "нет дохода в периоде"
                  : "от дохода за период"}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {aiPulse.data ? <FinancePulsePanel pulse={aiPulse.data} /> : null}
      {aiSavings.data ? <SavingsAdvicePanel advice={aiSavings.data} /> : null}

      <GlassCard>
        <TotalMoneyChart
          series={state.balanceSeries}
          currency={currency}
          balance={state.summary?.balance ?? 0}
          averageExpensePerMonthMinor={state.averageExpensePerMonthMinor}
          from={state.from}
          to={state.to}
          granularity={state.balanceGranularity}
        />
      </GlassCard>

      <GlassCard>
        <CashflowChart
          series={state.series}
          currency={currency}
          periodIncome={state.summary?.periodIncome ?? 0}
          periodExpense={state.summary?.periodExpense ?? 0}
          from={state.from}
          to={state.to}
          granularity={state.granularity}
          onOpenTransactions={({ bucketKey, type }) => {
            const range = bucketKey
              ? bucketToYmdRange(
                  bucketKey,
                  state.granularity,
                  state.from,
                  state.to,
                )
              : { from: state.from, to: state.to };
            if (!range) return;
            openTransactions({ ...range, type });
          }}
        />
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <h2 className="mb-4 font-display text-lg text-black md:text-xl">
            Доходы по категориям
          </h2>
          <CategoryPieChart
            items={state.incomeCats}
            currency={currency}
            monthSpan={state.monthSpan}
            emptyLabel="Нет доходов за период"
            onSliceClick={(slice) => {
              if (!slice.categoryId) return;
              openTransactions({
                type: "income",
                categoryId: slice.categoryId,
              });
            }}
          />
        </GlassCard>
        <GlassCard>
          <h2 className="mb-4 font-display text-lg text-black md:text-xl">
            Расходы по категориям
          </h2>
          <CategoryPieChart
            items={state.expenseCats}
            currency={currency}
            monthSpan={state.monthSpan}
            emptyLabel="Нет расходов за период"
            onSliceClick={(slice) => {
              if (!slice.categoryId) return;
              openTransactions({
                type: "expense",
                categoryId: slice.categoryId,
              });
            }}
          />
        </GlassCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <ParetoChart items={state.expensePareto} currency={currency} />
        </GlassCard>
        <GlassCard>
          <SpendingHeatmapChart
            cells={state.expenseHeatmap}
            currency={currency}
            from={state.from}
            to={state.to}
          />
        </GlassCard>
      </div>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Счет</DialogTitle>
            <DialogDescription>
              Показать данные по одному счету или по всем
            </DialogDescription>
          </DialogHeader>
          <AccountChoiceList
            accounts={state.accounts}
            selectedId={state.selectedAccountId}
            includeAll
            onSelect={(id) => {
              actions.setSelectedAccountId(id);
              setAccountOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={quickOpen}
        onOpenChange={(open) => {
          setQuickOpen(open);
          if (!open) actions.setMessage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Быстрая запись</DialogTitle>
            <DialogDescription>
              Напишите операцию своими словами — разберём и сохраним
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Счет</Label>
              <div className="mt-1">
                <AccountChoiceList
                  accounts={state.accounts}
                  selectedId={state.quickAccountId}
                  onSelect={actions.setQuickAccountId}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="quick-parse-text">Текст</Label>
              <Input
                id="quick-parse-text"
                className="mt-1"
                placeholder="кофе 350 или зарплата 100000"
                value={state.quickText}
                autoFocus
                onChange={(e) => actions.setQuickText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  void submitQuickParse();
                }}
              />
            </div>
            <Button
              className="w-full"
              disabled={
                mutations.parseMutation.isPending || !state.quickText.trim()
              }
              onClick={() => void submitQuickParse()}
            >
              {mutations.parseMutation.isPending ? "Разбираю..." : "Разобрать"}
            </Button>
            {state.message ? (
              <p className="text-sm text-black/65">{state.message}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
