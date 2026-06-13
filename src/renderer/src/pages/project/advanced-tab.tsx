import { useState } from 'react'
import {
  AlertTriangle,
  FileCode2,
  FolderOpen,
  Hammer,
  Layers,
  Play,
  Plus,
  RefreshCcwDot,
  Route,
  ShieldCheck,
  SquareTerminal,
  Webhook
} from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe, ExtraKind } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useExtras } from '@/api/hooks'
import { queryClient, queryKeys } from '@/lib/query-client'
import { useRouter } from '@/lib/router'
import { runOperation, useProjectBusy } from '@/store/operations'

function stripIpcPrefix(message: string): string {
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

function openInEditor(path: string): void {
  window.ddev.openInEditor(path).catch((err: Error) => {
    toast.error('Could not open editor', { description: stripIpcPrefix(err.message) })
  })
}

/* ---------- shared bits ---------- */

function FileRow({
  name,
  path,
  badge,
  onRun
}: {
  name: string
  path: string
  badge?: string
  onRun?: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs">{name}</span>
        {badge && (
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRun && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onRun}>
            <Play className="size-3" /> Run
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openInEditor(path)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void window.ddev.revealPath(path)}
        >
          Reveal
        </Button>
      </div>
    </div>
  )
}

function CreateFileButton({
  project,
  kind,
  label,
  title,
  description,
  placeholder
}: {
  project: string
  kind: ExtraKind
  label: string
  title: string
  description: string
  placeholder: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    try {
      const { path } = await window.ddev.createExtra(project, kind, name.trim())
      void queryClient.invalidateQueries({ queryKey: queryKeys.extras(project) })
      setOpen(false)
      setName('')
      toast.success('Created', { description: path })
      openInEditor(path)
    } catch (err) {
      toast.error('Could not create file', {
        description: err instanceof Error ? stripIpcPrefix(err.message) : String(err)
      })
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => setOpen(true)}>
        <Plus className="size-3" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            placeholder={placeholder}
            className="font-mono text-sm"
            autoFocus
          />
          <DialogFooter>
            <Button disabled={!name.trim()} onClick={() => void create()}>
              Create & open in editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const HOOKS_EXAMPLE = `hooks:
  post-start:
    - exec: composer install
    - exec-host: echo "started"
  post-import-db:
    - exec: ./vendor/bin/drush cr`

/* ---------- the tab ---------- */

export function AdvancedTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const extras = useExtras(info.name)
  const busy = useProjectBusy(info.name)
  const { navigate } = useRouter()

  if (extras.isLoading || !extras.data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  const x = extras.data
  const ddevDir = `${x.approot}/.ddev`

  return (
    <div className="space-y-4">
      {/* warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/90">Power tools.</span> Everything here maps
          to files inside <code className="text-foreground/80">.ddev/</code> and changes how your
          containers are built and routed. Files marked{' '}
          <code className="text-foreground/80">#ddev-generated</code> are owned by DDEV — remove
          that line before editing, or your changes are overwritten. Most changes need a restart;
          when a service exists as an{' '}
          <button className="underline underline-offset-2" onClick={() => navigate({ view: 'addons' })}>
            add-on
          </button>
          , prefer that instead.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Custom services */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4" /> Custom services
            </CardTitle>
            <CreateFileButton
              project={info.name}
              kind="compose"
              label="New service"
              title="New custom service"
              description="Creates .ddev/docker-compose.<name>.yaml with a starter service definition. The service joins this project's containers on next restart."
              placeholder="e.g. clamav"
            />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {x.composeFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No extra docker-compose files. Add any container to this project —
                check the add-on registry first for ready-made services.
              </p>
            ) : (
              x.composeFiles.map((f) => <FileRow key={f} name={f} path={`${ddevDir}/${f}`} />)
            )}
          </CardContent>
        </Card>

        {/* Image customization */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hammer className="size-4" /> Web image build
            </CardTitle>
            <CreateFileButton
              project={info.name}
              kind="web-dockerfile"
              label="New Dockerfile"
              title="New web-image Dockerfile"
              description="Creates .ddev/web-build/Dockerfile.<name>. Its instructions run when the web image is built at start — use it for global npm packages, system tools, etc."
              placeholder="e.g. pnpm  (or just: Dockerfile)"
            />
          </CardHeader>
          <CardContent className="space-y-1.5">
            {x.webDockerfiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No custom Dockerfiles. For plain PHP extensions use the{' '}
                <span className="font-medium text-foreground/80">Config → PHP extensions</span>{' '}
                section instead — Dockerfiles are for everything beyond apt packages.
              </p>
            ) : (
              x.webDockerfiles.map((f) => (
                <FileRow key={f} name={f} path={`${ddevDir}/web-build/${f}`} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Custom commands */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <SquareTerminal className="size-4" /> Custom commands
            </CardTitle>
            <div className="flex gap-1.5">
              <CreateFileButton
                project={info.name}
                kind="host-command"
                label="Host"
                title="New host command"
                description="Creates an executable script in .ddev/commands/host — runs on your machine in the project root, invoked as `ddev <name>`."
                placeholder="e.g. deploy"
              />
              <CreateFileButton
                project={info.name}
                kind="web-command"
                label="Web"
                title="New web command"
                description="Creates an executable script in .ddev/commands/web — runs inside the web container, invoked as `ddev <name>`."
                placeholder="e.g. phpunit"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {x.hostCommands.length === 0 && x.webCommands.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No custom commands. Wrap project chores (test runners, deploys, cache clears) as
                `ddev &lt;name&gt;` commands for the whole team.
              </p>
            ) : (
              <>
                {x.hostCommands.map((f) => (
                  <FileRow
                    key={`h-${f}`}
                    name={f}
                    badge="host"
                    path={`${ddevDir}/commands/host/${f}`}
                    onRun={() =>
                      void runOperation({ kind: 'custom-command', project: info.name, command: f })
                    }
                  />
                ))}
                {x.webCommands.map((f) => (
                  <FileRow
                    key={`w-${f}`}
                    name={f}
                    badge="web"
                    path={`${ddevDir}/commands/web/${f}`}
                    onRun={() =>
                      void runOperation({ kind: 'custom-command', project: info.name, command: f })
                    }
                  />
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Hooks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="size-4" /> Hooks
            </CardTitle>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => openInEditor(`${ddevDir}/config.yaml`)}
            >
              Edit config.yaml
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {x.hooks ? (
              <pre className="dark scrollbar-thin max-h-48 overflow-auto rounded-lg border bg-[#101010] p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
                {x.hooks}
              </pre>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  No hooks configured. Hooks run commands automatically around lifecycle events
                  (pre/post start, stop, import-db, snapshot…) — e.g. composer install on every
                  start.
                </p>
                <div className="rounded-lg border border-border/70 p-2.5">
                  <pre className="font-mono text-[11px] leading-relaxed text-muted-foreground">{HOOKS_EXAMPLE}</pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 h-6 px-2 text-[11px]"
                    onClick={() => {
                      void navigator.clipboard.writeText(HOOKS_EXAMPLE)
                      toast.success('Example copied — paste into config.yaml')
                    }}
                  >
                    Copy example
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* TLS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Custom TLS certificates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              DDEV creates trusted certificates automatically via mkcert. To supply your own (e.g.
              from a corporate CA), place <code>{info.name}.crt</code> and <code>{info.name}.key</code>{' '}
              into <code>.ddev/custom_certs/</code>, then start the project.
            </p>
            {x.hasCustomCerts ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={() => void window.ddev.revealPath(`${ddevDir}/custom_certs`)}
              >
                <FolderOpen className="size-3" /> Open custom_certs
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={busy}
                onClick={async () => {
                  const { path } = await window.ddev.createExtra(info.name, 'certs-dir', 'certs')
                  void queryClient.invalidateQueries({ queryKey: queryKeys.extras(info.name) })
                  void window.ddev.revealPath(path)
                }}
              >
                <Plus className="size-3" /> Create custom_certs folder
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Router */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Route className="size-4" /> Traefik router
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Project routing lives in <code>.ddev/traefik/config/</code>. Add your own{' '}
              <code>*.yaml</code> there (middlewares, extra routers) — Traefik hot-reloads them. To
              take over the generated <code>{info.name}.yaml</code>, remove its{' '}
              <code>#ddev-generated</code> line first. Only global/static router changes need{' '}
              <code>ddev poweroff</code> + start.
            </p>
            <div className="flex items-center gap-2">
              {info.router_status && (
                <Badge variant="secondary" className="rounded-full text-[11px]">
                  router: {info.router_status || 'n/a'}
                </Badge>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={!x.hasTraefikDir}
                onClick={() => void window.ddev.revealPath(`${ddevDir}/traefik`)}
              >
                <FolderOpen className="size-3" />
                {x.hasTraefikDir ? 'Open traefik folder' : 'Generated on first start'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger zone */}
      <Card className="border-destructive/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-4" /> Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Rebuild web image</div>
              <div className="text-xs text-muted-foreground">
                `ddev debug rebuild` — full no-cache rebuild; picks up Dockerfile and package
                changes that got stuck.
              </div>
            </div>
            <ConfirmDialog
              title="Rebuild the web image?"
              description="Rebuilds without cache and restarts the project. Takes a few minutes."
              confirmLabel="Rebuild"
              onConfirm={() =>
                void runOperation({ kind: 'debug-rebuild', project: info.name, service: 'web' })
              }
              trigger={
                <Button variant="secondary" size="sm" disabled={busy} className="shrink-0 gap-1.5">
                  <RefreshCcwDot className="size-3.5" /> Rebuild
                </Button>
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Reset Mutagen sync</div>
              <div className="text-xs text-muted-foreground">
                Drops and recreates the file-sync session — fixes stuck or corrupted syncs.
              </div>
            </div>
            <ConfirmDialog
              title="Reset Mutagen?"
              description="Stops the project, removes the Mutagen session and volume. Files on your machine are untouched; the sync rebuilds on next start."
              confirmLabel="Reset"
              onConfirm={() => void runOperation({ kind: 'mutagen-reset', project: info.name })}
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || !info.mutagen_enabled}
                  className="shrink-0 gap-1.5"
                >
                  <RefreshCcwDot className="size-3.5" /> Reset
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
