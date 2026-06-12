import { Bug, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { DdevDescribe } from '@shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { firstLine } from '@/lib/format'
import { runOperation, useProjectBusy } from '@/store/operations'

function InfoItem({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || '—'}</dd>
    </div>
  )
}

export function OverviewTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const busy = useProjectBusy(info.name)
  const running = info.status === 'running'
  const services = Object.entries(info.services ?? {})

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <InfoItem label="PHP" value={info.php_version} />
            <InfoItem label="Webserver" value={info.webserver_type} />
            <InfoItem label="Database" value={`${info.database_type} ${info.database_version}`} />
            <InfoItem label="Node.js" value={info.nodejs_version} />
            <InfoItem label="Docroot" value={info.docroot || '.'} />
            <InfoItem
              label="Performance"
              value={
                info.performance_mode === 'mutagen' ? (
                  <span title={info.mutagen_status}>mutagen ({firstLine(info.mutagen_status, 40)})</span>
                ) : (
                  info.performance_mode || 'none'
                )
              }
            />
            <InfoItem label="Router" value={running ? `${info.router} (${info.router_status})` : info.router} />
            <InfoItem label="Web image" value={<span className="break-all text-xs">{info.webimg}</span>} />
            <InfoItem label="DB image" value={<span className="break-all text-xs">{info.dbimg}</span>} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="size-4" /> Debugging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="xdebug-switch" className="text-sm">
                Xdebug
              </Label>
              <p className="text-xs text-muted-foreground">Step debugging on port 9003</p>
            </div>
            <Switch
              id="xdebug-switch"
              checked={info.xdebug_enabled}
              disabled={!running || busy}
              onCheckedChange={(checked) => {
                void runOperation({ kind: 'xdebug', project: info.name, enable: checked })
                toast.info(`Turning Xdebug ${checked ? 'on' : 'off'}…`)
              }}
            />
          </div>
          {!running && (
            <p className="text-xs text-muted-foreground">Start the project to toggle Xdebug.</p>
          )}
          {info.xhgui_status && info.xhgui_status !== 'disabled' && (
            <div className="text-xs text-muted-foreground">XHGui: {info.xhgui_status}</div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(info.urls ?? []).map((url) => (
            <button
              key={url}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-primary hover:bg-accent"
              onClick={() => void window.ddev.openExternal(url)}
            >
              <ExternalLink className="size-3.5 shrink-0" />
              <span className="truncate">{url}</span>
            </button>
          ))}
          {(!info.urls || info.urls.length === 0) && (
            <p className="text-sm text-muted-foreground">Available when the project is running.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">No containers (project stopped).</p>
          )}
          {services.map(([key, svc]) => (
            <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{key}</div>
                <div className="truncate text-xs text-muted-foreground">{svc.image}</div>
              </div>
              <Badge
                variant="outline"
                className={
                  svc.status?.includes('healthy') || svc.status === 'running'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'text-muted-foreground'
                }
              >
                {svc.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
