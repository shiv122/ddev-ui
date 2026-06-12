import { useState } from 'react'
import { Activity, CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import type { OperationDescriptor } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OperationConsole } from '@/components/app/operation-console'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cancelOperation, useOperations } from '@/store/operations'

function StatusIcon({ status }: { status: OperationDescriptor['status'] }): React.JSX.Element {
  switch (status) {
    case 'running':
      return <LoaderCircle animate loop className="size-4 text-primary" />
    case 'succeeded':
      return <CheckCircle2 className="size-4 text-success" />
    case 'failed':
      return <XCircle className="size-4 text-destructive" />
    case 'cancelled':
      return <CircleSlash className="size-4 text-muted-foreground" />
  }
}

export function OperationsPage({ selected }: { selected?: string }): React.JSX.Element {
  const operations = useOperations()
  const [selectedId, setSelectedId] = useState<string | null>(selected ?? null)
  const current = operations.find((o) => o.id === selectedId) ?? operations[0] ?? null

  return (
    <div className="mx-auto flex h-full w-full max-w-[1560px] flex-col gap-4 p-6">
      <div>
        <h1 className="text-metallic flex items-center gap-2 text-[26px] font-bold tracking-tight">
          <Activity className="size-6 text-primary" /> Activity
        </h1>
        <p className="text-sm text-muted-foreground">
          Every ddev command this session, with live output.
        </p>
      </div>

      {operations.length === 0 ? (
        <Card className="py-14">
          <CardContent className="text-center text-sm text-muted-foreground">
            Nothing has run yet. Start or stop a project to see activity here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="scrollbar-thin min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {operations.map((op) => (
              <button
                key={op.id}
                onClick={() => setSelectedId(op.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  current?.id === op.id ? 'border-primary/50 bg-accent' : 'hover:bg-accent/50'
                )}
              >
                <StatusIcon status={op.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{op.title}</div>
                  <div className="text-xs text-muted-foreground">{formatTime(op.startedAt)}</div>
                </div>
                {op.status === 'running' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      cancelOperation(op.id)
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            {current && (
              <code className="truncate text-xs text-muted-foreground">{current.command}</code>
            )}
            <OperationConsole operationId={current?.id ?? null} className="flex-1" />
          </div>
        </div>
      )}
    </div>
  )
}
