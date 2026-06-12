/**
 * Shared types for the DDEV UI app. These model the exact JSON shapes emitted
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

/** Result of the environment doctor checks. */
export interface DoctorCheck {
  id: 'ddev-binary' | 'ddev-version' | 'docker-cli' | 'docker-daemon' | 'mkcert' | 'tunnel'
  label: string
  ok: boolean
  detail: string
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
      /** DDEV UI app template id (templates.ts) — overrides projectType with `generic`. */
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
  | { kind: 'dockercheck' }
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
