import { useEffect, useState } from 'react'
import { AlertTriangle, HelpCircle, Save, Settings2 } from 'lucide-react'
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
import { useGlobalConfig } from '@/api/hooks'
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
    </div>
  )
}
