import type { ImportCsvAiResponse } from "@moneyflow/shared";
import { CheckSquare } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export function SettingsImportCsv({
  csvFile,
  csvResult,
  csvError,
  showImportPrompt,
  importPrompt,
  isPending,
  onFileChange,
  onTogglePrompt,
  onPromptChange,
  onImport,
}: {
  csvFile: File | null;
  csvResult: ImportCsvAiResponse | null;
  csvError: string | null;
  showImportPrompt: boolean;
  importPrompt: string;
  isPending: boolean;
  onFileChange: (file: File | null) => void;
  onTogglePrompt: () => void;
  onPromptChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <GlassCard className="space-y-4">
      <h3 className="font-display text-xl">Импорт CSV через ИИ</h3>
      <p className="text-sm text-black/65">
        Импорт добавляет новые транзакции без дедупликации. Категории создаются
        автоматически, если подходящих нет.
      </p>
      <div>
        <Label>CSV файл</Label>
        <Input
          className="mt-1"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            onFileChange(event.target.files?.[0] ?? null);
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
        onClick={onTogglePrompt}
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
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Например: колонка debit это расход, а credit это доход; поле merchant использовать как note..."
          />
        </div>
      )}
      <Button disabled={!csvFile || isPending} onClick={onImport}>
        {isPending ? "Импортируем..." : "Импортировать CSV"}
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
  );
}
