import { TopNav } from '@/components/TopNav'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROLE_LABEL, useAuth } from '@/lib/authContext'
import { useNav, type Route } from '@/lib/navigation'
import type { UserRole } from '@/types'
import { cn } from 'cn'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Clock,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface NavItem {
  label: string
  icon: typeof LayoutDashboard
  route: Route
  match: Route['name'][]
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  // Nghiệp vụ nội dung — student & teacher
  {
    label: 'Trang chủ',
    icon: LayoutDashboard,
    route: { name: 'dashboard' },
    match: ['dashboard', 'debate', 'report'],
    roles: ['student', 'teacher'],
  },
  {
    label: 'Tạo ngữ liệu',
    icon: FilePlus2,
    route: { name: 'textInput' },
    match: ['textInput'],
    roles: ['student', 'teacher'],
  },
  // Quản trị — chỉ admin
  {
    label: 'Quản lý người dùng',
    icon: UsersRound,
    route: { name: 'userMgmt' },
    match: ['userMgmt'],
    roles: ['admin'],
  },
  {
    label: 'Thống kê truy cập',
    icon: Activity,
    route: { name: 'analytics' },
    match: ['analytics'],
    roles: ['admin'],
  },
]

const COLLAPSE_KEY = 'visef_sidebar_collapsed'

/**
 * Khung ứng dụng dùng chung.
 * - Admin: sidebar trái (thu gọn được).
 * - Student / Teacher: thanh điều hướng trên cùng (TopNav), bố cục khác nhau.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { route, navigate } = useNav()
  const { user, role, logout, isActive, isPending } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Trạng thái thu gọn sidebar (lưu localStorage) — khai báo trước mọi early return.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  })
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Student & teacher: dùng TopNav thay cho sidebar.
  if (role === 'student' || role === 'teacher') {
    return (
      <div className="flex h-screen w-full flex-col overflow-hidden bg-muted/30">
        <TopNav variant={role} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    )
  }

  const items = NAV_ITEMS.filter(
    (it) => !it.roles || (role && it.roles.includes(role))
  )

  const initials = (user?.profile.full_name || user?.profile.username || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  /**
   * Nội dung sidebar. `isCollapsed` chỉ áp dụng cho desktop; drawer mobile luôn
   * hiển thị đầy đủ (truyền false).
   */
  const renderSidebar = (isCollapsed: boolean) => (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col gap-2 p-3">
        {/* Logo + nút thu gọn (desktop) */}
        <div
          className={cn(
            'mb-2 flex items-center gap-2',
            isCollapsed ? 'flex-col' : 'justify-between'
          )}
        >
          <button
            onClick={() => navigate({ name: 'dashboard' })}
            className={cn(
              'flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent',
              isCollapsed && 'p-1.5'
            )}
            title="Multi LitCritic AI"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
              <GraduationCap className="size-5" />
            </div>
            {!isCollapsed && (
              <div className="leading-tight">
                <div className="font-heading text-sm font-semibold">
                  Multi LitCritic AI
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Tư duy phản biện
                </div>
              </div>
            )}
          </button>

          {/* Nút thu gọn — chỉ hiện trên desktop (ẩn trong drawer mobile) */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>

        {/* Điều hướng */}
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => {
            const active = it.match.includes(route.name)
            const Icon = it.icon
            const disabled = !isActive && it.route.name !== 'dashboard'

            const button = (
              <button
                key={it.label}
                disabled={disabled}
                onClick={() => {
                  navigate(it.route)
                  setMobileOpen(false)
                }}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2' : 'px-3',
                  disabled && 'cursor-not-allowed opacity-40',
                  active
                    ? 'text-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative size-4.5 shrink-0" />
                {!isCollapsed && <span className="relative">{it.label}</span>}
              </button>
            )

            // Khi thu gọn: bọc tooltip để vẫn biết tên mục.
            if (isCollapsed) {
              return (
                <Tooltip key={it.label}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">
                    {it.label}
                    {disabled ? ' · chờ phê duyệt' : ''}
                  </TooltipContent>
                </Tooltip>
              )
            }
            return button
          })}
        </nav>

        {/* Người dùng */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Avatar>
              <AvatarFallback className="bg-brand-gradient text-xs text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={logout}
                  aria-label="Đăng xuất"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Đăng xuất ({user?.profile.username})
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="rounded-xl border bg-card/60 p-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar>
                <AvatarFallback className="bg-brand-gradient text-xs text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium">
                  {user?.profile.full_name ||
                    user?.profile.username ||
                    'Người dùng'}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {role ? ROLE_LABEL[role] : ''}
                  {user?.profile.class_name
                    ? ` · ${user.profile.class_name}`
                    : ''}
                </div>
                {isPending && (
                  <Badge className="mt-1 bg-amber-100 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <Clock className="mr-0.5 size-2.5" /> Chờ duyệt
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={logout}
                aria-label="Đăng xuất"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {/* Sidebar desktop — rộng/hẹp theo trạng thái thu gọn */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r bg-sidebar lg:block"
      >
        {renderSidebar(collapsed)}
      </motion.aside>

      {/* Sidebar mobile (drawer) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar lg:hidden"
            >
              <div className="flex justify-end p-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              {renderSidebar(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Nội dung */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="glass sticky top-0 z-30 flex items-center gap-2 border-b px-4 py-2.5 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-brand-gradient text-white">
              <GraduationCap className="size-4" />
            </div>
            <span className="font-heading text-sm font-semibold">
              Multi LitCritic AI
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

export default AppShell
