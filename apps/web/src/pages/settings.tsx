import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Save, Trash2 } from "lucide-react";
import {
  type Account,
  fromMinorUnits,
  type ImportCsvAiResponse,
  type Settings,
} from "@moneyflow/shared";
import { accountApi } from "@/entities/account/api/account-api";
import {
  accountKeys,
  useAccountsQuery,
} from "@/entities/account/model/queries";
import { categoryKeys } from "@/entities/category/model/queries";
import { statsKeys } from "@/entities/stats/model/queries";
import { settingsApi } from "@/entities/settings/api/settings-api";
import { transactionKeys } from "@/entities/transaction/model/queries";
import { importCsvAiApi } from "@/features/settings-import/api/import-csv-ai-api";
import { useSettingsQuery } from "@/entities/settings/model/queries";
import { cn } from "@/shared/lib/cn";
import { parseDecimalInput } from "@/shared/lib/number";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useSettingsQuery();
  const accountsQuery = useAccountsQuery();
  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
  });
  const importCsvMutation = useMutation({
    mutationFn: async (payload: { file: File; promptExtension?: string }) => {
      const { file, promptExtension } = payload;
      const csv = await file.text();
      return importCsvAiApi.importCsv({
        csv,
        filename: file.name,
        promptExtension: promptExtension?.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: transactionKeys.root }),
        queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
        queryClient.invalidateQueries({ queryKey: statsKeys.meta }),
        queryClient.invalidateQueries({ queryKey: statsKeys.dashboardRoot }),
      ]);
    },
  });
  const createAccountMutation = useMutation({
    mutationFn: accountApi.createAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      await queryClient.invalidateQueries({
        queryKey: statsKeys.dashboardRoot,
      });
    },
  });
  const updateAccountMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name: string;
        matchHint: string | null;
        openingBalance: number;
      };
    }) => accountApi.updateAccount(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      await queryClient.invalidateQueries({
        queryKey: statsKeys.dashboardRoot,
      });
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      await queryClient.invalidateQueries({ queryKey: transactionKeys.root });
      await queryClient.invalidateQueries({
        queryKey: statsKeys.dashboardRoot,
      });
    },
  });

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<ImportCsvAiResponse | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importPrompt, setImportPrompt] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountHint, setNewAccountHint] = useState("");
  const [newAccountOpening, setNewAccountOpening] = useState("0");
  const [accountDrafts, setAccountDrafts] = useState<
    Record<string, { name: string; matchHint: string; openingBalance: string }>
  >({});
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setSettings((prev) => {
      if (
        prev &&
        prev.currency === s.currency &&
        prev.categorizationPrompt === s.categorizationPrompt &&
        prev.aiModel === s.aiModel &&
        prev.allowedTelegramIds === s.allowedTelegramIds
      ) {
        return prev;
      }
      return s;
    });
  }, [settingsQuery.data]);

  if (settingsQuery.isPending && !settings) {
    return (
      <GlassCard className="mx-auto max-w-2xl">
        <p className="text-sm text-black/60">Загрузка настроек...</p>
      </GlassCard>
    );
  }
  if (!settings) {
    return (
      <GlassCard className="mx-auto max-w-2xl">
        <p className="text-sm text-rose-600">Не удалось загрузить настройки</p>
      </GlassCard>
    );
  }

  const accounts = accountsQuery.data ?? [];
  const ensureDraft = (account: Account) =>
    accountDrafts[account.id] ?? {
      name: account.name,
      matchHint: account.matchHint ?? "",
      openingBalance: String(fromMinorUnits(account.openingBalance)),
    };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <GlassCard className="space-y-5">
        <h2 className="font-display text-2xl">Настройки</h2>

        <div>
          <Label>Валюта</Label>
          <Input
            className="mt-1"
            value={settings.currency}
            onChange={(e) =>
              setSettings({
                ...settings,
                currency: e.target.value.toUpperCase(),
              })
            }
          />
        </div>

        <div>
          <Label>Telegram user ID</Label>
          <Input
            className="mt-1"
            value={settings.allowedTelegramIds}
            onChange={(e) =>
              setSettings({
                ...settings,
                allowedTelegramIds: e.target.value,
              })
            }
            placeholder="123456789,987654321"
          />
          <p className="mt-1 text-xs text-black/55">
            Список Telegram user id через запятую. Доступ к боту и веб-логину
            только у этих пользователей (плюс ID из env на сервере).
          </p>
        </div>

        <div>
          <Label>Глобальный промпт категоризации</Label>
          <Textarea
            className="mt-1 min-h-[160px]"
            value={settings.categorizationPrompt}
            onChange={(e) =>
              setSettings({ ...settings, categorizationPrompt: e.target.value })
            }
            placeholder="Как раскладывать траты по категориям..."
          />
        </div>

        <Button
          disabled={updateSettingsMutation.isPending}
          onClick={async () => {
            setSaveError(null);
            try {
              const updated = await updateSettingsMutation.mutateAsync({
                currency: settings.currency,
                categorizationPrompt: settings.categorizationPrompt,
                allowedTelegramIds: settings.allowedTelegramIds,
              });
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: statsKeys.meta }),
                queryClient.invalidateQueries({
                  queryKey: statsKeys.dashboardRoot,
                }),
              ]);
              setSettings(updated);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            } catch (error) {
              setSaveError(
                error instanceof Error
                  ? error.message
                  : "Не удалось сохранить настройки",
              );
            }
          }}
        >
          Сохранить
        </Button>
        {saveError && <p className="text-sm text-rose-600">{saveError}</p>}
        {saved && <p className="text-sm text-teal-700">Сохранено</p>}
      </GlassCard>

      <GlassCard className="space-y-4">
        <h3 className="font-display text-xl">Счета</h3>
        <p className="text-sm text-black/65">
          Стартовый баланс задаётся отдельно на каждый счёт. `matchHint`
          помогает ИИ распознавать счет по скринам банка (например: `Т-Банк,
          Tinkoff, *1234`).
        </p>
        <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
          <Input
            value={newAccountName}
            placeholder="Название счета"
            onChange={(e) => setNewAccountName(e.target.value)}
          />
          <Input
            value={newAccountHint}
            placeholder="Подсказки для AI (через запятую)"
            onChange={(e) => setNewAccountHint(e.target.value)}
          />
          <Input
            placeholder="Стартовый баланс"
            onChange={(e) => setNewAccountOpening(e.target.value)}
            value={newAccountOpening}
          />
          <Button
            disabled={createAccountMutation.isPending || !newAccountName.trim()}
            onClick={async () => {
              setAccountError(null);
              try {
                const parsedOpening = parseDecimalInput(newAccountOpening);
                if (parsedOpening == null) {
                  setAccountError("Некорректный стартовый баланс счета");
                  return;
                }
                await createAccountMutation.mutateAsync({
                  name: newAccountName.trim(),
                  matchHint: newAccountHint.trim() || null,
                  openingBalance: parsedOpening,
                });
                setNewAccountName("");
                setNewAccountHint("");
                setNewAccountOpening("0");
              } catch (error) {
                setAccountError(
                  error instanceof Error
                    ? error.message
                    : "Не удалось создать счет",
                );
              }
            }}
          >
            Добавить
          </Button>
        </div>

        <div className="space-y-2">
          {accounts.map((account) => {
            const draft = ensureDraft(account);
            const isSavingDraft =
              updateAccountMutation.isPending ||
              deleteAccountMutation.isPending;
            return (
              <div
                key={account.id}
                className="grid gap-2 rounded-2xl border border-black/10 bg-white/50 p-3 md:grid-cols-[1.2fr_1.2fr_1fr_auto_auto]"
              >
                <Input
                  value={draft.name}
                  onChange={(e) =>
                    setAccountDrafts((prev) => ({
                      ...prev,
                      [account.id]: { ...draft, name: e.target.value },
                    }))
                  }
                />
                <Input
                  value={draft.matchHint}
                  placeholder="Подсказка для AI"
                  onChange={(e) =>
                    setAccountDrafts((prev) => ({
                      ...prev,
                      [account.id]: { ...draft, matchHint: e.target.value },
                    }))
                  }
                />
                <Input
                  value={draft.openingBalance}
                  placeholder="Стартовый баланс"
                  onChange={(e) =>
                    setAccountDrafts((prev) => ({
                      ...prev,
                      [account.id]: {
                        ...draft,
                        openingBalance: e.target.value,
                      },
                    }))
                  }
                />
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={isSavingDraft}
                  aria-label="Сохранить"
                  onClick={async () => {
                    setAccountError(null);
                    try {
                      const parsedOpening = parseDecimalInput(
                        draft.openingBalance,
                      );
                      if (parsedOpening == null) {
                        setAccountError("Некорректный стартовый баланс счета");
                        return;
                      }
                      await updateAccountMutation.mutateAsync({
                        id: account.id,
                        payload: {
                          name: draft.name.trim(),
                          matchHint: draft.matchHint.trim() || null,
                          openingBalance: parsedOpening,
                        },
                      });
                      setAccountDrafts((prev) => {
                        const next = { ...prev };
                        delete next[account.id];
                        return next;
                      });
                    } catch (error) {
                      setAccountError(
                        error instanceof Error
                          ? error.message
                          : "Не удалось обновить счет",
                      );
                    }
                  }}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size={account.isDefault ? "sm" : "icon"}
                  disabled={isSavingDraft || account.isDefault}
                  aria-label={account.isDefault ? "Default" : "Удалить"}
                  onClick={async () => {
                    setAccountError(null);
                    if (!window.confirm("Удалить счет?")) return;
                    try {
                      await deleteAccountMutation.mutateAsync(account.id);
                    } catch (error) {
                      setAccountError(
                        error instanceof Error
                          ? error.message
                          : "Не удалось удалить счет",
                      );
                    }
                  }}
                >
                  {account.isDefault ? (
                    "Default"
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        {accountError ? (
          <p className="text-sm text-rose-600">{accountError}</p>
        ) : null}
      </GlassCard>

      <GlassCard className="space-y-4">
        <h3 className="font-display text-xl">Импорт CSV через ИИ</h3>
        <p className="text-sm text-black/65">
          Импорт добавляет новые транзакции без дедупликации. Категории
          создаются автоматически, если подходящих нет.
        </p>
        <div>
          <Label>CSV файл</Label>
          <Input
            className="mt-1"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setCsvFile(file);
              setCsvResult(null);
              setCsvError(null);
            }}
          />
          {csvFile && (
            <p className="mt-1 text-xs text-black/55">
              Выбран файл: {csvFile.name}
            </p>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-black/80"
          aria-pressed={showImportPrompt}
          onClick={() => setShowImportPrompt((prev) => !prev)}
        >
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2",
              showImportPrompt
                ? "border-black bg-[#d8fb88] text-black"
                : "border-black/30 bg-white text-transparent",
            )}
          >
            <CheckSquare className="h-4 w-4" />
          </span>
          Расширить промпт для этого импорта
        </button>
        {showImportPrompt && (
          <div>
            <Label>Дополнительная подсказка для ИИ</Label>
            <Textarea
              className="mt-1 min-h-[120px]"
              value={importPrompt}
              onChange={(event) => setImportPrompt(event.target.value)}
              placeholder="Например: колонка debit это расход, а credit это доход; поле merchant использовать как note..."
            />
          </div>
        )}
        <Button
          disabled={!csvFile || importCsvMutation.isPending}
          onClick={async () => {
            if (!csvFile) return;
            setCsvError(null);
            try {
              const result = await importCsvMutation.mutateAsync({
                file: csvFile,
                promptExtension: showImportPrompt ? importPrompt : undefined,
              });
              setCsvResult(result);
            } catch (error) {
              setCsvResult(null);
              setCsvError(
                error instanceof Error
                  ? error.message
                  : "Не удалось импортировать CSV",
              );
            }
          }}
        >
          {importCsvMutation.isPending ? "Импортируем..." : "Импортировать CSV"}
        </Button>
        {csvError && <p className="text-sm text-rose-600">{csvError}</p>}
        {csvResult && (
          <div className="space-y-1 text-sm text-black/75">
            <p>Строк всего: {csvResult.totalRows}</p>
            <p>Распознано ИИ: {csvResult.parsed}</p>
            <p>Сохранено: {csvResult.saved}</p>
            <p>Пропущено: {csvResult.skipped}</p>
            {csvResult.errors.length > 0 && (
              <p>Ошибки: {csvResult.errors.join(" | ")}</p>
            )}
          </div>
        )}
      </GlassCard>

      <p className="text-xs text-black/45">Версия {__APP_VERSION__}</p>
    </div>
  );
}
