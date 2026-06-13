import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  BinaryInfo,
  DdevAddon,
  DdevDescribe,
  DdevInstalledAddon,
  DdevProject,
  DdevSnapshot,
  DdevVersionInfo,
  DoctorReport,
  ExtraKind,
  FileDialogOptions,
  GlobalConfig,
  ProjectExtras,
  OperationDescriptor,
  OperationEvent,
  OperationLine,
  OperationRequest
} from '@shared/types'

const api = {
  list: (): Promise<DdevProject[]> => ipcRenderer.invoke(IPC.list),
  describe: (project: string): Promise<DdevDescribe> => ipcRenderer.invoke(IPC.describe, project),
  version: (): Promise<DdevVersionInfo> => ipcRenderer.invoke(IPC.version),
  doctor: (): Promise<DoctorReport> => ipcRenderer.invoke(IPC.doctor),
  addonRegistry: (): Promise<DdevAddon[]> => ipcRenderer.invoke(IPC.addonRegistry),
  addonsInstalled: (project: string): Promise<DdevInstalledAddon[]> =>
    ipcRenderer.invoke(IPC.addonsInstalled, project),
  snapshots: (project: string): Promise<DdevSnapshot[]> => ipcRenderer.invoke(IPC.snapshots, project),
  readConfigFile: (project: string): Promise<string> => ipcRenderer.invoke(IPC.readConfigFile, project),
  extras: (project: string): Promise<ProjectExtras> => ipcRenderer.invoke(IPC.extras, project),
  createExtra: (project: string, kind: ExtraKind, name: string): Promise<{ path: string }> =>
    ipcRenderer.invoke(IPC.createExtra, project, kind, name),
  globalConfig: (): Promise<GlobalConfig> => ipcRenderer.invoke(IPC.globalConfig),

  runOperation: (request: OperationRequest): Promise<OperationDescriptor> =>
    ipcRenderer.invoke(IPC.opRun, request),
  cancelOperation: (id: string): Promise<void> => ipcRenderer.invoke(IPC.opCancel, id),
  listOperations: (): Promise<OperationDescriptor[]> => ipcRenderer.invoke(IPC.opList),
  operationBuffer: (id: string): Promise<OperationLine[]> => ipcRenderer.invoke(IPC.opBuffer, id),
  onOperationEvent: (callback: (event: OperationEvent) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: OperationEvent): void => callback(event)
    ipcRenderer.on(IPC.opEvent, listener)
    return () => ipcRenderer.removeListener(IPC.opEvent, listener)
  },

  // Binary locations
  binaries: (): Promise<BinaryInfo[]> => ipcRenderer.invoke(IPC.binaries),
  pickBinary: (name: 'ddev' | 'docker'): Promise<BinaryInfo[]> =>
    ipcRenderer.invoke(IPC.pickBinary, name),
  clearBinaryOverride: (name: 'ddev' | 'docker'): Promise<BinaryInfo[]> =>
    ipcRenderer.invoke(IPC.clearBinaryOverride, name),

  // Interactive terminal sessions
  createTerminal: (
    project: string,
    service: string,
    cols: number,
    rows: number
  ): Promise<{ id: string }> => ipcRenderer.invoke(IPC.termCreate, project, service, cols, rows),
  writeTerminal: (id: string, data: string): void => ipcRenderer.send(IPC.termWrite, id, data),
  resizeTerminal: (id: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC.termResize, id, cols, rows),
  disposeTerminal: (id: string): void => ipcRenderer.send(IPC.termDispose, id),
  onTerminalData: (callback: (event: { id: string; data: string }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, e: { id: string; data: string }): void =>
      callback(e)
    ipcRenderer.on(IPC.termData, listener)
    return () => ipcRenderer.removeListener(IPC.termData, listener)
  },
  onTerminalExit: (callback: (event: { id: string; exitCode: number }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, e: { id: string; exitCode: number }): void =>
      callback(e)
    ipcRenderer.on(IPC.termExit, listener)
    return () => ipcRenderer.removeListener(IPC.termExit, listener)
  },

  setTheme: (theme: 'dark' | 'light'): void => ipcRenderer.send(IPC.setTheme, theme),

  onNavigate: (callback: (target: { view: string; name?: string }) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, target: { view: string; name?: string }): void =>
      callback(target)
    ipcRenderer.on(IPC.navigate, listener)
    return () => ipcRenderer.removeListener(IPC.navigate, listener)
  },

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),
  openInEditor: (path: string): Promise<void> => ipcRenderer.invoke(IPC.openInEditor, path),
  revealPath: (path: string): Promise<void> => ipcRenderer.invoke(IPC.revealPath, path),
  selectDirectory: (options?: FileDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke(IPC.selectDirectory, options),
  selectFile: (options?: FileDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke(IPC.selectFile, options),
  saveFile: (options?: FileDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke(IPC.saveFile, options)
}

export type DdevApi = typeof api

contextBridge.exposeInMainWorld('ddev', api)
