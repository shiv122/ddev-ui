import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EditorPreset, EditorStatus } from '@shared/types'
import { augmentedEnv, findBinary } from './ddev/binary'
import { getAppSettings } from './settings'

/**
 * Resolves the user's editor preference into an actual command to spawn.
 *
 * The key cross-platform problem: GUI editors launched from a packaged app
 * rarely have their CLI shim (`code`, `subl`, …) on PATH — especially on macOS.
 * So on macOS we launch presets via `open -a "<App>"`, which always works for
 * an installed app and needs no CLI setup. Windows/Linux use the CLI command.
 */

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? ''
const PLACEHOLDER = '{path}'

type RealPreset = Exclude<EditorPreset, 'auto' | 'custom'>

/** macOS application names per preset (for `open -a`). */
const MAC_APPS: Record<RealPreset, string> = {
  code: 'Visual Studio Code',
  cursor: 'Cursor',
  webstorm: 'WebStorm',
  phpstorm: 'PhpStorm',
  subl: 'Sublime Text',
  zed: 'Zed'
}

/** CLI command per preset on Windows/Linux. */
const CLI_COMMANDS: Record<RealPreset, string> = {
  code: 'code',
  cursor: 'cursor',
  webstorm: 'webstorm',
  phpstorm: 'phpstorm',
  subl: 'subl',
  zed: 'zed'
}

interface Launch {
  cmd: string
  args: string[]
  /** Short human description of how it'll launch, for the UI. */
  display: string
}

const isMac = process.platform === 'darwin'

/** Locate an installed .app bundle by name in the usual macOS locations. */
function macAppPath(appName: string): string | null {
  const candidates = [`/Applications/${appName}.app`, join(HOME, 'Applications', `${appName}.app`)]
  return candidates.find((p) => existsSync(p)) ?? null
}

/** Minimal shell-like tokenizer honoring single/double quotes. */
function tokenize(input: string): string[] {
  const matches = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return matches.map((m) =>
    (m.startsWith('"') && m.endsWith('"')) || (m.startsWith("'") && m.endsWith("'"))
      ? m.slice(1, -1)
      : m
  )
}

function resolvePreset(preset: RealPreset, targetPath: string): Launch {
  if (isMac) {
    const app = MAC_APPS[preset]
    const appPath = macAppPath(app)
    if (!appPath) {
      throw new Error(
        `${app} isn’t installed in /Applications. Install it, or choose “Custom command” in Settings → Editor.`
      )
    }
    return { cmd: '/usr/bin/open', args: ['-a', appPath, targetPath], display: `open -a "${app}"` }
  }
  const command = CLI_COMMANDS[preset]
  const bin = findBinary(command)
  if (!bin) {
    throw new Error(
      `The “${command}” command isn’t on your PATH. Enable your editor’s shell command (e.g. VS Code → “Shell Command: Install 'code' command in PATH”), or set a Custom command in Settings → Editor.`
    )
  }
  return { cmd: bin, args: [targetPath], display: `${command} (${bin})` }
}

function resolveAuto(targetPath: string): Launch {
  if (isMac) {
    for (const key of ['code', 'cursor'] as const) {
      const appPath = macAppPath(MAC_APPS[key])
      if (appPath) {
        return {
          cmd: '/usr/bin/open',
          args: ['-a', appPath, targetPath],
          display: `open -a "${MAC_APPS[key]}"`
        }
      }
    }
  }
  const bin = findBinary('code') ?? findBinary('cursor')
  if (!bin) {
    throw new Error('No editor found automatically — pick or configure one in Settings → Editor.')
  }
  return { cmd: bin, args: [targetPath], display: `auto (${bin})` }
}

function resolveCustom(command: string, targetPath: string): Launch {
  const raw = command.trim()
  if (!raw) throw new Error('No editor command set — add one in Settings → Editor.')

  const tokens = tokenize(raw)
  const [first, ...rest] = tokens

  let cmd: string
  if (first === 'open' && isMac) {
    cmd = '/usr/bin/open'
  } else if (first.startsWith('/') || first.startsWith('~')) {
    const abs = first.startsWith('~') ? join(HOME, first.slice(1)) : first
    if (!existsSync(abs)) {
      throw new Error(`Editor not found at ${abs} — update it in Settings → Editor.`)
    }
    cmd = abs
  } else {
    const bin = findBinary(first)
    if (!bin) {
      throw new Error(
        `Command not found on PATH: “${first}”. Use a full path or a different command in Settings → Editor.`
      )
    }
    cmd = bin
  }

  // Substitute {path}, or append the target if no placeholder was given.
  const args = rest.includes(PLACEHOLDER)
    ? rest.map((a) => (a === PLACEHOLDER ? targetPath : a))
    : [...rest, targetPath]

  return { cmd, args, display: raw }
}

function resolveEditorLaunch(targetPath: string): Launch {
  const { editorPreset, editorCommand } = getAppSettings()
  if (editorPreset === 'custom') return resolveCustom(editorCommand, targetPath)
  if (editorPreset === 'auto') return resolveAuto(targetPath)
  return resolvePreset(editorPreset, targetPath)
}

/** Open a path in the configured editor. Throws a descriptive error on failure. */
export function launchEditor(targetPath: string): void {
  const { cmd, args } = resolveEditorLaunch(targetPath)
  spawn(cmd, args, { detached: true, stdio: 'ignore', env: augmentedEnv() }).unref()
}

/** Validate (without launching) whether the configured editor can be opened. */
export function editorStatus(): EditorStatus {
  try {
    // Dummy path: only the command resolution matters here, nothing is spawned.
    const launch = resolveEditorLaunch('/tmp/__ddevui_probe__')
    return { ok: true, detail: launch.display }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}
