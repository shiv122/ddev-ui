import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ServiceResourceLimit } from '@shared/types'

/**
 * DDEV merges any `.ddev/docker-compose.*.yaml` files into the generated
 * config, so per-service CPU/memory ceilings are applied by writing a managed
 * override file rather than via a ddev flag (ddev has none). The active limits
 * are mirrored into a header comment so we can read them back without pulling
 * in a YAML parser.
 */
const FILE_NAME = 'docker-compose.resources.yaml'
const MARKER = '# ddevui-resources:'

function filePath(approot: string): string {
  return join(approot, '.ddev', FILE_NAME)
}

function hasLimit(l: ServiceResourceLimit): boolean {
  return l.cpus.trim() !== '' || l.memory.trim() !== ''
}

/** Read the limits currently applied by our managed override file. */
export async function readResourceLimits(approot: string): Promise<ServiceResourceLimit[]> {
  let content: string
  try {
    content = await readFile(filePath(approot), 'utf8')
  } catch {
    return []
  }
  const markerLine = content.split('\n').find((l) => l.trim().startsWith(MARKER))
  if (!markerLine) return []
  try {
    const json = markerLine.trim().slice(MARKER.length).trim()
    const parsed = JSON.parse(json) as Record<string, { cpus?: string; memory?: string }>
    return Object.entries(parsed).map(([service, v]) => ({
      service,
      cpus: v.cpus ?? '',
      memory: v.memory ?? ''
    }))
  } catch {
    return []
  }
}

function render(limits: ServiceResourceLimit[]): string {
  const active = limits.filter(hasLimit)
  const meta: Record<string, { cpus?: string; memory?: string }> = {}
  for (const l of active) {
    meta[l.service] = {
      ...(l.cpus.trim() ? { cpus: l.cpus.trim() } : {}),
      ...(l.memory.trim() ? { memory: l.memory.trim() } : {})
    }
  }

  const lines = [
    '# Managed by DDevUI — per-service resource limits (project → Resources tab).',
    '# Edit through the app; manual changes to this file may be overwritten.',
    `${MARKER} ${JSON.stringify(meta)}`,
    'services:'
  ]
  for (const l of active) {
    lines.push(`  ${l.service}:`)
    lines.push('    deploy:')
    lines.push('      resources:')
    lines.push('        limits:')
    if (l.cpus.trim()) lines.push(`          cpus: "${l.cpus.trim()}"`)
    if (l.memory.trim()) lines.push(`          memory: ${l.memory.trim()}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * Write (or, when no service has a limit, remove) the managed override file.
 * Returns true when a limits file is present afterward.
 */
export async function writeResourceLimits(
  approot: string,
  limits: ServiceResourceLimit[]
): Promise<boolean> {
  const path = filePath(approot)
  if (!limits.some(hasLimit)) {
    try {
      await unlink(path)
    } catch {
      // nothing to remove
    }
    return false
  }
  await writeFile(path, render(limits), 'utf8')
  return true
}
