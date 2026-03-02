import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"
import JSZip from "jszip"
import { DOMParser, XMLSerializer } from "@xmldom/xmldom"
import os from "node:os"
import fs from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import crypto from "node:crypto"

const execFileAsync = promisify(execFile)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function pickResumeSummary(text: string) {
  const normalized = String(text || "").replace(/\r\n/g, "\n")
  const blocks = normalized
    .split(/\n\s*\n/g)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  // pick the first reasonably long block
  return blocks.find((b) => b.length >= 80) || blocks[0] || ""
}

function ensureDocxPatches(obj: any, resumeText: string) {
  const summaryBefore =
    typeof obj?.beforeAfter?.summary?.before === "string" ? obj.beforeAfter.summary.before : ""
  const summaryAfter =
    typeof obj?.beforeAfter?.summary?.after === "string" ? obj.beforeAfter.summary.after : ""

  if (!obj.beforeAfter) obj.beforeAfter = { summary: { before: "", after: "" } }
  if (!obj.beforeAfter.summary) obj.beforeAfter.summary = { before: "", after: "" }

  const pickedBefore = summaryBefore.trim() ? summaryBefore : pickResumeSummary(resumeText)
  const pickedAfter =
    summaryAfter.trim()
      ? summaryAfter
      : typeof obj?.tailoredResume?.summary === "string"
        ? obj.tailoredResume.summary
        : typeof obj?.resumeSummary === "string"
          ? obj.resumeSummary
          : ""

  if (!obj.beforeAfter.summary.before) obj.beforeAfter.summary.before = pickedBefore
  if (!obj.beforeAfter.summary.after) obj.beforeAfter.summary.after = pickedAfter

  const existing = Array.isArray(obj.docxPatches) ? obj.docxPatches : []
  const cleaned = existing.filter((p: any) => p && typeof p.before === "string" && typeof p.after === "string")

  if (cleaned.length === 0 && pickedBefore.trim() && pickedAfter.trim()) {
    obj.docxPatches = [{ before: pickedBefore, after: pickedAfter }]
  } else {
    obj.docxPatches = cleaned
  }

  return obj
}

function buildRuns(doc: any, text: string, boldKeywords: string[]) {
  const runs: any[] = []
  const kws = boldKeywords
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12)

  if (kws.length === 0) {
    const r = doc.createElement("w:r")
    const t = doc.createElement("w:t")
    t.setAttribute("xml:space", "preserve")
    t.appendChild(doc.createTextNode(text))
    r.appendChild(t)
    return [r]
  }

  const re = new RegExp(kws.map(escapeRegExp).join("|"), "gi")
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (start > last) {
      const plain = text.slice(last, start)
      const r = doc.createElement("w:r")
      const t = doc.createElement("w:t")
      t.setAttribute("xml:space", "preserve")
      t.appendChild(doc.createTextNode(plain))
      r.appendChild(t)
      runs.push(r)
    }

    const hit = text.slice(start, end)
    const rB = doc.createElement("w:r")
    const rPr = doc.createElement("w:rPr")
    const b = doc.createElement("w:b")
    rPr.appendChild(b)
    rB.appendChild(rPr)
    const tB = doc.createElement("w:t")
    tB.setAttribute("xml:space", "preserve")
    tB.appendChild(doc.createTextNode(hit))
    rB.appendChild(tB)
    runs.push(rB)

    last = end
  }

  if (last < text.length) {
    const plain = text.slice(last)
    const r = doc.createElement("w:r")
    const t = doc.createElement("w:t")
    t.setAttribute("xml:space", "preserve")
    t.appendChild(doc.createTextNode(plain))
    r.appendChild(t)
    runs.push(r)
  }

  return runs
}

