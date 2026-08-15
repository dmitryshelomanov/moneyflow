import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { fromMinorUnits, type Settings } from "@moneyflow/shared";
import { settingsApi } from "@/entities/settings/api/settings-api";
import { useSettingsQuery } from "@/entities/settings/model/queries";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export function SettingsPage() {
  const settingsQuery = useSettingsQuery();
  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
  });

  const [settings, setSettings] = useState<Settings | null>(null);
  const [opening, setOpening] = useState("");
  const [saved, setSaved] = useState(false);

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

  if (settingsQuery.isPending && !settings) return null;
  if (!settings) {
    return (
      <GlassCard className="mx-auto max-w-2xl">
        <p className="text-sm text-rose-600">Не удалось загрузить настройки</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="mx-auto max-w-2xl space-y-5">
      <h2 className="font-display text-2xl">Настройки</h2>

      <div>
        <Label>Валюта</Label>
        <Input
          className="mt-1"
          value={settings.currency}
          onChange={(e) =>
            setSettings({ ...settings, currency: e.target.value.toUpperCase() })
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
            setSettings({ ...settings, allowedTelegramIds: e.target.value })
          }
          placeholder="123456789"
        />
        <p className="mt-1 text-xs text-black/55">
          Один ID или несколько через запятую. Дополняет ALLOWED_TELEGRAM_IDS из
          .env.
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
          const updated = await updateSettingsMutation.mutateAsync({
            currency: settings.currency,
            openingBalance: Number(opening.replace(",", ".") || 0),
            categorizationPrompt: settings.categorizationPrompt,
            allowedTelegramIds: settings.allowedTelegramIds,
          });
          setSettings(updated);
          setOpening(String(fromMinorUnits(updated.openingBalance)));
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        Сохранить
      </Button>
      {saved && <p className="text-sm text-teal-700">Сохранено</p>}
    </GlassCard>
  );
}
