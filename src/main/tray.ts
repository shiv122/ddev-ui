import { BrowserWindow, Menu, Tray, nativeImage, shell, type NativeImage } from 'electron'
import { IPC } from '@shared/ipc'
import type { DdevProject, DdevStatus, OperationRequest } from '@shared/types'
import { ddevClient } from './ddev/client'
import { operationManager } from './ddev/operations'

const REFRESH_MS = 20_000
/** Menu-bar icon size in points (rendered with a @2x representation). */
const TRAY_ICON_PT = 22
/** Status dot size in points. */
const DOT_PT = 9

type Rgb = [number, number, number]

const STATUS_COLORS: Record<string, Rgb> = {
  running: [50, 215, 95],
  starting: [255, 214, 10],
  paused: [255, 214, 10],
  unhealthy: [255, 69, 58],
  stopped: [142, 142, 147],
  broken: [255, 159, 10]
}

/** Draw a small antialiased filled circle as a native image (1x + 2x reps). */
function dotImage(color: Rgb): NativeImage {
  const render = (size: number): Buffer => {
    const buffer = Buffer.alloc(size * size * 4)
    const center = (size - 1) / 2
    const radius = size / 2 - 0.8
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dist = Math.hypot(x - center, y - center)
        const alpha = Math.max(0, Math.min(1, radius - dist + 0.5))
        const i = (y * size + x) * 4
        // BGRA byte order
        buffer[i] = color[2]
        buffer[i + 1] = color[1]
        buffer[i + 2] = color[0]
        buffer[i + 3] = Math.round(alpha * 255)
      }
    }
    return buffer
  }
  const image = nativeImage.createEmpty()
  image.addRepresentation({
    scaleFactor: 1,
    width: DOT_PT,
    height: DOT_PT,
    buffer: render(DOT_PT)
  })
  image.addRepresentation({
    scaleFactor: 2,
    width: DOT_PT * 2,
    height: DOT_PT * 2,
    buffer: render(DOT_PT * 2)
  })
  return image
}

/** Tray icon with crisp retina representation. */
function trayIcon(iconPath: string): NativeImage {
  const source = nativeImage.createFromPath(iconPath)
  // A missing/unreadable asset yields an empty image; building a Tray from an
  // empty image throws on macOS, so fall back to a neutral status dot instead.
  if (source.isEmpty()) return dotImage(STATUS_COLORS.stopped)
  const image = nativeImage.createEmpty()
  image.addRepresentation({
    scaleFactor: 1,
    buffer: source.resize({ width: TRAY_ICON_PT, height: TRAY_ICON_PT }).toPNG()
  })
  image.addRepresentation({
    scaleFactor: 2,
    buffer: source.resize({ width: TRAY_ICON_PT * 2, height: TRAY_ICON_PT * 2 }).toPNG()
  })
  return image
}

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  starting: 1,
  unhealthy: 2,
  paused: 3,
  stopped: 4
}

interface TrayOptions {
  iconPath: string
  iconLightPath: string
  showWindow: () => void
}

/** Handle returned from initTray so the app theme can drive the tray icon. */
export interface TrayHandle {
  setTheme: (theme: 'dark' | 'light') => void
}

/**
 * macOS menu-bar (and Windows tray) presence: live project list with quick
 * lifecycle controls, kept fresh from the client's list() results and a slow
 * fallback poll for when no window is open.
 */
export function initTray({ iconPath, iconLightPath, showWindow }: TrayOptions): TrayHandle {
  // Pre-render both theme variants once; setTheme() just swaps the image.
  const icons: Record<'dark' | 'light', NativeImage> = {
    dark: trayIcon(iconPath),
    light: trayIcon(iconLightPath)
  }
  const tray = new Tray(icons.dark)
  tray.setToolTip('DDevUI')

  // Pre-render one dot per status color.
  const dots = new Map<string, NativeImage>(
    Object.entries(STATUS_COLORS).map(([key, rgb]) => [key, dotImage(rgb)])
  )
  const dotFor = (status: DdevStatus): NativeImage =>
    dots.get(STATUS_COLORS[status] ? status : 'broken')!

  let projects: DdevProject[] = []

  const run = (request: OperationRequest): void => {
    void operationManager.run(request).catch(() => {
      // Lock conflicts etc. — surfaced as toasts when a window is open.
    })
  }

  const openProject = (name: string): void => {
    showWindow()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.navigate, { view: 'project', name })
    }
  }

  const rebuildMenu = (): void => {
    const sorted = [...projects].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name)
    )
    const running = projects.filter((p) => p.status === 'running')

    const projectItems =
      sorted.length === 0
        ? [{ label: 'No DDEV projects', enabled: false }]
        : sorted.map((p) => {
            const isRunning = p.status === 'running'
            const broken =
              p.status === '.ddev/config.yaml missing' || p.status === 'project directory missing'
            return {
              label: p.name,
              icon: dotFor(p.status),
              submenu: [
                { label: `${p.status}${p.type ? ` · ${p.type}` : ''}`, enabled: false },
                { type: 'separator' as const },
                ...(isRunning
                  ? [
                      {
                        label: 'Open in browser',
                        click: (): void => void shell.openExternal(p.primary_url)
                      },
                      {
                        label: 'Open Mailpit',
                        click: (): void => void shell.openExternal(p.mailpit_https_url)
                      },
                      { type: 'separator' as const },
                      { label: 'Stop', click: (): void => run({ kind: 'stop', project: p.name }) },
                      {
                        label: 'Restart',
                        click: (): void => run({ kind: 'restart', project: p.name })
                      }
                    ]
                  : broken
                    ? [
                        {
                          label: 'Unlist (files missing)',
                          click: (): void => run({ kind: 'unlist', project: p.name })
                        }
                      ]
                    : [
                        { label: 'Start', click: (): void => run({ kind: 'start', project: p.name }) }
                      ]),
                { type: 'separator' as const },
                { label: 'Show in DDevUI', click: (): void => openProject(p.name) }
              ]
            }
          })

    const menu = Menu.buildFromTemplate([
      { label: 'Open DDevUI', click: showWindow },
      { type: 'separator' },
      ...projectItems,
      { type: 'separator' },
      {
        label: 'Power off DDEV',
        enabled: running.length > 0,
        click: (): void => run({ kind: 'poweroff' })
      },
      { type: 'separator' },
      { label: 'Quit DDevUI', role: 'quit' }
    ])
    tray.setContextMenu(menu)

    // Running-project count next to the menu-bar icon (macOS only).
    if (process.platform === 'darwin') {
      tray.setTitle(running.length > 0 ? String(running.length) : '', { fontType: 'monospacedDigit' })
    }
  }

  rebuildMenu()

  // Fresh data piggybacks on every list() (renderer polls every 5s while a
  // window is open); the interval covers the window-closed case.
  ddevClient.onProjects((next) => {
    projects = next
    rebuildMenu()
  })
  setInterval(() => {
    void ddevClient.list().catch(() => {
      // ddev/docker unavailable — keep the last known menu.
    })
  }, REFRESH_MS)

  return {
    setTheme: (theme) => tray.setImage(icons[theme] ?? icons.dark)
  }
}
