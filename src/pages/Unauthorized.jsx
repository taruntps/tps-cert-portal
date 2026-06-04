import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="unauthorized-page">
      <div className="unauthorized-card">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ margin: '0 auto' }}>
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <h2>Access Restricted</h2>
        <p>You don't have permission to view this page. Please contact your administrator.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
          <button className="btn btn-primary" onClick={handleSignOut} style={{ width: 'auto' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
