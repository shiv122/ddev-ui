import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

/**
 * GUI apps on macOS/Linux don't inherit the user's shell PATH when launched
 * from Finder/Dock, so common install locations are appended explicitly.
 */
const EXTRA_DIRS =
  process.platform === 'win32'
    ? []
    : [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        join(process.env.HOME ?? '', '.local/bin'),
        join(process.env.HOME ?? '', 'bin')
      ]

export function augmentedEnv(): NodeJS.ProcessEnv {
  const current = process.env.PATH ?? ''
  const parts = current.split(delimiter)
  for (const dir of EXTRA_DIRS) {
    if (dir && !parts.includes(dir)) parts.push(dir)
  }
  return { ...process.env, PATH: parts.join(delimiter) }
}

export function findBinary(name: string): string | null {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const path = augmentedEnv().PATH ?? ''
  for (const dir of path.split(delimiter)) {
    if (!dir) continue
    const candidate = join(dir, exe)
    if (existsSync(candidate)) return candidate
  }
  return null
}

let cachedDdev: string | null | undefined

export function ddevBinary(): string | null {
  if (cachedDdev === undefined) cachedDdev = findBinary('ddev')
  return cachedDdev
}

/** Re-detect on demand (e.g. after the user installs ddev and hits "re-check"). */
export function resetBinaryCache(): void {
  cachedDdev = undefined
}
