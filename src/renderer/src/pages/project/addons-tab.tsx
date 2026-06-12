import { Blocks, ExternalLink, Trash2 } from 'lucide-react'
import type { DdevDescribe } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useInstalledAddons } from '@/api/hooks'
import { useRouter } from '@/lib/router'
import { runOperation, useProjectBusy } from '@/store/operations'

export function AddonsTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const addons = useInstalledAddons(info.name)
  const busy = useProjectBusy(info.name)
  const { navigate } = useRouter()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Installed add-ons</CardTitle>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => navigate({ view: 'addons' })}>
          <Blocks className="size-3.5" /> Browse registry
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {addons.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking installed add-ons…</p>
        ) : (addons.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No add-ons installed. Browse the registry to add services like Redis, Elasticsearch or
            Solr to this project.
          </p>
        ) : (
          (addons.data ?? []).map((addon) => (
            <div
              key={addon.Name}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{addon.Name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {addon.Version}
                  </Badge>
                </div>
                <button
                  className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={() =>
                    void window.ddev.openExternal(`https://github.com/${addon.Repository}`)
                  }
                >
                  {addon.Repository} <ExternalLink className="size-3" />
                </button>
              </div>
              <ConfirmDialog
                title={`Remove ${addon.Name}?`}
                description="Removes the add-on's files from this project. Restart the project afterwards to apply."
                confirmLabel="Remove add-on"
                destructive
                onConfirm={() =>
                  void runOperation({ kind: 'addon-remove', project: info.name, addon: addon.Name })
                }
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={busy}>
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                }
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
