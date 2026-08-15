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
        "rounded-[30px] border-2 border-black/90 bg-[#fffdf5] p-5 shadow-[0_8px_0_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
