import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings, EditorPreset } from '@shared/types'

/**
 * App-level preferences (distinct from DDEV's own config). Persisted as
 * userData/app-settings.json, mirroring the binary-overrides storage pattern.
 */

const EDITOR_PRESETS: EditorPreset[] = [
  'auto',
  'code',
  'cursor',
  'webstorm',
  'phpstorm',
  'subl',
  'zed',
  'custom'
]

const DEFAULTS: AppSettings = {
  editorPreset: 'auto',
  editorCommand: ''
}

let settings: AppSettings = { ...DEFAULTS }
let settingsFile: string | null = null

/** Load persisted settings; call once at startup with app.getPath('userData'). */
export function initAppSettings(storageDir: string): void {
  settingsFile = join(storageDir, 'app-settings.json')
  try {
    const parsed = JSON.parse(readFileSync(settingsFile, 'utf8')) as Partial<AppSettings>
    settings = {
      editorPreset: EDITOR_PRESETS.includes(parsed.editorPreset as EditorPreset)
        ? (parsed.editorPreset as EditorPreset)
        : DEFAULTS.editorPreset,
      editorCommand: typeof parsed.editorCommand === 'string' ? parsed.editorCommand : ''
    }
  } catch {
    // no settings saved yet — keep defaults
  }
}

export function getAppSettings(): AppSettings {
  return { ...settings }
}

export function setAppSettings(patch: Partial<AppSettings>): AppSettings {
  if (patch.editorPreset && EDITOR_PRESETS.includes(patch.editorPreset)) {
    settings.editorPreset = patch.editorPreset
  }
  if (typeof patch.editorCommand === 'string') {
    settings.editorCommand = patch.editorCommand
  }
  if (settingsFile) {
    try {
      writeFileSync(settingsFile, JSON.stringify(settings, null, 2))
    } catch {
      // persistence is best-effort; the value still applies this session
    }
  }
  return getAppSettings()
}
