import { useMemo, useState } from 'react'
import { Check, Plus, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CATEGORY_LABELS,
  SERVICES,
  type ServiceCategory,
  type ServiceSpec
} from '@/lib/service-catalog'
import { useInstalledAddons } from '@/api/hooks'
import { runOperation, useProjectBusy } from '@/store/operations'

const CATEGORY_ORDER: ServiceCategory[] = [
  'cache',
  'search',
  'queue',
  'storage',
  'dbtools',
  'frontend',
  'dev'
]

function ServiceRow({
  svc,
  installed,
  busy,
  onInstall
}: {
  svc: ServiceSpec
  installed: boolean
  busy: boolean
  onInstall: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{svc.name}</span>
          {svc.official ? (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              official
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
              community
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Star className="size-2.5" /> {svc.stars}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{svc.blurb}</p>
      </div>
      {installed ? (
        <Badge variant="outline" className="shrink-0 gap-1 border-success/40 bg-success/10 text-success">
          <Check className="size-3" /> Installed
        </Badge>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
          disabled={busy}
          onClick={onInstall}
        >
          <Plus className="size-3.5" /> Add
        </Button>
      )}
    </div>
  )
}

export function AddServiceDialog({
  project,
  trigger
}: {
  project: string
  trigger: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const installed = useInstalledAddons(project)
  const busy = useProjectBusy(project)

  const installedRepos = useMemo(
    () => new Set((installed.data ?? []).map((a) => a.Repository.toLowerCase())),
    [installed.data]
  )

  const grouped = useMemo(() => {
    const map = new Map<ServiceCategory, ServiceSpec[]>()
    for (const svc of SERVICES) {
      const list = map.get(svc.category) ?? []
      list.push(svc)
      map.set(svc.category, list)
    }
    return map
  }, [])

  const install = (svc: ServiceSpec): void => {
    void runOperation({ kind: 'addon-install', project, addon: svc.id, restartAfter: true })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a service</DialogTitle>
          <DialogDescription>
            One-click DDEV add-ons. Installing adds the service and restarts the project so it comes
            online. Browse the full registry from the Add-ons page for everything else.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mr-4 max-h-[60vh] pr-4">
          <div className="space-y-5">
            {CATEGORY_ORDER.map((cat) => {
              const list = grouped.get(cat)
              if (!list || list.length === 0) return null
              return (
                <div key={cat} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <div className="space-y-1.5">
                    {list.map((svc) => (
                      <ServiceRow
                        key={svc.id}
                        svc={svc}
                        installed={installedRepos.has(svc.id.toLowerCase())}
                        busy={busy}
                        onInstall={() => install(svc)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
