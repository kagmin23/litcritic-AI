import { NavContext, type Route } from '@/lib/navigation'
import AdminResearchPage from '@/pages/AdminResearchPage'
import AssessmentReportPage from '@/pages/AssessmentReportPage'
import DashboardPage from '@/pages/DashboardPage'
import DebateArenaPage from '@/pages/DebateArenaPage'
import TextInputPage from '@/pages/TextInputPage'
import { useState } from 'react'

function App() {
  const [route, setRoute] = useState<Route>({ name: 'dashboard' })

  function renderRoute() {
    switch (route.name) {
      case 'dashboard':
        return <DashboardPage />
      case 'textInput':
        return <TextInputPage />
      case 'debate':
        return <DebateArenaPage sessionId={route.sessionId} />
      case 'report':
        return <AssessmentReportPage sessionId={route.sessionId} />
      case 'admin':
        return <AdminResearchPage />
      default:
        return <DashboardPage />
    }
  }

  return (
    <NavContext.Provider value={{ route, navigate: setRoute }}>
      <div className="min-h-screen bg-muted/30 text-foreground">
        {renderRoute()}
      </div>
    </NavContext.Provider>
  )
}

export default App
