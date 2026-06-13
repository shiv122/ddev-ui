import { FolderOpen, Globe, Mail, TerminalSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/app/status'
import { ProjectActions } from '@/components/app/project-actions'
import { ProjectTypeIcon } from '@/components/app/project-type-icon'
import { ShareDialog } from '@/components/app/share-dialog'
import { useDescribe, useProjects } from '@/api/hooks'
import { projectTypeLabel } from '@/lib/format'
import { OverviewTab } from './overview-tab'
import { DatabaseTab } from './database-tab'
import { LogsTab } from './logs-tab'
import { AddonsTab } from './addons-tab'
import { ConfigTab } from './config-tab'
import { ResourcesTab } from './resources-tab'
import { RunTab } from './run-tab'
import { AdvancedTab } from './advanced-tab'

export function ProjectPage({
  name,
  initialTab
}: {
  name: string
  initialTab?: string
}): React.JSX.Element {
  const describe = useDescribe(name)
  const projects = useProjects()
  const listEntry = projects.data?.find((p) => p.name === name)
  const info = describe.data
  const running = info?.status === 'running'

  return (
    <div className="mx-auto w-full max-w-[1560px] space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <ProjectTypeIcon
            type={info?.type ?? listEntry?.type ?? ''}
            className="size-14 rounded-xl"
            iconClassName="size-7"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-metallic truncate text-[26px] font-bold tracking-tight">{name}</h1>
              {info ? (
                <StatusBadge status={info.status} />
              ) : (
                listEntry && <StatusBadge status={listEntry.status} />
              )}
              <Badge variant="secondary" className="rounded-full">
                {projectTypeLabel(info?.type ?? listEntry?.type ?? '')}
              </Badge>
            </div>
            <button
              className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => info && void window.ddev.revealPath(info.approot)}
            >
              <FolderOpen className="size-3.5" />
              {info?.shortroot ?? listEntry?.shortroot ?? ''}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {info && <ShareDialog info={info} />}
          {running && info && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void window.ddev.openExternal(info.primary_url)}
                  >
                    <Globe className="size-3.5" /> Open
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{info.primary_url}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void window.ddev.openExternal(info.mailpit_https_url)}
                  >
                    <Mail className="size-3.5" /> Mailpit
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Outgoing email capture</TooltipContent>
              </Tooltip>
            </>
          )}
          {listEntry && <ProjectActions project={listEntry} size="sm" />}
        </div>
      </div>

      {describe.isLoading && !info ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : describe.isError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load project details: {(describe.error as Error).message}
        </div>
      ) : info ? (
        <Tabs defaultValue={initialTab ?? 'overview'} className="gap-5">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="run" className="gap-1.5">
              <TerminalSquare className="size-3.5" /> Run
            </TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab info={info} />
          </TabsContent>
          <TabsContent value="database">
            <DatabaseTab info={info} />
          </TabsContent>
          <TabsContent value="logs">
            <LogsTab info={info} />
          </TabsContent>
          <TabsContent value="addons">
            <AddonsTab info={info} />
          </TabsContent>
          <TabsContent value="config">
            <ConfigTab info={info} />
          </TabsContent>
          <TabsContent value="resources">
            <ResourcesTab info={info} />
          </TabsContent>
          <TabsContent value="run">
            <RunTab info={info} />
          </TabsContent>
          <TabsContent value="advanced">
            <AdvancedTab info={info} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
