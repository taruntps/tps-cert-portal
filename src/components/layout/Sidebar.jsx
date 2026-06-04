import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// ── SVG ICONS ──────────────────────────────────────────────
const icons = {
  dashboard:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  companies:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/></svg>,
  certs:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  documents:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>,
  auditors:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  compliance:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  ncs:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  committees:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  auditFiles:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  sales:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  reports:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  users:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  enquiries:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  assignments: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  procedures:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
}

// ── NAVIGATION CONFIGS BY ROLE ─────────────────────────────
const NAV = {
  admin: [
    {
      section: 'Operations',
      items: [
        { label: 'Dashboard',    to: '/dashboard',    icon: icons.dashboard },
        { label: 'Companies',    to: '/companies',    icon: icons.companies },
        { label: 'Certifications', to: '/certifications', icon: icons.certs },
        { label: 'Audit Files',  to: '/audit-files',  icon: icons.auditFiles },
        { label: 'NC Tracker',   to: '/ncs',          icon: icons.ncs },
        { label: 'Compliance',   to: '/compliance',   icon: icons.compliance },
      ]
    },
    {
      section: 'People',
      items: [
        { label: 'Auditors',     to: '/auditors',     icon: icons.auditors },
        { label: 'Committees',   to: '/committees',   icon: icons.committees },
      ]
    },
    {
      section: 'Content',
      items: [
        { label: 'Documents',    to: '/documents',    icon: icons.documents },
        { label: 'Sales',        to: '/sales',        icon: icons.sales },
        { label: 'Reports',      to: '/reports',      icon: icons.reports },
      ]
    },
    {
      section: 'Admin',
      items: [
        { label: 'User Mgmt',    to: '/users',        icon: icons.users },
      ]
    }
  ],

  technical_manager: [
    {
      section: 'Operations',
      items: [
        { label: 'Dashboard',    to: '/dashboard',    icon: icons.dashboard },
        { label: 'Companies',    to: '/companies',    icon: icons.companies },
        { label: 'Certifications', to: '/certifications', icon: icons.certs },
        { label: 'Audit Files',  to: '/audit-files',  icon: icons.auditFiles },
        { label: 'NC Tracker',   to: '/ncs',          icon: icons.ncs },
        { label: 'Compliance',   to: '/compliance',   icon: icons.compliance },
      ]
    },
    {
      section: 'People & Docs',
      items: [
        { label: 'Auditors',     to: '/auditors',     icon: icons.auditors },
        { label: 'Committees',   to: '/committees',   icon: icons.committees },
        { label: 'Documents',    to: '/documents',    icon: icons.documents },
      ]
    },
    {
      section: 'Reporting',
      items: [
        { label: 'Reports',      to: '/reports',      icon: icons.reports },
      ]
    }
  ],

  auditor: [
    {
      section: 'My Work',
      items: [
        { label: 'Dashboard',      to: '/dashboard',    icon: icons.dashboard },
        { label: 'My Assignments', to: '/assignments',  icon: icons.assignments },
      ]
    },
    {
      section: 'Resources',
      items: [
        { label: 'Procedures',     to: '/documents',    icon: icons.procedures },
        { label: 'Formats',        to: '/formats',      icon: icons.auditFiles },
      ]
    }
  ],

  sales: [
    {
      section: 'Business',
      items: [
        { label: 'Dashboard',   to: '/dashboard',    icon: icons.dashboard },
        { label: 'Enquiries',   to: '/enquiries',    icon: icons.enquiries },
        { label: 'Companies',   to: '/companies',    icon: icons.companies },
      ]
    },
    {
      section: 'Reporting',
      items: [
        { label: 'Reports',     to: '/reports',      icon: icons.reports },
      ]
    }
  ],
}

const ROLE_LABELS = {
  admin: 'Administrator',
  technical_manager: 'Technical Manager',
  auditor: 'Auditor',
  sales: 'Sales & Follow-up',
}

export default function Sidebar() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'auditor'
  const navSections = NAV[role] ?? NAV.auditor

  return (
    <aside className="sidebar">
      {/* Brand header */}
      <div className="sidebar-header">
        <img
          src="/logo.png"
          alt="TPS"
          className="sidebar-logo"
        />
        <div className="sidebar-brand">
          <span className="sidebar-brand-name">TPS Cert Portal</span>
          <span className="sidebar-brand-sub">NABCB Accredited CB</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div className="nav-section" key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Role badge */}
      <div className="sidebar-footer">
        <div className="sidebar-role-badge">
          <span className="role-dot" />
          <span className="role-text">{ROLE_LABELS[role] ?? role}</span>
        </div>
      </div>
    </aside>
  )
}
