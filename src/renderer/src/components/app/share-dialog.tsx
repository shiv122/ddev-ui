import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Globe2, Share2, Square, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useDoctor } from '@/api/hooks'
import {
  cancelOperation,
  runOperation,
  useOperationLines,
  useOperations
} from '@/store/operations'

type Provider = 'ngrok' | 'cloudflared'

/** Extract the public tunnel URL from provider output lines. */
function findPublicUrl(lines: Array<{ text: string }>): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i].text
    const byKey = text.match(/url=(https:\/\/\S+)/)
    if (byKey) return byKey[1]
    const byDomain = text.match(
      /(https:\/\/[a-z0-9][a-z0-9-]*\.(?:trycloudflare\.com|ngrok-free\.(?:app|dev)|ngrok\.(?:app|dev|io))\S*)/i
    )
    if (byDomain) return byDomain[1]
  }
  return null
}

function SetupInstructions(): React.JSX.Element {
  const copy = (cmd: string): void => {
    void navigator.clipboard.writeText(cmd)
    toast.success('Command copied')
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Sharing needs a tunnel provider on your machine — it's entirely optional and nothing else
        in DDevUI depends on it. Install one, then come back here:
      </p>
      {[
        { name: 'ngrok', cmd: 'brew install ngrok', extra: 'then add your free authtoken: ngrok config add-authtoken <token>' },
        { name: 'cloudflared', cmd: 'brew install cloudflared', extra: 'no account needed for quick tunnels' }
      ].map((p) => (
        <div key={p.name} className="rounded-lg border border-border/70 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.name}</span>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => copy(p.cmd)}>
              <Copy className="size-3" /> {p.cmd}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{p.extra}</p>
        </div>
      ))}
      <button
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => void window.ddev.openExternal('https://docs.ddev.com/en/stable/users/topics/sharing/')}
      >
        ddev sharing docs ↗
      </button>
    </div>
  )
}

export function ShareDialog({ info }: { info: DdevDescribe }): React.JSX.Element {
  const doctor = useDoctor()
  const operations = useOperations()
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [providerArgs, setProviderArgs] = useState('')
  const [copied, setCopied] = useState(false)

  const tunnelCheck = doctor.data?.checks.find((c) => c.id === 'tunnel')
  const available: Provider[] = useMemo(() => {
    if (!tunnelCheck?.ok) return []
    const found: Provider[] = []
    if (tunnelCheck.detail.includes('ngrok')) found.push('ngrok')
    if (tunnelCheck.detail.includes('cloudflared')) found.push('cloudflared')
    return found
  }, [tunnelCheck])

  const activeProvider = provider ?? available[0] ?? 'ngrok'
  const running = info.status === 'running'

  const shareOp = operations.find(
    (o) =>
      o.status === 'running' && o.request.kind === 'share' && o.request.project === info.name
  )
  const lines = useOperationLines(shareOp?.id ?? null)
  const publicUrl = shareOp ? findPublicUrl(lines) : null

  const start = (): void => {
    void runOperation({
      kind: 'share',
      project: info.name,
      provider: activeProvider,
      providerArgs: providerArgs.trim() || undefined
    })
  }

  const copyUrl = (): void => {
    if (!publicUrl) return
    void navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-1.5" disabled={!running && !shareOp}>
              {shareOp ? (
                <LoaderCircle animate loop className="size-3.5 text-success" />
              ) : (
                <Share2 className="size-3.5" />
              )}
              Share
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {running || shareOp ? 'Share this project on the internet' : 'Start the project to share it'}
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe2 className="size-4" /> Share {info.name}
          </DialogTitle>
          <DialogDescription>
            Expose this project at a temporary public URL via `ddev share`.
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <SetupInstructions />
        ) : shareOp ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-black/30 p-4">
              {publicUrl ? (
                <div className="flex items-center gap-2">
                  <button
                    className="min-w-0 flex-1 truncate text-left font-mono text-sm text-foreground underline-offset-2 hover:underline"
                    onClick={() => void window.ddev.openExternal(publicUrl)}
                    title={publicUrl}
                  >
                    {publicUrl}
                  </button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={copyUrl}>
                    {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => void window.ddev.openExternal(publicUrl)}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle animate loop className="size-4" /> Establishing tunnel…
                </div>
              )}
            </div>
            <div className="dark scrollbar-thin max-h-32 overflow-auto rounded-lg border bg-[#101010] p-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {lines.slice(-12).map((l, i) => (
                <div key={i} className="truncate">
                  {l.text}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Tunnel stays open until stopped or the app quits.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => cancelOperation(shareOp.id)}
              >
                <Square className="size-3.5" /> Stop sharing
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={activeProvider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provider args (optional)</Label>
                <Input
                  value={providerArgs}
                  onChange={(e) => setProviderArgs(e.target.value)}
                  placeholder={
                    activeProvider === 'ngrok' ? '--basic-auth user:pass1234' : '--hostname my.example.com'
                  }
                  className="font-mono text-xs"
                />
              </div>
            </div>
            {activeProvider === 'ngrok' && (
              <p className="text-xs text-muted-foreground">
                ngrok needs a free account token once:{' '}
                <code className="text-foreground/80">ngrok config add-authtoken &lt;token&gt;</code>
              </p>
            )}
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                Your local site becomes reachable by anyone with the URL. Avoid sharing projects
                containing sensitive data, or protect it (e.g. ngrok `--basic-auth`).
              </p>
            </div>
            <div className="flex justify-end">
              <Button className="sheen gap-1.5" onClick={start}>
                <Share2 className="size-3.5" /> Start sharing
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
