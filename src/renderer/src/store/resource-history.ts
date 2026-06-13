import { useSyncExternalStore } from 'react'
import type { ProjectResourceUsage } from '@shared/types'

/**
 * Rolling time-series of live `docker stats` samples, kept in the renderer so
 * the resource charts have history to draw. Module-level (persists across
 * navigation) and fed by every consumer of useResourceStats, so a project's
 * chart is already populated by the time you open its detail page.
 */

export interface ResourceSample {
  t: number
  cpuPercent: number
  memBytes: number
  services: Record<string, { cpuPercent: number; memBytes: number }>
}

/** ~4 min of history at the 4s poll interval. */
const MAX_SAMPLES = 60

const history = new Map<string, ResourceSample[]>()
const listeners = new Set<() => void>()
/** Bumped per project so useSyncExternalStore sees a stable reference until change. */
const snapshots = new Map<string, ResourceSample[]>()
const EMPTY: ResourceSample[] = []

let lastStamp = 0

function notify(): void {
  for (const l of listeners) l()
}

/** Append one reading per project from a stats snapshot. */
export function recordResourceSample(usage: Record<string, ProjectResourceUsage>): void {
  // Guard against duplicate records within the same tick (multiple consumers).
  const now = Date.now()
  if (now - lastStamp < 500) return
  lastStamp = now

  let changed = false
  for (const [project, u] of Object.entries(usage)) {
    if (!u.services.length) continue
    const services: ResourceSample['services'] = {}
    for (const s of u.services) {
      services[s.service] = { cpuPercent: s.cpuPercent, memBytes: s.memBytes }
    }
    const sample: ResourceSample = {
      t: now,
      cpuPercent: u.cpuPercent,
      memBytes: u.memBytes,
      services
    }
    const arr = history.get(project) ?? []
    arr.push(sample)
    if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES)
    history.set(project, arr)
    snapshots.set(project, [...arr])
    changed = true
  }
  if (changed) notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useResourceHistory(project: string): ResourceSample[] {
  return useSyncExternalStore(subscribe, () => snapshots.get(project) ?? EMPTY)
}
