import { useMemo, useState } from 'react'
import { Blocks, Download, ExternalLink, Package, Search, Star } from 'lucide-react'
import type { DdevAddon } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddonRegistry, useProjects } from '@/api/hooks'
import { runOperation } from '@/store/operations'

type TypeFilter = 'all' | 'official' | 'contrib'

function AddonRow({ addon, onInstall }: { addon: DdevAddon; onInstall: () => void }): React.JSX.Element {
  return (
    <Card className="sheen py-3.5 transition-transform duration-200 hover:-translate-y-px">
      <CardContent className="flex items-center gap-4 px-4">
        <div className="metal-tile flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Package className="size-4.5 text-foreground/80" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="flex items-center gap-1 truncate text-sm font-semibold underline-offset-2 hover:underline"
              onClick={() => void window.ddev.openExternal(addon.github_url)}
            >
              {addon.title}
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            </button>
            {addon.type === 'official' && (
              <Badge variant="outline" className="rounded-full border-foreground/25 bg-foreground/[0.06] text-foreground/85">
                official
              </Badge>
            )}
            {addon.tag_name && (
              <Badge variant="secondary" className="text-xs">
                {addon.tag_name}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{addon.description}</p>
          {(addon.dependencies?.length ?? 0) > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              requires: {addon.dependencies?.join(', ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5" /> {addon.stars}
          </span>
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={onInstall}>
            <Download className="size-3.5" /> Install
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AddonsPage(): React.JSX.Element {
  const registry = useAddonRegistry()
  const projects = useProjects()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [installTarget, setInstallTarget] = useState<DdevAddon | null>(null)
  const [targetProject, setTargetProject] = useState('')

  const filtered = useMemo(() => {
    const all = registry.data ?? []
    const q = query.trim().toLowerCase()
    return all
      .filter((a) => typeFilter === 'all' || a.type === typeFilter)
      .filter(
        (a) =>
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      )
      .sort((a, b) => (a.type !== b.type ? (a.type === 'official' ? -1 : 1) : b.stars - a.stars))
  }, [registry.data, query, typeFilter])

  const startInstall = (addon: DdevAddon): void => {
    setTargetProject(projects.data?.[0]?.name ?? '')
    setInstallTarget(addon)
  }

  const confirmInstall = (): void => {
    if (!installTarget || !targetProject) return
    void runOperation({
      kind: 'addon-install',
      project: targetProject,
      addon: installTarget.title
    })
    setInstallTarget(null)
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-metallic flex items-center gap-2 text-[26px] font-bold tracking-tight">
            <Blocks className="size-6 text-foreground/80" /> Add-on registry
          </h1>
          <p className="text-sm text-muted-foreground">
            {registry.data
              ? `${registry.data.length} add-ons available — services and tools you can add to any project`
              : 'Loading registry…'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search add-ons (redis, solr, elasticsearch…)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="official">Official</TabsTrigger>
            <TabsTrigger value="contrib">Community</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {registry.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : registry.isError ? (
        <Card className="py-10">
          <CardContent className="text-center text-sm text-muted-foreground">
            Could not load the add-on registry: {(registry.error as Error).message}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.slice(0, 80).map((addon) => (
            <AddonRow key={addon.title} addon={addon} onInstall={() => startInstall(addon)} />
          ))}
          {filtered.length > 80 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Showing top 80 of {filtered.length} — refine your search to see more.
            </p>
          )}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No add-ons match.</p>
          )}
        </div>
      )}

      <Dialog open={installTarget !== null} onOpenChange={(open) => !open && setInstallTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install {installTarget?.title}</DialogTitle>
            <DialogDescription>
              Runs <code>ddev add-on get {installTarget?.title}</code> in the selected project.
              Restart the project afterwards to activate it.
            </DialogDescription>
          </DialogHeader>
          <Select value={targetProject} onValueChange={setTargetProject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a project" />
            </SelectTrigger>
            <SelectContent>
              {(projects.data ?? []).map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button disabled={!targetProject} onClick={confirmInstall}>
              Install add-on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
