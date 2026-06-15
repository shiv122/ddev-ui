import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Route =
  | { view: 'dashboard' }
  | { view: 'project'; name: string; tab?: string }
  | { view: 'create' }
  | { view: 'addons' }
  | { view: 'connections' }
  | { view: 'operations'; selected?: string }
  | { view: 'doctor' }
  | { view: 'settings' }

interface RouterValue {
  route: Route
  navigate: (route: Route) => void
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ view: 'dashboard' })
  const navigate = useCallback((next: Route) => setRoute(next), [])
  const value = useMemo(() => ({ route, navigate }), [route, navigate])
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}
