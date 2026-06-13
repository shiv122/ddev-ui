import type { ProjectResourceUsage, ServiceResourceUsage } from '@shared/types'
import { findBinary } from './binary'
import { runCommand } from './runner'

/** One row of `docker stats --no-stream --format "{{json .}}"`. */
interface DockerStatsRow {
  Name?: string
  CPUPerc?: string
  MemUsage?: string
  MemPerc?: string
}

const UNIT_BYTES: Record<string, number> = {
  b: 1,
  kb: 1e3,
  mb: 1e6,
  gb: 1e9,
  tb: 1e12,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4
}

/** Parse a docker size token like "150MiB" / "1.5GB" / "0B" into bytes. */
function parseBytes(token: string | undefined): number {
  if (!token) return 0
  const m = token.trim().match(/^([\d.]+)\s*([a-zA-Z]+)?$/)
  if (!m) return 0
  const value = Number.parseFloat(m[1])
  if (!Number.isFinite(value)) return 0
  const unit = (m[2] ?? 'b').toLowerCase()
  return value * (UNIT_BYTES[unit] ?? 1)
}

function parsePercent(token: string | undefined): number {
  if (!token) return 0
  const value = Number.parseFloat(token.replace('%', ''))
  return Number.isFinite(value) ? value : 0
}

/**
 * Map a ddev container name to its (project, service) by matching the longest
 * known project name. ddev names containers `ddev-<project>-<service>`, and
 * project names may contain hyphens, so prefix-matching against the real list
 * is the only unambiguous split.
 */
function classify(container: string, projectNames: string[]): { project: string; service: string } | null {
  let best: { project: string; service: string } | null = null
  for (const name of projectNames) {
    const prefix = `ddev-${name}-`
    if (container.startsWith(prefix)) {
      const service = container.slice(prefix.length)
      if (service && (!best || name.length > best.project.length)) {
        best = { project: name, service }
      }
    }
  }
  return best
}

/**
 * Snapshot live CPU/memory usage for the given projects via a single
 * `docker stats --no-stream` call, aggregated per project. Projects with no
 * running containers are simply absent from the result.
 */
export async function resourceStats(
  projectNames: string[]
): Promise<Record<string, ProjectResourceUsage>> {
  if (projectNames.length === 0) return {}
  const docker = findBinary('docker')
  if (!docker) return {}

  const { exitCode, output } = await runCommand(
    docker,
    ['stats', '--no-stream', '--format', '{{json .}}'],
    { timeoutMs: 15_000 }
  )
  if (exitCode !== 0 && !output.trim()) return {}

  const result: Record<string, ProjectResourceUsage> = {}
  for (const line of output.split('\n')) {
    const text = line.trim()
    if (!text.startsWith('{')) continue
    let row: DockerStatsRow
    try {
      row = JSON.parse(text) as DockerStatsRow
    } catch {
      continue
    }
    if (!row.Name) continue
    const hit = classify(row.Name, projectNames)
    if (!hit) continue

    const [used, limit] = (row.MemUsage ?? '').split('/')
    const memBytes = parseBytes(used)
    const memLimitBytes = parseBytes(limit)
    const usage: ServiceResourceUsage = {
      service: hit.service,
      container: row.Name,
      cpuPercent: parsePercent(row.CPUPerc),
      memBytes,
      memLimitBytes,
      memPercent: parsePercent(row.MemPerc)
    }

    const entry =
      result[hit.project] ??
      (result[hit.project] = { project: hit.project, cpuPercent: 0, memBytes: 0, services: [] })
    entry.services.push(usage)
    entry.cpuPercent += usage.cpuPercent
    entry.memBytes += usage.memBytes
  }

  for (const entry of Object.values(result)) {
    entry.services.sort((a, b) => a.service.localeCompare(b.service))
    entry.cpuPercent = Math.round(entry.cpuPercent * 10) / 10
  }
  return result
}
