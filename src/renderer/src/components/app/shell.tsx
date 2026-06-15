import type { ReactNode } from 'react'
import {
  Activity,
  Blocks,
  CircleAlert,
  LayoutGrid,
  Moon,
  Plus,
  Power,
  Settings2,
  Stethoscope,
  Sun,
  Waypoints
} from 'lucide-react'
import logoDark from '@/assets/logo-dark.png'
import logoLight from '@/assets/logo-light.png'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { StatusDot } from '@/components/app/status'
import { OperationDock } from '@/components/app/operation-dock'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useDoctor, useProjects, useVersion } from '@/api/hooks'
import { useRouter, type Route } from '@/lib/router'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { runOperation, useRunningOperations } from '@/store/operations'

interface NavItem {
  label: string
  icon: typeof LayoutGrid
  route: Route
  matches: (route: Route) => boolean
}

const NAV: NavItem[] = [
  {
    label: 'Projects',
    icon: LayoutGrid,
    route: { view: 'dashboard' },
    matches: (r) => r.view === 'dashboard' || r.view === 'project' || r.view === 'create'
  },
  {
    label: 'Add-ons',
    icon: Blocks,
    route: { view: 'addons' },
    matches: (r) => r.view === 'addons'
  },
  {
    label: 'Connections',
    icon: Waypoints,
    route: { view: 'connections' },
    matches: (r) => r.view === 'connections'
  },
  {
    label: 'Activity',
    icon: Activity,
    route: { view: 'operations' },
    matches: (r) => r.view === 'operations'
  },
  {
    label: 'Doctor',
    icon: Stethoscope,
    route: { view: 'doctor' },
    matches: (r) => r.view === 'doctor'
  },
  {
    label: 'Settings',
    icon: Settings2,
    route: { view: 'settings' },
    matches: (r) => r.view === 'settings'
  }
]

export function Shell({ children }: { children: ReactNode }): React.JSX.Element {
  const { route, navigate } = useRouter()
  const { theme, toggleTheme } = useTheme()
  const projects = useProjects()
  const doctor = useDoctor()
  const version = useVersion()
  const running = useRunningOperations()

  const anyRunningProject = (projects.data ?? []).some((p) => p.status === 'running')

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {/* draggable spacer clears the macOS traffic lights, logo sits below */}
        <div className="app-drag h-11 shrink-0" />
        <div className="flex items-center gap-2.5 px-4 pb-3">
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="DDevUI"
            className="size-7 rounded-md shadow-sm"
          />
          <span className="text-metallic text-[15px] font-bold tracking-widest">DDevUI</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-all',
                item.matches(route)
                  ? 'bg-foreground/[0.07] font-medium text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
              )}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
              {item.label === 'Activity' && running.length > 0 && (
                <LoaderCircle animate loop className="ml-auto size-3.5 text-foreground/70" />
              )}
            </button>
          ))}
        </nav>

        <Separator className="bg-sidebar-border" />

        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Projects
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => navigate({ view: 'create' })}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New project</TooltipContent>
          </Tooltip>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {(projects.data ?? []).map((p) => (
            <button
              key={p.name}
              onClick={() => navigate({ view: 'project', name: p.name })}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-colors',
                route.view === 'project' && route.name === p.name
                  ? 'bg-foreground/[0.07] text-foreground'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground'
              )}
            >
              <StatusDot status={p.status} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          {projects.isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading projects…</div>
          )}
          {projects.data?.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No projects yet</div>
          )}
        </div>

        <Separator className="bg-sidebar-border" />
        <div className="space-y-2 p-3">
          {doctor.data && !doctor.data.ok && (
            <button
              onClick={() => navigate({ view: 'doctor' })}
              className="flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
            >
              <CircleAlert className="size-3.5 shrink-0" />
              Environment problem — open Doctor
            </button>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">
                {version.data?.['DDEV version'] ?? 'ddev'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={toggleTheme}
                  >
                    {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</TooltipContent>
              </Tooltip>
            </div>
            <ConfirmDialog
              title="Power off DDEV?"
              description="Stops all projects and removes the router and ssh-agent containers."
              confirmLabel="Power off"
              destructive
              onConfirm={() => void runOperation({ kind: 'poweroff' })}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
                  disabled={!anyRunningProject}
                >
                  <Power className="size-3.5" /> Power off
                </Button>
              }
            />
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="app-drag h-3 shrink-0" />
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        <OperationDock />
      </main>
    </div>
  )
}
