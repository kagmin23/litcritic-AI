import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROLE_LABEL, useAuth } from '@/lib/authContext'
import { useNav, type Route } from '@/lib/navigation'
import type { UserRole } from '@/types'
import { cn } from 'cn'
import { AnimatePresence, motion } from 'framer-motion'
import {
    FilePlus2,
    FlaskConical,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Menu,
    X,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  icon: typeof LayoutDashboard
  route: Route
  match: Route['name'][]
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
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
  {
    label: 'Tổng quan',
    icon: FlaskConical,
    route: { name: 'admin' },
    match: ['admin'],
    roles: ['student', 'teacher'],
  },
]

/**
 * Thanh điều hướng trên cùng cho student & teacher (thay cho sidebar).
 * - Student: tabs kiểu "pill" bo tròn, tông sky/cyan.
 * - Teacher: tabs kiểu "underline" gạch chân, tông indigo/violet + pill vai trò.
 */
export function TopNav({ variant }: { variant: 'student' | 'teacher' }) {
  const { route, navigate } = useNav()
  const { user, role, logout, isActive } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = NAV_ITEMS.filter((it) => role && it.roles.includes(role))

  const initials = (user?.profile.full_name || user?.profile.username || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  const isStudent = variant === 'student'

  // Màu nền logo + accent theo role.
  const logoClass = isStudent
    ? 'bg-gradient-to-br from-sky-500 to-cyan-500'
    : 'bg-brand-gradient'

  function go(it: NavItem) {
    if (!isActive && it.route.name !== 'dashboard') return
    navigate(it.route)
    setMobileOpen(false)
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full border-b',
        route.name !== 'debate' && 'app-ui-scale',
        isStudent
          ? 'glass border-sky-200/60 dark:border-sky-900/40'
          : 'glass border-indigo-200/60 dark:border-indigo-900/40'
      )}
    >
      {/* Dải màu mảnh trên đỉnh để phân biệt role ngay từ cái nhìn đầu tiên */}
      <div
        className={cn(
          'h-1 w-full',
          isStudent
            ? 'bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400'
            : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500'
        )}
      />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 lg:px-8">
        {/* Logo */}
        <button
          onClick={() => navigate({ name: 'dashboard' })}
          className="flex shrink-0 items-center gap-2.5"
        >
          <div
            className={cn(
              'flex size-9 items-center justify-center rounded-xl text-white shadow-sm',
              logoClass
            )}
          >
            <GraduationCap className="size-5" />
          </div>
          <div className="hidden text-left leading-tight sm:block">
            <div className="font-heading text-sm font-semibold">
              ViSEF LitCritic
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isStudent ? 'Không gian học sinh' : 'Không gian giáo viên'}
            </div>
          </div>
        </button>

        {/* Tabs — desktop */}
        <nav
          className={cn(
            'hidden flex-1 items-center lg:flex',
            isStudent ? 'justify-center gap-2' : 'justify-start gap-1 pl-4'
          )}
        >
          {items.map((it) => {
            const active = it.match.includes(route.name)
            const disabled = !isActive && it.route.name !== 'dashboard'
            const Icon = it.icon

            if (isStudent) {
              // Kiểu PILL bo tròn nổi
              return (
                <button
                  key={it.label}
                  onClick={() => go(it)}
                  disabled={disabled}
                  className={cn(
                    'relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    disabled && 'cursor-not-allowed opacity-40',
                    active
                      ? 'text-white'
                      : 'text-muted-foreground hover:bg-sky-100/60 hover:text-sky-700 dark:hover:bg-sky-950/40'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="topnav-active"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className="relative size-4" />
                  <span className="relative">{it.label}</span>
                </button>
              )
            }

            // Teacher — kiểu UNDERLINE gạch chân
            return (
              <button
                key={it.label}
                onClick={() => go(it)}
                disabled={disabled}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-4 text-sm font-medium transition-colors',
                  disabled && 'cursor-not-allowed opacity-40',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="size-4" />
                {it.label}
                {active && (
                  <motion.div
                    layoutId="topnav-active"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Spacer khi mobile */}
        <div className="flex-1 lg:hidden" />

        {/* Cụm người dùng — desktop */}
        <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
          {!isStudent && role && (
            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {ROLE_LABEL[role]}
            </Badge>
          )}
          <div className="text-right leading-tight">
            <div className="text-sm font-medium">
              {user?.profile.full_name || user?.profile.username}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isStudent
                ? user?.profile.class_name || 'Học sinh'
                : `@${user?.profile.username}`}
            </div>
          </div>
          <Avatar>
            <AvatarFallback
              className={cn('text-xs text-white', logoClass)}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={logout}
            aria-label="Đăng xuất"
          >
            <LogOut className="size-4" />
          </Button>
        </div>

        {/* Nút mở menu mobile */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {/* Menu mobile xổ xuống */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t lg:hidden"
          >
            <div className="space-y-1 p-3">
              {items.map((it) => {
                const active = it.match.includes(route.name)
                const disabled = !isActive && it.route.name !== 'dashboard'
                const Icon = it.icon
                return (
                  <button
                    key={it.label}
                    onClick={() => go(it)}
                    disabled={disabled}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      disabled && 'cursor-not-allowed opacity-40',
                      active
                        ? isStudent
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                          : 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    {it.label}
                  </button>
                )
              })}
              <div className="mt-2 flex items-center justify-between rounded-xl border p-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar>
                    <AvatarFallback className={cn('text-xs text-white', logoClass)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <div className="text-sm font-medium">
                      {user?.profile.full_name || user?.profile.username}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {role ? ROLE_LABEL[role] : ''}
                      {user?.profile.class_name
                        ? ` · ${user.profile.class_name}`
                        : ''}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={logout}>
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export default TopNav
