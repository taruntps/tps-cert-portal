import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StatCard from '../../components/shared/StatCard'

const fmt = (d) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

function DaysChip({ days }) {
  if (days === null) return null
  if (days < 0)    return <span className="days-chip overdue">{Math.abs(days)}d overdue</span>
  if (days <= 60)  return <span className="days-chip soon">{days}d</span>
  return             <span className="days-chip upcoming">{days}d</span>
}

const I = {
  audit:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>,
  nc:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  due:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  certs:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
}

export default function TechManagerDashboard() {
  const { profile } = useAuth()
  const [certs, setCerts]           = useState([])
  const [ncs, setNcs]               = useState([])
  const [upcoming, setUpcoming]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]       = useState(true)

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [certsRes, ncsRes, compRes, auditRes] = await Promise.all([
          supabase.from('certifications').select('*, companies(name)').eq('status', 'active').order('surveillance_1_due'),
          supabase.from('nonconformities').select('*, companies(name)').not('status', 'in', '("closed")').order('raised_date', { ascending: false }).limit(8),
          supabase.from('compliance_calendar').select('*, companies(name)').eq('status', 'pending').order('due_date').limit(6),
          supabase.from('audit_assignments').select('*, companies(name), certifications(certificate_type, standard)').in('status', ['planned', 'scheduled']).order('planned_date').limit(6),
        ])
        setCerts(certsRes.data ?? [])
        setNcs(ncsRes.data ?? [])
        setUpcoming(compRes.data ?? [])
        setAssignments(auditRes.data ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const openNCs  = ncs.filter(n => n.status === 'open').length
  const majorNCs = ncs.filter(n => n.nc_type === 'major').length

  const NC_STATUS_COLOR = {
    open: 'badge-danger', root_cause_submitted: 'badge-pending',
    corrective_action_submitted: 'badge-info', verified: 'badge-active', closed: 'badge-active',
  }
  const NC_TYPE_COLOR = { major: 'badge-danger', minor: 'badge-pending', observation: 'badge-info' }

  return (
    <div>
      <div className="page-header">
        <h1>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Virat'}</h1>
        <p>{today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Technical Manager View</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Active Certs" value={loading ? '…' : certs.length} sub="ISO 22000:2018" iconClass="stat-icon-blue" icon={I.certs} />
        <StatCard label="Open NCs" value={loading ? '…' : openNCs} sub={majorNCs > 0 ? `${majorNCs} major — action required` : 'No major NCs'} iconClass={openNCs > 0 ? 'stat-icon-red' : 'stat-icon-green'} icon={I.nc} />
        <StatCard label="Planned Audits" value={loading ? '…' : assignments.length} sub="Pending scheduling" iconClass="stat-icon-amber" icon={I.audit} />
        <StatCard
          label="Next Due"
          value={loading || upcoming.length === 0 ? '—' : (() => { const d = daysUntil(upcoming[0]?.due_date); return d === null ? '—' : `${d}d`; })()}
          sub={upcoming[0]?.title ?? 'No pending items'}
          iconClass="stat-icon-accent"
          icon={I.due}
        />
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <>
          {/* Row 1: Certs + Compliance */}
          <div className="content-grid-3" style={{ marginBottom: 20 }}>
            <div className="table-wrap">
              <div className="table-header"><h3>Certification Dates</h3><span>{certs.length} active</span></div>
              <table className="data-table">
                <thead><tr><th>Company</th><th>Issue</th><th>S1 Due</th><th>S2 Due</th></tr></thead>
                <tbody>
                  {certs.map(c => (
                    <tr key={c.id} className={daysUntil(c.surveillance_1_due) !== null && daysUntil(c.surveillance_1_due) <= 90 ? 'row-due-soon' : ''}>
                      <td className="td-company">{c.companies?.name}</td>
                      <td className="td-date">{fmt(c.issue_date)}</td>
                      <td className="td-due"><span className="td-date">{fmt(c.surveillance_1_due)}</span><DaysChip days={daysUntil(c.surveillance_1_due)} /></td>
                      <td className="td-date">{fmt(c.surveillance_2_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <div className="table-header"><h3>Compliance Planner</h3><span>Upcoming</span></div>
              <table className="data-table">
                <thead><tr><th>Activity</th><th>Due</th><th></th></tr></thead>
                <tbody>
                  {upcoming.length === 0
                    ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>All clear ✓</td></tr>
                    : upcoming.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 500 }}>{item.title}</div>
                          {item.companies?.name && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.companies.name}</div>}
                        </td>
                        <td className="td-date">{fmt(item.due_date)}</td>
                        <td><DaysChip days={daysUntil(item.due_date)} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 2: NC Tracker */}
          <div className="table-wrap">
            <div className="table-header">
              <h3>NC Tracker</h3>
              <span>{openNCs} open · {majorNCs} major</span>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Ref</th><th>Company</th><th>Type</th><th>Description</th><th>Raised</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ncs.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No open NCs — excellent!</td></tr>
                  : ncs.map(nc => (
                    <tr key={nc.id} className={nc.nc_type === 'major' ? 'row-overdue' : ''}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{nc.nc_ref ?? '—'}</td>
                      <td className="td-company">{nc.companies?.name}</td>
                      <td><span className={`badge ${NC_TYPE_COLOR[nc.nc_type] ?? 'badge-info'}`}>{nc.nc_type}</span></td>
                      <td style={{ maxWidth: 260, fontSize: '0.82rem' }}>{nc.description?.slice(0, 80)}{nc.description?.length > 80 ? '…' : ''}</td>
                      <td className="td-date">{fmt(nc.raised_date)}</td>
                      <td className="td-due"><span className="td-date">{fmt(nc.due_date)}</span><DaysChip days={daysUntil(nc.due_date)} /></td>
                      <td><span className={`badge ${NC_STATUS_COLOR[nc.status] ?? 'badge-info'}`}>{nc.status?.replace(/_/g, ' ')}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
