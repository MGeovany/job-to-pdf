import type { JSX } from "solid-js"
import { splitProps } from "solid-js"
import { cn } from "@/lib/utils"

type Props = JSX.TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea(allProps: Props) {
  const [props, rest] = splitProps(allProps, ["class"])
  const base =
    "flex min-h-[80px] w-full rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  return <textarea {...rest} class={cn(base, props.class)} />
}
