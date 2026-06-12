import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DdevAddon,
  DdevDescribe,
  DdevInstalledAddon,
  DdevProject,
  DdevSnapshot,
  DdevVersionInfo
} from '@shared/types'
import { runDdevJson } from './runner'

/**
 * Typed wrapper around ddev's query commands. Also keeps an approot cache so
 * operations that must run inside a project directory (xdebug, import-db,
 * add-on get, ...) can resolve a project name to its path.
 */
class DdevClient {
  private approots = new Map<string, string>()

  async list(): Promise<DdevProject[]> {
    const { raw } = await runDdevJson<DdevProject[]>(['list'])
    const projects = Array.isArray(raw) ? raw : []
    for (const p of projects) {
      if (p.name && p.approot) this.approots.set(p.name, p.approot)
    }
    return projects
  }

  async describe(project: string): Promise<DdevDescribe> {
    const { raw } = await runDdevJson<DdevDescribe>(['describe', project])
    if (raw.name && raw.approot) this.approots.set(raw.name, raw.approot)
    return raw
  }

  async version(): Promise<DdevVersionInfo> {
    const { raw } = await runDdevJson<DdevVersionInfo>(['version'], { timeoutMs: 60_000 })
    return raw
  }

  async addonRegistry(): Promise<DdevAddon[]> {
    const { raw } = await runDdevJson<DdevAddon[]>(['add-on', 'list'], { timeoutMs: 60_000 })
    return Array.isArray(raw) ? raw : []
  }

  async addonsInstalled(project: string): Promise<DdevInstalledAddon[]> {
    const cwd = await this.approotFor(project)
    try {
      const { raw } = await runDdevJson<DdevInstalledAddon[]>(
        ['add-on', 'list', '--installed', '--project', project],
        { cwd }
      )
      return Array.isArray(raw) ? raw : []
    } catch {
      // ddev exits non-zero / returns nothing when no add-ons are installed.
      return []
    }
  }

  async snapshots(project: string): Promise<DdevSnapshot[]> {
    const cwd = await this.approotFor(project)
    try {
      const { raw } = await runDdevJson<unknown>(['snapshot', '--list', project], { cwd })
      return normalizeSnapshots(raw, project)
    } catch {
      return []
    }
  }

  async readConfigFile(project: string): Promise<string> {
    const approot = await this.approotFor(project)
    return readFile(join(approot, '.ddev', 'config.yaml'), 'utf8')
  }

  async approotFor(project: string): Promise<string> {
    const cached = this.approots.get(project)
    if (cached) return cached
    await this.list()
    const found = this.approots.get(project)
    if (!found) throw new Error(`Unknown ddev project: ${project}`)
    return found
  }
}

function normalizeSnapshots(raw: unknown, project: string): DdevSnapshot[] {
  // Observed shapes: array of snapshots, or map of project name -> snapshots.
  // Entries may be objects ({Name, Created}) or bare strings.
  let entries: unknown[] = []
  if (Array.isArray(raw)) {
    entries = raw
  } else if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>
    const forProject = map[project]
    entries = Array.isArray(forProject) ? forProject : Object.values(map).flat()
  }
  return entries
    .map((entry): DdevSnapshot | null => {
      if (typeof entry === 'string') return { Name: entry, Created: '' }
      if (entry && typeof entry === 'object' && 'Name' in entry) {
        const e = entry as { Name: string; Created?: string }
        return { Name: e.Name, Created: e.Created ?? '' }
      }
      return null
    })
    .filter((s): s is DdevSnapshot => s !== null)
}

export const ddevClient = new DdevClient()
