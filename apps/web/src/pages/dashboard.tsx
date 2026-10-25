import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAiPulse } from "@/features/ai-pulse/model/use-ai-pulse";
import { FinancePulsePanel } from "@/features/ai-pulse/ui/finance-pulse-panel";
import { useAiSavings } from "@/features/ai-savings/model/use-ai-savings";
import { SavingsAdvicePanel } from "@/features/ai-savings/ui/savings-advice-panel";
import {
  buildTransactionsQuery,
  exportDashboardCsv,
} from "@/features/dashboard/lib/dashboard-actions";
import { useDashboard } from "@/features/dashboard/model/use-dashboard";
import { AccountChoiceList } from "@/features/dashboard/ui/account-choice-list";
import { DashboardAiActions } from "@/features/dashboard/ui/dashboard-ai-actions";
import { DashboardKpiStrip } from "@/features/dashboard/ui/dashboard-kpi-strip";
import { getErrorMessage } from "@/shared/api/http";
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
import { QueryErrorCard } from "@/shared/ui/query-error-card";
import { CashflowChart } from "@/widgets/charts/cashflow-chart";
import { CategoryPieChart } from "@/widgets/charts/category-pie-chart";
import { ParetoChart } from "@/widgets/charts/pareto-chart";
import { SpendingHeatmapChart } from "@/widgets/charts/spending-heatmap-chart";
import { TotalMoneyChart } from "@/widgets/charts/total-money-chart";
import { DateRangePicker } from "@/widgets/date-range/date-range-picker";

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

  const openTransactions = (query: {
    from?: string;
    to?: string;
    type: "income" | "expense";
    categoryId?: string;
  }) => {
    navigate(
      buildTransactionsQuery({
        from: query.from ?? state.from,
        to: query.to ?? state.to,
        type: query.type,
        categoryId: query.categoryId,
        accountId: state.selectedAccountId || undefined,
      }),
    );
  };

  const submitQuickParse = async () => {
    if (mutations.parseMutation.isPending || !state.quickText.trim()) return;
    actions.setMessage(null);
    try {
      await mutations.parseMutation.mutateAsync();
      setQuickOpen(false);
    } catch (err) {
      actions.setMessage(getErrorMessage(err, "Ошибка"));
    }
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DateRangePicker
            from={state.from}
            to={state.to}
            allTimeFrom={state.allTimeFrom}
            onChange={({ from: nextFrom, to: nextTo }) => {
              actions.setPeriod({ from: nextFrom, to: nextTo });
            }}
          />
          <button
            type="button"
            className="flex h-11 min-w-0 max-w-full items-center justify-between gap-2 rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-4 text-sm text-black shadow-[0_3px_0_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:max-w-[16rem]"
            onClick={() => setAccountOpen(true)}
          >
            <span className="truncate">{selectedAccountName}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-black/60" />
          </button>
          {state.isLongRange ? (
            <div
              role="group"
              aria-label="Группировка"
              className="flex h-11 items-center rounded-2xl border-2 border-black/90 bg-[#fffdf5] p-1 shadow-[0_3px_0_rgba(0,0,0,0.8)]"
            >
              <button
                type="button"
                className={cn(
                  "h-full rounded-xl px-3 text-xs font-semibold transition",
                  state.longRangeGranularity === "year"
                    ? "bg-[#5bd7d3] text-black"
                    : "text-black/55 hover:text-black",
                )}
                onClick={() => actions.setLongRangeGranularity("year")}
              >
                По годам
              </button>
              <button
                type="button"
                className={cn(
                  "h-full rounded-xl px-3 text-xs font-semibold transition",
                  state.longRangeGranularity === "month"
                    ? "bg-[#5bd7d3] text-black"
                    : "text-black/55 hover:text-black",
                )}
                onClick={() => actions.setLongRangeGranularity("month")}
              >
                По месяцам
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
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
          <DashboardAiActions
            hasSummary={Boolean(state.summary)}
            pulsePending={aiPulse.isPending}
            savingsPending={aiSavings.isPending}
            onPulse={() =>
              aiPulse.requestPulse({ from: state.from, to: state.to })
            }
            onSavings={() =>
              aiSavings.requestAdvice({
                from: state.from,
                to: state.to,
                maxTips: 5,
              })
            }
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              exportDashboardCsv({
                series: state.series,
                from: state.from,
                to: state.to,
              })
            }
          >
            Экспорт CSV
          </Button>
        </div>
      </div>
      {aiPulse.error && (
        <p className="text-sm text-rose-600">
          {getErrorMessage(aiPulse.error, "Не удалось получить оценку")}
        </p>
      )}
      {aiSavings.error && (
        <p className="text-sm text-rose-600">
          {getErrorMessage(aiSavings.error, "Не удалось получить советы")}
        </p>
      )}
      {queries.dashboardQuery.isPending && !state.summary && (
        <GlassCard>
          <p className="text-sm text-black/60">Загрузка данных дашборда...</p>
        </GlassCard>
      )}
      {queries.dashboardQuery.isError && (
        <QueryErrorCard
          message={getErrorMessage(
            queries.dashboardQuery.error,
            "Не удалось загрузить дашборд",
          )}
          onRetry={() => void queries.dashboardQuery.refetch()}
        />
      )}

      <DashboardKpiStrip summary={state.summary} ratio={state.ratio} />

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
