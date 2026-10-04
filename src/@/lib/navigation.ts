import { createContext, useContext } from 'react';

export type Route =
  // Auth (chưa đăng nhập)
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'adminLogin' }
  // Ứng dụng (đã đăng nhập)
  | { name: 'dashboard' }
  | { name: 'textInput' }
  | { name: 'debate'; sessionId: string }
  | { name: 'report'; sessionId: string }
  | { name: 'admin' } // Nghiên cứu ViSEF (teacher)
  | { name: 'userMgmt' } // Quản lý người dùng (admin)
  | { name: 'analytics' } // Thống kê truy cập (admin)

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
