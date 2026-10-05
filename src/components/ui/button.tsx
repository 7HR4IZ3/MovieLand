import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

export const buttonVariants = cva(
  "ui-button",
  {
    variants: {
      variant: {
        default: "ui-button-primary",
        outline: "ui-button-quiet",
        secondary: "ui-button-secondary",
        ghost: "ui-button-quiet",
      },
      size: {
        default: "ui-button-default",
        sm: "ui-button-small",
        lg: "ui-button-large",
        icon: "ui-button-icon",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))

Button.displayName = "Button"
