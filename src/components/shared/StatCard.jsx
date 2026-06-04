// Reusable KPI stat card for dashboards
// Usage: <StatCard label="Active Certs" value={4} sub="ISO 22000:2018" iconClass="stat-icon-blue" icon={<CertIcon />} />

export default function StatCard({ label, value, sub, iconClass, icon, trend }) {
  return (
    <div className="stat-card">
      {icon && (
        <div className={`stat-card-icon ${iconClass ?? 'stat-icon-blue'}`}>
          {icon}
        </div>
      )}
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">
        {value === null || value === undefined ? (
          <span style={{ fontSize: '1.2rem', opacity: 0.4 }}>—</span>
        ) : value}
      </div>
      {sub && <div className="stat-card-sub">{sub}</div>}
      {trend && (
        <div style={{
          marginTop: 8, fontSize: '0.75rem', fontWeight: 600,
          color: trend.positive ? 'var(--success)' : 'var(--warning)',
          fontFamily: 'var(--font-heading)'
        }}>
          {trend.label}
        </div>
      )}
    </div>
  )
}
