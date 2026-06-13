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
  DoctorReport,
  EditorStatus,
  GlobalConfig,
  ProjectExtras,
  ProjectResourceUsage,
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
