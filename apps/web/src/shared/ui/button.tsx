import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/shared/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border-2 border-black/90 text-sm font-semibold text-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#d68bf5] shadow-[0_4px_0_rgba(0,0,0,0.85)] hover:bg-[#c879ec]",
        secondary:
          "bg-[#5bd7d3] shadow-[0_4px_0_rgba(0,0,0,0.85)] hover:bg-[#47c7c3]",
        ghost:
          "bg-[#fff2a3] shadow-[0_4px_0_rgba(0,0,0,0.85)] hover:bg-[#ffe976]",
        danger:
          "bg-[#f188a4] shadow-[0_4px_0_rgba(0,0,0,0.85)] hover:bg-[#e87896]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
