/** IPC channel names, shared between main and preload. */
export const IPC = {
  // Queries (invoke/handle, return parsed `raw` payloads)
  list: 'ddev:list',
  describe: 'ddev:describe',
  version: 'ddev:version',
  doctor: 'ddev:doctor',
  addonRegistry: 'ddev:addon-registry',
  addonsInstalled: 'ddev:addons-installed',
  snapshots: 'ddev:snapshots',
  readConfigFile: 'ddev:read-config-file',
  extras: 'ddev:extras',
  createExtra: 'ddev:create-extra',
  globalConfig: 'ddev:global-config',

  // Operations (long-running, streamed)
  opRun: 'op:run',
  opCancel: 'op:cancel',
  opList: 'op:list',
  opEvent: 'op:event',
  opBuffer: 'op:buffer',

  // Interactive terminal sessions (PTY into containers via `ddev ssh`)
  termCreate: 'term:create',
  termWrite: 'term:write',
  termResize: 'term:resize',
  termDispose: 'term:dispose',
  termData: 'term:data',
  termExit: 'term:exit',

  // App utilities
  openExternal: 'app:open-external',
  openInEditor: 'app:open-in-editor',
  revealPath: 'app:reveal-path',
  selectDirectory: 'app:select-directory',
  selectFile: 'app:select-file',
  saveFile: 'app:save-file'
} as const
