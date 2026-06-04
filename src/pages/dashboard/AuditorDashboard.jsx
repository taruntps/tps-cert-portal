import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StatCard from '../../components/shared/StatCard'

const fmt = (d) => d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—'
const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null

function DaysChip({ days }) {
  if (days === null) return null
  if (days < 0)   return <span className="days-chip overdue">{Math.abs(days)}d overdue</span>
  if (days <= 60) return <span className="days-chip soon">{days}d</span>
  return            <span className="days-chip upcoming">{days}d</span>
}

const AUDIT_TYPE_LABELS = {
  stage_1: 'Stage 1', stage_2: 'Stage 2',
  surveillance_1: 'Surveillance 1', surveillance_2: 'Surveillance 2',
  recertification: 'Recertification', special: 'Special', transfer: 'Transfer',
}

const I = {
  assign: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  clients:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l7-4 7 4v14"/></svg>,
  cal:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  check:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
}

export default function AuditorDashboard() {
  const { user, profile } = useAuth()
  const [auditorRecord, setAuditorRecord] = useState(null)
  const [assignments, setAssignments]     = useState([])
  const [compliance, setCompliance]       = useState([])
  const [loading, setLoading]             = useState(true)

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    if (!user) return
    async function fetchData() {
      setLoading(true)
      try {
        // 1. Find auditor record linked to this profile
        const { data: aud } = await supabase
          .from('auditors')
          .select('id, full_name, is_lead_auditor, nabcb_approved')
          .eq('profile_id', user.id)
          .maybeSingle()

        setAuditorRecord(aud)

        // 2. Fetch assigned audits (via audit_team_members)
        if (aud?.id) {
          const { data: teamRows } = await supabase
            .from('audit_team_members')
            .select(`
              role,
              audit_assignment:audit_assignments(
                id, audit_type, planned_date, status,
                companies(name),
                certifications(certificate_type, standard, surveillance_1_due, surveillance_2_due)
              )
            `)
            .eq('auditor_id', aud.id)
            .order('created_at', { ascending: false })
            .limit(10)

          setAssignments(
            (teamRows ?? [])
              .map(r => ({ ...r.audit_assignment, team_role: r.role }))
              .filter(Boolean)
          )
        }

        // 3. Compliance calendar (auditor sees all pending items for context)
        const { data: comp } = await supabase
          .from('compliance_calendar')
          .select('*, companies(name)')
          .eq('status', 'pending')
          .order('due_date')
          .limit(8)

        setCompliance(comp ?? [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const upcomingAudits = assignments.filter(a => a.status !== 'completed' && a.status !== 'cancelled')
  const completedAudits = assignments.filter(a => a.status === 'completed').length

  return (
    <div>
      <div className="page-header">
        <h1>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Auditor'}</h1>
        <p>
          {today.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          {auditorRecord && (
            <> · {auditorRecord.is_lead_auditor ? 'Lead Auditor' : 'Auditor'}
            {auditorRecord.nabcb_approved && <> · <span style={{ color: 'var(--accent)', fontWeight: 600 }}>NABCB Approved</span></>}
            </>
          )}
        </p>
      </div>

      <div className="stat-grid">
        <StatCard label="Assigned Audits" value={loading ? '…' : upcomingAudits.length} sub="Active / planned" iconClass="stat-icon-blue" icon={I.assign} />
        <StatCard label="Assigned Clients" value={loading ? '…' : new Set(upcomingAudits.map(a => a.companies?.name)).size} sub="Companies" iconClass="stat-icon-green" icon={I.clients} />
        <StatCard
          label="Next Audit"
          value={loading || upcomingAudits.length === 0 ? '—' : (() => { const d = daysUntil(upcomingAudits[0]?.planned_date); return d === null ? 'TBD' : `${d}d`; })()}
          sub={upcomingAudits[0]?.planned_date ? fmt(upcomingAudits[0].planned_date) : 'Date not set'}
          iconClass="stat-icon-amber"
          icon={I.cal}
        />
        <StatCard label="Completed Audits" value={loading ? '…' : completedAudits} sub="This cycle" iconClass="stat-icon-green" icon={I.check} />
      </div>

      {!auditorRecord && !loading && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 20, color: 'var(--warning-text)', fontSize: '0.875rem' }}>
          <strong>Setup required:</strong> Your portal account hasn't been linked to an auditor record yet.
          Please contact your administrator to complete setup.
        </div>
      )}

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <div className="content-grid-3">
          {/* My Assignments */}
          <div className="table-wrap">
            <div className="table-header">
              <h3>My Assignments</h3>
              <span>{upcomingAudits.length} active</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Company</th><th>Audit Type</th><th>Planned Date</th><th>My Role</th><th>Status</th></tr></thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                    {auditorRecord ? 'No audit assignments yet' : 'Link your auditor record to see assignments'}
                  </td></tr>
                ) : assignments.map(a => (
                  <tr key={a.id} className={daysUntil(a.planned_date) !== null && daysUntil(a.planned_date) <= 30 ? 'row-due-soon' : ''}>
                    <td className="td-company">{a.companies?.name ?? '—'}</td>
                    <td><span className="badge badge-info">{AUDIT_TYPE_LABELS[a.audit_type] ?? a.audit_type}</span></td>
                    <td className="td-due">
                      <span className="td-date">{fmt(a.planned_date)}</span>
                      <DaysChip days={daysUntil(a.planned_date)} />
                    </td>
                    <td style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{a.team_role?.replace(/_/g, ' ') ?? '—'}</td>
                    <td><span className={`badge ${a.status === 'completed' ? 'badge-active' : a.status === 'in_progress' ? 'badge-pending' : 'badge-info'}`}>{a.status?.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compliance Calendar (read-only reference) */}
          <div className="table-wrap">
            <div className="table-header"><h3>CB Calendar</h3><span>Reference only</span></div>
            <table className="data-table">
              <thead><tr><th>Activity</th><th>Due</th><th></th></tr></thead>
              <tbody>
                {compliance.length === 0
                  ? <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>Clear ✓</td></tr>
                  : compliance.map(item => (
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
      )}
    </div>
  )
}
