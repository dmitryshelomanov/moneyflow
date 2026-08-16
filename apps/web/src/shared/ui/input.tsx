import * as React from "react";
import { cn } from "@/shared/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-4 text-base text-black shadow-[0_3px_0_rgba(0,0,0,0.8)] placeholder:text-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 md:text-sm",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";
