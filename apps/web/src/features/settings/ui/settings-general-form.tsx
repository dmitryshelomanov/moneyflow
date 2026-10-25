import type { Settings } from "@moneyflow/shared";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { ReactNode } from "react";

export function SettingsGeneralForm({
  settings,
  isSaving,
  saveError,
  saved,
  botHistorySlot,
  onChange,
  onSave,
}: {
  settings: Settings;
  isSaving: boolean;
  saveError: string | null;
  saved: boolean;
  botHistorySlot: ReactNode;
  onChange: (next: Settings) => void;
  onSave: () => void;
}) {
  return (
    <GlassCard className="space-y-5">
      <h2 className="font-display text-2xl">Настройки</h2>

      <div>
        <Label>Валюта</Label>
        <Input
          className="mt-1"
          value={settings.currency}
          onChange={(e) =>
            onChange({
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
            onChange({
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

      {botHistorySlot}

      <div>
        <Label>Глобальный промпт категоризации</Label>
        <Textarea
          className="mt-1 min-h-[160px]"
          value={settings.categorizationPrompt}
          onChange={(e) =>
            onChange({ ...settings, categorizationPrompt: e.target.value })
          }
          placeholder="Как раскладывать траты по категориям..."
        />
      </div>

      <Button disabled={isSaving} onClick={onSave}>
        Сохранить
      </Button>
      {saveError && <p className="text-sm text-rose-600">{saveError}</p>}
      {saved && <p className="text-sm text-teal-700">Сохранено</p>}
    </GlassCard>
  );
}
