import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StatCard from '../../components/shared/StatCard'

// ── UTILS ─────────────────────────────────────────────────
const fmt = (d) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function DaysChip({ days }) {
  if (days === null) return null
  if (days < 0) return <span className="days-chip overdue">{Math.abs(days)}d overdue</span>
  if (days <= 60) return <span className="days-chip soon">{days}d</span>
  return <span className="days-chip upcoming">{days}d</span>
}

function CertBadge({ type }) {
  return type === 'nabcb_accredited'
    ? <span className="badge badge-accredited">NABCB Accredited</span>
    : <span className="badge badge-pre-acc">Pre-accreditation</span>
}

// ── ICONS ─────────────────────────────────────────────────
const I = {
  certs:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  companies:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/></svg>,
  calendar:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  alert:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
}

// ── COMPONENT ─────────────────────────────────────────────
export default function AdminDashboard() {
  const { profile } = useAuth()
  const [certs, setCerts]           = useState([])
  const [compliance, setCompliance] = useState([])
  const [ncCount, setNcCount]       = useState(null)
  const [loading, setLoading]       = useState(true)

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // All active certifications with company names
        const { data: certData } = await supabase
          .from('certifications')
          .select('*, companies(name)')
          .eq('status', 'active')
          .order('surveillance_1_due', { ascending: true })

        // Next 10 pending compliance items
        const { data: complianceData } = await supabase
          .from('compliance_calendar')
          .select('*, companies(name)')
          .eq('status', 'pending')
          .order('due_date', { ascending: true })
          .limit(10)

        // Open NCs count
        const { count } = await supabase
          .from('nonconformities')
          .select('*', { count: 'exact', head: true })
          .not('status', 'in', '("closed","overdue")')

        setCerts(certData ?? [])
        setCompliance(complianceData ?? [])
        setNcCount(count ?? 0)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Compute upcoming S1 (due within 90 days)
  const upcomingS1 = certs.filter(c => {
    const d = daysUntil(c.surveillance_1_due)
    return d !== null && d <= 365 && d >= 0
  })

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Tarun'}</h1>
        <p>
          {today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}TPS Xperts Global Certification — Admin View
        </p>
      </div>

      {/* KPI cards */}
      <div className="stat-grid">
        <StatCard
          label="Active Certifications"
          value={loading ? '…' : certs.length}
          sub="ISO 22000:2018"
          iconClass="stat-icon-blue"
          icon={I.certs}
        />
        <StatCard
          label="Certified Companies"
          value={loading ? '…' : certs.length}
          sub="All active"
          iconClass="stat-icon-green"
          icon={I.companies}
        />
        <StatCard
          label="Upcoming S1 (≤ 1 year)"
          value={loading ? '…' : upcomingS1.length}
          sub={upcomingS1.length > 0 ? `Next: ${fmt(upcomingS1[0]?.surveillance_1_due)}` : 'None due soon'}
          iconClass={upcomingS1.length > 0 ? 'stat-icon-amber' : 'stat-icon-green'}
          icon={I.calendar}
        />
        <StatCard
          label="Open NCs"
          value={loading ? '…' : ncCount}
          sub={ncCount === 0 ? 'All closed ✓' : 'Require attention'}
          iconClass={ncCount > 0 ? 'stat-icon-red' : 'stat-icon-green'}
          icon={I.alert}
        />
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>Loading data…</span></div>
      ) : (
        <div className="content-grid-3">

          {/* ── Certification Tracker ── */}
          <div className="table-wrap">
            <div className="table-header">
              <h3>Certification Tracker</h3>
              <span>{certs.length} active</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Issue Date</th>
                  <th>S1 Due</th>
                  <th>Recert Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {certs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No certifications found</td></tr>
                ) : certs.map(cert => {
                  const s1Days = daysUntil(cert.surveillance_1_due)
                  const isOverdue  = s1Days !== null && s1Days < 0
                  const isDueSoon  = s1Days !== null && s1Days >= 0 && s1Days <= 90
                  return (
                    <tr
                      key={cert.id}
                      className={isOverdue ? 'row-overdue' : isDueSoon ? 'row-due-soon' : ''}
                    >
                      <td className="td-company">{cert.companies?.name ?? '—'}</td>
                      <td><CertBadge type={cert.certificate_type} /></td>
                      <td className="td-date">{fmt(cert.issue_date)}</td>
                      <td className="td-due">
                        <span className="td-date">{fmt(cert.surveillance_1_due)}</span>
                        <DaysChip days={s1Days} />
                      </td>
                      <td className="td-date">{fmt(cert.recertification_due)}</td>
                      <td>
                        <span className={`badge ${cert.status === 'active' ? 'badge-active' : 'badge-pending'}`}>
                          {cert.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Upcoming Compliance ── */}
          <div className="table-wrap">
            <div className="table-header">
              <h3>Compliance Calendar</h3>
              <span>Pending</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Due Date</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {compliance.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No pending items</td></tr>
                ) : compliance.slice(0, 8).map(item => {
                  const days = daysUntil(item.due_date)
                  return (
                    <tr key={item.id} className={days !== null && days < 0 ? 'row-overdue' : days !== null && days <= 60 ? 'row-due-soon' : ''}>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.82rem', lineHeight: 1.3 }}>{item.title}</div>
                        {item.companies?.name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.companies.name}</div>
                        )}
                      </td>
                      <td className="td-date">{fmt(item.due_date)}</td>
                      <td><DaysChip days={days} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}
