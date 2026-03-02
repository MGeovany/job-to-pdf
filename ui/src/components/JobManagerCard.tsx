import { Download, Loader2, Plus, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import type { JobPost } from "@/types"

function sanitizeFilename(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_. ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60)
}

type Props = {
  posts: JobPost[]
  activeId: string
  setActiveId: (id: string) => void
  addPost: () => void
  removePost: (id: string) => void
  updatePost: (id: string, patch: Partial<JobPost>) => void
  queueActive: () => void
  fileReady: boolean
  runningId: string | null
  aiTokenPresent: boolean
}

export function JobManagerCard(props: Props) {
  const current = props.posts.find((p) => p.id === props.activeId)
  const running = !!props.runningId

  const canQueueActive =
    props.fileReady &&
    !!current?.content.trim() &&
    current.status !== "queued" &&
    current.status !== "running"

  return (
    <div className="rounded-lg border border-neutral-800 bg-black">
      <div className="border-b border-neutral-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-200">Job Descriptions</div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            onClick={props.addPost}
            title="Add another job"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950/50 p-1">
          {props.posts.map((post) => {
            const isActive = post.id === props.activeId
            const isBusy = post.status === "queued" || post.status === "running"

            return (
              <button
                key={post.id}
                type="button"
                onClick={() => props.setActiveId(post.id)}
                className={
                  "inline-flex h-7 items-center gap-2 rounded-md border px-3 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2 " +
                  (isActive
                    ? "border-neutral-700 bg-black text-neutral-100"
                    : "border-transparent bg-transparent text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200")
                }
                aria-selected={isActive}
              >
                <span className="max-w-[10rem] truncate">{post.title}</span>

                {post.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />
                ) : post.status === "queued" ? (
                  <span className="text-[10px] text-neutral-500">Q</span>
                ) : post.status === "done" ? (
                  <span className="text-[10px] text-neutral-500">OK</span>
                ) : post.status === "error" ? (
                  <span className="text-[10px] text-neutral-500">ERR</span>
                ) : null}

                {props.posts.length > 1 ? (
                  <span
                    role="button"
                    tabIndex={-1}
                    className={
                      "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200 " +
                      (isBusy ? "pointer-events-none opacity-30" : "")
                    }
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isBusy) props.removePost(post.id)
                    }}
                    aria-label={`Remove ${post.title}`}
                    title={isBusy ? "Busy" : "Remove"}
                  >
                    <X className="h-3 w-3" />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {current ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between rounded-md border border-neutral-800 bg-black px-3 py-2">
              <label className="flex select-none items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={current.aiMode === "on"}
                  onChange={(e) =>
                    props.updatePost(current.id, { aiMode: e.target.checked ? "on" : "off" })
                  }
                  disabled={!props.aiTokenPresent}
                  className="h-4 w-4 accent-neutral-200"
                />
                Use AI to refactor cover page
              </label>
              <div className="text-[11px] text-neutral-600">
                {props.aiTokenPresent ? "" : "Add token to enable"}
              </div>
            </div>

            <Textarea
              placeholder="Paste job description"
              className="min-h-[220px] resize-none border-neutral-800 bg-black text-sm text-neutral-200 placeholder:text-neutral-600"
              value={current.content}
              onChange={(e) => props.updatePost(current.id, { content: e.target.value })}
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-neutral-500">
                {current.status === "idle" ? "" : current.status}
                {current.status === "error" && current.error ? `: ${current.error}` : ""}
              </div>

              <div className="flex items-center gap-2">
                {current.status === "done" && current.resultUrl ? (
                  <a
                    href={current.resultUrl}
                    download={`job-to-pdf-${sanitizeFilename(current.title) || "job"}.pdf`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-800 bg-black px-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download
                  </a>
                ) : null}

                {current.status === "done" && current.reportUrl ? (
                  <a
                    href={current.reportUrl}
                    download={`tailoring-report-${sanitizeFilename(current.title) || "job"}.pdf`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-800 bg-black px-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
                  >
                    <Download className="mr-2 h-4 w-4" /> Report
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={props.queueActive}
                  disabled={!canQueueActive}
                  className={
                    "inline-flex h-9 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-900 disabled:text-neutral-500"
                  }
                >
                  {running && props.runningId !== current.id ? "Add to queue" : "Generate PDF"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
