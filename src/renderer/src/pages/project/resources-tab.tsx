import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Activity, Cpu, Gauge, HelpCircle, MemoryStick, RotateCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe, ServiceResourceLimit } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useResourceLimits, useResourceStats } from '@/api/hooks'
import { formatBytes, formatTime } from '@/lib/format'
import { useResourceHistory } from '@/store/resource-history'
import { runOperation, useProjectBusy } from '@/store/operations'

interface Limit {
  cpus: string
  memory: string
}

const EMPTY_CHART_CONFIG: ChartConfig = {}
const BASELINE_SERVICES = ['web', 'db']

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

/** A headline live area chart for one metric (CPU% or memory bytes). */
function MetricChart({
  data,
  kind
}: {
  data: Array<{ t: number; value: number }>
  kind: 'cpu' | 'mem'
}): React.JSX.Element {
  const gradId = `res-grad-${kind}`
  const fmt = (v: number): string => (kind === 'cpu' ? `${v.toFixed(1)}%` : formatBytes(v))

  return (
    <ChartContainer config={EMPTY_CHART_CONFIG} className="aspect-auto h-[132px] w-full">
      <AreaChart data={data} margin={{ left: 2, right: 2, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" opacity={0.6} />
        <XAxis dataKey="t" hide />
        <YAxis hide domain={kind === 'cpu' ? [0, (max: number) => Math.max(100, max)] : [0, 'auto']} />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)' }}
          content={
            <ChartTooltipContent
              labelFormatter={(_label, payload) =>
                formatTime((payload?.[0]?.payload as { t?: number })?.t ?? 0)
              }
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {fmt(Number(value))}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--foreground)"
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

/** Tiny axis-less sparkline used in the per-service rows. */
function Sparkline({ data }: { data: Array<{ value: number }> }): React.JSX.Element {
  const gradId = `res-spark-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`
  return (
    <ChartContainer config={EMPTY_CHART_CONFIG} className="aspect-auto h-9 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 3, bottom: 3 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, (max: number) => Math.max(100, max)]} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--foreground)"
          strokeWidth={1.25}
          strokeOpacity={0.7}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function HeadlineCard({
  icon,
  label,
  current,
  running,
  hasData,
  children
}: {
  icon: React.ReactNode
  label: string
  current: string
  running: boolean
  hasData: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className="metal-card overflow-hidden">
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {icon} {label}
          </CardTitle>
          <span className="text-metallic text-2xl font-semibold tabular-nums leading-none">
            {running ? current : '—'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-1 pb-1">
        {running && hasData ? (
          children
        ) : (
          <div className="flex h-[132px] items-center justify-center text-xs text-muted-foreground/60">
            {running ? 'Collecting live data…' : 'Start the project to see live usage'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function normalize(limits: ServiceResourceLimit[]): Record<string, Limit> {
  const out: Record<string, Limit> = {}
  for (const l of limits) out[l.service] = { cpus: l.cpus, memory: l.memory }
  return out
}

export function ResourcesTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const busy = useProjectBusy(info.name)
  const running = info.status === 'running'
  const saved = useResourceLimits(info.name)
  useResourceStats(running ? [info.name] : [])
  const history = useResourceHistory(info.name)

  const cpuSeries = useMemo(() => history.map((s) => ({ t: s.t, value: s.cpuPercent })), [history])
  const memSeries = useMemo(() => history.map((s) => ({ t: s.t, value: s.memBytes })), [history])
  const latest = history.length ? history[history.length - 1] : undefined

  const serviceSpark = (svc: string): Array<{ value: number }> =>
    history.map((s) => ({ value: s.services[svc]?.cpuPercent ?? 0 }))

  // Services to expose: anything ddev reports, anything already constrained,
  // plus the always-present web/db baseline (so limits can be set while stopped).
  const services = useMemo(() => {
    const set = new Set<string>(BASELINE_SERVICES)
    for (const key of Object.keys(info.services ?? {})) set.add(key)
    for (const l of saved.data ?? []) set.add(l.service)
    return [...set].sort((a, b) => {
      if (a === 'web') return -1
      if (b === 'web') return 1
      return a.localeCompare(b)
    })
  }, [info.services, saved.data])

  const [limits, setLimits] = useState<Record<string, Limit>>({})
  const [restartAfter, setRestartAfter] = useState(true)

  useEffect(() => {
    if (saved.data) setLimits(normalize(saved.data))
  }, [saved.data])

  useEffect(() => {
    setRestartAfter(running)
  }, [running])

  const savedMap = useMemo(() => normalize(saved.data ?? []), [saved.data])
  const get = (svc: string): Limit => limits[svc] ?? { cpus: '', memory: '' }
  const set = (svc: string, patch: Partial<Limit>): void =>
    setLimits((prev) => ({ ...prev, [svc]: { ...get(svc), ...patch } }))

  const dirty = useMemo(() => {
    return services.some((svc) => {
      const cur = get(svc)
      const was = savedMap[svc] ?? { cpus: '', memory: '' }
      return cur.cpus.trim() !== was.cpus.trim() || cur.memory.trim() !== was.memory.trim()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, limits, savedMap])

  const activeLimitCount = services.filter(
    (s) => get(s).cpus.trim() || get(s).memory.trim()
  ).length

  const apply = (): void => {
    const payload: ServiceResourceLimit[] = services.map((service) => ({
      service,
      cpus: get(service).cpus.trim(),
      memory: get(service).memory.trim()
    }))
    void runOperation({ kind: 'set-resource-limits', project: info.name, limits: payload, restartAfter })
    toast.info(restartAfter ? 'Applying limits and restarting…' : 'Saving resource limits…')
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <HeadlineCard
          icon={<Cpu className="size-3.5" />}
          label="CPU"
          current={latest ? `${latest.cpuPercent.toFixed(0)}%` : '0%'}
          running={running}
          hasData={cpuSeries.length > 1}
        >
          <MetricChart data={cpuSeries} kind="cpu" />
        </HeadlineCard>
        <HeadlineCard
          icon={<MemoryStick className="size-3.5" />}
          label="Memory"
          current={latest ? formatBytes(latest.memBytes) : '0 MB'}
          running={running}
          hasData={memSeries.length > 1}
        >
          <MetricChart data={memSeries} kind="mem" />
        </HeadlineCard>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4" /> Per-service limits
            <Help text="Caps the CPU and memory each container may use. DDevUI writes these as a docker-compose.resources.yaml override in .ddev/ and they take effect on the next restart. Leave a field blank for no limit." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="hidden grid-cols-[minmax(0,1.1fr)_96px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <span>Service</span>
            <span className="flex items-center gap-1">
              <Activity className="size-3" /> CPU
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="size-3" /> Cores limit
            </span>
            <span className="flex items-center gap-1">
              <MemoryStick className="size-3" /> Memory limit
            </span>
          </div>

          {services.map((svc) => {
            const live = latest?.services[svc]
            const spark = serviceSpark(svc)
            return (
              <div
                key={svc}
                className="grid grid-cols-2 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/70 hover:bg-accent/30 md:grid-cols-[minmax(0,1.1fr)_96px_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {svc}
                    {info.services?.[svc] ? (
                      <span className="size-1.5 rounded-full bg-success" title="running" />
                    ) : null}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {running && live
                      ? `${live.cpuPercent.toFixed(0)}% · ${formatBytes(live.memBytes)}`
                      : running
                        ? 'measuring…'
                        : 'not running'}
                  </div>
                </div>

                <div className="hidden h-9 md:block">
                  {running && spark.length > 1 ? (
                    <Sparkline data={spark} />
                  ) : (
                    <div className="h-full" />
                  )}
                </div>

                <Input
                  inputMode="decimal"
                  placeholder="no limit"
                  aria-label={`${svc} CPU cores limit`}
                  value={get(svc).cpus}
                  onChange={(e) => set(svc, { cpus: e.target.value })}
                  disabled={busy}
                />
                <Input
                  placeholder="e.g. 1024M, 2g"
                  aria-label={`${svc} memory limit`}
                  value={get(svc).memory}
                  onChange={(e) => set(svc, { memory: e.target.value })}
                  disabled={busy}
                />
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5">
          <Switch checked={restartAfter} onCheckedChange={setRestartAfter} disabled={busy} />
          <span className="flex items-center gap-1.5 text-sm">
            <RotateCw className="size-3.5 text-muted-foreground" /> Restart to apply now
            <Help text="Limits only take effect after the containers are recreated. With this off, your changes are written but applied on the next manual restart." />
          </span>
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {activeLimitCount > 0
              ? `${activeLimitCount} service${activeLimitCount > 1 ? 's' : ''} limited`
              : 'No limits set'}
          </span>
          <Button className="sheen gap-1.5" disabled={!dirty || busy} onClick={apply}>
            <Save className="size-3.5" /> Apply limits
          </Button>
        </div>
      </div>
    </div>
  )
}
