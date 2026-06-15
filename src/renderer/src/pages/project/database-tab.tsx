import { useState } from 'react'
import { Camera, ChevronDown, Copy, Database, Download, History, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useSnapshots } from '@/api/hooks'
import { runOperation, useProjectBusy } from '@/store/operations'

function copy(value: string, label: string): void {
  void navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

/** Host-reachable connection URI (mysql:// or postgres://) for external DB clients. */
function dbConnectionUri(info: DdevDescribe): string | null {
  const db = info.dbinfo
  if (!db || db.published_port <= 0) return null
  const type = (info.database_type || db.database_type || '').toLowerCase()
  const scheme = type.includes('postgres') ? 'postgresql' : 'mysql'
  const cred = `${encodeURIComponent(db.username)}:${encodeURIComponent(db.password)}`
  return `${scheme}://${cred}@127.0.0.1:${db.published_port}/${db.dbname}`
}

const DB_APPS: Array<{ target: string; label: string }> = [
  { target: 'tableplus', label: 'TablePlus' },
  { target: 'sequelace', label: 'Sequel Ace' },
  { target: 'dbeaver', label: 'DBeaver' }
]

function CredRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <code className="text-xs">{value}</code>
        <Button variant="ghost" size="icon" className="size-6" onClick={() => copy(value, label)}>
          <Copy className="size-3" />
        </Button>
      </div>
    </div>
  )
}

export function DatabaseTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const busy = useProjectBusy(info.name)
  const running = info.status === 'running'
  const snapshots = useSnapshots(info.name)
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false)
  const db = info.dbinfo
  const dbUri = running ? dbConnectionUri(info) : null
  const isMac = window.ddev.platform === 'darwin'

  const openInClient = (target?: string): void => {
    if (!dbUri) return
    window.ddev.openDbClient(dbUri, target).catch((err: Error) =>
      toast.error('Could not open database client', {
        description: err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
      })
    )
  }

  const importDb = async (): Promise<void> => {
    const file = await window.ddev.selectFile({
      title: 'Choose a database dump',
      filters: [{ name: 'SQL dumps', extensions: ['sql', 'gz', 'bz2', 'xz', 'zip', 'tar'] }]
    })
    if (file) void runOperation({ kind: 'import-db', project: info.name, file })
  }

  const exportDb = async (): Promise<void> => {
    const file = await window.ddev.saveFile({
      title: 'Export database to…',
      defaultPath: `${info.name}.sql.gz`,
      filters: [{ name: 'SQL dump', extensions: ['sql.gz', 'sql', 'gz'] }]
    })
    if (file) void runOperation({ kind: 'export-db', project: info.name, file })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Connection — {info.database_type} {info.database_version}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {db ? (
            <>
              <CredRow label="Database" value={db.dbname} />
              <CredRow label="Username" value={db.username} />
              <CredRow label="Password" value={db.password} />
              <CredRow label="Host (inside containers)" value={`${db.host}:${db.dbPort}`} />
              {running && db.published_port > 0 && (
                <CredRow label="Host (from your machine)" value={`127.0.0.1:${db.published_port}`} />
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Start the project to see connection info.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-3">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={!running || busy}
              onClick={() => void importDb()}
            >
              <Upload className="size-3.5" /> Import dump…
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              disabled={!running || busy}
              onClick={() => void exportDb()}
            >
              <Download className="size-3.5" /> Export dump…
            </Button>
            {isMac ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1.5" disabled={!dbUri}>
                    <Database className="size-3.5" /> Open in… <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {DB_APPS.map((a) => (
                    <DropdownMenuItem key={a.target} onClick={() => openInClient(a.target)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={() => openInClient()}>Default app</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={!dbUri}
                onClick={() => openInClient()}
              >
                <Database className="size-3.5" /> Open in DB client
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> Snapshots
          </CardTitle>
          <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1.5" disabled={!running || busy}>
                <Camera className="size-3.5" /> New snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create database snapshot</DialogTitle>
                <DialogDescription>
                  Saves the current database state. Restore it later from this list.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Optional name (default: timestamp)"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
              />
              <DialogFooter>
                <Button
                  onClick={() => {
                    void runOperation({
                      kind: 'snapshot-create',
                      project: info.name,
                      name: snapshotName.trim() || undefined
                    })
                    setSnapshotName('')
                    setSnapshotDialogOpen(false)
                  }}
                >
                  Create snapshot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(snapshots.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots for this project yet.</p>
          ) : (
            (snapshots.data ?? []).map((snap) => (
              <div
                key={snap.Name}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{snap.Name}</div>
                  {snap.Created && (
                    <div className="text-xs text-muted-foreground">{snap.Created}</div>
                  )}
                </div>
                <ConfirmDialog
                  title="Restore this snapshot?"
                  description={`The current database of ${info.name} will be replaced with snapshot "${snap.Name}".`}
                  confirmLabel="Restore"
                  destructive
                  onConfirm={() =>
                    void runOperation({
                      kind: 'snapshot-restore',
                      project: info.name,
                      snapshot: snap.Name
                    })
                  }
                  trigger={
                    <Button variant="ghost" size="sm" disabled={!running || busy}>
                      Restore
                    </Button>
                  }
                />
              </div>
            ))
          )}
          {(snapshots.data ?? []).length > 0 && (
            <div className="pt-2">
              <ConfirmDialog
                title="Delete all snapshots?"
                description={`Removes every stored snapshot of ${info.name}. This cannot be undone.`}
                confirmLabel="Delete all"
                destructive
                onConfirm={() => void runOperation({ kind: 'snapshot-cleanup', project: info.name })}
                trigger={
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" disabled={busy}>
                    <Trash2 className="size-3.5" /> Delete all snapshots
                  </Button>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
