import { useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, Plus, X } from "lucide-react"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type JobStatus = "idle" | "queued" | "running" | "done" | "error"

type AiMode = "off" | "on"

type JobPost = {
  id: string
  title: string
  content: string
  status: JobStatus
  aiMode: AiMode
  resultUrl?: string
  error?: string
}

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

function wrapText(text: string, maxWidth: number, measure: (s: string) => number) {
  const normalized = text.replace(/\r\n/g, "\n")
  const paragraphs = normalized.split("\n")
  const lines: string[] = []

  for (const p of paragraphs) {
    const raw = p.trimEnd()
    if (!raw) {
      lines.push("")
      continue
    }

    const words = raw.split(/\s+/g)
    let current = ""

    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w
      if (measure(candidate) <= maxWidth) {
        current = candidate
        continue
      }

      if (current) lines.push(current)
      current = w
    }

    if (current) lines.push(current)
  }

  return lines
}

async function buildPdf(resumePdf: File, jobText: string) {
  const resumeBytes = await resumePdf.arrayBuffer()
  const resumeDoc = await PDFDocument.load(resumeBytes)
  const outDoc = await PDFDocument.create()

  const font = await outDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold)

  const a4 = { width: 595.28, height: 841.89 }
  const margin = 56
  const titleSize = 18
  const bodySize = 11
  const lineHeight = 15

  let page = outDoc.addPage([a4.width, a4.height])
  let y = a4.height - margin

  page.drawText("Job Description", {
    x: margin,
    y: y - titleSize,
    size: titleSize,
    font: fontBold,
  })

  y -= titleSize + 18

  const maxWidth = a4.width - margin * 2
  const measure = (s: string) => font.widthOfTextAtSize(s, bodySize)
  const lines = wrapText(jobText, maxWidth, measure)

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = outDoc.addPage([a4.width, a4.height])
      y = a4.height - margin
    }

    if (line) {
      page.drawText(line, {
        x: margin,
        y,
        size: bodySize,
        font,
      })
    }

    y -= lineHeight
  }

  const copied = await outDoc.copyPages(resumeDoc, resumeDoc.getPageIndices())
  for (const p of copied) outDoc.addPage(p)

  const bytes = await outDoc.save()
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

type AiRefactor = {
  title: string
  summary: string
  mustHaves: string[]
  niceToHaves: string[]
  keywords: string[]
}

async function refactorJobWithAi(token: string, jobText: string): Promise<AiRefactor> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error("Missing token")

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${trimmed}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You rewrite job descriptions into a compact, PDF-ready brief. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: [
            "Convert this job description into a brief with:",
            "- title: string (short)",
            "- summary: string (2-4 sentences)",
            "- mustHaves: 5-10 bullets",
            "- niceToHaves: 3-8 bullets",
            "- keywords: 10-20 single tokens/phrases",
            "Rules:",
            "- Output JSON only.",
            "- No markdown.",
            "- Keep bullets concise.",
            "JOB:",
            jobText,
          ].join("\n"),
        },
      ],
      response_format: { type: "json_object" },
    }),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "")
    throw new Error(txt || `AI error (${resp.status})`)
  }

  const data = (await resp.json()) as any
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") throw new Error("AI response missing")

  const parsed = JSON.parse(content) as AiRefactor
  if (!parsed || typeof parsed !== "object") throw new Error("AI parse failed")
  return {
    title: String((parsed as any).title ?? ""),
    summary: String((parsed as any).summary ?? ""),
    mustHaves: Array.isArray((parsed as any).mustHaves) ? (parsed as any).mustHaves.map(String) : [],
    niceToHaves: Array.isArray((parsed as any).niceToHaves) ? (parsed as any).niceToHaves.map(String) : [],
    keywords: Array.isArray((parsed as any).keywords) ? (parsed as any).keywords.map(String) : [],
  }
}

