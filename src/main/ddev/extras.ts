import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ExtraKind, GlobalConfig, ProjectExtras } from '@shared/types'
import { ddevClient } from './client'

/* ------------------------- discovery ------------------------- */

async function listDir(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).map((e) => e.name)
  } catch {
    return []
  }
}

/** Extract the top-level `hooks:` block (until the next top-level key). */
function extractHooksBlock(yaml: string): string | null {
  const m = yaml.match(/^hooks:[^\n]*\n((?:[ \t]+[^\n]*\n|[ \t]*\n)*)/m)
  if (!m) return null
  const block = `hooks:\n${m[1]}`.trimEnd()
  return block.length > 'hooks:'.length ? block : null
}

export async function projectExtras(project: string): Promise<ProjectExtras> {
  const approot = await ddevClient.approotFor(project)
  const ddevDir = join(approot, '.ddev')

  const [rootFiles, webBuild, hostCmds, webCmds] = await Promise.all([
    listDir(ddevDir),
    listDir(join(ddevDir, 'web-build')),
    listDir(join(ddevDir, 'commands', 'host')),
    listDir(join(ddevDir, 'commands', 'web'))
  ])

  let hooks: string | null = null
  try {
    hooks = extractHooksBlock(await readFile(join(ddevDir, 'config.yaml'), 'utf8'))
  } catch {
    // no config.yaml — leave hooks null
  }

  return {
    composeFiles: rootFiles.filter(
      (f) => /^docker-compose\..+\.ya?ml$/.test(f) && !f.includes('.ddev.')
    ),
    webDockerfiles: webBuild.filter((f) => /^(pre\.)?Dockerfile(\..+)?$/.test(f) && !f.endsWith('.example')),
    hostCommands: hostCmds.filter((f) => !f.endsWith('.example')),
    webCommands: webCmds.filter((f) => !f.endsWith('.example')),
    hasTraefikDir: existsSync(join(ddevDir, 'traefik')),
    hasCustomCerts: existsSync(join(ddevDir, 'custom_certs')),
    hooks,
    approot
  }
}

/* ------------------------- creation templates ------------------------- */

const sanitize = (name: string): string => name.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '')

function composeTemplate(name: string): string {
  return `# Custom service "${name}" — merged into this project's docker-compose config.
# Prefer an add-on if one exists: https://addons.ddev.com
# Docs: https://docs.ddev.com/en/stable/users/extend/custom-compose-files/
services:
  ${name}:
    container_name: ddev-\${DDEV_SITENAME}-${name}
    image: busybox:stable
    command: tail -f /dev/null
    restart: "no"
    labels:
      com.ddev.site-name: \${DDEV_SITENAME}
      com.ddev.approot: \${DDEV_APPROOT}
    # To expose the service through the router on https://<project>.ddev.site:<port>:
    # expose:
    #   - "9999"
    # environment:
    #   - VIRTUAL_HOST=$DDEV_HOSTNAME
    #   - HTTP_EXPOSE=9998:9999
    #   - HTTPS_EXPOSE=9999:9999
`
}

function webDockerfileTemplate(name: string): string {
  return `# ${name} — extends the ddev web image. Applied at ddev start (image rebuild).
# Docs: https://docs.ddev.com/en/stable/users/extend/customizing-images/
# Example:
# RUN npm install -g pnpm
`
}

function commandTemplate(name: string, where: 'host' | 'web'): string {
  return `#!/usr/bin/env bash
## Description: ${name} custom command
## Usage: ${name}
## Example: "ddev ${name}"

# Runs ${where === 'web' ? 'inside the web container' : 'on your host machine, in the project root'}.
# Docs: https://docs.ddev.com/en/stable/users/extend/custom-commands/
echo "Hello from ddev ${name}"
`
}

export interface CreatedExtra {
  /** Absolute path of the created file/directory. */
  path: string
}

export async function createExtra(
  project: string,
  kind: ExtraKind,
  rawName: string
): Promise<CreatedExtra> {
  const approot = await ddevClient.approotFor(project)
  const ddevDir = join(approot, '.ddev')
  const name = sanitize(rawName)
  if (!name && kind !== 'certs-dir') throw new Error('Invalid name')

  switch (kind) {
    case 'compose': {
      const path = join(ddevDir, `docker-compose.${name}.yaml`)
      if (existsSync(path)) throw new Error(`${name} already exists`)
      await writeFile(path, composeTemplate(name), { flag: 'wx' })
      return { path }
    }
    case 'web-dockerfile': {
      const dir = join(ddevDir, 'web-build')
      await mkdir(dir, { recursive: true })
      const path = join(dir, name === 'Dockerfile' ? 'Dockerfile' : `Dockerfile.${name}`)
      if (existsSync(path)) throw new Error(`${name} already exists`)
      await writeFile(path, webDockerfileTemplate(name), { flag: 'wx' })
      return { path }
    }
    case 'host-command':
    case 'web-command': {
      const where = kind === 'host-command' ? 'host' : 'web'
      const dir = join(ddevDir, 'commands', where)
      await mkdir(dir, { recursive: true })
      const path = join(dir, name)
      if (existsSync(path)) throw new Error(`${name} already exists`)
      await writeFile(path, commandTemplate(name, where), { flag: 'wx' })
      await chmod(path, 0o755)
      return { path }
    }
    case 'certs-dir': {
      const path = join(ddevDir, 'custom_certs')
      await mkdir(path, { recursive: true })
      return { path }
    }
  }
}

/* ------------------------- global config ------------------------- */

export async function readGlobalConfig(): Promise<GlobalConfig> {
  const path = join(homedir(), '.ddev', 'global_config.yaml')
  let raw = ''
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    // missing global config — defaults below
  }
  const scalar = (key: string): string => {
    const m = raw.match(new RegExp(`^${key}:\\s*["']?([^"'\\n#]*)["']?\\s*$`, 'm'))
    return m ? m[1].trim() : ''
  }
  return {
    performance_mode: scalar('performance_mode') || 'none',
    instrumentation_opt_in: scalar('instrumentation_opt_in') === 'true',
    router_http_port: scalar('router_http_port') || '80',
    router_https_port: scalar('router_https_port') || '443',
    raw
  }
}
