import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, ListTodo, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OperationConsole } from '@/components/app/operation-console'
import { LoaderCircle } from '@/components/animate-ui/icons/loader-circle'
import { useRouter } from '@/lib/router'
import { cancelOperation, useOperations } from '@/store/operations'

/**
 * Operation kinds that stream into their own dedicated surface (Logs tab,
 * Share dialog, Doctor diagnostics, Run terminal). Showing them in the dock
 * too would duplicate the live output, so the dock ignores them.
 */
const SELF_HOSTED_KINDS = new Set(['logs', 'share', 'diagnose', 'exec'])

/**
 * Bottom dock that appears while an operation is running (or just finished),
 * showing the live console. Collapsible; dismissed automatically when idle.
 */
export function OperationDock(): React.JSX.Element | null {
  const operations = useOperations()
  const { navigate } = useRouter()
  const [expanded, setExpanded] = useState(true)
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const dockable = operations.filter((o) => !SELF_HOSTED_KINDS.has(o.request.kind))
  const running = dockable.filter((o) => o.status === 'running')
  const current = running[0] ?? dockable[0] ?? null
  const visible = current !== null && current.id !== dismissedId && (running.length > 0 || currentRecent(current.startedAt))

  // New operation re-opens a dismissed dock.
  useEffect(() => {
    if (running.length > 0 && dismissedId !== null) setDismissedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running.length])

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="absolute inset-x-4 bottom-3 z-40 overflow-hidden rounded-xl border bg-popover/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            {current.status === 'running' ? (
              <LoaderCircle animate loop className="size-4 text-primary" />
            ) : (
              <span
                className={
                  current.status === 'succeeded'
                    ? 'size-2 rounded-full bg-success'
                    : 'size-2 rounded-full bg-destructive'
                }
              />
            )}
            <span className="text-sm font-medium">{current.title}</span>
            <code className="truncate text-xs text-muted-foreground">{current.command}</code>
            <div className="ml-auto flex items-center gap-1">
              {running.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate({ view: 'operations' })}
                >
                  <ListTodo className="size-3.5" /> {running.length} running
                </Button>
              )}
              {current.status === 'running' && (
                <Button variant="ghost" size="sm" onClick={() => cancelOperation(current.id)}>
                  Cancel
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setDismissedId(current.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                exit={{ height: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="overflow-hidden px-3 pb-3"
              >
                <OperationConsole operationId={current.id} className="h-[188px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Keep finished operations visible briefly is handled by dismiss; this keeps the dock for ops started in the last 10 minutes. */
function currentRecent(startedAt: number): boolean {
  return Date.now() - startedAt < 10 * 60_000
}