async function applyDocxPatches(docxBytes: Buffer, patches: Array<{ before: string; after: string }>, boldKeywords: string[]) {
  const zip = await JSZip.loadAsync(docxBytes)
  const file = zip.file("word/document.xml")
  if (!file) throw new Error("DOCX missing document.xml")
  const xml = await file.async("string")

  const doc = new DOMParser().parseFromString(xml, "text/xml")
  const paragraphs = Array.from(doc.getElementsByTagName("w:p")) as any[]

  const remaining = patches
    .map((p) => ({ before: String(p.before ?? ""), after: String(p.after ?? "") }))
    .filter((p) => p.before.trim() && p.after.trim())

  const applied: Set<number> = new Set()

  for (const p of paragraphs) {
    if (applied.size === remaining.length) break

    const texts = Array.from(p.getElementsByTagName("w:t")) as any[]
    const paragraphText = texts.map((t) => t.textContent ?? "").join("")
    if (!paragraphText.trim()) continue

    const normParagraph = paragraphText.replace(/\s+/g, " ").trim()

    for (let i = 0; i < remaining.length; i++) {
      if (applied.has(i)) continue
      const { before, after } = remaining[i]
      const idx = paragraphText.indexOf(before)

      let nextText: string | null = null
      if (idx !== -1) {
        nextText = paragraphText.replace(before, after)
      } else {
        const normBefore = before.replace(/\s+/g, " ").trim()
        if (normBefore && normParagraph.includes(normBefore)) {
          nextText = normParagraph.replace(normBefore, after)
        }
      }

      if (!nextText) continue

      // keep <w:pPr> if present, replace all other children with new runs
      const children = Array.from(p.childNodes) as any[]
      for (const c of children) {
        if (c.nodeType === 1 && c.tagName === "w:pPr") continue
        p.removeChild(c)
      }

      const runs = buildRuns(doc, nextText, boldKeywords)
      for (const r of runs) p.appendChild(r)

      applied.add(i)
      break
    }
  }

  const outXml = new XMLSerializer().serializeToString(doc)
  zip.file("word/document.xml", outXml)
  return {
    bytes: await zip.generateAsync({ type: "nodebuffer" }),
    appliedCount: applied.size,
  }
}

