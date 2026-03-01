import { useEffect, useState } from "react"
import type { AiProvider } from "@/lib/ai"

type Props = {
  provider: AiProvider
  onProviderChange: (provider: AiProvider) => void
  token: string
  onTokenChange: (token: string) => void
}

export function AiTokenCard(props: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(false)
  }, [])

  return (
    <div className="rounded-md border border-neutral-800 bg-black p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="text-xs text-neutral-500">AI</div>
        <div className="flex items-center gap-2">
          <select
            value={props.provider}
            onChange={(e) => props.onProviderChange(e.target.value as AiProvider)}
            className="h-10 min-w-[132px] rounded-md border border-neutral-800 bg-black px-3 text-sm text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            aria-label="AI provider"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input
            value={props.token}
            onChange={(e) => props.onTokenChange(e.target.value)}
            type={show ? "text" : "password"}
            placeholder={props.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            className="h-10 w-full rounded-md border border-neutral-800 bg-black px-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-md bg-transparent px-4 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  )
}
