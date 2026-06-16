import { useState } from 'react'
import {
  Code2,
  EyeOff,
  FolderOpen,
  Globe,
  Mail,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCw,
  Square,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import type { DdevProject } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useRouter } from '@/lib/router'
import { runOperation, useProjectBusy } from '@/store/operations'

export function ProjectActions({
  project,
  size = 'sm'
}: {
  project: DdevProject
  size?: 'sm' | 'default'
}): React.JSX.Element {
  const busy = useProjectBusy(project.name)
  const { navigate } = useRouter()
  const running = project.status === 'running'
  const broken =
    project.status === '.ddev/config.yaml missing' || project.status === 'project directory missing'
  const startable = !running && !broken && project.status !== 'starting'

  const [renameOpen, setRenameOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [snapshotFirst, setSnapshotFirst] = useState(true)
  const cleanName = newName.trim().toLowerCase()
  const nameOk = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(cleanName) && cleanName !== project.name

  const submitRename = (): void => {
    if (!nameOk) return
    void runOperation({ kind: 'rename', project: project.name, newName: cleanName })
    setRenameOpen(false)
    setNewName('')
    // The old name no longer resolves; land somewhere stable.
    navigate({ view: 'dashboard' })
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {busy ? (
        <Button size={size} variant="secondary" disabled className="gap-2">
          <LoaderCircle animate loop className="size-4" />
          Working…
        </Button>
      ) : broken ? (
        <ConfirmDialog
          title={`Unlist ${project.name}?`}
          description="This project's files are missing, so it can't start. Unlisting removes the stale entry from DDEV's registry — nothing on disk is touched."
          confirmLabel="Unlist project"
          onConfirm={() => void runOperation({ kind: 'unlist', project: project.name })}
          trigger={
            <Button size={size} variant="secondary" className="gap-1.5">
              <EyeOff className="size-3.5" /> Unlist
            </Button>
          }
        />
      ) : startable ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              className="gap-1.5"
              onClick={() => void runOperation({ kind: 'start', project: project.name })}
            >
              <Play className="size-3.5" /> Start
            </Button>
          </TooltipTrigger>
          <TooltipContent>ddev start {project.name}</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="secondary"
              className="gap-1.5"
              onClick={() => void runOperation({ kind: 'stop', project: project.name })}
            >
              <Square className="size-3.5" /> Stop
            </Button>
          </TooltipTrigger>
          <TooltipContent>ddev stop {project.name}</TooltipContent>
        </Tooltip>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size} variant="ghost" className="px-2" disabled={busy}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={() => void runOperation({ kind: 'restart', project: project.name })}
          >
            <RotateCw className="size-4" /> Restart
          </DropdownMenuItem>
          {running && (
            <>
              <DropdownMenuItem onClick={() => void window.ddev.openExternal(project.primary_url)}>
                <Globe className="size-4" /> Open in browser
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void window.ddev.openExternal(project.mailpit_https_url)}
              >
                <Mail className="size-4" /> Open Mailpit
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => void window.ddev.revealPath(project.approot)}>
            <FolderOpen className="size-4" /> Reveal project folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              window.ddev.openInEditor(project.approot).catch((err: Error) =>
                toast.error('Could not open editor', {
                  description: err.message.replace(/^Error invoking remote method '[^']+': /, '')
                })
              )
            }
          >
            <Code2 className="size-4" /> Open in editor
          </DropdownMenuItem>
          {!broken && (
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="size-4" /> Rename…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <ConfirmDialog
            title={`Unlist ${project.name}?`}
            description="Removes the project from DDEV's list without touching code or database. Run ddev start in the folder (or re-create it here) to register it again."
            confirmLabel="Unlist project"
            onConfirm={() => void runOperation({ kind: 'unlist', project: project.name })}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <EyeOff className="size-4" /> Unlist…
              </DropdownMenuItem>
            }
          />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setSnapshotFirst(!broken)
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="size-4" /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {project.name}</DialogTitle>
            <DialogDescription>
              DDevUI snapshots the database, recreates the project under the new name, then restores
              the data. The project restarts and its URL becomes{' '}
              <code>{cleanName || 'new-name'}.ddev.site</code>.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="new-project-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename()
            }}
          />
          {newName.trim() && !nameOk && (
            <p className="text-xs text-destructive">
              {cleanName === project.name
                ? 'Choose a name different from the current one.'
                : 'Use lowercase letters, numbers and hyphens (not starting or ending with a hyphen).'}
            </p>
          )}
          <DialogFooter>
            <Button disabled={!nameOk} onClick={submitRename}>
              Rename project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>
              {broken
                ? "This project's files are missing, so its database can't be snapshotted. This removes its containers and DDEV registration; anything on disk is left untouched."
                : "This removes the project's containers and DDEV registration. Your code stays on disk."}
            </DialogDescription>
          </DialogHeader>
          {!broken && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/70 px-3 py-2.5">
              <Checkbox
                checked={snapshotFirst}
                onCheckedChange={(v) => setSnapshotFirst(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Take a database snapshot first
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {!snapshotFirst
                    ? 'The database will be destroyed without a snapshot.'
                    : running
                      ? 'Recoverable later with a snapshot restore.'
                      : 'The stopped project is started briefly so its database can be snapshotted.'}
                </span>
              </span>
            </label>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                void runOperation({
                  kind: 'delete',
                  project: project.name,
                  omitSnapshot: broken || !snapshotFirst,
                  startFirst: !broken && snapshotFirst && !running
                })
                setDeleteOpen(false)
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
