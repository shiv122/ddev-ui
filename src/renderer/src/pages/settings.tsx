import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  FolderSearch,
  HelpCircle,
  PencilRuler,
  Rocket,
  Save,
  Settings2,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'
import type { EditorPreset } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useAppSettings,
  useBinaries,
  useEditorStatus,
  useGlobalConfig,
  useLoginItem
} from '@/api/hooks'
import { invalidateAfterBinaryChange, queryClient, queryKeys } from '@/lib/query-client'
import { runOperation, useOperations } from '@/store/operations'

function Help({ text }: { text: string }): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help text-muted-foreground/60 transition-colors hover:text-foreground">
          <HelpCircle className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty">{text}</TooltipContent>
    </Tooltip>
  )
}

export function SettingsPage(): React.JSX.Element {
  const config = useGlobalConfig()
  const operations = useOperations()
  const busy = operations.some((o) => o.status === 'running' && o.request.kind === 'global-config')

  const [performanceMode, setPerformanceMode] = useState('none')
  const [instrumentation, setInstrumentation] = useState(false)
  const [httpPort, setHttpPort] = useState('80')
  const [httpsPort, setHttpsPort] = useState('443')

  // Seed local state whenever a fresh global config arrives.
  useEffect(() => {
    if (config.data) {
      setPerformanceMode(config.data.performance_mode)
      setInstrumentation(config.data.instrumentation_opt_in)
      setHttpPort(config.data.router_http_port)
      setHttpsPort(config.data.router_https_port)
    }
  }, [config.data])

  if (config.isLoading || !config.data) {
    return (
      <div className="mx-auto w-full max-w-[1000px] space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  const portsChanged =
    httpPort !== config.data.router_http_port || httpsPort !== config.data.router_https_port
  const dirty =
    performanceMode !== config.data.performance_mode ||
    instrumentation !== config.data.instrumentation_opt_in ||
    portsChanged

  const apply = (): void => {
    void runOperation({
      kind: 'global-config',
      flags: {
        ...(performanceMode !== config.data!.performance_mode ? { performanceMode } : {}),
        ...(instrumentation !== config.data!.instrumentation_opt_in
          ? { instrumentationOptIn: instrumentation }
          : {}),
        ...(httpPort !== config.data!.router_http_port ? { routerHttpPort: httpPort } : {}),
        ...(httpsPort !== config.data!.router_https_port ? { routerHttpsPort: httpsPort } : {})
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div>
        <h1 className="text-metallic flex items-center gap-2 text-[26px] font-bold tracking-tight">
          <Settings2 className="size-6 text-foreground/80" /> Global settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Machine-wide DDEV defaults — applies to every project (`ddev config global`).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Performance mode</Label>
                <Help text="Default file-sync strategy for all projects. Mutagen is strongly recommended on macOS. Projects can override it individually." />
              </div>
              <Select value={performanceMode} onValueChange={setPerformanceMode} disabled={busy}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="mutagen">Mutagen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="instrumentation" className="text-sm font-normal">
                  Share anonymous usage data
                </Label>
                <Help text="Opt-in telemetry that helps the DDEV maintainers prioritize work. No project data is sent." />
              </div>
              <Switch
                id="instrumentation"
                checked={instrumentation}
                onCheckedChange={setInstrumentation}
                disabled={busy}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Router ports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid max-w-md grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">HTTP port</Label>
                <Help text="Host port the ddev router binds for http:// URLs. Change if something else (Apache, another proxy) already owns port 80." />
              </div>
              <Input value={httpPort} onChange={(e) => setHttpPort(e.target.value)} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">HTTPS port</Label>
                <Help text="Host port for https:// URLs (default 443)." />
              </div>
              <Input value={httpsPort} onChange={(e) => setHttpsPort(e.target.value)} disabled={busy} />
            </div>
          </div>
          {portsChanged && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                Port changes affect every project URL and take effect after{' '}
                <code>ddev poweroff</code> (sidebar) and starting a project again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="sheen gap-1.5" disabled={!dirty || busy} onClick={apply}>
          <Save className="size-3.5" /> Apply global settings
        </Button>
      </div>

      {window.ddev.platform !== 'linux' && <GeneralCard />}
      <EditorCard />
      <BinaryLocationsCard />
    </div>
  )
}

/** App-level preferences that aren't DDEV settings (stored by the OS / userData). */
function GeneralCard(): React.JSX.Element {
  const loginItem = useLoginItem()

  const toggle = (open: boolean): void => {
    void window.ddev.setLoginItem(open).then((next) => {
      queryClient.setQueryData(queryKeys.loginItem, next)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="size-4 text-foreground/80" /> General
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="login-item" className="text-sm font-normal">
              Launch DDevUI at login
            </Label>
            <Help text="Start DDevUI automatically when you sign in, so the menu-bar tray and live project status are always available." />
          </div>
          <Switch
            id="login-item"
            checked={loginItem.data ?? false}
            onCheckedChange={toggle}
            disabled={loginItem.isLoading}
          />
        </div>
      </CardContent>
    </Card>
  )
}

const EDITOR_OPTIONS: Array<{ value: EditorPreset; label: string }> = [
  { value: 'auto', label: 'Auto-detect (VS Code, then Cursor)' },
  { value: 'code', label: 'VS Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'webstorm', label: 'WebStorm' },
  { value: 'phpstorm', label: 'PhpStorm' },
  { value: 'subl', label: 'Sublime Text' },
  { value: 'zed', label: 'Zed' },
  { value: 'custom', label: 'Custom command…' }
]

const EDITOR_SETUP: Record<'mac' | 'win' | 'linux', { example: string; note: string }> = {
  mac: {
    example: 'code · subl · open -a "MacVim" · /opt/homebrew/bin/nvim',
    note: 'Presets launch the app with `open -a`, so no CLI setup is needed — just install the app. For a custom editor, type a command or click Browse to pick an app (.app) or binary.'
  },
  win: {
    example: 'code · subl · "C:\\Program Files\\Editor\\editor.exe" {path}',
    note: 'Your editor’s CLI must be on PATH (VS Code installs `code` automatically). For a custom editor, enter the command or Browse to its .exe.'
  },
  linux: {
    example: 'code · subl · /usr/bin/nvim · flatpak run com.visualstudio.code {path}',
    note: 'Your editor’s CLI must be on PATH (`code`, `subl`, …). For a custom editor, enter the command or Browse to the binary.'
  }
}

function cleanError(err: unknown): string {
  return err instanceof Error
    ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    : String(err)
}

function EditorCard(): React.JSX.Element {
  const settings = useAppSettings()
  const status = useEditorStatus()
  const [preset, setPreset] = useState<EditorPreset>('auto')
  const [command, setCommand] = useState('')
  const [testing, setTesting] = useState(false)

  const platform = window.ddev.platform
  const setup =
    platform === 'darwin' ? EDITOR_SETUP.mac : platform === 'win32' ? EDITOR_SETUP.win : EDITOR_SETUP.linux

  useEffect(() => {
    if (settings.data) {
      setPreset(settings.data.editorPreset)
      setCommand(settings.data.editorCommand)
    }
  }, [settings.data])

  const persist = (next: { editorPreset?: EditorPreset; editorCommand?: string }): void => {
    void window.ddev
      .setAppSettings(next)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.appSettings })
        void queryClient.invalidateQueries({ queryKey: queryKeys.editorStatus })
      })
      .catch((err) => toast.error('Could not save editor setting', { description: cleanError(err) }))
  }

  const browse = async (): Promise<void> => {
    const picked = await window.ddev.selectFile({ title: 'Choose your editor application or binary' })
    if (!picked) return
    const cmd =
      platform === 'darwin' && picked.endsWith('.app')
        ? `open -a "${picked}"`
        : picked.includes(' ')
          ? `"${picked}"`
          : picked
    setPreset('custom')
    setCommand(cmd)
    persist({ editorPreset: 'custom', editorCommand: cmd })
  }

  const test = (): void => {
    setTesting(true)
    void window.ddev
      .testEditor()
      .then(() =>
        toast.success('Launched your editor', { description: 'Opened your home folder as a test.' })
      )
      .catch((err) => toast.error('Could not open editor', { description: cleanError(err) }))
      .finally(() => setTesting(false))
  }

  const ok = status.data?.ok

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PencilRuler className="size-4" /> Editor
          <Help text='Which editor "Open in editor" launches for a project folder.' />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Default editor</Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                const next = v as EditorPreset
                setPreset(next)
                persist({ editorPreset: next })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs">Custom command</Label>
                <Help
                  text={
                    'Command run with the project folder. Add {path} to control where the folder is inserted, otherwise it is appended. Examples: code --reuse-window {path}, open -a Sublime Text, /usr/bin/nvim.'
                  }
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={setup.example.split(' · ')[0]}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onBlur={() => persist({ editorCommand: command })}
                  className="font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5"
                  onClick={() => void browse()}
                >
                  <FolderSearch className="size-3.5" /> Browse…
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* live status + test */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2">
            {ok === undefined ? (
              <span className="size-3.5 shrink-0" />
            ) : ok ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            )}
            <span className="min-w-0 text-xs text-muted-foreground">
              {status.data?.detail ?? 'Checking editor…'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs"
            disabled={testing}
            onClick={test}
          >
            <FlaskConical className="size-3" /> Test
          </Button>
        </div>

        {/* per-OS setup help */}
        <p className="text-xs leading-relaxed text-muted-foreground">{renderHint(setup.note)}</p>
      </CardContent>
    </Card>
  )
}

/** Render text with `code` spans as inline code. */
function renderHint(text: string): React.ReactNode {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <code
        key={i}
        className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[10px] text-foreground/90"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function BinaryLocationsCard(): React.JSX.Element {
  const binaries = useBinaries()

  const handle = async (action: Promise<unknown>): Promise<void> => {
    try {
      await action
      invalidateAfterBinaryChange()
    } catch (err) {
      toast.error('Could not use that file', {
        description:
          err instanceof Error
            ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
            : String(err)
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Binary locations
          <Help text="DDevUI finds ddev and docker via your login-shell PATH plus common install locations. If detection fails (custom installs, unusual shells), point it at the binary directly — the override is saved and also passed to ddev so it finds the same docker." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(binaries.data ?? []).map((bin) => (
          <div
            key={bin.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{bin.name}</span>
                {bin.override && (
                  <span className="rounded-full border border-foreground/25 bg-foreground/[0.06] px-2 py-0.5 text-[10px] text-foreground/80">
                    manual
                  </span>
                )}
                {!bin.resolved && (
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                    not found
                  </span>
                )}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground" title={bin.resolved ?? ''}>
                {bin.resolved ?? 'auto-detection failed'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => void handle(window.ddev.pickBinary(bin.name))}
              >
                <FolderSearch className="size-3" /> Browse…
              </Button>
              {bin.override && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => void handle(window.ddev.clearBinaryOverride(bin.name))}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
