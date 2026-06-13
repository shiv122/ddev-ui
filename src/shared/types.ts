/**
 * Shared types for the DDevUI app. These model the exact JSON shapes emitted
 * by `ddev <cmd> --json-output` (the `raw` field of the NDJSON envelope).
 */

/** One NDJSON line emitted by ddev with --json-output. */
export interface DdevLogLine {
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal'
  msg: string
  time: string
  raw?: unknown
}

/** Statuses reported by ddev (pkg/ddevapp constants). */
export type DdevStatus =
  | 'running'
  | 'starting'
  | 'stopped'
  | 'paused'
  | 'unhealthy'
  | 'project directory missing'
  | '.ddev/config.yaml missing'
  | string

/** One entry of `ddev list --json-output` raw array. */
export interface DdevProject {
  name: string
  status: DdevStatus
  status_desc: string
  approot: string
  shortroot: string
  docroot: string
  type: string
  primary_url: string
  httpurl: string
  httpsurl: string
  mailpit_url: string
  mailpit_https_url: string
  mutagen_enabled: boolean
  mutagen_status: string
  nodejs_version: string
  router: string
  router_disabled: boolean
}

export interface DdevDbInfo {
  username: string
  password: string
  dbname: string
  host: string
  dbPort: string
  published_port: number
  database_type: string
  database_version: string
}

export interface DdevServiceInfo {
  status: string
  full_name: string
  short_name: string
  image: string
  exposed_ports: string
  host_ports: string
  host_ports_mapping?: Array<{ exposed_port: string; host_port: string }>
  virtual_host?: string
  http_url?: string
  https_url?: string
  host_http_url?: string
  host_https_url?: string
  'describe-info'?: string
  'describe-url-port'?: string
}

/** `ddev describe --json-output` raw object. */
export interface DdevDescribe extends DdevProject {
  hostname: string
  hostnames: string[]
  httpURLs: string[]
  httpsURLs: string[]
  urls: string[]
  php_version: string
  webserver_type: string
  database_type: string
  database_version: string
  performance_mode: string
  xdebug_enabled: boolean
  fail_on_hook_fail: boolean
  router_status: string
  router_status_log: string
  router_http_port: string
  router_https_port: string
  ssh_agent_status: string
  webimg: string
  dbimg: string
  dbinfo: DdevDbInfo
  services: Record<string, DdevServiceInfo>
  xhgui_status?: string
  xhgui_url?: string
  xhgui_https_url?: string
  xhprof_mode?: string
}

/** One entry of `ddev add-on list --json-output` raw array (registry add-on). */
export interface DdevAddon {
  title: string
  github_url: string
  description: string
  user: string
  repo: string
  repo_id: number
  default_branch: string
  tag_name: string | null
  ddev_version_constraint: string
  dependencies: string[] | null
  type: 'official' | 'contrib'
  created_at: string
  updated_at: string
  workflow_status: string
  stars: number
}

/** One entry of `ddev add-on list --installed --json-output` (manifest, Go field names). */
export interface DdevInstalledAddon {
  Name: string
  Repository: string
  Version: string
  Dependencies: string[] | null
  InstallDate: string
  ProjectFiles: string[] | null
  GlobalFiles: string[] | null
}

/** One snapshot from `ddev snapshot --list --json-output` (keys are Go field names). */
export interface DdevSnapshot {
  Name: string
  Created: string
}

export type DdevVersionInfo = Record<string, string>

/** Customization files discovered in a project's .ddev directory. */
export interface ProjectExtras {
  /** docker-compose.<name>.yaml files (filenames). */
  composeFiles: string[]
  /** Dockerfile / Dockerfile.<name> / pre.Dockerfile.* in .ddev/web-build. */
  webDockerfiles: string[]
  /** Custom command names in .ddev/commands/host. */
  hostCommands: string[]
  /** Custom command names in .ddev/commands/web. */
  webCommands: string[]
  hasTraefikDir: boolean
  hasCustomCerts: boolean
  /** Raw `hooks:` block from config.yaml, or null when absent. */
  hooks: string | null
  approot: string
}

export type ExtraKind = 'compose' | 'web-dockerfile' | 'host-command' | 'web-command' | 'certs-dir'

/** Selected keys of ~/.ddev/global_config.yaml surfaced in the Settings page. */
export interface GlobalConfig {
  performance_mode: string
  instrumentation_opt_in: boolean
  router_http_port: string
  router_https_port: string
  raw: string
}

/* ------------------------------------------------------------------ */
/* Resource usage & limits                                             */
/* ------------------------------------------------------------------ */

/** Live `docker stats` reading for a single container of a project. */
export interface ServiceResourceUsage {
  /** Service name as ddev knows it (web, db, redis, …). */
  service: string
  /** Full container name (ddev-<project>-<service>). */
  container: string
  /** CPU usage as a percentage of one core (can exceed 100 on multi-core). */
  cpuPercent: number
  /** Memory currently used, in bytes. */
  memBytes: number
  /** Container memory limit, in bytes (host total when no limit is set). */
  memLimitBytes: number
  /** Memory used as a percentage of the limit. */
  memPercent: number
}

/** Aggregated live resource usage for one project (sum across its services). */
export interface ProjectResourceUsage {
  project: string
  cpuPercent: number
  memBytes: number
  services: ServiceResourceUsage[]
}

/**
 * A user-defined resource ceiling for one service, applied via a generated
 * `.ddev/docker-compose.resources.yaml` override. Empty string = no limit.
 */
export interface ServiceResourceLimit {
  service: string
  /** CPU cores, e.g. "1.5". Empty clears the limit. */
  cpus: string
  /** Memory with unit, e.g. "1024M" or "2g". Empty clears the limit. */
  memory: string
}

