import { useEffect, useMemo, useState } from "react"
import { Toaster, toast } from "sonner"
import mammoth from "mammoth"
import type { JobPost } from "@/types"
import { AiTokenCard } from "@/components/AiTokenCard"
import { ResumeUploadCard } from "@/components/ResumeUploadCard"
import { JobManagerCard } from "@/components/JobManagerCard"
import { refactorJobWithAi, type AiProvider } from "@/lib/ai"
import {
  buildPdfPassthrough,
  buildTailoringReportPdf,
} from "@/lib/pdf-builders"
import { deleteStoredResume, readStoredResume, writeStoredResume } from "@/lib/resume-store"
import { parseResume, type ParsedResume } from "@/lib/resume-parse"

function createJobPost(id: string, index: number): JobPost {
  return {
    id,
    title: `Job ${index}`,
    content: "",
    status: "idle",
    aiMode: "off",
  }
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState("")
  const [, setParsedResume] = useState<ParsedResume | null>(null)
  const [aiProvider, setAiProvider] = useState<AiProvider>(
    () => (localStorage.getItem("aiProvider") as AiProvider) || "openai"
  )
  const [aiToken, setAiToken] = useState(() => localStorage.getItem("aiToken") ?? "")

  const [posts, setPosts] = useState<JobPost[]>([{ id: "1", title: "Job 1", content: "", status: "idle", aiMode: "off" }])
  const [activeId, setActiveId] = useState("1")

  const [queue, setQueue] = useState<string[]>([])
  const [runningId, setRunningId] = useState<string | null>(null)

  const aiTokenPresent = !!aiToken.trim()
  const queuedCount = queue.length
  const running = !!runningId

  const activePost = useMemo(() => posts.find((p) => p.id === activeId) ?? null, [posts, activeId])

  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  useEffect(() => {
    localStorage.setItem("aiToken", aiToken)
  }, [aiToken])

  useEffect(() => {
    localStorage.setItem("aiProvider", aiProvider)
  }, [aiProvider])

  useEffect(() => {
    ;(async () => {
      try {
        const restored = await readStoredResume()
        if (!restored) return
        setFile(restored)
        if (restored.name.toLowerCase().endsWith(".docx")) {
          const { value } = await mammoth.extractRawText({ arrayBuffer: await restored.arrayBuffer() })
          const t = value || ""
          setResumeText(t)
          setParsedResume(parseResume(t))
        }
        toast.message("Resume restored")
      } catch {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    if (runningId) return
    if (!file) return
    const nextId = queue[0]
    if (!nextId) return

    const nextPost = posts.find((p) => p.id === nextId)
    if (!nextPost) {
      setQueue((q) => q.slice(1))
      return
    }

    setRunningId(nextId)
    setQueue((q) => q.slice(1))
    setPosts((all) => all.map((p) => (p.id === nextId ? { ...p, status: "running", error: undefined } : p)))

    ;(async () => {
      try {
        let blob: Blob
        let reportBlob: Blob | null = null
        if (nextPost.aiMode === "on" && aiToken.trim()) {
          if (!resumeText.trim()) throw new Error("Missing resume text (upload DOCX)")
          const isDocx = file.name.toLowerCase().endsWith(".docx")
          if (!isDocx) throw new Error("Upload DOCX to preserve layout")

          const brief = await refactorJobWithAi(aiProvider, aiToken, nextPost.content, resumeText)
          const patches =
            brief.docxPatches?.length
              ? brief.docxPatches
              : brief.beforeAfter?.summary?.before && brief.beforeAfter?.summary?.after
                ? [
                    {
                      before: brief.beforeAfter.summary.before,
                      after: brief.beforeAfter.summary.after,
                    },
                  ]
                : []
          if (!patches.length) throw new Error("AI returned no patches")

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = String(reader.result || "")
              const comma = result.indexOf(",")
              resolve(comma >= 0 ? result.slice(comma + 1) : result)
            }
            reader.onerror = () => reject(new Error("Failed to read DOCX"))
            reader.readAsDataURL(file)
          })

          const pdfResp = await fetch("/api/docx/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              docxBase64: base64,
              patches,
              boldKeywords: (brief.keywords || []).slice(0, 12),
            }),
          })

          if (!pdfResp.ok) {
            const err = await pdfResp.json().catch(() => null)
            throw new Error(String(err?.error ?? "Failed to render DOCX"))
          }

          blob = await pdfResp.blob()
          reportBlob = await buildTailoringReportPdf(brief)
        } else {
          // Non-AI mode: only safe passthrough for PDF
          if (file.name.toLowerCase().endsWith(".pdf")) {
            blob = await buildPdfPassthrough(file)
          } else {
            throw new Error("Upload PDF for non-AI, or enable AI with DOCX")
          }
        }

        const url = URL.createObjectURL(blob)
        const reportUrl = reportBlob ? URL.createObjectURL(reportBlob) : undefined
        setPosts((all) =>
          all.map((p) => {
            if (p.id !== nextId) return p
            if (p.resultUrl) URL.revokeObjectURL(p.resultUrl)
            if (p.reportUrl) URL.revokeObjectURL(p.reportUrl)
            return { ...p, status: "done", resultUrl: url, reportUrl, error: undefined }
          })
        )
        toast.success("PDF ready")
      } catch (err: any) {
        const message = String(err?.message ?? "Failed")
        setPosts((all) => all.map((p) => (p.id === nextId ? { ...p, status: "error", error: message } : p)))
        toast.error(message)
      } finally {
        setRunningId(null)
      }
    })()
  }, [queue, runningId, file, posts, aiToken, aiProvider])

  const onPickResume = (picked: File) => {
    setFile(picked)

    const isDocx =
      picked.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      picked.name.toLowerCase().endsWith(".docx")

    if (isDocx) {
      picked
        .arrayBuffer()
        .then((ab) => mammoth.extractRawText({ arrayBuffer: ab }))
        .then(({ value }) => {
          const t = value || ""
          setResumeText(t)
          setParsedResume(parseResume(t))
          toast.message("DOCX parsed")
        })
        .catch(() => {
          setResumeText("")
          setParsedResume(null)
          toast.error("Failed to read DOCX")
        })
    } else {
      setResumeText("")
      setParsedResume(null)
    }

    writeStoredResume(picked)
      .then(() => toast.message("Resume saved locally"))
      .catch(() => {})
  }

  const onForgetResume = () => {
    setFile(null)
    setResumeText("")
    setParsedResume(null)
    deleteStoredResume().catch(() => {})
    toast.message("Resume forgotten")
  }

  const addPost = () => {
    const id = String(Date.now()) + String(Math.random()).slice(2)
    setPosts((all) => [...all, createJobPost(id, all.length + 1)])
    setActiveId(id)
  }

  const removePost = (id: string) => {
    let nextActiveId: string | null = null

    setPosts((all) => {
      const post = all.find((p) => p.id === id)
      if (!post) return all
      if (post.status === "running") return all
      if (post.resultUrl) URL.revokeObjectURL(post.resultUrl)

      const next = all.filter((p) => p.id !== id)
      if (next.length === 0) return all

      if (activeId === id) {
        nextActiveId = next[next.length - 1].id
      }

      return next
    })

    setQueue((q) => q.filter((x) => x !== id))

    if (nextActiveId) setActiveId(nextActiveId)
  }

  const updatePost = (id: string, patch: Partial<JobPost>) => {
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const queueActive = () => {
    if (!activePost) return
    if (!file) return
    if (!activePost.content.trim()) return
    if (activePost.status === "queued" || activePost.status === "running") return

    updatePost(activePost.id, { status: "queued", error: undefined })
    setQueue((q) => (q.includes(activePost.id) ? q : [...q, activePost.id]))
    toast.message("Added to queue")
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100">
      <Toaster theme="dark" closeButton={false} richColors={false} />

      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Job To PDF</h1>
          <div className="text-xs text-neutral-500 tabular-nums">
            {running ? "Running" : "Idle"}
            {queuedCount ? ` / Queue ${queuedCount}` : ""}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ResumeUploadCard file={file} onPick={onPickResume} onForget={onForgetResume} />

          <div className="space-y-4">
            <AiTokenCard
              provider={aiProvider}
              onProviderChange={setAiProvider}
              token={aiToken}
              onTokenChange={setAiToken}
            />
            <JobManagerCard
              posts={posts}
              activeId={activeId}
              setActiveId={setActiveId}
              addPost={addPost}
              removePost={removePost}
              updatePost={updatePost}
              queueActive={queueActive}
              fileReady={!!file}
              runningId={runningId}
              aiTokenPresent={aiTokenPresent}
              resumeReady={!!resumeText.trim()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
