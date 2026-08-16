import * as React from "react";
import { cn } from "@/shared/lib/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[110px] w-full rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-4 py-3 text-base text-black shadow-[0_3px_0_rgba(0,0,0,0.8)] placeholder:text-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 md:text-sm",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";
