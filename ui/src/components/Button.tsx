import type { JSX } from "solid-js"
import { splitProps } from "solid-js"
import { cn } from "@/lib/utils"

type Variant = "default" | "outline" | "ghost"
type Size = "default" | "sm" | "icon"

type Props = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

export function Button(allProps: Props) {
  const [props, rest] = splitProps(allProps, ["class", "variant", "size"])

  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50"

  const variants: Record<Variant, string> = {
    default: "bg-white text-black hover:bg-neutral-200",
    outline: "border border-neutral-800 bg-black text-neutral-200 hover:bg-neutral-900",
    ghost: "bg-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200",
  }

  const sizes: Record<Size, string> = {
    default: "h-10 px-4",
    sm: "h-9 px-3 text-xs",
    icon: "h-9 w-9",
  }

  const variant = props.variant ?? "default"
  const size = props.size ?? "default"

  return (
    <button
      {...rest}
      class={cn(base, variants[variant], sizes[size], props.class)}
    />
  )
}
