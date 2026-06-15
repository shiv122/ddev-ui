/** IPC channel names, shared between main and preload. */
export const IPC = {
  // Queries (invoke/handle, return parsed `raw` payloads)
  list: 'ddev:list',
  describe: 'ddev:describe',
  version: 'ddev:version',
  doctor: 'ddev:doctor',
  addonRegistry: 'ddev:addon-registry',
  addonsInstalled: 'ddev:addons-installed',
  addonsInstalledAll: 'ddev:addons-installed-all',
  snapshots: 'ddev:snapshots',
  readConfigFile: 'ddev:read-config-file',
  extras: 'ddev:extras',
  createExtra: 'ddev:create-extra',
  globalConfig: 'ddev:global-config',
  resourceStats: 'ddev:resource-stats',
  resourceLimits: 'ddev:resource-limits',
  serviceConfig: 'ddev:service-config',
  xdebugStatus: 'ddev:xdebug-status',
  projectsGraph: 'ddev:projects-graph',
  latestDdevVersion: 'ddev:latest-version',

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

  // Binary locations (manual override when auto-detection fails)
  binaries: 'app:binaries',
  pickBinary: 'app:pick-binary',
  clearBinaryOverride: 'app:clear-binary-override',

  // Main → renderer navigation (from the tray menu)
  navigate: 'app:navigate',

  // Renderer → main: keep the dock/menu-bar icon in sync with the UI theme
  setTheme: 'app:set-theme',

  // DDevUI's own app version (from package.json / app.getVersion)
  appVersion: 'app:version',

  // App preferences (not DDEV — stored in userData)
  appSettings: 'app:settings',
  setAppSettings: 'app:set-settings',
  editorStatus: 'app:editor-status',
  testEditor: 'app:test-editor',

  // App utilities
  openDbClient: 'app:open-db-client',
  loginItem: 'app:login-item',
  setLoginItem: 'app:set-login-item',
  dockerProviders: 'app:docker-providers',
  startDockerProvider: 'app:start-docker-provider',
  openExternal: 'app:open-external',
  openInEditor: 'app:open-in-editor',
  revealPath: 'app:reveal-path',
  selectDirectory: 'app:select-directory',
  selectFile: 'app:select-file',
  saveFile: 'app:save-file'
} as const
