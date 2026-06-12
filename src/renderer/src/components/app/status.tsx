import type { DdevStatus } from '@shared/types'
import { cn } from '@/lib/utils'
import { statusLabel, statusTone, type StatusTone } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

const DOT_COLORS: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground/50'
}

export function StatusDot({
  status,
  className
}: {
  status: DdevStatus
  className?: string
}): React.JSX.Element {
  const tone = statusTone(status)
  const pulse = status === 'running' || status === 'starting'
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-50',
            DOT_COLORS[tone]
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2 rounded-full', DOT_COLORS[tone])} />
    </span>
  )
}

const BADGE_CLASSES: Record<StatusTone, string> = {
  success: 'border-border bg-foreground/[0.04] text-foreground/90',
  warning: 'border-border bg-foreground/[0.04] text-foreground/80',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  muted: 'border-border bg-transparent text-muted-foreground'
}

export function StatusBadge({ status }: { status: DdevStatus }): React.JSX.Element {
  const tone = statusTone(status)
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 rounded-full px-2.5 font-medium capitalize', BADGE_CLASSES[tone])}
    >
      <StatusDot status={status} />
      {statusLabel(status)}
    </Badge>
  )
}