async function buildPdfWithAi(resumePdf: File, jobText: string, ai: AiRefactor) {
  const resumeBytes = await resumePdf.arrayBuffer()
  const resumeDoc = await PDFDocument.load(resumeBytes)
  const outDoc = await PDFDocument.create()

  const font = await outDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold)

  const a4 = { width: 595.28, height: 841.89 }
  const margin = 56
  const h1 = 18
  const h2 = 12
  const body = 11
  const lh = 15
  const maxWidth = a4.width - margin * 2
  const measure = (s: string, size: number) => font.widthOfTextAtSize(s, size)
  const wrap = (t: string, size: number) => wrapText(t, maxWidth, (s) => measure(s, size))

  let page = outDoc.addPage([a4.width, a4.height])
  let y = a4.height - margin

  const drawLine = (text: string, size = body, bold = false) => {
    if (y < margin + lh) {
      page = outDoc.addPage([a4.width, a4.height])
      y = a4.height - margin
    }
    page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
    y -= lh
  }

  page.drawText("Job Brief", { x: margin, y: y - h1, size: h1, font: fontBold })
  y -= h1 + 18

  if (ai.title.trim()) {
    drawLine(ai.title.trim(), h2, true)
    y -= 6
  }

  for (const line of wrap(ai.summary.trim(), body)) {
    drawLine(line || " ")
  }

  y -= 10
  if (ai.mustHaves.length) {
    drawLine("Must-haves", h2, true)
    for (const b of ai.mustHaves.slice(0, 10)) {
      for (const line of wrap(`- ${b}`.trim(), body)) drawLine(line || " ")
    }
    y -= 10
  }

  if (ai.niceToHaves.length) {
    drawLine("Nice-to-haves", h2, true)
    for (const b of ai.niceToHaves.slice(0, 8)) {
      for (const line of wrap(`- ${b}`.trim(), body)) drawLine(line || " ")
    }
    y -= 10
  }

  if (ai.keywords.length) {
    drawLine("Keywords", h2, true)
    const kw = ai.keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 20)
      .join("  ")
    for (const line of wrap(kw, body)) drawLine(line || " ")
  }

  const copied = await outDoc.copyPages(resumeDoc, resumeDoc.getPageIndices())
  for (const p of copied) outDoc.addPage(p)

  const bytes = await outDoc.save()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

