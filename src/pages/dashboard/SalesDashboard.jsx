import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StatCard from '../../components/shared/StatCard'

const fmt = (d) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

function DaysChip({ days }) {
  if (days === null) return null
  if (days < 0)   return <span className="days-chip overdue">{Math.abs(days)}d overdue</span>
  if (days <= 90) return <span className="days-chip soon">{days}d</span>
  return            <span className="days-chip upcoming">{days}d</span>
}

const ENQUIRY_STATUS_BADGE = {
  new: 'badge-info', contacted: 'badge-pending', quoted: 'badge-pending',
  negotiating: 'badge-pending', won: 'badge-active', lost: 'badge-danger', on_hold: 'badge-pre-acc',
}

const ENQUIRY_STAGES = ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost']

const I = {
  pipe:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  won:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  alert:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  follow: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
}

export default function SalesDashboard() {
  const { profile } = useAuth()
  const [enquiries, setEnquiries]   = useState([])
  const [certs, setCerts]           = useState([])
  const [loading, setLoading]       = useState(true)

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  // 90 days from today for renewal alerts
  const ninetyDaysOut = new Date()
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 365)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [enqRes, certsRes] = await Promise.all([
          supabase.from('enquiries').select('*').not('status', 'in', '("won","lost")').order('created_at', { ascending: false }).limit(20),
          supabase.from('certifications').select('*, companies(name)').eq('status', 'active').order('surveillance_1_due'),
        ])
        setEnquiries(enqRes.data ?? [])
        setCerts(certsRes.data ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const activeEnquiries = enquiries.filter(e => !['won','lost'].includes(e.status)).length
  const wonThisCycle    = enquiries.filter(e => e.status === 'won').length
  const followUpToday   = enquiries.filter(e => e.follow_up_date && daysUntil(e.follow_up_date) !== null && daysUntil(e.follow_up_date) <= 3).length

  // Companies with S1 due within 365 days (renewal opportunity)
  const renewalAlerts = certs.filter(c => {
    const d = daysUntil(c.surveillance_1_due)
    return d !== null && d <= 365
  })

  // Pipeline stage counts
  const stageCounts = {}
  ENQUIRY_STAGES.forEach(s => { stageCounts[s] = enquiries.filter(e => e.status === s).length })

  return (
    <div>
      <div className="page-header">
        <h1>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Team'}</h1>
        <p>{today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Sales & Business Development</p>
      </div>

      <div className="stat-grid">
        <StatCard label="Active Enquiries" value={loading ? '…' : activeEnquiries} sub="In pipeline" iconClass="stat-icon-blue" icon={I.pipe} />
        <StatCard label="Won This Cycle" value={loading ? '…' : wonThisCycle} sub="Certifications issued" iconClass="stat-icon-green" icon={I.won} />
        <StatCard label="Renewal Alerts" value={loading ? '…' : renewalAlerts.length} sub="S1 due ≤ 1 year" iconClass={renewalAlerts.length > 0 ? 'stat-icon-amber' : 'stat-icon-green'} icon={I.alert} />
        <StatCard label="Follow-ups Due" value={loading ? '…' : followUpToday} sub="Within 3 days" iconClass={followUpToday > 0 ? 'stat-icon-red' : 'stat-icon-green'} icon={I.follow} />
      </div>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <>
          {/* Pipeline funnel strip */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {ENQUIRY_STAGES.filter(s => !['won','lost'].includes(s)).map(stage => (
              <div key={stage} style={{
                flex: 1, background: 'var(--bg)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)', padding: '14px 16px', textAlign: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text)' }}>
                  {stageCounts[stage] ?? 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                  {stage}
                </div>
              </div>
            ))}
          </div>

          <div className="content-grid-3">
            {/* Enquiries table */}
            <div className="table-wrap">
              <div className="table-header">
                <h3>Enquiries</h3>
                <span>{activeEnquiries} active</span>
              </div>
              {enquiries.length === 0 ? (
                <div className="empty-state">
                  <p>No enquiries yet. Start adding leads!</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Company</th><th>Standard</th><th>Status</th><th>Follow-up</th></tr></thead>
                  <tbody>
                    {enquiries.map(e => (
                      <tr key={e.id} className={e.follow_up_date && daysUntil(e.follow_up_date) !== null && daysUntil(e.follow_up_date) <= 1 ? 'row-due-soon' : ''}>
                        <td>
                          <div className="td-company">{e.company_name}</div>
                          {e.contact_name && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{e.contact_name}</div>}
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>{e.standard}</td>
                        <td><span className={`badge ${ENQUIRY_STATUS_BADGE[e.status] ?? 'badge-info'}`}>{e.status?.replace(/_/g, ' ')}</span></td>
                        <td className="td-due">
                          <span className="td-date">{fmt(e.follow_up_date)}</span>
                          {e.follow_up_date && <DaysChip days={daysUntil(e.follow_up_date)} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Renewal Alerts */}
            <div className="table-wrap">
              <div className="table-header"><h3>Renewal Alerts</h3><span>S1 due ≤ 1 year</span></div>
              {renewalAlerts.length === 0 ? (
                <div className="empty-state"><p>No upcoming renewals within 1 year</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Company</th><th>S1 Due</th><th></th></tr></thead>
                  <tbody>
                    {renewalAlerts.map(c => (
                      <tr key={c.id} className={daysUntil(c.surveillance_1_due) !== null && daysUntil(c.surveillance_1_due) <= 90 ? 'row-due-soon' : ''}>
                        <td className="td-company">{c.companies?.name}</td>
                        <td className="td-date">{fmt(c.surveillance_1_due)}</td>
                        <td><DaysChip days={daysUntil(c.surveillance_1_due)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
