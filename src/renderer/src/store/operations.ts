import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { OperationDescriptor, OperationLine, OperationRequest } from '@shared/types'
import { invalidateAfterOperation } from '@/lib/query-client'

/**
 * Single source of truth for ddev operations in the renderer.
 * Subscribes once to main-process operation events, keeps descriptors and
 * per-operation line buffers, and notifies React via useSyncExternalStore.
 */

const buffers = new Map<string, OperationLine[]>()
let descriptors: OperationDescriptor[] = []
/** Bumped array references so React can use them as immutable snapshots. */
const bufferSnapshots = new Map<string, OperationLine[]>()

const listeners = new Set<() => void>()
const EMPTY: OperationLine[] = []

function notify(): void {
  for (const listener of listeners) listener()
}

function projectOf(request: OperationRequest): string | undefined {
  return 'project' in request ? request.project : 'name' in request ? request.name : undefined
}

let initialized = false

export function initOperationsStore(): void {
  if (initialized) return
  initialized = true

  window.ddev.onOperationEvent((event) => {
    if (event.type === 'line') {
      const buf = buffers.get(event.id) ?? []
      buf.push(event.line)
      buffers.set(event.id, buf)
      bufferSnapshots.set(event.id, [...buf])
      notify()
      return
    }

    // status change
    descriptors = descriptors.map((d) => (d.id === event.id ? { ...d, status: event.status } : d))
    const descriptor = descriptors.find((d) => d.id === event.id)
    if (descriptor) {
      const project = projectOf(descriptor.request)
      invalidateAfterOperation(project)
      if (event.status === 'succeeded') {
        toast.success(descriptor.title, { description: 'Completed successfully' })
      } else if (event.status === 'failed') {
        const lines = buffers.get(event.id) ?? []
        const lastError = [...lines].reverse().find((l) => l.level === 'error' || l.level === 'fatal')
        toast.error(descriptor.title, {
          description: lastError?.text ?? `Exited with code ${event.exitCode ?? '?'}`
        })
      }
    }
    notify()
  })

  // Hydrate anything that was already running (e.g. after a renderer reload).
  void window.ddev.listOperations().then(async (existing) => {
    descriptors = existing
    await Promise.all(
      existing.map(async (d) => {
        const lines = await window.ddev.operationBuffer(d.id)
        buffers.set(d.id, lines)
        bufferSnapshots.set(d.id, [...lines])
      })
    )
    notify()
  })
}

export async function runOperation(request: OperationRequest): Promise<OperationDescriptor | null> {
  try {
    const descriptor = await window.ddev.runOperation(request)
    descriptors = [descriptor, ...descriptors.filter((d) => d.id !== descriptor.id)]
    buffers.set(descriptor.id, buffers.get(descriptor.id) ?? [])
    notify()
    return descriptor
  } catch (err) {
    toast.error('Could not start operation', {
      description: err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': /, '') : String(err)
    })
    return null
  }
}

export function cancelOperation(id: string): void {
  void window.ddev.cancelOperation(id)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useOperations(): OperationDescriptor[] {
  return useSyncExternalStore(subscribe, () => descriptors)
}

export function useOperationLines(id: string | null): OperationLine[] {
  return useSyncExternalStore(subscribe, () => (id ? (bufferSnapshots.get(id) ?? EMPTY) : EMPTY))
}

export function useRunningOperations(): OperationDescriptor[] {
  const all = useOperations()
  return all.filter((d) => d.status === 'running')
}

/** True while a mutating operation runs for the given project. */
export function useProjectBusy(project: string): boolean {
  const all = useOperations()
  return all.some(
    (d) =>
      d.status === 'running' &&
      projectOf(d.request) === project &&
      d.request.kind !== 'logs' &&
      d.request.kind !== 'exec'
  )
}
