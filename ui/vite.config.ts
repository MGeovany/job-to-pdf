import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"

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

            if (!token) {
              res.statusCode = 400
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "Missing token" }))
              return
            }

            const prompt = [
              "Convert this job description into a brief with:",
              "- title: string (short)",
              "- summary: string (2-4 sentences)",
              "- mustHaves: 5-10 bullets",
              "- niceToHaves: 3-8 bullets",
              "- keywords: 10-20 single tokens/phrases",
              "- resumeHeadline: string (single line, ATS-friendly)",
              "- resumeSummary: string (3-5 lines, keyword-dense, recruiter tone)",
              "- suggestedBullets: 6-10 bullets (resume-ready, quantified where possible)",
              "- changeLogApplied: 2-6 bullets (what was changed in the generated PDF output)",
              "- nextEditsRecommended: 4-10 bullets (what to edit in the resume next)",
              "Rules:",
              "- Output JSON only.",
              "- No markdown.",
              "- Keep bullets concise.",
              "- Do NOT include the full job description in any field.",
              "- Act as a senior HR recruiter optimizing for ATS and relevance.",
              "JOB:",
              jobText,
            ].join("\n")

            if (provider === "anthropic") {
              const upstream = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": token,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-3-5-haiku-latest",
                  max_tokens: 900,
                  temperature: 0.2,
                  system:
                    "You are a senior HR recruiter. You tailor resumes to job descriptions for ATS. Return ONLY valid JSON.",
                  messages: [{ role: "user", content: prompt }],
                }),
              })

              const payload = (await upstream.json().catch(() => null)) as any
              if (!upstream.ok) {
                const msg = payload?.error?.message || payload?.message || `AI error (${upstream.status})`
                res.statusCode = upstream.status
                res.setHeader("Content-Type", "application/json")
                res.end(JSON.stringify({ error: String(msg) }))
                return
              }

              const textBlocks = Array.isArray(payload?.content) ? payload.content : []
              const text = textBlocks
                .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
                .map((b: any) => b.text)
                .join("\n")

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
