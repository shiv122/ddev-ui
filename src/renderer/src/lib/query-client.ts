import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 2_000
    }
  }
})

export const queryKeys = {
  projects: ['projects'] as const,
  describe: (name: string) => ['describe', name] as const,
  version: ['version'] as const,
  doctor: ['doctor'] as const,
  addonRegistry: ['addon-registry'] as const,
  addonsInstalled: (name: string) => ['addons-installed', name] as const,
  snapshots: (name: string) => ['snapshots', name] as const,
  configFile: (name: string) => ['config-file', name] as const,
  extras: (name: string) => ['extras', name] as const,
  globalConfig: ['global-config'] as const,
  binaries: ['binaries'] as const
}

/** Refresh everything affected by a binary path change (ddev/docker located). */
export function invalidateAfterBinaryChange(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.binaries })
  void queryClient.invalidateQueries({ queryKey: queryKeys.doctor })
  void queryClient.invalidateQueries({ queryKey: queryKeys.version })
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects })
}

/** Invalidate everything that may change after a ddev operation completes. */
export function invalidateAfterOperation(project?: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects })
  if (project) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.describe(project) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.addonsInstalled(project) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.snapshots(project) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.configFile(project) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.extras(project) })
  } else {
    void queryClient.invalidateQueries({ queryKey: ['describe'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.globalConfig })
  }
}
