export type ParsedResume = {
  name: string
  contactLine?: string
  skills: string[]
  bullets: string[]
}

function isLikelyHeading(line: string) {
  const t = line.trim()
  if (!t) return false
  if (t.length > 48) return false
  return /^[A-Z0-9][A-Z0-9 &/._-]{2,}$/.test(t)
}

function splitLines(raw: string) {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
}

export function parseResume(rawText: string): ParsedResume {
  const lines = splitLines(rawText)
  const nonEmpty = lines.filter((l) => l.trim())
  const name = (nonEmpty[0] ?? "").trim()

  const second = (nonEmpty[1] ?? "").trim()
  const contactLine =
    second && /@|linkedin|github|\+?\d[\d()\s.-]{7,}/i.test(second) ? second : undefined

  // Skills: capture up to 6 lines after a SKILLS heading
  const skills: string[] = []
  const headingIdx = lines.findIndex((l) => /\b(technical\s+skills|skills)\b/i.test(l))
  if (headingIdx >= 0) {
    for (let i = headingIdx + 1; i < Math.min(lines.length, headingIdx + 10); i++) {
      const t = lines[i].trim()
      if (!t) break
      if (isLikelyHeading(t)) break
      skills.push(t)
      if (skills.length >= 6) break
    }
  }

  // Bullets: gather bullet-like lines
  const bullets = lines
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, ""))
    .slice(0, 14)

  return {
    name,
    contactLine,
    skills,
    bullets,
  }
}
