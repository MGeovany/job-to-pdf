import path from "path"
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    solid(),
    {
      name: "local-openai-proxy",
      configureServer(server) {
        server.middlewares.use("/api/ai/refactor", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ error: "Method not allowed" }))
            return
          }

          try {
            const chunks: Buffer[] = []
            await new Promise<void>((resolve, reject) => {
              req.on("data", (c) => chunks.push(Buffer.from(c)))
              req.on("end", () => resolve())
              req.on("error", reject)
            })
            const raw = Buffer.concat(chunks).toString("utf8")
            const body = JSON.parse(raw || "{}") as any
            const token = String(body.token ?? "").trim()
            const jobText = String(body.jobText ?? "")

            if (!token) {
              res.statusCode = 400
              res.setHeader("Content-Type", "application/json")
              res.end(JSON.stringify({ error: "Missing token" }))
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
