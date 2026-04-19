import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_8px_20px_-6px_hsl(var(--riscv-accent)/0.35),0_0_0_1px_hsl(var(--riscv-accent)/0.28)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-md",
        outline:
          "border border-input bg-background hover:-translate-y-0.5 hover:border-riscv-accent/40 hover:bg-riscv-accent/[0.04] hover:text-foreground hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/80 hover:shadow-md",
        ghost:
          "hover:-translate-y-0.5 hover:bg-riscv-accent/[0.06] hover:text-foreground hover:shadow-sm",
        link:
          "text-primary underline-offset-4 transition-colors hover:text-primary/90 hover:underline hover:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

