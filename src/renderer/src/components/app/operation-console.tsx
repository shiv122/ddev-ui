import { useEffect, useRef } from 'react'
import type { OperationLine } from '@shared/types'
import { cn } from '@/lib/utils'
import { useOperationLines } from '@/store/operations'

const LEVEL_CLASSES: Record<OperationLine['level'], string> = {
  debug: 'text-muted-foreground/60',
  info: 'text-foreground/90',
  warning: 'text-warning',
  error: 'text-destructive',
  fatal: 'text-destructive font-semibold',
  stdout: 'text-foreground/90',
  stderr: 'text-muted-foreground'
}

export function OperationConsole({
  operationId,
  className
}: {
  operationId: string | null
  className?: string
}): React.JSX.Element {
  const lines = useOperationLines(operationId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget
        pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      }}
      className={cn(
        'scrollbar-thin h-full overflow-auto rounded-lg border bg-black/40 p-3 font-mono text-xs leading-relaxed',
        className
      )}
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground">Waiting for output…</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className={cn('whitespace-pre-wrap break-all', LEVEL_CLASSES[line.level])}>
            {line.text}
          </div>
        ))
      )}
    </div>
  )
}
