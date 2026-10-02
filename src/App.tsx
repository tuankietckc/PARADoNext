import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthPage } from './features/auth/AuthPage'
import { HomePage } from './features/home/HomePage'
import { SupabaseSettingsPage } from './features/settings/SupabaseSettingsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { NotesPage } from './features/notes/NotesPage'
import { AreasPage } from './features/para/AreasPage'
import { ProjectsPage } from './features/para/ProjectsPage'
import { ParaDetailPage } from './features/para/ParaDetailPage'
import { ArchivesPage } from './features/para/ArchivesPage'
import { ResourcesPage } from './features/resources/ResourcesPage'
import { ChannelPage } from './features/channel/ChannelPage'
import { HabitsPage } from './features/habits/HabitsPage'
import { ReviewPage } from './features/review/ReviewPage'
import { StatsPage } from './features/stats/StatsPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/settings" element={<SupabaseSettingsPage />} />
        <Route path="/login" element={<AuthPage />} />
        {(['areas', 'projects'] as const).map((kind) => [
          <Route
            key={kind}
            path={`/${kind}`}
            element={
              <ProtectedRoute>
                {kind === 'projects' ? <ProjectsPage /> : <AreasPage />}
              </ProtectedRoute>
            }
          />,
          <Route
            key={`${kind}-detail`}
            path={`/${kind}/:id`}
            element={
              <ProtectedRoute>
                <ParaDetailPage key={kind} kind={kind} />
              </ProtectedRoute>
            }
          />,
        ])}
        <Route
          path="/archives"
          element={
            <ProtectedRoute>
              <ArchivesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/habits"
          element={
            <ProtectedRoute>
              <HabitsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <ProtectedRoute>
              <StatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channel"
          element={
            <ProtectedRoute>
              <ChannelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resources"
          element={
            <ProtectedRoute>
              <ResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <NotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <TasksPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppShell>
  )
}

export default App
