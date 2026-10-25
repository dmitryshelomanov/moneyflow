import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

export function SettingsBotHistory({
  isPending,
  error,
  doneMessage,
  onClear,
}: {
  isPending: boolean;
  error: string | null;
  doneMessage: string | null;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-black/10 bg-white/40 p-3">
      <Label>История чата бота</Label>
      <p className="text-xs text-black/55">
        Удаляет в Telegram все отслеженные сообщения вашего чата с ботом, кроме
        первого приветствия. Сообщения до появления этой функции бот удалить не
        сможет.
      </p>
      <Button variant="danger" disabled={isPending} onClick={onClear}>
        {isPending ? "Очищаем..." : "Очистить историю бота"}
      </Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {doneMessage ? (
        <p className="text-sm text-teal-700">{doneMessage}</p>
      ) : null}
    </div>
  );
}
