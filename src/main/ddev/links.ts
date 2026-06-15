import { readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectGraph, ProjectGraphNode, ProjectLink } from '@shared/types'
import { ddevClient } from './client'

/**
 * Cross-project links are applied by writing a managed compose override that
 * adds connection env vars to the consumer's web container. DDEV merges any
 * `.ddev/docker-compose.*.yaml`, and every project sits on the shared
 * `ddev_default` network, so `ddev-<provider>-<service>` is already routable.
 * The active links are mirrored into a header comment for read-back.
 */
const FILE_NAME = 'docker-compose.ddevui-links.yaml'
const MARKER = '# ddevui-links:'

/** Best-effort default internal port per well-known service. */
const SERVICE_PORTS: Record<string, number> = {
  db: 3306,
  redis: 6379,
  'redis-insight': 5540,
  valkey: 6379,
  keydb: 6379,
  memcached: 11211,
  mongo: 27017,
  elasticsearch: 9200,
  opensearch: 9200,
  solr: 8983,
  meilisearch: 7700,
  typesense: 8108,
  rabbitmq: 5672,
  minio: 9000,
  postgres: 5432
}

export function servicePort(service: string): number | undefined {
  return SERVICE_PORTS[service]
}

function filePath(approot: string): string {
  return join(approot, '.ddev', FILE_NAME)
}

/** Sanitize an env-var prefix to uppercase letters/digits/underscore. */
export function sanitizeEnvPrefix(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export async function readLinks(approot: string): Promise<ProjectLink[]> {
  let content: string
  try {
    content = await readFile(filePath(approot), 'utf8')
  } catch {
    return []
  }
  const markerLine = content.split('\n').find((l) => l.trim().startsWith(MARKER))
  if (!markerLine) return []
  try {
    return JSON.parse(markerLine.trim().slice(MARKER.length).trim()) as ProjectLink[]
  } catch {
    return []
  }
}

function render(links: ProjectLink[]): string {
  const lines = [
    '# Managed by DDevUI — cross-project service links (Connections map).',
    '# Edit through the app; manual changes here may be overwritten.',
    `${MARKER} ${JSON.stringify(links)}`,
    'services:',
    '  web:',
    '    environment:'
  ]
  for (const l of links) {
    lines.push(`      - ${l.envPrefix}_HOST=${l.host}`)
    if (l.port) lines.push(`      - ${l.envPrefix}_PORT=${l.port}`)
  }
  return lines.join('\n') + '\n'
}

/** Write (or remove, when empty) the managed links override for a consumer. */
export async function writeLinks(project: string, links: ProjectLink[]): Promise<void> {
  const approot = await ddevClient.approotFor(project)
  const path = filePath(approot)
  if (links.length === 0) {
    try {
      await unlink(path)
    } catch {
      // nothing to remove
    }
    return
  }
  // Backfill host/port so the renderer only needs to send (from, to, service, prefix).
  const filled = links.map((l) => ({
    ...l,
    host: l.host || `ddev-${l.to}-${l.service}`,
    port: l.port ?? servicePort(l.service)
  }))
  await writeFile(path, render(filled), 'utf8')
}

/** Top-level service names from a project's rendered compose file. */
async function composeServices(approot: string): Promise<string[]> {
  for (const file of ['.ddev-docker-compose-full.yaml', '.ddev-docker-compose-base.yaml']) {
    try {
      const yaml = await readFile(join(approot, '.ddev', file), 'utf8')
      const names: string[] = []
      let inServices = false
      for (const line of yaml.split('\n')) {
        if (/^services:\s*$/.test(line)) {
          inServices = true
          continue
        }
        if (inServices) {
          if (/^\S/.test(line)) break // next top-level key
          const m = line.match(/^ {2}([A-Za-z0-9._-]+):\s*$/)
          if (m) names.push(m[1])
        }
      }
      if (names.length) return names
    } catch {
      // try next file
    }
  }
  return []
}

/** Assemble the full connections graph: every project plus its links. */
export async function projectsGraph(): Promise<ProjectGraph> {
  const projects = await ddevClient.list()
  const nodes: ProjectGraphNode[] = []
  const links: ProjectLink[] = []

  for (const p of projects) {
    const approot = p.approot
    const [services, projectLinks] = await Promise.all([
      composeServices(approot),
      readLinks(approot)
    ])
    nodes.push({
      name: p.name,
      type: p.type,
      status: p.status,
      approot,
      services: services.filter((s) => s !== 'web')
    })
    links.push(...projectLinks)
  }

  // Drop links whose endpoints no longer exist.
  const names = new Set(nodes.map((n) => n.name))
  return { nodes, links: links.filter((l) => names.has(l.from) && names.has(l.to)) }
}
