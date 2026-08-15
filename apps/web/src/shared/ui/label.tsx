import * as React from "react";
import { cn } from "@/shared/lib/cn";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.14em] text-black/65",
        className,
      )}
      {...props}
    />
  );
}
