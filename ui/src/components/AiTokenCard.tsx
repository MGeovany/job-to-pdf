import { useState } from "react"
import type { AiProvider } from "@/lib/ai"

type Props = {
  provider: AiProvider
  onProviderChange: (provider: AiProvider) => void
  token: string
  onTokenChange: (token: string) => void
}

export function AiTokenCard(props: Props) {
  const [show, setShow] = useState(false)

  return (
    <div className="rounded-md border border-neutral-800 bg-black p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">AI</div>
        <div className="text-[11px] text-neutral-600">Token stored locally</div>
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <select
          value={props.provider}
          onChange={(e) => props.onProviderChange(e.target.value as AiProvider)}
          className="h-10 w-full shrink-0 rounded-md border border-neutral-800 bg-black px-3 text-sm text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2 md:w-[160px]"
          aria-label="AI provider"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>

        <div className="flex w-full min-w-0 items-center gap-2">
          <input
            value={props.token}
            onChange={(e) => props.onTokenChange(e.target.value)}
            type={show ? "text" : "password"}
            placeholder={props.provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            className="h-10 min-w-0 flex-1 rounded-md border border-neutral-800 bg-black px-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-black px-4 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
            onClick={() => setShow((v) => !v)}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
    </div>
  )
}
