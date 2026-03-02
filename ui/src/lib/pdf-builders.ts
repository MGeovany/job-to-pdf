import { PDFDocument, StandardFonts } from "pdf-lib"
import type { AiRefactor } from "@/lib/ai"

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

export async function buildPdfPassthrough(resumePdf: File) {
  const bytes = await resumePdf.arrayBuffer()
  return new Blob([bytes], { type: "application/pdf" })
}

export async function buildTailoredCvPdf(ai: AiRefactor) {
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

  const ensureSpace = () => {
    if (y >= margin + lh) return
    page = outDoc.addPage([a4.width, a4.height])
    y = a4.height - margin
  }

  const drawLine = (text: string, size = body, bold = false) => {
    ensureSpace()
    page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
    y -= lh
  }

  const drawSection = (title: string) => {
    y -= 4
    drawLine(title, h2, true)
    y -= 2
  }

  const tr = ai.tailoredResume
  const headline = (tr?.headline || ai.resumeHeadline || "").trim()
  const summary = (tr?.summary || ai.resumeSummary || "").trim()
  const skills = (tr?.skills || []).map((s) => s.trim()).filter(Boolean)
  const bullets = (tr?.experienceBullets || ai.suggestedBullets || [])
    .map((b) => b.trim())
    .filter(Boolean)

  if (headline) {
    page.drawText(headline, { x: margin, y: y - h1, size: h1, font: fontBold })
    y -= h1 + 18
  }

  if (summary) {
    for (const line of wrap(summary, body)) drawLine(line || " ")
    y -= 10
  }

  if (skills.length) {
    drawSection("Skills")
    const line = skills.slice(0, 24).join("  ")
    for (const l of wrap(line, body)) drawLine(l || " ")
    y -= 10
  }

  if (bullets.length) {
    drawSection("Experience Highlights")
    for (const b of bullets.slice(0, 10)) {
      for (const l of wrap(`- ${b}`, body)) drawLine(l || " ")
    }
  }

  const bytes = await outDoc.save()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

export async function buildPdfWithAiBrief(_resumePdf: File, ai: AiRefactor) {
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

  const ensureSpace = () => {
    if (y >= margin + lh) return
    page = outDoc.addPage([a4.width, a4.height])
    y = a4.height - margin
  }

  const drawLine = (text: string, size = body, bold = false) => {
    ensureSpace()
    page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
    y -= lh
  }

  page.drawText("Tailored Resume Addendum", { x: margin, y: y - h1, size: h1, font: fontBold })
  y -= h1 + 18

  if (ai.resumeHeadline?.trim()) {
    drawLine(ai.resumeHeadline.trim(), h2, true)
    y -= 6
  }

  if (ai.resumeSummary?.trim()) {
    for (const line of wrap(ai.resumeSummary.trim(), body)) drawLine(line || " ")
    y -= 10
  }

  if (ai.suggestedBullets?.length) {
    drawLine("Suggested bullets", h2, true)
    for (const b of ai.suggestedBullets
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10)) {
      for (const line of wrap(`- ${b}`.trim(), body)) drawLine(line || " ")
    }
    y -= 10
  }

  if (ai.keywords?.length) {
    drawLine("ATS keywords", h2, true)
    const kw = ai.keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 24)
      .join("  ")
    for (const line of wrap(kw, body)) drawLine(line || " ")
  }

  const bytes = await outDoc.save()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}

export async function buildTailoringReportPdf(ai: AiRefactor) {
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

  const ensureSpace = () => {
    if (y >= margin + lh) return
    page = outDoc.addPage([a4.width, a4.height])
    y = a4.height - margin
  }

  const drawLine = (text: string, size = body, bold = false) => {
    ensureSpace()
    page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font })
    y -= lh
  }

  const drawBlock = (title: string, lines: string[]) => {
    if (!lines.length) return
    drawLine(title, h2, true)
    for (const l of lines) {
      for (const w of wrap(l, body)) drawLine(w || " ")
    }
    y -= 10
  }

  page.drawText("Tailoring Report", { x: margin, y: y - h1, size: h1, font: fontBold })
  y -= h1 + 18

  if (ai.title.trim()) {
    drawLine(`Target role: ${ai.title.trim()}`, body, true)
    y -= 6
  }

  drawBlock("ATS keyword pack", [
    ai.keywords
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 24)
      .join("  "),
  ].filter(Boolean) as string[])

  if (ai.resumeHeadline.trim()) {
    drawBlock("Suggested resume headline", [ai.resumeHeadline.trim()])
  }

  if (ai.resumeSummary.trim()) {
    drawBlock(
      "Suggested summary (paste into resume)",
      wrap(ai.resumeSummary.trim(), body).map((l) => l || " ")
    )
  }

  const before = ai.beforeAfter?.summary?.before?.trim()
  const after = ai.beforeAfter?.summary?.after?.trim()
  if (before || after) {
    drawBlock(
      "Summary before/after",
      [
        before ? `Before: ${before}` : "",
        after ? `After: ${after}` : "",
      ].filter(Boolean) as string[]
    )
  }

  drawBlock(
    "Suggested bullets (adapt to your experience)",
    ai.suggestedBullets
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((b) => `- ${b}`)
  )

  drawBlock(
    "Changes applied to generated PDF",
    ai.changeLogApplied
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((b) => `- ${b}`)
  )

  drawBlock(
    "Next edits recommended (to improve fit)",
    ai.nextEditsRecommended
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 12)
      .map((b) => `- ${b}`)
  )

  const bytes = await outDoc.save()
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([ab], { type: "application/pdf" })
}
