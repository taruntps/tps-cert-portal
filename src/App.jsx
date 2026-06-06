import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Unauthorized from './pages/Unauthorized'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import TechManagerDashboard from './pages/dashboard/TechManagerDashboard'
import AuditorDashboard from './pages/dashboard/AuditorDashboard'
import SalesDashboard from './pages/dashboard/SalesDashboard'
import AdminKnowledge from './pages/AdminKnowledge'
import AskAIWidget from './components/AskAIWidget'

function DashboardRouter() {
  const { profile, loading } = useAuth()
  if (loading || !profile) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
        <span>Loading dashboard…</span>
      </div>
    )
  }
  switch (profile.role) {
    case 'admin':             return <AdminDashboard />
    case 'technical_manager': return <TechManagerDashboard />
    case 'auditor':           return <AuditorDashboard />
    case 'sales':             return <SalesDashboard />
    default:                  return <Navigate to="/unauthorized" replace />
  }
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login"        element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Authenticated — AppShell wraps all protected pages */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardRouter />} />
          <Route path="admin/knowledge" element={<AdminKnowledge />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Ask AI widget — shows on all authenticated pages */}
      <AskAIWidget />
    </>
  )
}
