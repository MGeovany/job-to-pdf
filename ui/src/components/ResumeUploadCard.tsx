import { useState } from "react"
import { FileText } from "lucide-react"

type Props = {
  file: File | null
  onPick: (file: File) => void
  onForget: () => void
}

export function ResumeUploadCard(props: Props) {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    if (e.type === "dragleave") setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (!dropped) return
    const ok =
      dropped.type === "application/pdf" ||
      dropped.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      dropped.name.toLowerCase().endsWith(".docx")
    if (!ok) return
    props.onPick(dropped)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    const ok =
      picked.type === "application/pdf" ||
      picked.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      picked.name.toLowerCase().endsWith(".docx")
    if (!ok) return
    props.onPick(picked)
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-black">
      <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
        <div className="flex items-center gap-2 text-sm text-neutral-200">
          <FileText className="h-4 w-4 text-neutral-500" /> Resume PDF
        </div>
        {props.file ? (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md bg-transparent px-3 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            onClick={props.onForget}
          >
            Forget
          </button>
        ) : null}
      </div>

      <div className="p-5">
        <div
          className={
            "relative flex h-[220px] w-full items-center justify-center rounded-md border border-neutral-800 bg-black transition-colors " +
            (dragActive ? "border-neutral-600" : "hover:border-neutral-700") +
            (props.file ? " border-neutral-700" : "")
          }
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={handleChange}
          />

          {props.file ? (
            <div className="px-6 text-center">
              <div className="text-sm font-medium text-neutral-200">{props.file.name}</div>
              <div className="mt-1 text-xs text-neutral-500">
                {(props.file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          ) : (
            <div className="px-6 text-center">
              <div className="text-sm font-medium text-neutral-200">Drop PDF or click</div>
              <div className="mt-1 text-xs text-neutral-500">PDF or DOCX</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
