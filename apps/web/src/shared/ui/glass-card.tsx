import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-black/90 bg-[#fffdf5] p-3 shadow-[0_5px_0_rgba(0,0,0,0.82)] md:rounded-[30px] md:p-5 md:shadow-[0_8px_0_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
