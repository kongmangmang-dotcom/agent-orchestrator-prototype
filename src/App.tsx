import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { OverviewPage } from './pages/Overview'
import { ProvidersPage } from './pages/Providers'
import { AgentsPage } from './pages/Agents'
import { RolesPage } from './pages/Roles'
import { KnowledgePage } from './pages/Knowledge'
import { WorkflowsPage } from './pages/Workflows'
import { WorkflowFormPage } from './pages/WorkflowCreate'
import { RunMonitorPage } from './pages/RunMonitor'
import { SchedulePage } from './pages/Schedule'
import { ProgressOverviewPage } from './pages/ProgressOverview'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="providers" element={<ProvidersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/new" element={<WorkflowFormPage />} />
          <Route path="workflows/:id/edit" element={<WorkflowFormPage />} />
          <Route path="runs" element={<RunMonitorPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="progress" element={<ProgressOverviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
