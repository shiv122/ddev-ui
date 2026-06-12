import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import type { DdevDescribe } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { OperationConsole } from '@/components/app/operation-console'
import { cancelOperation, runOperation, useOperations } from '@/store/operations'

export function LogsTab({ info }: { info: DdevDescribe }): React.JSX.Element {
  const serviceNames = Object.keys(info.services ?? {})
  const [service, setService] = useState(serviceNames.includes('web') ? 'web' : (serviceNames[0] ?? 'web'))
  const [follow, setFollow] = useState(true)
  const [tail, setTail] = useState('200')
  const [opId, setOpId] = useState<string | null>(null)
  const operations = useOperations()
  const currentOp = operations.find((o) => o.id === opId)
  const streaming = currentOp?.status === 'running'

  // Stop a follow stream when leaving the tab/page.
  const opIdRef = useRef<string | null>(null)
  opIdRef.current = streaming ? opId : null
  useEffect(
    () => () => {
      if (opIdRef.current) cancelOperation(opIdRef.current)
    },
    []
  )

  const start = async (): Promise<void> => {
    const descriptor = await runOperation({
      kind: 'logs',
      project: info.name,
      service,
      follow,
      tail: Number(tail)
    })
    if (descriptor) setOpId(descriptor.id)
  }

  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Service</Label>
          <Select value={service} onValueChange={setService} disabled={streaming}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(serviceNames.length > 0 ? serviceNames : ['web', 'db']).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tail lines</Label>
          <Select value={tail} onValueChange={setTail} disabled={streaming}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['100', '200', '500', '1000'].map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="follow" checked={follow} onCheckedChange={setFollow} disabled={streaming} />
          <Label htmlFor="follow" className="text-sm">
            Follow
          </Label>
        </div>
        <div className="ml-auto pb-0.5">
          {streaming ? (
            <Button variant="secondary" className="gap-1.5" onClick={() => opId && cancelOperation(opId)}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button
              className="gap-1.5"
              disabled={info.status !== 'running'}
              onClick={() => void start()}
            >
              <Play className="size-3.5" /> Stream logs
            </Button>
          )}
        </div>
      </div>
      {info.status !== 'running' && (
        <p className="text-sm text-muted-foreground">Start the project to read container logs.</p>
      )}
      <OperationConsole operationId={opId} className="flex-1" />
    </div>
  )
}
