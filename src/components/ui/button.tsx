import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

export const buttonVariants = cva("btn", {
  variants: {
    variant: { solid: "btn-solid", soft: "btn-soft", ghost: "btn-ghost" },
    size: { md: "btn-md", icon: "btn-icon", lg: "btn-lg" },
  },
  defaultVariants: { variant: "soft", size: "md" },
})

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = "Button"
