import { Button } from "@/components/Button"

type Props = {
  token: string
  setToken: (v: string) => void
  show: boolean
  setShow: (v: boolean) => void
}

export function AiTokenPanel(props: Props) {
  return (
    <div class="mb-4 grid grid-cols-1 gap-2 rounded-md border border-neutral-800 bg-black p-3 md:grid-cols-2">
      <div class="text-xs text-neutral-500">AI token (stored locally)</div>
      <div class="flex items-center gap-2">
        <input
          value={props.token}
          onInput={(e) => props.setToken(e.currentTarget.value)}
          type={props.show ? "text" : "password"}
          placeholder="sk-..."
          class="h-8 w-full rounded-md border border-neutral-800 bg-black px-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-700 focus-visible:outline-offset-2"
          autocomplete="off"
          spellcheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-8 px-3"
          onClick={() => props.setShow(!props.show)}
        >
          {props.show ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  )
}
