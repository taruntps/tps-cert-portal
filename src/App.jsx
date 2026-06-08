import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import Unauthorized from './pages/Unauthorized'

// Dashboards
import AdminDashboard from './pages/dashboard/AdminDashboard'
import TechManagerDashboard from './pages/dashboard/TechManagerDashboard'
import AuditorDashboard from './pages/dashboard/AuditorDashboard'
import SalesDashboard from './pages/dashboard/SalesDashboard'

// Module pages
import Companies from './pages/Companies'
import Certifications from './pages/Certifications'
import AuditFiles from './pages/AuditFiles'
import NCTracker from './pages/NCTracker'
import Compliance from './pages/Compliance'
import Auditors from './pages/Auditors'
import Committees from './pages/Committees'
import Documents from './pages/Documents'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'

// Other
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

          {/* Core */}
          <Route path="dashboard"    element={<DashboardRouter />} />

          {/* Operations */}
          <Route path="companies"    element={<Companies />} />
          <Route path="certifications" element={<Certifications />} />
          <Route path="audit-files"  element={<AuditFiles />} />
          <Route path="nc-tracker"   element={<NCTracker />} />
          <Route path="compliance"   element={<Compliance />} />

          {/* People */}
          <Route path="auditors"     element={<Auditors />} />
          <Route path="committees"   element={<Committees />} />

          {/* Content */}
          <Route path="documents"    element={<Documents />} />
          <Route path="sales"        element={<Sales />} />
          <Route path="reports"      element={<Reports />} />

          {/* Admin only */}
          <Route path="user-management" element={<UserManagement />} />
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
