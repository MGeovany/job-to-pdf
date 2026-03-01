export type AiRefactor = {
  title: string
  summary: string
  mustHaves: string[]
  niceToHaves: string[]
  keywords: string[]
}

export type AiProvider = "openai" | "anthropic"

export async function refactorJobWithAi(
  provider: AiProvider,
  token: string,
  jobText: string
): Promise<AiRefactor> {
  const resp = await fetch("/api/ai/refactor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, token, jobText }),
  })

  const data = (await resp.json().catch(() => null)) as any
  if (!resp.ok) {
    throw new Error(String(data?.error ?? "AI request failed"))
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") throw new Error("AI response missing")

  const parsed = JSON.parse(content) as AiRefactor
  return {
    title: String((parsed as any).title ?? ""),
    summary: String((parsed as any).summary ?? ""),
    mustHaves: Array.isArray((parsed as any).mustHaves)
      ? (parsed as any).mustHaves.map(String)
      : [],
    niceToHaves: Array.isArray((parsed as any).niceToHaves)
      ? (parsed as any).niceToHaves.map(String)
      : [],
    keywords: Array.isArray((parsed as any).keywords)
      ? (parsed as any).keywords.map(String)
      : [],
  }
}