async function findSofficeBinary() {
  const candidates = [
    "soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ]
  for (const bin of candidates) {
    try {
      await execFileAsync(bin, ["--version"], { timeout: 3000 })
      return bin
    } catch {
      // try next
    }
  }
  return null
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-ai-proxy",
      configureServer(server: ViteDevServer) {
        server.middlewares.use("/api/docx/tailor-to-pdf", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "Method not allowed" }))
            return
          }

          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on("data", (c: any) => chunks.push(Buffer.from(c)))
              req.on("end", () => resolve())
              req.on("error", reject)
            })
            const raw = Buffer.concat(chunks).toString("utf8")
            const body = JSON.parse(raw || "{}") as any

            const b64 = String(body.docxBase64 ?? "")
            const patches = Array.isArray(body.patches) ? body.patches : []
            const boldKeywords = Array.isArray(body.boldKeywords) ? body.boldKeywords : []

            if (!b64) {
              res.statusCode = 400
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "Missing docx" }))
              return
            }

            const soffice = await findSofficeBinary()
            if (!soffice) {
              res.statusCode = 500
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "LibreOffice not found (install LibreOffice)" }))
              return
            }

            const docxBytes = Buffer.from(b64, "base64")
            const patched = await applyDocxPatches(docxBytes, patches, boldKeywords)

            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "job-to-pdf-"))
            const id = crypto.randomBytes(8).toString("hex")
            const docxPath = path.join(tmpDir, `${id}.docx`)
            if (patched.appliedCount === 0) {
              res.statusCode = 400
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "No matching text found in DOCX for patches" }))
              return
            }

            await fs.writeFile(docxPath, patched.bytes)

            await execFileAsync(
              soffice,
              [
                "--headless",
                "--nologo",
                "--nolockcheck",
                "--nodefault",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                tmpDir,
                docxPath,
              ],
              { timeout: 90000 }
            )

            const pdfPath = path.join(tmpDir, `${id}.pdf`)
            const pdf = await fs.readFile(pdfPath)

            res.statusCode = 200
            res.setHeader("Content-Type", "application/pdf")
            res.setHeader("X-Applied-Patches", String(patched.appliedCount))
            res.end(pdf)

            fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: err?.message ?? "Server error" }))
          }
        })

        server.middlewares.use("/api/ai/refactor", async (req: IncomingMessage, res: ServerResponse) => {
          if (req.method !== "POST") {
            res.statusCode = 405
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "Method not allowed" }))
            return
          }

          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on("data", (c: any) => chunks.push(Buffer.from(c)))
              req.on("end", () => resolve())
              req.on("error", reject)
            })
            const raw = Buffer.concat(chunks).toString("utf8")
            const body = JSON.parse(raw || "{}") as any
            const provider = String(body.provider ?? "openai")
            const token = String(body.token ?? "").trim()
            const jobText = String(body.jobText ?? "")
            const resumeText = String(body.resumeText ?? "")

            if (!token) {
              res.statusCode = 400
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "Missing token" }))
              return
            }

            const prompt = [
              "You will generate ATS-optimized resume text based on the job description.",
              "Return a JSON object with:",
              "- title: string (short)",
              "- summary: string (2-4 sentences; recruiter-friendly job brief)",
              "- mustHaves: 5-10 bullets (job requirements)",
              "- niceToHaves: 3-8 bullets (job preferences)",
              "- keywords: 10-20 single tokens/phrases",
              "- resumeHeadline: string (single line, ATS-friendly)",
              "- resumeSummary: string (3-6 lines; keyword-dense; sounds like the candidate; no fluff)",
              "- suggestedBullets: 6-10 bullets (resume-ready; action + impact; include relevant keywords; no invented company names)",
              "- tailoredResume: object { headline, summary, skills[], experienceBullets[] } (this is the FINAL copy to put on the resume)",
              "- beforeAfter: object { summary: { before, after } } (before is from RESUME, after is your optimized version)",
              "- changeLogApplied: 2-6 bullets (what you changed in the GENERATED PDF addendum text vs a generic SWE resume)",
              "- nextEditsRecommended: 4-10 bullets (what to update in the resume content next)",
              "Rules:",
              "- Output JSON only.",
              "- No markdown.",
              "- Keep bullets concise.",
              "- Do NOT include the full job description in any field.",
              "- Act as a senior HR recruiter optimizing for ATS and relevance.",
              "- Reuse exact keywords/phrases from the job description (where truthful/neutral) across resumeHeadline/resumeSummary/suggestedBullets.",
              "- Avoid vague claims; prefer specific responsibilities and outcomes phrased generally (e.g., 'improved latency', 'reduced errors').",
              "- Do NOT invent employers, dates, or credentials. Only use what is present in RESUME input.",
              "- If RESUME is missing detail, write neutrally (no fabrication).",
              "- Ensure tailoredResume.skills has at least 8 items and tailoredResume.experienceBullets has at least 6 items.",
              "- Also return docxPatches: array of { before, after } for replacing text in the DOCX. Include at least 1 patch for the RESUME summary paragraph.",
              "  Use exact 'before' strings copied from RESUME text; 'after' is the optimized replacement.",
              "RESUME:",
              resumeText,
              "JOB:",
              jobText,
            ].join("\n")

            if (provider === "anthropic") {
              const anthropicRequest = {
                // Cheap + broadly available model
                model: "claude-3-haiku-20240307",
                max_tokens: 900,
                temperature: 0.2,
                system:
                  "You are a senior HR recruiter. You tailor resumes to job descriptions for ATS. Use the tool to return structured output.",
                tools: [
                  {
                    name: "tailor_job",
                    description:
                      "Return a structured ATS-focused brief and resume tailoring notes based on the job description.",
                    input_schema: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        summary: { type: "string" },
                        mustHaves: { type: "array", items: { type: "string" } },
                        niceToHaves: { type: "array", items: { type: "string" } },
                        keywords: { type: "array", items: { type: "string" } },
                        resumeHeadline: { type: "string" },
                        resumeSummary: { type: "string" },
                        suggestedBullets: { type: "array", items: { type: "string" } },
                        tailoredResume: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            headline: { type: "string" },
                            summary: { type: "string" },
                            skills: { type: "array", minItems: 8, items: { type: "string" } },
                            experienceBullets: { type: "array", minItems: 6, items: { type: "string" } },
                          },
                          required: ["headline", "summary", "skills", "experienceBullets"],
                        },
                        beforeAfter: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            summary: {
                              type: "object",
                              additionalProperties: false,
                              properties: {
                                before: { type: "string" },
                                after: { type: "string" },
                              },
                              required: ["before", "after"],
                            },
                          },
                          required: ["summary"],
                        },
                        docxPatches: {
                          type: "array",
                          minItems: 1,
                          items: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                              before: { type: "string" },
                              after: { type: "string" },
                            },
                            required: ["before", "after"],
                          },
                        },
                        changeLogApplied: { type: "array", items: { type: "string" } },
                        nextEditsRecommended: { type: "array", items: { type: "string" } },
                      },
                      required: [
                        "title",
                        "summary",
                        "mustHaves",
                        "niceToHaves",
                        "keywords",
                        "resumeHeadline",
                        "resumeSummary",
                        "suggestedBullets",
                        "tailoredResume",
                        "beforeAfter",
                        "docxPatches",
                        "changeLogApplied",
                        "nextEditsRecommended",
                      ],
                    },
                  },
                ],
                tool_choice: { type: "tool", name: "tailor_job" },
                messages: [{ role: "user", content: prompt }],
              }

              const retryDelays = [250, 750, 1500]
              let upstream: Response | null = null
              let payload: any = null

              for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
                upstream = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": token,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify(anthropicRequest),
                })

                payload = (await upstream.json().catch(() => null)) as any

                const overloaded =
                  upstream.status === 529 ||
                  upstream.status === 503 ||
                  payload?.error?.type === "overloaded_error" ||
                  String(payload?.error?.message ?? "").toLowerCase().includes("overloaded")

                if (upstream.ok || !overloaded || attempt === retryDelays.length) break

                await sleep(retryDelays[attempt])
              }

              if (!upstream || !upstream.ok) {
                const status = upstream?.status ?? 500
                const msg = payload?.error?.message || payload?.message || `AI error (${status})`
                res.statusCode = status
                res.setHeader("Content-Type", "application/json")
                res.end(JSON.stringify({ error: String(msg) }))
                return
              }

              const blocks = Array.isArray(payload?.content) ? payload.content : []
              const toolUse = blocks.find((b: any) => b && b.type === "tool_use" && b.name === "tailor_job")
              const input = toolUse?.input
              if (!input || typeof input !== "object") {
                res.statusCode = 500
                res.setHeader("Content-Type", "application/json")
                res.end(JSON.stringify({ error: "Anthropic tool response missing" }))
                return
              }

              const text = JSON.stringify(ensureDocxPatches(input, resumeText))

              res.statusCode = 200
              res.setHeader("Content-Type", "application/json")
              res.end(
                JSON.stringify({
                  choices: [{ message: { content: text } }],
                })
              )
              return
            }

            const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0.2,
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a senior HR recruiter. You tailor resumes to job descriptions for ATS. Return ONLY valid JSON.",
                  },
                  { role: "user", content: prompt },
                ],
                response_format: { type: "json_object" },
              }),
            })

            const text = await upstream.text()
            if (!upstream.ok) {
              res.statusCode = upstream.status
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: text || `AI error (${upstream.status})` }))
              return
            }

            // Ensure docxPatches exists (fallback from beforeAfter.summary or first resume block)
            try {
              const data = JSON.parse(text)
              const content = data?.choices?.[0]?.message?.content
              if (typeof content === "string") {
                const obj = ensureDocxPatches(JSON.parse(content), resumeText)
                data.choices[0].message.content = JSON.stringify(obj)
              }
              res.statusCode = 200
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify(data))
              return
            } catch {
              // If anything fails, pass through
            }

            res.statusCode = 200
            res.setHeader("Content-Type", "application/json")
            res.end(text)
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: err?.message ?? "Server error" }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
