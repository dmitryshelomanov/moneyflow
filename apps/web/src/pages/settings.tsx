import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare } from "lucide-react";
import {
  fromMinorUnits,
  type ImportCsvAiResponse,
  type Settings,
} from "@moneyflow/shared";
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

  const [settings, setSettings] = useState<Settings | null>(null);
  const [opening, setOpening] = useState("");
  const [saved, setSaved] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<ImportCsvAiResponse | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importPrompt, setImportPrompt] = useState("");

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setSettings((prev) => {
      if (
        prev &&
        prev.currency === s.currency &&
        prev.openingBalance === s.openingBalance &&
        prev.categorizationPrompt === s.categorizationPrompt &&
        prev.aiModel === s.aiModel &&
        prev.allowedTelegramIds === s.allowedTelegramIds
      ) {
        return prev;
      }
      return s;
    });
    setOpening((prev) =>
      prev.length > 0 ? prev : String(fromMinorUnits(s.openingBalance)),
    );
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
          <Label>Стартовый баланс</Label>
          <Input
            className="mt-1"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0"
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
            const parsedOpening = parseDecimalInput(opening);
            if (parsedOpening == null) {
              setSaveError("Введите корректный стартовый баланс");
              return;
            }
            setSaveError(null);
            try {
              const updated = await updateSettingsMutation.mutateAsync({
                currency: settings.currency,
                openingBalance: parsedOpening,
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
              setOpening(String(fromMinorUnits(updated.openingBalance)));
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
    </div>
  );
}
