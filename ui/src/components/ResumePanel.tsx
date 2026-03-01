import { createSignal, Show } from "solid-js"
import { FileText } from "lucide-solid"
import { Button } from "@/components/Button"

type Props = {
  file: File | null
  onPick: (file: File) => void
  onForget: () => void
}

export function ResumePanel(props: Props) {
  const [dragActive, setDragActive] = createSignal(false)

  const onDrag = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    if (e.type === "dragleave") setDragActive(false)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const dt = (e as DragEvent).dataTransfer
    const dropped = dt?.files?.[0]
    if (!dropped) return
    if (dropped.type !== "application/pdf") return
    props.onPick(dropped)
  }

  const onChange: JSX.EventHandlerUnion<HTMLInputElement, Event> = (e) => {
    const picked = e.currentTarget.files?.[0]
    if (!picked) return
    if (picked.type !== "application/pdf") return
    props.onPick(picked)
  }

  return (
    <div class="rounded-lg border border-neutral-800 bg-black">
      <div class="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div class="flex items-center gap-2 text-sm text-neutral-200">
          <FileText class="h-4 w-4 text-neutral-500" /> Resume PDF
        </div>
        <Show when={props.file}>
          <Button variant="ghost" size="sm" class="h-8 px-3" onClick={props.onForget}>
            Forget
          </Button>
        </Show>
      </div>

      <div class="p-5">
        <div
          class={
            "relative flex h-[220px] w-full items-center justify-center rounded-md border border-neutral-800 bg-black transition-colors " +
            (dragActive() ? "border-neutral-600" : "hover:border-neutral-700") +
            (props.file ? " border-neutral-700" : "")
          }
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={onChange}
          />

          <Show
            when={props.file}
            fallback={
              <div class="px-6 text-center">
                <div class="text-sm font-medium text-neutral-200">Drop PDF or click</div>
                <div class="mt-1 text-xs text-neutral-500">PDF only</div>
              </div>
            }
          >
            <div class="px-6 text-center">
              <div class="text-sm font-medium text-neutral-200">{props.file?.name}</div>
              <div class="mt-1 text-xs text-neutral-500">
                {((props.file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}
