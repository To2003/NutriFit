import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:brightness-105",
        secondary: "bg-surface-2 text-text border border-line hover:bg-[#232a26]",
        ghost: "text-text hover:bg-surface-2",
        outline: "border border-line text-text hover:border-muted",
        danger: "bg-alert/15 text-alert border border-alert/30",
      },
      size: {
        sm: "h-9 rounded-[10px] px-3 text-sm",
        md: "h-12 rounded-[14px] px-5 text-[15px]",
        lg: "h-14 rounded-[16px] px-6 text-base",
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
