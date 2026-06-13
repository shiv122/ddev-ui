import { app, ipcMain, nativeImage, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import iconDark from '../../resources/icon.png?asset'
import iconLight from '../../resources/icon-light.png?asset'
import { IPC } from '@shared/ipc'
import { registerIpcHandlers } from './ipc'
import { initBinaryOverrides, initLoginShellPath } from './ddev/binary'
import { terminalManager } from './ddev/terminals'
import { initTray, type TrayHandle } from './tray'

/** Dock/window icon used when no theme override is active (Info.plist default). */
const icon = iconDark

/** Current UI theme, mirrored from the renderer; drives the dock + tray icon. */
let currentTheme: 'dark' | 'light' = 'dark'
let trayHandle: TrayHandle | undefined

/** Point the macOS dock at the icon matching the current UI theme. */
function applyDockIcon(): void {
  if (process.platform !== 'darwin' || !app.dock) return
  const image = nativeImage.createFromPath(currentTheme === 'light' ? iconLight : iconDark)
  // An empty image (missing asset) makes setIcon clear the icon — skip it and
  // let the .app's Info.plist icon stand.
  if (!image.isEmpty()) app.dock.setIcon(image)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0b',
    // Window icon for Linux/Windows; macOS uses the dock icon / .icns instead.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // When the last window closes, macOS repaints the dock from the app bundle's
  // Info.plist icon (the generic Electron icon in dev). Re-assert our icon as
  // the window tears down, and again on the next frames, so it doesn't flash.
  mainWindow.on('closed', () => {
    if (process.platform !== 'darwin') return
    applyDockIcon()
    setImmediate(applyDockIcon)
    setTimeout(applyDockIcon, 60)
  })

  // Any window.open / target=_blank goes to the system browser.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.zaraffasoft.ddevui')

  // Match the dock icon to the saved UI theme right away (and again whenever the
  // renderer reports a theme change). Packaged builds bake the dark icon into
  // the .app via build/icon.png; this override is what makes light mode swap.
  applyDockIcon()

  // Renderer theme toggle → swap dock + menu-bar icon.
  ipcMain.on(IPC.setTheme, (_event, theme: 'dark' | 'light') => {
    currentTheme = theme === 'light' ? 'light' : 'dark'
    applyDockIcon()
    trayHandle?.setTheme(currentTheme)
  })

  // Packaged apps launched from Finder get a minimal PATH — resolve the real
  // login-shell PATH (Docker Desktop, OrbStack etc.) before anything runs ddev.
  initBinaryOverrides(app.getPath('userData'))
  await initLoginShellPath()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()
  trayHandle = initTray({ iconPath: iconDark, iconLightPath: iconLight, showWindow: showMainWindow })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

/** Focus the existing window or create a fresh one (tray "Open DDevUI"). */
function showMainWindow(): void {
  const existing = BrowserWindow.getAllWindows()[0]
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
  } else {
    createWindow()
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  // On macOS the app stays alive in the menu bar; re-assert the dock icon so the
  // bundle's default icon doesn't show through after the last window closes.
  else applyDockIcon()
})

app.on('will-quit', () => {
  terminalManager.disposeAll()
})
