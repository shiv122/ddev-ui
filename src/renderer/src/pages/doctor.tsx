import { useRef, useState } from 'react'
import {
  Activity,
  ArrowUpCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Container,
  FolderSearch,
  HeartPulse,
  Network,
  Play,
  RefreshCw,
  Share2,
  ShieldCheck,
  Square,
  Stethoscope,
  Terminal,
  Trash2,
  Wrench,
  XCircle
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import type { DiagnoseTarget, DockerProvider, DoctorCheck } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { OperationConsole } from '@/components/app/operation-console'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useDdevLatest, useDockerProviders, useDoctor, useVersion } from '@/api/hooks'
import { invalidateAfterBinaryChange } from '@/lib/query-client'
import { cn } from '@/lib/utils'
import { cancelOperation, runOperation, useOperations } from '@/store/operations'

const TROUBLESHOOTING_URL = 'https://docs.ddev.com/en/stable/users/usage/troubleshooting/'
const DDEV_INSTALL_URL = 'https://docs.ddev.com/en/stable/users/install/ddev-installation/'

function parseVer(v?: string | null): [number, number, number] | null {
  const m = v?.match(/(\d+)\.(\d+)\.(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** True only when both versions parse and `installed` is strictly older. */
function isOutdated(installed?: string | null, latest?: string | null): boolean {
  const a = parseVer(installed)
  const b = parseVer(latest)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

const CHECK_ICONS: Record<DoctorCheck['id'], typeof Container> = {
  'ddev-binary': Terminal,
  'ddev-version': Stethoscope,
  'docker-cli': Container,
  'docker-daemon': Container,
  mkcert: ShieldCheck,
  tunnel: Share2
}

/** Checks whose binary the user can point us to manually. */
const LOCATABLE: Partial<Record<DoctorCheck['id'], 'ddev' | 'docker'>> = {
  'ddev-binary': 'ddev',
  'docker-cli': 'docker'
}

/** Contextual help for a failing check: a relevant diagnostic, docs anchor, fix hint. */
const CHECK_HELP: Partial<
  Record<DoctorCheck['id'], { diagnose?: DiagnoseTarget; docHash?: string; hint?: string }>
> = {
  mkcert: {
    diagnose: 'tls-diagnose',
    docHash: 'browser-shows-certificate-error-for-ddev-sites',
    hint: 'Install mkcert and register its CA. On macOS: `brew install mkcert nss && mkcert -install`.'
  },
  'docker-daemon': {
    diagnose: 'dockercheck',
    hint: 'Start your Docker provider (Docker Desktop, OrbStack, Colima, Rancher Desktop).'
  },
  'docker-cli': { diagnose: 'dockercheck' },
  tunnel: { docHash: 'ddev-share-and-ngrok' }
}

interface Diagnostic {
  target: DiagnoseTarget
  label: string
  desc: string
  icon: typeof Container
}

const DIAGNOSTICS: Diagnostic[] = [
  {
    target: 'diagnose',
    label: 'Quick diagnose',
    desc: 'Docker, network, HTTPS and project health in one pass.',
    icon: Activity
  },
  {
    target: 'dockercheck',
    label: 'Docker provider',
    desc: 'Builds a test container, mounts a volume, checks networking (~30s).',
    icon: Container
  },
  {
    target: 'tls-diagnose',
    label: 'TLS / mkcert',
    desc: 'mkcert install, CA trust store and live HTTPS certificate trust.',
    icon: ShieldCheck
  },
  {
    target: 'port-diagnose',
    label: 'Ports',
    desc: 'Find processes occupying the ports DDEV needs (80/443, Mailpit…).',
    icon: Network
  }
]

function docUrl(hash?: string): string {
  return hash ? `${TROUBLESHOOTING_URL}#${hash}` : TROUBLESHOOTING_URL
}

function CheckTile({
  check,
  busyTarget,
  providers,
  onDiagnose,
  onStartProvider
}: {
  check: DoctorCheck
  busyTarget: DiagnoseTarget | null
  providers: DockerProvider[]
  onDiagnose: (target: DiagnoseTarget) => void
  onStartProvider: (id: string) => void
}): React.JSX.Element {
  const Icon = CHECK_ICONS[check.id] ?? Stethoscope
  const locatable = !check.ok && LOCATABLE[check.id]
  const help = !check.ok ? CHECK_HELP[check.id] : undefined

  const locate = async (): Promise<void> => {
    try {
      await window.ddev.pickBinary(LOCATABLE[check.id]!)
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
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3.5',
        check.ok ? 'border-border/70' : 'border-destructive/40 bg-destructive/[0.06]'
      )}
    >
      <div
        className={cn(
          'metal-tile flex size-9 shrink-0 items-center justify-center rounded-lg',
          !check.ok && 'opacity-80'
        )}
      >
        <Icon className="size-4 text-foreground/80" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{check.label}</span>
          {check.ok ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
          ) : (
            <XCircle className="size-3.5 shrink-0 text-destructive" />
          )}
          {locatable && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto h-6 shrink-0 gap-1 px-2 text-[11px]"
              onClick={() => void locate()}
            >
              <FolderSearch className="size-3" /> Locate manually…
            </Button>
          )}
        </div>
        <p
          className="mt-0.5 line-clamp-2 break-all font-mono text-[11px] leading-relaxed text-muted-foreground"
          title={check.detail}
        >
          {check.detail}
        </p>

        {help && (
          <div className="mt-2 space-y-2">
            {help.hint && (
              <p className="text-[11px] leading-relaxed text-foreground/70">
                {renderHint(help.hint)}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {help.diagnose && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={busyTarget === help.diagnose}
                  onClick={() => onDiagnose(help.diagnose!)}
                >
                  {busyTarget === help.diagnose ? (
                    <LoaderCircle animate loop className="size-3" />
                  ) : (
                    <Wrench className="size-3" />
                  )}
                  Run diagnose
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                onClick={() => void window.ddev.openExternal(docUrl(help.docHash))}
              >
                <BookOpen className="size-3" /> Troubleshooting
              </Button>
            </div>
            {check.id === 'docker-daemon' && providers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {providers.map((p) => (
                  <Button
                    key={p.id}
                    variant="secondary"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={() => onStartProvider(p.id)}
                  >
                    <Play className="size-3" /> Start {p.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Render a hint, turning `code` spans into styled inline code. */
function renderHint(hint: string): React.ReactNode {
  return hint.split(/(`[^`]+`)/).map((part, i) =>
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

export function DoctorPage(): React.JSX.Element {
  const doctor = useDoctor()
  const version = useVersion()
  const providers = useDockerProviders()
  const latest = useDdevLatest()
  const operations = useOperations()
  const [activeOpId, setActiveOpId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const diagnosticsRef = useRef<HTMLDivElement>(null)

  const activeOp = operations.find((o) => o.id === activeOpId)
  const runningTarget =
    activeOp?.status === 'running' && activeOp.request.kind === 'diagnose'
      ? activeOp.request.target
      : null
  const activeTarget =
    activeOp?.request.kind === 'diagnose' ? activeOp.request.target : null
  const activeLabel = DIAGNOSTICS.find((d) => d.target === activeTarget)?.label ?? activeTarget

  const failing = (doctor.data?.checks ?? []).filter((c) => !c.ok)
  const healthy = doctor.data ? failing.length === 0 : null

  const runDiagnostic = async (target: DiagnoseTarget): Promise<void> => {
    const descriptor = await runOperation({ kind: 'diagnose', target })
    if (descriptor) {
      setActiveOpId(descriptor.id)
      diagnosticsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  const installedVer = doctor.data?.versionInfo?.['DDEV version'] ?? version.data?.['DDEV version']
  const ddevOutdated = isOutdated(installedVer, latest.data)

  const startProvider = (id: string): void => {
    window.ddev
      .startDockerProvider(id)
      .then(() =>
        toast.success('Starting Docker provider', { description: 'Re-check in a few seconds.' })
      )
      .catch((err: Error) =>
        toast.error('Could not start provider', {
          description: err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        })
      )
  }

  return (
    <div className="hero-glow mx-auto w-full max-w-[1200px] space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-metallic flex items-center gap-2 text-[26px] font-bold tracking-tight">
            <Stethoscope className="size-6 text-foreground/80" /> Doctor
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything DDEV needs to run on this machine.
          </p>
        </div>
        <Button
          variant="ghost"
          className="shrink-0 gap-2 text-muted-foreground"
          onClick={() => void window.ddev.openExternal(TROUBLESHOOTING_URL)}
        >
          <BookOpen className="size-4" /> Troubleshooting docs
        </Button>
      </div>

      {/* health hero */}
      <Card className="sheen gap-0 py-5">
        <CardContent className="flex items-center gap-4 px-6">
          <div
            className={cn(
              'metal-tile flex size-12 items-center justify-center rounded-xl',
              healthy === false && 'border-destructive/40'
            )}
          >
            <HeartPulse
              className={cn(
                'size-6',
                healthy === null
                  ? 'text-muted-foreground'
                  : healthy
                    ? 'text-success'
                    : 'text-destructive'
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-metallic text-lg font-semibold tracking-tight">
              {healthy === null
                ? 'Checking environment…'
                : healthy
                  ? 'Environment healthy'
                  : `${failing.length} check${failing.length > 1 ? 's' : ''} failing`}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {healthy === null
                ? 'Running quick checks'
                : healthy
                  ? `${doctor.data!.versionInfo?.['DDEV version'] ?? 'ddev'} · ${doctor.data!.versionInfo?.['docker-platform'] ?? 'docker'} · all systems go`
                  : failing.map((f) => f.label).join(' · ')}
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 gap-2"
            onClick={() => void doctor.refetch()}
            disabled={doctor.isFetching}
          >
            <RefreshCw className={doctor.isFetching ? 'size-4 animate-spin' : 'size-4'} /> Re-check
          </Button>
        </CardContent>
      </Card>

      {ddevOutdated && (
        <Card className="border-warning/40 bg-warning/[0.06] py-3">
          <CardContent className="flex items-center gap-3 px-5">
            <ArrowUpCircle className="size-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-medium">DDEV {latest.data} is available</span>
              <span className="text-muted-foreground"> — you&apos;re on {installedVer}.</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => void window.ddev.openExternal(DDEV_INSTALL_URL)}
            >
              <BookOpen className="size-3.5" /> How to upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* check tiles */}
      {doctor.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(doctor.data?.checks ?? []).map((check) => (
            <CheckTile
              key={check.id}
              check={check}
              busyTarget={runningTarget}
              providers={providers.data ?? []}
              onDiagnose={(t) => void runDiagnostic(t)}
              onStartProvider={startProvider}
            />
          ))}
        </div>
      )}

      {/* diagnostics */}
      <Card ref={diagnosticsRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> Diagnostics
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            <code>ddev utility</code> — read-only, safe to run
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {DIAGNOSTICS.map((d) => {
                const running = runningTarget === d.target
                return (
                  <button
                    key={d.target}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      activeTarget === d.target
                        ? 'border-foreground/30 bg-accent/40'
                        : 'border-border/70 hover:border-border hover:bg-accent/30'
                    )}
                    onClick={() => void runDiagnostic(d.target)}
                    disabled={running}
                  >
                    <div className="metal-tile flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <d.icon className="size-4 text-foreground/80" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">{d.label}</div>
                      <div className="text-xs text-muted-foreground">{d.desc}</div>
                      <code className="text-[10px] text-muted-foreground/60">
                        ddev utility {d.target}
                      </code>
                    </div>
                    {running ? (
                      <LoaderCircle animate loop className="mt-1 size-4 shrink-0 text-foreground/70" />
                    ) : (
                      <Play className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col">
              <div className="mb-2 flex h-6 items-center justify-between">
                <span className="truncate text-xs text-muted-foreground">
                  {activeOp ? `Output — ${activeLabel}` : 'Output'}
                </span>
                {runningTarget && activeOpId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                    onClick={() => cancelOperation(activeOpId)}
                  >
                    <Square className="size-3" /> Stop
                  </Button>
                )}
              </div>
              {activeOpId ? (
                <OperationConsole operationId={activeOpId} className="h-72 lg:h-[calc(100%-2rem)]" />
              ) : (
                <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground lg:h-full">
                  Pick a diagnostic to run — output streams here
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">Remove unused DDEV images</div>
              <div className="text-xs text-muted-foreground">
                Reclaims disk space after version upgrades — projects re-pull on next start.
              </div>
            </div>
            <ConfirmDialog
              title="Remove unused DDEV images?"
              description="Runs `ddev delete images` — removes ddev images not matching the current version."
              confirmLabel="Remove images"
              onConfirm={() => void runOperation({ kind: 'clean-images' })}
              trigger={
                <Button variant="secondary" size="sm" className="shrink-0 gap-1.5">
                  <Trash2 className="size-3.5" /> Clean
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* versions, collapsed */}
      <Card className="gap-0 py-4">
        <button
          className="flex w-full items-center gap-2 px-6 text-left"
          onClick={() => setShowVersions(!showVersions)}
        >
          <Stethoscope className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Component versions</span>
          <span className="text-xs text-muted-foreground">
            {version.data?.['DDEV version'] ?? ''}
          </span>
          <ChevronDown
            className={`ml-auto size-4 text-muted-foreground transition-transform ${showVersions ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {showVersions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="px-6 pt-3">
                {version.data ? (
                  <dl className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2">
                    {Object.entries(version.data).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5"
                      >
                        <dt className="shrink-0 text-xs text-muted-foreground">{key}</dt>
                        <dd className="truncate font-mono text-[11px]" title={value}>
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <Skeleton className="h-32 rounded-lg" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  )
}
