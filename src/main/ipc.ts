import { app, dialog, ipcMain, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { ExtraKind, FileDialogOptions, OperationRequest } from '@shared/types'
import { binaryInfo, setBinaryOverride, type OverridableBinary } from './ddev/binary'
import { ddevClient } from './ddev/client'
import { runDoctor } from './ddev/doctor'
import { createExtra, projectExtras, readGlobalConfig } from './ddev/extras'
import { resourceStats } from './ddev/stats'
import { readResourceLimits } from './ddev/resources'
import { serviceConfig, xdebugStatus } from './ddev/services'
import { projectsGraph } from './ddev/links'
import { terminalManager } from './ddev/terminals'
import { operationManager } from './ddev/operations'
import { getAppSettings, setAppSettings } from './settings'
import { editorStatus, launchEditor } from './editor'
import type { AppSettings } from '@shared/types'

export function registerIpcHandlers(): void {
  // ----- queries -----
  ipcMain.handle(IPC.list, () => ddevClient.list())
  ipcMain.handle(IPC.describe, (_e, project: string) => ddevClient.describe(project))
  ipcMain.handle(IPC.version, () => ddevClient.version())
  ipcMain.handle(IPC.doctor, () => runDoctor())
  ipcMain.handle(IPC.addonRegistry, () => ddevClient.addonRegistry())
  ipcMain.handle(IPC.addonsInstalled, (_e, project: string) => ddevClient.addonsInstalled(project))
  ipcMain.handle(IPC.snapshots, (_e, project: string) => ddevClient.snapshots(project))
  ipcMain.handle(IPC.readConfigFile, (_e, project: string) => ddevClient.readConfigFile(project))
  ipcMain.handle(IPC.extras, (_e, project: string) => projectExtras(project))
  ipcMain.handle(IPC.createExtra, (_e, project: string, kind: ExtraKind, name: string) =>
    createExtra(project, kind, name)
  )
  ipcMain.handle(IPC.globalConfig, () => readGlobalConfig())
  ipcMain.handle(IPC.resourceStats, (_e, projectNames: string[]) =>
    resourceStats(Array.isArray(projectNames) ? projectNames : [])
  )
  ipcMain.handle(IPC.resourceLimits, async (_e, project: string) =>
    readResourceLimits(await ddevClient.approotFor(project))
  )
  ipcMain.handle(IPC.serviceConfig, (_e, project: string, service: string) =>
    serviceConfig(project, service)
  )
  ipcMain.handle(IPC.xdebugStatus, (_e, project: string) => xdebugStatus(project))
  ipcMain.handle(IPC.projectsGraph, () => projectsGraph())

  // ----- app preferences -----
  ipcMain.handle(IPC.appSettings, () => getAppSettings())
  ipcMain.handle(IPC.setAppSettings, (_e, patch: Partial<AppSettings>) => setAppSettings(patch))
  ipcMain.handle(IPC.editorStatus, () => editorStatus())
  ipcMain.handle(IPC.testEditor, () => launchEditor(app.getPath('home')))

  // ----- operations -----
  ipcMain.handle(IPC.opRun, (_e, request: OperationRequest) => operationManager.run(request))
  ipcMain.handle(IPC.opCancel, (_e, id: string) => operationManager.cancel(id))
  ipcMain.handle(IPC.opList, () => operationManager.list())
  ipcMain.handle(IPC.opBuffer, (_e, id: string) => operationManager.buffer(id))

  // ----- binary locations -----
  ipcMain.handle(IPC.binaries, () => binaryInfo())
  ipcMain.handle(IPC.pickBinary, async (_e, name: OverridableBinary) => {
    const result = await dialog.showOpenDialog({
      title: `Locate the ${name} binary`,
      defaultPath: '/usr/local/bin',
      properties: ['openFile', 'showHiddenFiles', 'treatPackageAsDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return binaryInfo()
    setBinaryOverride(name, result.filePaths[0])
    return binaryInfo()
  })
  ipcMain.handle(IPC.clearBinaryOverride, (_e, name: OverridableBinary) => {
    setBinaryOverride(name, null)
    return binaryInfo()
  })

  // ----- interactive terminals -----
  ipcMain.handle(IPC.termCreate, (e, project: string, service: string, cols: number, rows: number) =>
    terminalManager.create(e.sender, project, service, cols, rows)
  )
  ipcMain.on(IPC.termWrite, (_e, id: string, data: string) => terminalManager.write(id, data))
  ipcMain.on(IPC.termResize, (_e, id: string, cols: number, rows: number) =>
    terminalManager.resize(id, cols, rows)
  )
  ipcMain.on(IPC.termDispose, (_e, id: string) => terminalManager.dispose(id))

  // ----- app utilities -----
  ipcMain.handle(IPC.openExternal, (_e, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error(`Refusing to open non-http URL: ${url}`)
    return shell.openExternal(url)
  })
  ipcMain.handle(IPC.revealPath, (_e, path: string) => shell.showItemInFolder(path))

  ipcMain.handle(IPC.openInEditor, (_e, path: string) => launchEditor(path))

  ipcMain.handle(IPC.selectDirectory, async (_e, options: FileDialogOptions = {}) => {
    const result = await dialog.showOpenDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.selectFile, async (_e, options: FileDialogOptions = {}) => {
    const result = await dialog.showOpenDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters,
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.saveFile, async (_e, options: FileDialogOptions = {}) => {
    const result = await dialog.showSaveDialog({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters
    })
    return result.canceled ? null : result.filePath
  })
}
