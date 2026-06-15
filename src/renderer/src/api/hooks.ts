import { useEffect } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  AppSettings,
  BinaryInfo,
  DdevAddon,
  DdevDescribe,
  DdevInstalledAddon,
  DdevProject,
  DdevSnapshot,
  DdevVersionInfo,
  DockerProvider,
  DoctorReport,
  EditorStatus,
  GlobalConfig,
  ProjectExtras,
  ProjectGraph,
  ProjectResourceUsage,
  ServiceComposeConfig,
  ServiceResourceLimit
} from '@shared/types'
import { queryKeys } from '@/lib/query-client'
import { recordResourceSample } from '@/store/resource-history'

export function useProjects(): UseQueryResult<DdevProject[]> {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => window.ddev.list(),
    refetchInterval: 5_000
  })
}

export function useDescribe(name: string): UseQueryResult<DdevDescribe> {
  return useQuery({
    queryKey: queryKeys.describe(name),
    queryFn: () => window.ddev.describe(name),
    refetchInterval: 10_000
  })
}

export function useVersion(): UseQueryResult<DdevVersionInfo> {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: () => window.ddev.version(),
    staleTime: Infinity
  })
}

/** DDevUI's own app version (static for the session). */
export function useAppVersion(): UseQueryResult<string> {
  return useQuery({
    queryKey: queryKeys.appVersion,
    queryFn: () => window.ddev.appVersion(),
    staleTime: Infinity
  })
}

export function useDoctor(): UseQueryResult<DoctorReport> {
  return useQuery({
    queryKey: queryKeys.doctor,
    queryFn: () => window.ddev.doctor(),
    staleTime: 60_000,
    refetchInterval: 60_000
  })
}

export function useAddonRegistry(): UseQueryResult<DdevAddon[]> {
  return useQuery({
    queryKey: queryKeys.addonRegistry,
    queryFn: () => window.ddev.addonRegistry(),
    staleTime: 30 * 60_000
  })
}

export function useInstalledAddons(project: string): UseQueryResult<DdevInstalledAddon[]> {
  return useQuery({
    queryKey: queryKeys.addonsInstalled(project),
    queryFn: () => window.ddev.addonsInstalled(project)
  })
}

/**
 * Installed add-ons across every project, keyed by name. Powers the registry
 * install matrix (which projects already have a given add-on). Only fetched
 * when a detail view opens, since it spawns one `ddev add-on list` per project.
 */
export function useAllInstalledAddons(
  enabled: boolean
): UseQueryResult<Record<string, DdevInstalledAddon[]>> {
  return useQuery({
    queryKey: queryKeys.addonsInstalledAll,
    queryFn: () => window.ddev.addonsInstalledAll(),
    enabled,
    staleTime: 10_000
  })
}

export function useSnapshots(project: string): UseQueryResult<DdevSnapshot[]> {
  return useQuery({
    queryKey: queryKeys.snapshots(project),
    queryFn: () => window.ddev.snapshots(project)
  })
}

export function useConfigFile(project: string): UseQueryResult<string> {
  return useQuery({
    queryKey: queryKeys.configFile(project),
    queryFn: () => window.ddev.readConfigFile(project)
  })
}

export function useExtras(project: string): UseQueryResult<ProjectExtras> {
  return useQuery({
    queryKey: queryKeys.extras(project),
    queryFn: () => window.ddev.extras(project)
  })
}

export function useBinaries(): UseQueryResult<BinaryInfo[]> {
  return useQuery({
    queryKey: queryKeys.binaries,
    queryFn: () => window.ddev.binaries()
  })
}

export function useGlobalConfig(): UseQueryResult<GlobalConfig> {
  return useQuery({
    queryKey: queryKeys.globalConfig,
    queryFn: () => window.ddev.globalConfig()
  })
}

/**
 * Live per-project CPU/memory usage (one `docker stats` call). Pass the names
 * of running projects; the query is disabled when there are none.
 */
export function useResourceStats(
  runningProjects: string[]
): UseQueryResult<Record<string, ProjectResourceUsage>> {
  const query = useQuery({
    queryKey: queryKeys.resourceStats,
    queryFn: () => window.ddev.resourceStats(runningProjects),
    enabled: runningProjects.length > 0,
    refetchInterval: 4_000,
    placeholderData: (prev) => prev
  })

  // Accumulate each reading into the rolling history that feeds the charts.
  const { data, dataUpdatedAt } = query
  useEffect(() => {
    if (data) recordResourceSample(data)
  }, [data, dataUpdatedAt])

  return query
}

export function useResourceLimits(project: string): UseQueryResult<ServiceResourceLimit[]> {
  return useQuery({
    queryKey: queryKeys.resourceLimits(project),
    queryFn: () => window.ddev.resourceLimits(project)
  })
}

/** Rendered compose block + editable override files for one service (lazy). */
export function useServiceConfig(
  project: string,
  service: string,
  enabled: boolean
): UseQueryResult<ServiceComposeConfig> {
  return useQuery({
    queryKey: queryKeys.serviceConfig(project, service),
    queryFn: () => window.ddev.serviceConfig(project, service),
    enabled
  })
}

/**
 * Live Xdebug state via `ddev xdebug status`. The describe payload's
 * `xdebug_enabled` only reflects the configured default, not the runtime
 * toggle, so the switch must read this instead.
 */
export function useXdebugStatus(project: string, enabled: boolean): UseQueryResult<boolean> {
  return useQuery({
    queryKey: queryKeys.xdebugStatus(project),
    queryFn: () => window.ddev.xdebugStatus(project),
    enabled,
    staleTime: 15_000
  })
}

/** Project nodes + cross-project links for the connections map. */
export function useProjectsGraph(): UseQueryResult<ProjectGraph> {
  return useQuery({
    queryKey: queryKeys.projectsGraph,
    queryFn: () => window.ddev.projectsGraph(),
    refetchInterval: 8_000
  })
}

/** Container runtimes installed on this machine that DDevUI can launch. */
export function useDockerProviders(): UseQueryResult<DockerProvider[]> {
  return useQuery({
    queryKey: queryKeys.dockerProviders,
    queryFn: () => window.ddev.dockerProviders(),
    staleTime: 60_000
  })
}

/** Whether DDevUI is set to launch at login (macOS/Windows). */
export function useLoginItem(): UseQueryResult<boolean> {
  return useQuery({
    queryKey: queryKeys.loginItem,
    queryFn: () => window.ddev.loginItem(),
    staleTime: Infinity
  })
}

/** Latest released DDEV CLI version tag (e.g. "v1.24.3"); refreshed sparingly. */
export function useDdevLatest(): UseQueryResult<string | null> {
  return useQuery({
    queryKey: queryKeys.ddevLatest,
    queryFn: () => window.ddev.latestDdevVersion(),
    staleTime: 6 * 60 * 60_000,
    retry: false
  })
}

export function useAppSettings(): UseQueryResult<AppSettings> {
  return useQuery({
    queryKey: queryKeys.appSettings,
    queryFn: () => window.ddev.appSettings(),
    staleTime: Infinity
  })
}

export function useEditorStatus(): UseQueryResult<EditorStatus> {
  return useQuery({
    queryKey: queryKeys.editorStatus,
    queryFn: () => window.ddev.editorStatus()
  })
}
