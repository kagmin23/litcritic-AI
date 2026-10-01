import { createContext, useContext } from 'react'

export type Route =
  | { name: 'dashboard' }
  | { name: 'textInput' }
  | { name: 'debate'; sessionId: string }
  | { name: 'report'; sessionId: string }
  | { name: 'admin' }

export interface NavContextValue {
  route: Route
  navigate: (route: Route) => void
}

export const NavContext = createContext<NavContextValue | null>(null)

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav phải dùng bên trong <NavContext.Provider>')
  return ctx
}
