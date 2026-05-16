import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from '../components/ui/Spinner'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AppShell } from '../components/layout/AppShell'

// ─── Lazy-loaded pages (code splitting) ───────────────────────────────────────
const LoginPage = lazy(() => import('../pages/LoginPage').then(m => ({ default: m.LoginPage })))
const HomePage = lazy(() => import('../pages/HomePage').then(m => ({ default: m.HomePage })))
const ProjectPage = lazy(() => import('../pages/ProjectPage').then(m => ({ default: m.ProjectPage })))
const EpisodeDetailPage = lazy(() => import('../pages/EpisodeDetailPage').then(m => ({ default: m.EpisodeDetailPage })))
const BranchPage = lazy(() => import('../pages/BranchPage').then(m => ({ default: m.BranchPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const SetupPage = lazy(() => import('../pages/SetupPage').then(m => ({ default: m.SetupPage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <Spinner size="md" />
    </div>
  )
}

function ProtectedRoute() {
  const { loading } = useAuth()
  if (loading) return <PageLoader />
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <HomePage />,
          },
          {
            path: ':projectId',
            element: <ProjectPage />,
          },
          {
            path: ':projectId/episodes/:episodeId',
            element: <EpisodeDetailPage />,
          },
          {
            path: ':projectId/branch/:branchName',
            element: <BranchPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
          {
            path: 'setup',
            element: <SetupPage />,
          },
        ],
      },
    ],
  },
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageLoader />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
])

export function AppRouter() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}
