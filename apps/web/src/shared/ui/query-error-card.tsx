import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { cn } from "@/shared/lib/cn";

export function QueryErrorCard({
  message,
  onRetry,
  className,
  retryLabel = "Повторить",
}: {
  message: string;
  onRetry: () => void;
  className?: string;
  retryLabel?: string;
}) {
  return (
    <GlassCard className={cn("space-y-3", className)}>
      <p className="text-sm text-rose-600">{message}</p>
      <Button size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </GlassCard>
  );
}