/** Editor launched by "Open in editor". `auto` falls back to VS Code/Cursor. */
export type EditorPreset =
  | 'auto'
  | 'code'
  | 'cursor'
  | 'webstorm'
  | 'phpstorm'
  | 'subl'
  | 'zed'
  | 'custom'

/** App-level (not DDEV) preferences, persisted in userData/app-settings.json. */
export interface AppSettings {
  editorPreset: EditorPreset
  /**
   * Command line used when editorPreset is 'custom'. May be a bare command
   * (`code`), a full path, or include args and a `{path}` placeholder
   * (e.g. `code --reuse-window {path}`, `open -a "Sublime Text"`).
   */
  editorCommand: string
}

/** Whether the configured editor can actually be launched, for the Settings UI. */
export interface EditorStatus {
  ok: boolean
  /** Human-readable resolution or the reason it can't be launched. */
  detail: string
}

/** Result of the environment doctor checks. */
export interface DoctorCheck {
  id: 'ddev-binary' | 'ddev-version' | 'docker-cli' | 'docker-daemon' | 'mkcert' | 'tunnel'
  label: string
  ok: boolean
  detail: string
}

/** A binary the user can locate manually when auto-detection fails. */
export interface BinaryInfo {
  name: 'ddev' | 'docker'
  resolved: string | null
  override: string | null
}

export interface DoctorReport {
  ok: boolean
  checks: DoctorCheck[]
  ddevPath: string | null
  versionInfo: DdevVersionInfo | null
}

/* ------------------------------------------------------------------ */
/* Long-running operations                                             */
/* ------------------------------------------------------------------ */

/**
 * Renderer never builds CLI args. It sends one of these typed requests and
 * the main process maps it to a ddev invocation.
 */
export type OperationRequest =
  | { kind: 'start'; project: string }
  | { kind: 'stop'; project: string }
  | { kind: 'restart'; project: string }
  | { kind: 'delete'; project: string; omitSnapshot: boolean }
  | { kind: 'unlist'; project: string }
  | { kind: 'poweroff' }
  | { kind: 'xdebug'; project: string; enable: boolean }
  | { kind: 'snapshot-create'; project: string; name?: string }
  | { kind: 'snapshot-restore'; project: string; snapshot: string }
  | { kind: 'snapshot-cleanup'; project: string }
  | { kind: 'import-db'; project: string; file: string; targetDb?: string; noDrop?: boolean }
  | { kind: 'export-db'; project: string; file: string; sourceDb?: string }
  | { kind: 'addon-install'; project: string; addon: string; version?: string }
  | { kind: 'addon-remove'; project: string; addon: string }
  | {
      kind: 'create-project'
      dir: string
      name: string
      /** DDevUI app template id (templates.ts) — overrides projectType with `generic`. */
      template?: string
      /** Skip the db container entirely (--omit-containers=db). */
      omitDb?: boolean
      projectType: string
      docroot?: string
      phpVersion?: string
      database?: string
      webserverType?: string
      nodejsVersion?: string
      startAfter: boolean
    }
  | {
      kind: 'update-config'
      project: string
      restartAfter?: boolean
      flags: Partial<{
        phpVersion: string
        database: string
        webserverType: string
        nodejsVersion: string
        docroot: string
        projectType: string
        performanceMode: string
        timezone: string
        /** Comma-separated; empty string clears the list. */
        additionalHostnames: string
        /** Comma-separated; empty string clears the list. */
        additionalFqdns: string
        projectTld: string
        /** Comma-separated Debian packages (e.g. php${DDEV_PHP_VERSION}-pcov); empty clears. */
        webimageExtraPackages: string
      }>
    }
  | { kind: 'logs'; project: string; service: string; follow: boolean; tail: number }
  | { kind: 'exec'; project: string; service: string; command: string }
  | { kind: 'diagnose'; target: DiagnoseTarget; project?: string }
  | { kind: 'composer'; project: string; args: string }
  | { kind: 'share'; project: string; provider?: 'ngrok' | 'cloudflared'; providerArgs?: string }
  | { kind: 'clean-images' }
  | { kind: 'debug-rebuild'; project: string; service: string }
  | { kind: 'mutagen-reset'; project: string }
  | { kind: 'custom-command'; project: string; command: string }
  | {
      kind: 'global-config'
      flags: Partial<{
        performanceMode: string
        instrumentationOptIn: boolean
        routerHttpPort: string
        routerHttpsPort: string
      }>
    }
  | {
      kind: 'set-resource-limits'
      project: string
      limits: ServiceResourceLimit[]
      restartAfter?: boolean
    }

/**
 * `ddev utility <target>` diagnostic commands surfaced in the Doctor page.
 * Each streams human-readable, actionable output (no --json-output).
 */
export type DiagnoseTarget =
  | 'diagnose'
  | 'dockercheck'
  | 'tls-diagnose'
  | 'port-diagnose'
  | 'mutagen-diagnose'
  | 'xdebug-diagnose'

export type OperationStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface OperationLine {
  level: DdevLogLine['level'] | 'stdout' | 'stderr'
  text: string
}

export interface OperationDescriptor {
  id: string
  request: OperationRequest
  /** Human-readable title, e.g. "Start core". */
  title: string
  command: string
  status: OperationStatus
  startedAt: number
}

export type OperationEvent =
  | { id: string; type: 'line'; line: OperationLine }
  | { id: string; type: 'status'; status: OperationStatus; exitCode: number | null }

export interface FileDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  defaultPath?: string
}
