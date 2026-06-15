import { useState } from 'react'
import {
  ChevronDown,
  Copy,
  Database,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Gauge,
  Globe,
  HardDrive,
  Mail,
  Network,
  Play,
  Plus,
  RotateCw,
  ScrollText,
  Server,
  Square,
  TerminalSquare
} from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe, DdevServiceInfo, ServiceAction } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useResourceLimits, useServiceConfig } from '@/api/hooks'
import { AddServiceDialog } from '@/components/app/add-service-dialog'
import { runOperation, useOperations } from '@/store/operations'

function stripIpcPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function openInEditor(path: string): void {
  window.ddev.openInEditor(path).catch((err: Error) => {
    toast.error('Could not open editor', { description: stripIpcPrefix(err.message) })
  })
}

function copy(text: string, label: string): void {
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`)
}

function isHealthy(status?: string): boolean {
  return status === 'running' || (status?.includes('healthy') ?? false)
}

/** Compact icon-only action with a tooltip, used in the card toolbar. */
function IconAction({
  tip,
  onClick,
  disabled,
  dot,
  children
}: {
  tip: string
  onClick: () => void
  disabled?: boolean
  dot?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-7 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
        >
          {children}
          {dot && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

/** A best-effort icon for well-known service names. */
function serviceIcon(name: string): React.ComponentType<{ className?: string }> {
  if (name === 'web') return Globe
  if (name === 'db') return Database
  if (/redis|memcache|valkey/.test(name)) return HardDrive
  if (/mail|mailpit|mailhog/.test(name)) return Mail
  if (/phpmyadmin|pma|adminer/.test(name)) return Database
  return Server
}

/* ---------- connection endpoints ---------- */

function Endpoints({ svc }: { svc: DdevServiceInfo }): React.JSX.Element {
  const webUrls = [svc.https_url, svc.http_url].filter(Boolean) as string[]
  const ports = svc.host_ports_mapping ?? []

  if (webUrls.length === 0 && ports.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Internal only. Reachable from other containers as{' '}
        <code className="text-foreground/70">{svc.full_name?.replace(/^ddev-/, '') ?? 'service'}</code>.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {webUrls.map((url) => (
        <button
          key={url}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-primary hover:bg-accent"
          onClick={() => void window.ddev.openExternal(url)}
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="truncate">{url}</span>
        </button>
      ))}
      {ports.map((p) => {
        const hostAddr = `127.0.0.1:${p.host_port}`
        return (
          <div
            key={`${p.exposed_port}-${p.host_port}`}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Network className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[13px]">{hostAddr}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                → container :{p.exposed_port}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 gap-1 px-1.5 text-[11px]"
              onClick={() => copy(hostAddr, 'address')}
            >
              <Copy className="size-3" /> Copy
            </Button>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- compose configuration (lazy) ---------- */

function ComposeSection({
  project,
  service,
  ddevDir,
  expanded
}: {
  project: string
  service: string
  ddevDir: string
  expanded: boolean
}): React.JSX.Element {
  const cfg = useServiceConfig(project, service, expanded)

  if (cfg.isLoading || !cfg.data) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Reading compose config…</p>
  }

  const { rendered, overrideFiles } = cfg.data

  return (
    <div className="space-y-2.5 pt-1">
      {overrideFiles.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Editable override files
          </p>
          {overrideFiles.map((f) => (
            <div
              key={f}
              className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs">{f}</span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openInEditor(`${ddevDir}/${f}`)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void window.ddev.revealPath(`${ddevDir}/${f}`)}
                >
                  Reveal
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rendered ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Rendered compose (read-only)
          </p>
          <pre className="dark scrollbar-thin max-h-72 overflow-auto rounded-lg border bg-[#101010] p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
            {rendered}
          </pre>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {overrideFiles.length === 0
            ? 'Built-in service with no override file. Start the project to view its rendered compose definition, or add a custom service from the Advanced tab.'
            : 'Start the project to view the rendered compose definition.'}
        </p>
      )}
    </div>
  )
}

/* ---------- per-service card ---------- */

function ServiceCard({
  info,
  name,
  svc,
  limit,
  onOpenService,
  onOpenTab
}: {
  info: DdevDescribe
  name: string
  svc: DdevServiceInfo
  limit?: { cpus: string; memory: string }
  onOpenService: (target: 'run' | 'logs', service: string) => void
  onOpenTab: (tab: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [opId, setOpId] = useState<string | null>(null)
  const operations = useOperations()
  const op = opId ? operations.find((o) => o.id === opId) : undefined
  const acting = op?.status === 'running'
  const runningAction =
    acting && op && op.request.kind === 'service-action' ? op.request.action : null
  const Icon = serviceIcon(name)
  const running = info.status === 'running'
  const healthy = isHealthy(svc.status)
  const up = !!svc.status && svc.status !== 'stopped' && svc.status !== 'exited'
  const ddevDir = `${info.approot}/.ddev`

  const act = (action: ServiceAction): void => {
    void runOperation({ kind: 'service-action', project: info.name, service: name, action }).then(
      (d) => d && setOpId(d.id)
    )
  }
  const limitLabel = [limit?.cpus && `${limit.cpus} CPU`, limit?.memory].filter(Boolean).join(' · ')

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-foreground/[0.04]">
              <Icon className="size-4 text-foreground/80" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{name}</span>
                {name === 'web' && (
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    primary
                  </Badge>
                )}
              </div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">{svc.image}</div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0',
              healthy ? 'border-success/40 bg-success/10 text-success' : 'text-muted-foreground'
            )}
          >
            <span
              className={cn(
                'mr-1.5 size-1.5 rounded-full',
                healthy ? 'bg-success' : 'bg-muted-foreground/50'
              )}
            />
            {svc.status || 'stopped'}
          </Badge>
        </div>

        {/* endpoints */}
        <Endpoints svc={svc} />

        {/* actions */}
        <div className="flex items-center gap-1 pt-0.5">
          {/* lifecycle */}
          {up ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={acting}
                onClick={() => act('restart')}
              >
                <RotateCw className={cn('size-3.5', runningAction === 'restart' && 'animate-spin')} />
                Restart
              </Button>
              <IconAction tip={`Stop ${name}`} disabled={acting} onClick={() => act('stop')}>
                <Square className="size-3.5" />
              </IconAction>
            </>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={acting}
              onClick={() => act('start')}
            >
              <Play className={cn('size-3.5', runningAction === 'start' && 'animate-pulse')} /> Start
            </Button>
          )}

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />

          {/* utilities */}
          <IconAction
            tip="Open shell"
            disabled={!running}
            onClick={() => onOpenService('run', name)}
          >
            <TerminalSquare className="size-3.5" />
          </IconAction>
          <IconAction tip="View logs" disabled={!running} onClick={() => onOpenService('logs', name)}>
            <ScrollText className="size-3.5" />
          </IconAction>
          <IconAction
            tip={limitLabel ? `Resource limits: ${limitLabel}` : 'Set resource limits'}
            dot={!!limitLabel}
            onClick={() => onOpenTab('resources')}
          >
            <Gauge className="size-3.5" />
          </IconAction>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1.5 px-2 text-xs"
            onClick={() => setOpen((v) => !v)}
          >
            <FileCode2 className="size-3.5" /> Config
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </Button>
        </div>

        {open && (
          <div className="border-t border-border/60">
            <ComposeSection
              project={info.name}
              service={name}
              ddevDir={ddevDir}
              expanded={open}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------- the tab ---------- */

export function ServicesTab({
  info,
  onOpenService,
  onOpenTab
}: {
  info: DdevDescribe
  onOpenService: (target: 'run' | 'logs', service: string) => void
  onOpenTab: (tab: string) => void
}): React.JSX.Element {
  const limits = useResourceLimits(info.name)
  const limitMap = new Map((limits.data ?? []).map((l) => [l.service, l]))
  const entries = Object.entries(info.services ?? {}).sort(([a], [b]) => {
    if (a === 'web') return -1
    if (b === 'web') return 1
    if (a === 'db') return -1
    if (b === 'db') return 1
    return a.localeCompare(b)
  })

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Server className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No containers. Start the project to see its services.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-1 gap-1.5"
            onClick={() => onOpenTab('addons')}
          >
            <FolderOpen className="size-3.5" /> Browse add-ons
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {entries.length} service{entries.length === 1 ? '' : 's'}. Open a service, shell in, tail
          its logs, set limits, or inspect its compose config.
        </p>
        <AddServiceDialog
          project={info.name}
          trigger={
            <Button variant="secondary" size="sm" className="shrink-0 gap-1.5 text-xs">
              <Plus className="size-3.5" /> Add a service
            </Button>
          }
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {entries.map(([name, svc]) => (
          <ServiceCard
            key={name}
            info={info}
            name={name}
            svc={svc}
            limit={limitMap.get(name)}
            onOpenService={onOpenService}
            onOpenTab={onOpenTab}
          />
        ))}
      </div>
    </div>
  )
}
