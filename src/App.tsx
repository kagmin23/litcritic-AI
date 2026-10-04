import { AppShell } from '@/components/AppShell'
import { AuthProvider } from '@/components/AuthProvider'
import { useAuth } from '@/lib/authContext'
import { pageTransition, pageVariants } from '@/lib/motion'
import { NavContext, type Route } from '@/lib/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import AdminAnalyticsPage from '@/pages/AdminAnalyticsPage'
import AdminLoginPage from '@/pages/AdminLoginPage'
import AdminResearchPage from '@/pages/AdminResearchPage'
import AssessmentReportPage from '@/pages/AssessmentReportPage'
import DashboardPage from '@/pages/DashboardPage'
import DebateArenaPage from '@/pages/DebateArenaPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import TextInputPage from '@/pages/TextInputPage'
import UserManagementPage from '@/pages/UserManagementPage'

const AUTH_ROUTES: Route['name'][] = ['login', 'register', 'adminLogin']
// Chỉ admin
const ADMIN_ONLY: Route['name'][] = ['userMgmt', 'analytics']
// Nghiệp vụ nội dung — admin KHÔNG dùng
const CONTENT_ROUTES: Route['name'][] = [
  'dashboard',
  'textInput',
  'debate',
  'report',
]
// Nghiên cứu ViSEF — chỉ teacher
const TEACHER_ONLY: Route['name'][] = ['admin']

function Routed() {
  const { user, loading, hasRole } = useAuth()
  const [route, setRoute] = useState<Route>({ name: 'login' })

  const isAdmin = hasRole('admin')

  // Đồng bộ điều hướng với trạng thái đăng nhập + phân quyền.
  useEffect(() => {
    if (loading) return
    const onAuthRoute = AUTH_ROUTES.includes(route.name)

    let redirect: Route | null = null

    if (!user && !onAuthRoute) {
      redirect = { name: 'login' }
    } else if (user && onAuthRoute) {
      // Đăng nhập xong → admin vào quản lý user, còn lại vào dashboard.
      redirect = isAdmin ? { name: 'userMgmt' } : { name: 'dashboard' }
    } else if (user && isAdmin && CONTENT_ROUTES.includes(route.name)) {
      // Admin không làm nghiệp vụ nội dung → đưa về quản lý user.
      redirect = { name: 'userMgmt' }
    } else if (user && isAdmin && TEACHER_ONLY.includes(route.name)) {
      // Admin không vào trang nghiên cứu teacher.
      redirect = { name: 'userMgmt' }
    } else if (user && !isAdmin && ADMIN_ONLY.includes(route.name)) {
      // Không phải admin mà cố vào trang admin → về dashboard.
      redirect = { name: 'dashboard' }
    } else if (
      user &&
      !hasRole('teacher', 'admin') &&
      TEACHER_ONLY.includes(route.name)
    ) {
      // Học sinh không vào trang nghiên cứu.
      redirect = { name: 'dashboard' }
    }

    if (redirect) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoute(redirect)
    }
  }, [user, loading, route.name, hasRole, isAdmin])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm">Đang tải phiên làm việc…</span>
        </div>
      </div>
    )
  }

  const nav = { route, navigate: setRoute }

  // ----- Trang auth -----
  if (!user || AUTH_ROUTES.includes(route.name)) {
    let authPage: React.ReactNode
    switch (route.name) {
      case 'register':
        authPage = <RegisterPage />
        break
      case 'adminLogin':
        authPage = <AdminLoginPage />
        break
      default:
        authPage = <LoginPage />
    }
    return (
      <NavContext.Provider value={nav}>
        <AnimatePresence mode="wait">
          <motion.div
            key={route.name}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {authPage}
          </motion.div>
        </AnimatePresence>
      </NavContext.Provider>
    )
  }

  // ----- Đấu trường: full-height -----
  if (route.name === 'debate') {
    return (
      <NavContext.Provider value={nav}>
        <AppShell>
          <DebateArenaPage sessionId={route.sessionId} />
        </AppShell>
      </NavContext.Provider>
    )
  }

  // ----- Trang trong shell, chuyển cảnh -----
  function renderApp() {
    switch (route.name) {
      case 'textInput':
        return <TextInputPage />
      case 'report':
        return <AssessmentReportPage sessionId={route.sessionId} />
      case 'admin':
        return <AdminResearchPage />
      case 'userMgmt':
        return <UserManagementPage />
      case 'analytics':
        return <AdminAnalyticsPage />
      case 'dashboard':
      default:
        return <DashboardPage />
    }
  }

  return (
    <NavContext.Provider value={nav}>
      <AppShell>
        <AnimatePresence mode="wait">
          <motion.div
            key={route.name}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {renderApp()}
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </NavContext.Provider>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  )
}

export default App
