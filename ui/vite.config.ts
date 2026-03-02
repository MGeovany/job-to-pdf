import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-ai-proxy",
      configureServer(server: ViteDevServer) {
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
                            skills: { type: "array", items: { type: "string" } },
                            experienceBullets: { type: "array", items: { type: "string" } },
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

              const text = JSON.stringify(input)

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
