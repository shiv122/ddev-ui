import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Container,
  FlaskConical,
  HeartPulse,
  RefreshCw,
  Share2,
  ShieldCheck,
  Stethoscope,
  Terminal,
  Trash2,
  XCircle
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { DoctorCheck } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { OperationConsole } from '@/components/app/operation-console'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useDoctor, useVersion } from '@/api/hooks'
import { cn } from '@/lib/utils'
import { runOperation, useOperations } from '@/store/operations'

const CHECK_ICONS: Record<DoctorCheck['id'], typeof Container> = {
  'ddev-binary': Terminal,
  'ddev-version': Stethoscope,
  'docker-cli': Container,
  'docker-daemon': Container,
  mkcert: ShieldCheck,
  tunnel: Share2
}

function CheckTile({ check }: { check: DoctorCheck }): React.JSX.Element {
  const Icon = CHECK_ICONS[check.id] ?? Stethoscope
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
        </div>
        <p
          className="mt-0.5 line-clamp-2 break-all font-mono text-[11px] leading-relaxed text-muted-foreground"
          title={check.detail}
        >
          {check.detail}
        </p>
      </div>
    </div>
  )
}

export function DoctorPage(): React.JSX.Element {
  const doctor = useDoctor()
  const version = useVersion()
  const operations = useOperations()
  const [checkOpId, setCheckOpId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const dockercheckRunning = operations.some((o) => o.id === checkOpId && o.status === 'running')

  const failing = (doctor.data?.checks ?? []).filter((c) => !c.ok)
  const healthy = doctor.data ? failing.length === 0 : null

  const runDockercheck = async (): Promise<void> => {
    const descriptor = await runOperation({ kind: 'dockercheck' })
    if (descriptor) setCheckOpId(descriptor.id)
  }

  return (
    <div className="hero-glow mx-auto w-full max-w-[1200px] space-y-5 p-6">
      <div>
        <h1 className="text-metallic flex items-center gap-2 text-[26px] font-bold tracking-tight">
          <Stethoscope className="size-6 text-foreground/80" /> Doctor
        </h1>
        <p className="text-sm text-muted-foreground">Everything DDEV needs to run on this machine.</p>
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
            <CheckTile key={check.id} check={check} />
          ))}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* deep docker check */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4" /> Deep Docker check
            </CardTitle>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={dockercheckRunning}
              onClick={() => void runDockercheck()}
            >
              {dockercheckRunning ? (
                <LoaderCircle animate loop className="size-4" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              Run check
            </Button>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              <code>ddev debug dockercheck</code> — builds a test container, mounts a volume and
              checks networking. Takes up to ~30s.
            </p>
            {checkOpId ? (
              <OperationConsole operationId={checkOpId} className="h-56" />
            ) : (
              <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                Output appears here
              </div>
            )}
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
      </div>

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
