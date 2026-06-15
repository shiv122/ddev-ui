import { useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Star, Trash2 } from 'lucide-react'
import type { DdevAddon, DdevStatus } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { StatusDot } from '@/components/app/status'
import { useAllInstalledAddons, useProjects } from '@/api/hooks'
import { runOperation, useProjectBusy } from '@/store/operations'

interface RowState {
  name: string
  status: DdevStatus
  installed: boolean
  version?: string
  /** Manifest `Name` — the argument `ddev add-on remove` expects. */
  manifestName?: string
}

function ProjectRow({
  row,
  checked,
  onToggle
}: {
  row: RowState
  checked: boolean
  onToggle: (name: string) => void
}): React.JSX.Element {
  const busy = useProjectBusy(row.name)

  // Installed projects aren't selectable — they offer a Remove action instead.
  if (row.installed) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusDot status={row.status} />
          <span className="truncate text-sm">{row.name}</span>
          <Badge
            variant="outline"
            className="shrink-0 border-success/40 bg-success/10 text-[10px] text-success"
          >
            installed{row.version ? ` · v${row.version}` : ''}
          </Badge>
        </div>
        <ConfirmDialog
          title={`Remove from ${row.name}?`}
          description="Removes the add-on's files from this project. Restart the project afterwards to apply."
          confirmLabel="Remove"
          destructive
          onConfirm={() =>
            void runOperation({
              kind: 'addon-remove',
              project: row.name,
              addon: row.manifestName ?? ''
            })
          }
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs text-destructive"
              disabled={busy}
            >
              <Trash2 className="size-3.5" /> Remove
            </Button>
          }
        />
      </div>
    )
  }

  // The whole row toggles selection, so clicking the name (not just the box) works.
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={checked}
      onClick={() => onToggle(row.name)}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusDot status={row.status} />
        <span className="truncate text-sm">{row.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {busy && <span>working…</span>}
        <Checkbox checked={checked} disabled={busy} tabIndex={-1} className="pointer-events-none" />
      </div>
    </button>
  )
}

/**
 * Detail view for a single registry add-on: shows where it is already installed
 * across every project and lets you install it to one or many at once (or remove
 * it from those that have it). Open when `addon` is non-null.
 */
export function AddonDetailDialog({
  addon,
  onClose
}: {
  addon: DdevAddon | null
  onClose: () => void
}): React.JSX.Element {
  const open = addon !== null
  const projects = useProjects()
  const installedAll = useAllInstalledAddons(open)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [restartAfter, setRestartAfter] = useState(true)

  // Reset the selection whenever we switch to a different add-on.
  useEffect(() => {
    setSelected(new Set())
  }, [addon?.title])

  const repoKey = addon ? `${addon.user}/${addon.repo}`.toLowerCase() : ''

  const rows: RowState[] = useMemo(() => {
    return (projects.data ?? []).map((p) => {
      const match = (installedAll.data?.[p.name] ?? []).find(
        (a) => a.Repository.toLowerCase() === repoKey
      )
      return {
        name: p.name,
        status: p.status,
        installed: !!match,
        version: match?.Version,
        manifestName: match?.Name
      }
    })
  }, [projects.data, installedAll.data, repoKey])

  const notInstalled = rows.filter((r) => !r.installed)
  const installedCount = rows.length - notInstalled.length
  const allSelected = notInstalled.length > 0 && notInstalled.every((r) => selected.has(r.name))

  const toggle = (name: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const toggleAll = (): void =>
    setSelected(allSelected ? new Set() : new Set(notInstalled.map((r) => r.name)))

  const install = (): void => {
    if (!addon) return
    for (const name of selected) {
      void runOperation({
        kind: 'addon-install',
        project: name,
        addon: `${addon.user}/${addon.repo}`,
        restartAfter
      })
    }
    onClose()
  }

  const loading = projects.isLoading || installedAll.isLoading

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {addon && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <button
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  onClick={() => void window.ddev.openExternal(addon.github_url)}
                >
                  {addon.title}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </button>
                {addon.type === 'official' ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-foreground/25 bg-foreground/[0.06] text-foreground/85"
                  >
                    official
                  </Badge>
                ) : (
                  <Badge variant="secondary">community</Badge>
                )}
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Star className="size-3" /> {addon.stars}
                </span>
              </DialogTitle>
              <DialogDescription>{addon.description}</DialogDescription>
            </DialogHeader>

            {(addon.dependencies?.length ?? 0) > 0 && (
              <p className="-mt-1 text-xs text-muted-foreground">
                Requires: {addon.dependencies?.join(', ')}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Projects
                  {installedCount > 0 && (
                    <span className="ml-1 normal-case text-muted-foreground/70">
                      · installed in {installedCount}
                    </span>
                  )}
                </span>
                {notInstalled.length > 1 && (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    Select all
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </label>
                )}
              </div>

              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Checking projects…</p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No projects yet. Create a project first.
                </p>
              ) : (
                <div className="scrollbar-thin max-h-[42vh] space-y-1.5 overflow-y-auto pr-0.5">
                  {rows.map((r) => (
                    <ProjectRow
                      key={r.name}
                      row={r}
                      checked={selected.has(r.name)}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={restartAfter}
                  onCheckedChange={(v) => setRestartAfter(v === true)}
                />
                Restart after install
              </label>
              <Button disabled={selected.size === 0} onClick={install} className="gap-1.5">
                <Download className="size-3.5" />
                Install to {selected.size} project{selected.size === 1 ? '' : 's'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
