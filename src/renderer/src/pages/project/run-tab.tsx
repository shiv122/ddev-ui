import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { Plus, TerminalSquare } from 'lucide-react'
import type { DdevDescribe } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface ShellSessionProps {
  project: string
  service: string
  onExited: () => void
}

/** One interactive PTY session (`ddev ssh`) rendered with xterm. */
function ShellSession({ project, service, onExited }: ShellSessionProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12.5,
      fontFamily: "'SF Mono', 'JetBrains Mono', Menlo, monospace",
      lineHeight: 1.25,
      scrollback: 8000,
      theme: {
        background: '#101010',
        foreground: '#d6d6d6',
        cursor: '#e8e8e8',
        cursorAccent: '#101010',
        selectionBackground: '#3d3d3d'
      }
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)
    fit.fit()

    let termId: string | null = null
    let disposed = false

    const offData = window.ddev.onTerminalData(({ id, data }) => {
      if (id === termId) term.write(data)
    })
    const offExit = window.ddev.onTerminalExit(({ id, exitCode }) => {
      if (id === termId) {
        termId = null
        term.write(`\r\n\x1b[2m[session ended with code ${exitCode}]\x1b[0m\r\n`)
        onExitedRef.current()
      }
    })

    term.writeln(`\x1b[2mConnecting to ${service} container of ${project}…\x1b[0m`)
    window.ddev
      .createTerminal(project, service, term.cols, term.rows)
      .then(({ id }) => {
        if (disposed) {
          window.ddev.disposeTerminal(id)
          return
        }
        termId = id
        term.onData((data) => termId && window.ddev.writeTerminal(termId, data))
        term.onResize(({ cols, rows }) => termId && window.ddev.resizeTerminal(termId, cols, rows))
        window.ddev.resizeTerminal(id, term.cols, term.rows)
        term.focus()
      })
      .catch((err: Error) => {
        term.writeln(`\x1b[31m${err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}\x1b[0m`)
        onExitedRef.current()
      })

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        // container momentarily 0-sized during tab switches
      }
    })
    resizeObserver.observe(el)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      offData()
      offExit()
      if (termId) window.ddev.disposeTerminal(termId)
      term.dispose()
    }
  }, [project, service])

  return <div ref={containerRef} className="h-full w-full" />
}

export function RunTab({
  info,
  initialService
}: {
  info: DdevDescribe
  initialService?: string
}): React.JSX.Element {
  const serviceNames = Object.keys(info.services ?? {})
  const [service, setService] = useState(initialService ?? 'web')
  const [sessionNonce, setSessionNonce] = useState(0)
  const [exited, setExited] = useState(false)
  const running = info.status === 'running'

  const newSession = (nextService?: string): void => {
    if (nextService) setService(nextService)
    setExited(false)
    setSessionNonce((n) => n + 1)
  }

  return (
    <div className="flex h-[68vh] min-h-[460px] flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Container</Label>
          <Select value={service} onValueChange={(s) => newSession(s)} disabled={!running}>
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
        <p className="pb-2 text-xs text-muted-foreground">
          Interactive shell via <code>ddev ssh</code> — composer, artisan, npm, anything.
        </p>
        <div className="ml-auto pb-0.5">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={!running}
            onClick={() => newSession()}
          >
            <Plus className="size-3.5" /> {exited ? 'Restart session' : 'New session'}
          </Button>
        </div>
      </div>

      <div className="metal-card relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#101010] p-2">
        {running ? (
          <ShellSession
            key={`${info.name}:${service}:${sessionNonce}`}
            project={info.name}
            service={service}
            onExited={() => setExited(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <TerminalSquare className="size-8 opacity-50" />
            <p className="text-sm">Start the project to open a shell in its containers.</p>
          </div>
        )}
      </div>
    </div>
  )
}