function App() {
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const [jobPosts, setJobPosts] = useState<JobPost[]>([
    { id: "1", title: "Job 1", content: "", status: "idle", aiMode: "off" },
  ])
  const [activeTab, setActiveTab] = useState("1")

  const [queue, setQueue] = useState<string[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  useEffect(() => {
    localStorage.setItem("aiToken", aiToken)
  }, [aiToken])

  useEffect(() => {
    if (runningId) return
    if (!file) return
    const nextId = queue[0]
    if (!nextId) return

    const nextPost = jobPosts.find((p) => p.id === nextId)
    if (!nextPost) {
      setQueue((q) => q.slice(1))
      return
    }

    setRunningId(nextId)
    setQueue((q) => q.slice(1))
    setJobPosts((posts) =>
      posts.map((p) =>
        p.id === nextId
          ? { ...p, status: "running", error: undefined }
          : p
      )
    )

    ;(async () => {
      try {
        let blob: Blob
        if (nextPost.aiMode === "on" && aiToken.trim()) {
          const brief = await refactorJobWithAi(aiToken, nextPost.content)
          blob = await buildPdfWithAi(file, nextPost.content, brief)
        } else {
          blob = await buildPdf(file, nextPost.content)
        }
        const url = URL.createObjectURL(blob)

        setJobPosts((posts) =>
          posts.map((p) => {
            if (p.id !== nextId) return p
            if (p.resultUrl) URL.revokeObjectURL(p.resultUrl)
            return { ...p, status: "done", resultUrl: url, error: undefined }
          })
        )
      } catch (err: any) {
        setJobPosts((posts) =>
          posts.map((p) =>
            p.id === nextId
              ? { ...p, status: "error", error: err?.message ?? "Failed" }
              : p
          )
        )
      } finally {
        setRunningId(null)
      }
    })()
  }, [queue, runningId, file, jobPosts])

  const currentPost = useMemo(
    () => jobPosts.find((p) => p.id === activeTab),
    [jobPosts, activeTab]
  )

  const canQueueActive =
    !!file &&
    !!currentPost?.content.trim() &&
    currentPost.status !== "queued" &&
    currentPost.status !== "running"

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
    if (dropped.type !== "application/pdf") return
    setFile(dropped)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (picked.type !== "application/pdf") return
    setFile(picked)
  }

  const updatePost = (id: string, patch: Partial<JobPost>) => {
    setJobPosts((posts) => posts.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const addJobPost = () => {
    const nextIndex = jobPosts.length + 1
    const newId = String(Date.now())
    setJobPosts((posts) => [
      ...posts,
      { id: newId, title: `Job ${nextIndex}`, content: "", status: "idle", aiMode: "off" },
    ])
    setActiveTab(newId)
  }

  const removeJobPost = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (jobPosts.length === 1) return
    const post = jobPosts.find((p) => p.id === idToRemove)
    if (!post) return
    if (post.status === "running") return

    if (post.resultUrl) URL.revokeObjectURL(post.resultUrl)
    setQueue((q) => q.filter((id) => id !== idToRemove))

    const nextPosts = jobPosts.filter((p) => p.id !== idToRemove)
    setJobPosts(nextPosts)
    if (activeTab === idToRemove) setActiveTab(nextPosts[nextPosts.length - 1].id)
  }

  const queueActive = () => {
    if (!currentPost) return
    if (!canQueueActive) return

    updatePost(currentPost.id, { status: "queued", error: undefined })
    setQueue((q) => (q.includes(currentPost.id) ? q : [...q, currentPost.id]))
  }

  const clearFile = () => {
    setFile(null)
  }

  const queuedCount = queue.length
  const running = !!runningId

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Job To PDF</h1>
          <div className="text-xs text-neutral-500 tabular-nums">
            {running ? "Running" : "Idle"}
            {queuedCount ? ` / Queue ${queuedCount}` : ""}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-800 bg-black">
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-neutral-200">
                <FileText className="h-4 w-4 text-neutral-500" /> Resume PDF
              </div>
              {file ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={clearFile}
                >
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="p-5">
              <div
                className={
                  "relative flex h-[220px] w-full items-center justify-center rounded-md border border-neutral-800 bg-black transition-colors " +
                  (dragActive ? "border-neutral-600" : "hover:border-neutral-700") +
                  (file ? " border-neutral-700" : "")
                }
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={handleChange}
                />

                {file ? (
                  <div className="px-6 text-center">
                    <div className="text-sm font-medium text-neutral-200">{file.name}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div className="px-6 text-center">
                    <div className="text-sm font-medium text-neutral-200">
                      Drop PDF or click
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">PDF only</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-800 bg-black">
            <div className="border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-200">Job Descriptions</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={addJobPost}
                  title="Add another job"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 grid grid-cols-1 gap-2 rounded-md border border-neutral-800 bg-black p-3 md:grid-cols-2">
                <div className="text-xs text-neutral-500">AI token (stored locally)</div>
                <div className="flex items-center gap-2">
                  <input
                    value={aiToken}
                    onChange={(e) => setAiToken(e.target.value)}
                    type={showAiToken ? "text" : "password"}
                    placeholder="sk-..."
                    className="h-8 w-full rounded-md border border-neutral-800 bg-black px-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setShowAiToken((v) => !v)}
                  >
                    {showAiToken ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>

              <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-md border border-neutral-800 bg-neutral-950/50 p-1">
                {jobPosts.map((post) => {
                  const isActive = post.id === activeTab
                  const isBusy = post.status === "queued" || post.status === "running"
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setActiveTab(post.id)}
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

                      {jobPosts.length > 1 ? (
                        <span
                          role="button"
                          tabIndex={-1}
                          className={
                            "ml-1 inline-flex h-5 w-5 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200 " +
                            (isBusy ? "pointer-events-none opacity-30" : "")
                          }
                          onClick={(e) => removeJobPost(post.id, e)}
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

              {currentPost ? (
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between rounded-md border border-neutral-800 bg-black px-3 py-2">
                    <label className="flex select-none items-center gap-2 text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        checked={currentPost.aiMode === "on"}
                        onChange={(e) =>
                          updatePost(currentPost.id, { aiMode: e.target.checked ? "on" : "off" })
                        }
                        disabled={!aiToken.trim()}
                        className="h-4 w-4 accent-neutral-200"
                      />
                      Use AI to refactor cover page
                    </label>
                    <div className="text-[11px] text-neutral-600">
                      {aiToken.trim() ? "" : "Add token to enable"}
                    </div>
                  </div>

                  <Textarea
                    placeholder="Paste job description"
                    className="min-h-[220px] resize-none border-neutral-800 bg-black text-sm text-neutral-200 placeholder:text-neutral-600"
                    value={currentPost.content}
                    onChange={(e) => updatePost(currentPost.id, { content: e.target.value })}
                  />

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500">
                      {currentPost.status === "idle" ? "" : currentPost.status}
                      {currentPost.status === "error" && currentPost.error
                        ? `: ${currentPost.error}`
                        : ""}
                    </div>

                    <div className="flex items-center gap-2">
                      {currentPost.status === "done" && currentPost.resultUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 border-neutral-800 bg-black text-neutral-200 hover:bg-neutral-900"
                        >
                          <a
                            href={currentPost.resultUrl}
                            download={`job-to-pdf-${sanitizeFilename(currentPost.title) || "job"}.pdf`}
                          >
                            <Download className="mr-2 h-4 w-4" /> Download
                          </a>
                        </Button>
                      ) : null}

                      <Button
                        onClick={queueActive}
                        disabled={!canQueueActive}
                        className="h-9 bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200 disabled:bg-neutral-900 disabled:text-neutral-500"
                      >
                        {running && runningId !== currentPost.id
                          ? "Add to queue"
                          : "Generate PDF"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
  const [aiToken, setAiToken] = useState(() => localStorage.getItem("aiToken") ?? "")
  const [showAiToken, setShowAiToken] = useState(false)
