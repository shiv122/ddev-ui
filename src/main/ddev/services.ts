import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ServiceComposeConfig } from '@shared/types'
import { findBinary } from './binary'
import { ddevClient } from './client'
import { runCommand } from './runner'

const FULL_COMPOSE = '.ddev-docker-compose-full.yaml'

/**
 * Pull one service's block out of DDEV's rendered compose file. The file is
 * generated with stable two-space indentation under a top-level `services:`
 * key, so we can slice the block by indentation without a YAML parser.
 */
function extractServiceBlock(yaml: string, service: string): string | null {
  const lines = yaml.split('\n')
  const header = `  ${service}:`
  const start = lines.findIndex((l) => l === header || l.startsWith(`${header} `))
  if (start === -1) return null

  const block: string[] = [lines[start].slice(2)]
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    // A non-empty line indented two spaces or less ends this service's block.
    if (line.trim() !== '' && !line.startsWith('   ')) break
    block.push(line.slice(2))
  }
  return block.join('\n').trimEnd()
}

/**
 * Configuration for a single service: the rendered compose block (read-only)
 * and any editable `docker-compose.<service>*.yaml` override files in .ddev.
 */
export async function serviceConfig(project: string, service: string): Promise<ServiceComposeConfig> {
  const approot = await ddevClient.approotFor(project)
  const ddevDir = join(approot, '.ddev')

  let rendered: string | null = null
  try {
    rendered = extractServiceBlock(await readFile(join(ddevDir, FULL_COMPOSE), 'utf8'), service)
  } catch {
    // project never started / file absent — leave null
  }

  let overrideFiles: string[] = []
  try {
    const entries = await readdir(ddevDir)
    const re = new RegExp(`^docker-compose\\.${service}([._-][^.]*)?\\.ya?ml$`)
    overrideFiles = entries.filter((f) => re.test(f)).sort()
  } catch {
    // no .ddev dir
  }

  return { rendered, overrideFiles, approot }
}

/**
 * The live Xdebug state. `ddev describe` only reports the configured default
 * (often false) and not the runtime toggle, so we read `ddev xdebug status`.
 */
export async function xdebugStatus(project: string): Promise<boolean> {
  const ddev = findBinary('ddev')
  if (!ddev) return false
  const approot = await ddevClient.approotFor(project)
  const { output } = await runCommand(ddev, ['xdebug', 'status'], { cwd: approot, timeoutMs: 20_000 })
  const text = output.toLowerCase()
  if (text.includes('disabled')) return false
  return text.includes('enabled')
}
