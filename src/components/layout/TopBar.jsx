import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const PAGE_TITLES = {
  '/dashboard':      'Dashboard',
  '/companies':      'Companies',
  '/certifications': 'Certifications',
  '/audit-files':    'Audit Files',
  '/ncs':            'NC Tracker',
  '/compliance':     'Compliance Planner',
  '/auditors':       'Auditor Management',
  '/committees':     'Committees',
  '/documents':      'Document Library',
  '/sales':          'Sales Pipeline',
  '/reports':        'Reports & Analytics',
  '/users':          'User Management',
  '/enquiries':      'Enquiries',
  '/assignments':    'My Assignments',
  '/formats':        'Formats',
}

function getInitials(name) {
  if (!name) return 'U'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function TopBar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const pathname = window.location.pathname
  const pageTitle = PAGE_TITLES[pathname] ?? 'TPS Cert Portal'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-page-title">{pageTitle}</span>
      </div>

      <div className="topbar-right">
        {profile && (
          <div className="topbar-user">
            <div className="topbar-avatar">
              {getInitials(profile.full_name)}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-name">{profile.full_name}</span>
              <span className="topbar-role">
                {profile.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        )}
        <button className="topbar-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </header>
  )
}
