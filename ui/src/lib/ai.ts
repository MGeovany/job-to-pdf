export type AiRefactor = {
  title: string
  summary: string
  mustHaves: string[]
  niceToHaves: string[]
  keywords: string[]

  resumeHeadline: string
  resumeSummary: string
  suggestedBullets: string[]

  tailoredResume: {
    headline: string
    summary: string
    skills: string[]
    experienceBullets: string[]
  }

  beforeAfter: {
    summary: {
      before: string
      after: string
    }
  }

  changeLogApplied: string[]
  nextEditsRecommended: string[]
}

export type AiProvider = "openai" | "anthropic"

export async function refactorJobWithAi(
  provider: AiProvider,
  token: string,
  jobText: string,
  resumeText: string
): Promise<AiRefactor> {
  const resp = await fetch("/api/ai/refactor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, token, jobText, resumeText }),
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
    resumeHeadline: String((parsed as any).resumeHeadline ?? ""),
    resumeSummary: String((parsed as any).resumeSummary ?? ""),
    suggestedBullets: Array.isArray((parsed as any).suggestedBullets)
      ? (parsed as any).suggestedBullets.map(String)
      : [],
    tailoredResume: {
      headline: String((parsed as any).tailoredResume?.headline ?? ""),
      summary: String((parsed as any).tailoredResume?.summary ?? ""),
      skills: Array.isArray((parsed as any).tailoredResume?.skills)
        ? (parsed as any).tailoredResume.skills.map(String)
        : [],
      experienceBullets: Array.isArray((parsed as any).tailoredResume?.experienceBullets)
        ? (parsed as any).tailoredResume.experienceBullets.map(String)
        : [],
    },
    beforeAfter: {
      summary: {
        before: String((parsed as any).beforeAfter?.summary?.before ?? ""),
        after: String((parsed as any).beforeAfter?.summary?.after ?? ""),
      },
    },
    changeLogApplied: Array.isArray((parsed as any).changeLogApplied)
      ? (parsed as any).changeLogApplied.map(String)
      : [],
    nextEditsRecommended: Array.isArray((parsed as any).nextEditsRecommended)
      ? (parsed as any).nextEditsRecommended.map(String)
      : [],
  }
}
