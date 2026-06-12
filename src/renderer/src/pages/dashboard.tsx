import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, FolderGit2, Plus, Search } from 'lucide-react'
import type { DdevProject } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number'
import { StatusBadge } from '@/components/app/status'
import { ProjectActions } from '@/components/app/project-actions'
import { ProjectTypeIcon } from '@/components/app/project-type-icon'
import { useProjects } from '@/api/hooks'
import { useRouter } from '@/lib/router'
import { firstLine, hostName, projectTypeLabel } from '@/lib/format'

function StatCard({ label, value, dim }: { label: string; value: number; dim?: boolean }): React.JSX.Element {
  return (
    <Card className="metal-card sheen gap-0 rounded-xl py-4">
      <CardContent className="px-5">
        <div className={`text-3xl font-semibold tabular-nums tracking-tight ${dim && value === 0 ? 'text-muted-foreground/40' : 'text-metallic'}`}>
          <CountingNumber number={value} transition={{ stiffness: 150, damping: 22 }} />
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
      </CardContent>
    </Card>
  )
}

function ProjectCard({ project, index }: { project: DdevProject; index: number }): React.JSX.Element {
  const { navigate } = useRouter()
  const running = project.status === 'running'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25), duration: 0.2 }}
    >
      <Card
        className="metal-card sheen group cursor-pointer gap-3 rounded-xl py-4 transition-transform duration-200 hover:-translate-y-0.5"
        onClick={() => navigate({ view: 'project', name: project.name })}
      >
        <CardContent className="space-y-3.5 px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProjectTypeIcon type={project.type} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold tracking-tight">
                    {project.name}
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {projectTypeLabel(project.type)} · {project.shortroot}
                </div>
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="flex h-5 items-center">
            {running ? (
              <button
                className="truncate text-xs text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  void window.ddev.openExternal(project.primary_url)
                }}
              >
                {hostName(project.primary_url)}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground/50">—</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <span
              className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground"
              title={project.mutagen_status}
            >
              {project.mutagen_enabled && project.mutagen_status !== 'not enabled'
                ? `mutagen · ${firstLine(project.mutagen_status)}`
                : ''}
            </span>
            <ProjectActions project={project} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function DashboardPage(): React.JSX.Element {
  const projects = useProjects()
  const { navigate } = useRouter()
  const [filter, setFilter] = useState('')

  const all = projects.data ?? []
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.shortroot.toLowerCase().includes(q)
    )
  }, [all, filter])

  const runningCount = all.filter((p) => p.status === 'running').length
  const stoppedCount = all.filter((p) => p.status === 'stopped' || p.status === 'paused').length
  const problemCount = all.length - runningCount - stoppedCount - all.filter((p) => p.status === 'starting').length

  return (
    <div className="hero-glow mx-auto w-full max-w-[1560px] space-y-6 p-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-metallic text-[28px] font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Local development environments managed by DDEV
          </p>
        </div>
        <Button className="sheen gap-2" onClick={() => navigate({ view: 'create' })}>
          <Plus className="size-4" /> New project
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={all.length} />
        <StatCard label="Running" value={runningCount} />
        <StatCard label="Stopped" value={stoppedCount} />
        <StatCard label="Attention" value={Math.max(problemCount, 0)} dim />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by name, type or path…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg bg-card/60 pl-9"
        />
      </div>

      {projects.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : projects.isError ? (
        <Card className="metal-card rounded-xl py-10">
          <CardContent className="text-center text-sm text-muted-foreground">
            Could not list projects: {(projects.error as Error).message}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="metal-card rounded-xl py-14">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <FolderGit2 className="size-10 text-muted-foreground/50" />
            <div className="text-sm text-muted-foreground">
              {filter ? 'No projects match your filter.' : 'No DDEV projects yet.'}
            </div>
            {!filter && (
              <Button variant="secondary" className="gap-2" onClick={() => navigate({ view: 'create' })}>
                <Plus className="size-4" /> Create your first project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, i) => (
            <ProjectCard key={p.name} project={p} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
