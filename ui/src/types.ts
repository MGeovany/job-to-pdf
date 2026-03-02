export type JobStatus = "idle" | "queued" | "running" | "done" | "error"
export type AiMode = "off" | "on"

export type JobPost = {
  id: string
  title: string
  content: string
  status: JobStatus
  aiMode: AiMode
  resultUrl?: string
  reportUrl?: string
  error?: string
}
