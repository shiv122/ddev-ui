import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { DockerProvider } from '@shared/types'
import { findBinary } from './ddev/binary'

interface ProviderDef {
  id: DockerProvider['id']
  name: string
  /** macOS .app bundle name under /Applications. */
  macApp?: string
  /** Candidate Windows executable paths. */
  winPaths?: string[]
  /** CLI binary to detect/launch (e.g. colima). */
  cli?: string
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'docker-desktop',
    name: 'Docker Desktop',
    macApp: 'Docker',
    winPaths: ['C:/Program Files/Docker/Docker/Docker Desktop.exe']
  },
  { id: 'orbstack', name: 'OrbStack', macApp: 'OrbStack' },
  {
    id: 'rancher',
    name: 'Rancher Desktop',
    macApp: 'Rancher Desktop',
    winPaths: ['C:/Program Files/Rancher Desktop/Rancher Desktop.exe']
  },
  { id: 'colima', name: 'Colima', cli: 'colima' }
]

function isAvailable(p: ProviderDef): boolean {
  if (process.platform === 'darwin' && p.macApp) return existsSync(`/Applications/${p.macApp}.app`)
  if (process.platform === 'win32' && p.winPaths) return p.winPaths.some((w) => existsSync(w))
  if (p.cli) return findBinary(p.cli) !== null
  return false
}

/** Container runtimes installed on this machine that we know how to launch. */
export function detectDockerProviders(): DockerProvider[] {
  return PROVIDERS.filter(isAvailable).map((p) => ({ id: p.id, name: p.name }))
}

/** Launch a provider's app/daemon. Resolves once spawned (it starts in the background). */
export async function startDockerProvider(id: string): Promise<void> {
  const def = PROVIDERS.find((p) => p.id === id)
  if (!def) throw new Error(`Unknown provider: ${id}`)

  if (def.cli) {
    const cli = findBinary(def.cli)
    if (!cli) throw new Error(`${def.name} CLI not found on PATH`)
    spawn(cli, ['start'], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  if (process.platform === 'darwin' && def.macApp) {
    spawn('open', ['-a', def.macApp], { stdio: 'ignore' }).unref()
    return
  }
  if (process.platform === 'win32' && def.winPaths) {
    const exe = def.winPaths.find((w) => existsSync(w))
    if (!exe) throw new Error(`${def.name} not found`)
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
    return
  }
  throw new Error(`Cannot launch ${def.name} on this platform`)
}
