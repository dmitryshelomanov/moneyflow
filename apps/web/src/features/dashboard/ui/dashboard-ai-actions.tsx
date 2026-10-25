import { Button } from "@/shared/ui/button";

export function DashboardAiActions({
  hasSummary,
  pulsePending,
  savingsPending,
  onPulse,
  onSavings,
}: {
  hasSummary: boolean;
  pulsePending: boolean;
  savingsPending: boolean;
  onPulse: () => Promise<unknown>;
  onSavings: () => Promise<unknown>;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="default"
        disabled={!hasSummary || pulsePending}
        onClick={() => {
          void onPulse().catch(() => {
            // Error state is rendered below action buttons.
          });
        }}
      >
        {pulsePending ? "Смотрю..." : "Как дела?"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={!hasSummary || savingsPending}
        onClick={() => {
          void onSavings().catch(() => {
            // Error state is rendered below action buttons.
          });
        }}
      >
        {savingsPending ? "Ищу варианты..." : "Где сэкономить?"}
      </Button>
    </>
  );
}
