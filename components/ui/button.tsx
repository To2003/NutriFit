import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink shadow-[0_8px_22px_-10px_rgba(255,216,77,0.7)] hover:brightness-105",
        brand: "bg-grad text-white shadow-[0_10px_26px_-10px_rgba(176,75,214,0.85)]",
        secondary: "bg-surface-2 text-text border border-line hover:bg-[#232a26]",
        ghost: "text-text hover:bg-surface-2",
        outline: "border border-line text-text hover:border-muted",
        danger: "bg-alert/15 text-alert border border-alert/30",
      },
      size: {
        sm: "h-9 rounded-full px-3.5 text-sm",
        md: "h-12 rounded-full px-5 text-[15px]",
        lg: "h-14 rounded-full px-6 text-base",
        icon: "size-11 rounded-full",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
