import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import type { BinaryInfo } from '@shared/types'

const HOME = process.env.HOME ?? ''

/**
 * GUI apps on macOS/Linux don't inherit the user's shell PATH when launched
 * from Finder/Dock. Two defenses, applied in order:
 *  1. `initLoginShellPath()` captures the real login-shell PATH at startup.
 *  2. EXTRA_DIRS covers common install locations as a static fallback
 *     (Homebrew, Docker Desktop, OrbStack, Rancher Desktop).
 */
const EXTRA_DIRS =
  process.platform === 'win32'
    ? []
    : [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/Applications/Docker.app/Contents/Resources/bin',
        join(HOME, '.docker', 'bin'),
        join(HOME, '.orbstack', 'bin'),
        join(HOME, '.rd', 'bin'),
        join(HOME, '.local', 'bin'),
        join(HOME, 'bin')
      ]

let loginShellPath: string | null = null

/* ---------------- user-configured binary overrides ---------------- */

/** Binaries the user may locate manually when auto-detection fails. */
export type OverridableBinary = 'ddev' | 'docker'
const OVERRIDABLE: OverridableBinary[] = ['ddev', 'docker']

let overrides: Partial<Record<OverridableBinary, string>> = {}
let overridesFile: string | null = null

/** Load persisted overrides; call once at startup with app.getPath('userData'). */
export function initBinaryOverrides(storageDir: string): void {
  overridesFile = join(storageDir, 'binary-overrides.json')
  try {
    const parsed = JSON.parse(readFileSync(overridesFile, 'utf8')) as Record<string, string>
    for (const name of OVERRIDABLE) {
      if (typeof parsed[name] === 'string' && existsSync(parsed[name])) overrides[name] = parsed[name]
    }
  } catch {
    // no overrides saved yet
  }
}

export function setBinaryOverride(name: OverridableBinary, path: string | null): void {
  if (!OVERRIDABLE.includes(name)) throw new Error(`Cannot override binary: ${name}`)
  if (path === null) {
    delete overrides[name]
  } else {
    if (!existsSync(path)) throw new Error(`File does not exist: ${path}`)
    try {
      accessSync(path, constants.X_OK)
    } catch {
      throw new Error(`File is not executable: ${path}`)
    }
    overrides[name] = path
  }
  if (overridesFile) {
    try {
      writeFileSync(overridesFile, JSON.stringify(overrides, null, 2))
    } catch {
      // persistence is best-effort; the override still applies this session
    }
  }
  resetBinaryCache()
}

export function binaryInfo(): BinaryInfo[] {
  return OVERRIDABLE.map((name) => ({
    name,
    resolved: findBinary(name),
    override: overrides[name] ?? null
  }))
}

/**
 * Resolve the user's login-shell PATH (sources .zshrc/.bashrc, where Docker
 * Desktop & friends register their CLI dirs). Call once at app startup;
 * resolves quietly on any failure or after 4s.
 */
export function initLoginShellPath(): Promise<void> {
  if (process.platform === 'win32') return Promise.resolve()
  return new Promise((resolve) => {
    const marker = '__DDEVUI_PATH__'
    const shell = process.env.SHELL || '/bin/zsh'
    const child = spawn(shell, ['-ilc', `echo -n "${marker}$PATH"`], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, TERM: 'dumb' }
    })
    let output = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 4000)
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8')
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve()
    })
    child.on('close', () => {
      clearTimeout(timer)
      const idx = output.lastIndexOf(marker)
      const path = idx >= 0 ? output.slice(idx + marker.length).trim() : ''
      if (path) {
        loginShellPath = path
        resetBinaryCache()
      }
      resolve()
    })
  })
}

export function augmentedEnv(): NodeJS.ProcessEnv {
  const parts: string[] = []
  const push = (dir: string): void => {
    if (dir && !parts.includes(dir)) parts.push(dir)
  }
  // Override dirs go first so e.g. ddev's own docker lookup finds the same
  // binary the user pointed us at.
  for (const path of Object.values(overrides)) push(dirname(path))
  for (const dir of (process.env.PATH ?? '').split(delimiter)) push(dir)
  for (const dir of (loginShellPath ?? '').split(delimiter)) push(dir)
  for (const dir of EXTRA_DIRS) push(dir)
  return { ...process.env, PATH: parts.join(delimiter) }
}

export function findBinary(name: string): string | null {
  const override = overrides[name as OverridableBinary]
  if (override && existsSync(override)) return override
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
