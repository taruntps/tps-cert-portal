/**
 * AdminKnowledge.jsx  —  Admin panel for the AI Knowledge Base.
 *
 * Tabs:
 *  1. Overview  — stats cards, quick actions
 *  2. Sync      — trigger Drive sync, live progress, job history
 *  3. Documents — paginated document table with filter, reindex, deactivate
 *  4. Analytics — 30/90-day query volume, top queries, confidence distribution
 *  5. Logs      — paginated search log table with filters
 *  6. Settings  — AI model and indexing parameters (read-only view)
 *
 * Place in: tps-xperts-frontend/src/pages/AdminKnowledge.jsx
 * Requires: ../services/knowledgeApi.js
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getKbStats,
  adminListDocuments,
  deactivateDocument,
  reindexDocument,
  reindexAll,
  triggerSync,
  getSyncStatus,
  getSyncJobs,
  cancelSync,
  getSearchLogs,
  getAnalytics,
  getAISettings,
} from '../services/knowledgeApi';

// ─── Tokens ───────────────────────────────────────────────────────────────────
const T = {
  navy:    '#0B2447', navyL: '#1A3A6E',
  teal:    '#19A7CE', tealDk: '#1190B2', sky: '#EBF7FD',
  white:   '#FFFFFF',
  gray50:  '#F8FAFC', gray100: '#F1F5F9', gray200: '#E2E8F0',
  gray400: '#94A3B8', gray500: '#64748B', gray600: '#475569', gray700: '#334155', gray900: '#0F172A',
  green:   '#10B981', greenBg: '#ECFDF5',
  amber:   '#F59E0B', amberBg: '#FFFBEB',
  red:     '#EF4444', redBg:   '#FEF2F2',
  purple:  '#7C3AED', purpleBg: '#F5F3FF',
  border:  '#DDE3EC',
  shadow:  '0 2px 12px rgba(11,36,71,0.10)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) { return n !== null && n !== undefined ? Number(n).toLocaleString() : '—'; }
function pct(n) { return n !== null ? `${n}%` : '—'; }
function relTime(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function Spinner({ size = 20, color = T.teal }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${color}30`, borderTopColor: color,
      animation: 'ak-spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

function StatusPill({ status }) {
  const map = {
    running:    [T.teal,   T.sky,    '● Running'],
    completed:  [T.green,  T.greenBg, '✓ Completed'],
    failed:     [T.red,    T.redBg,   '✕ Failed'],
    cancelling: [T.amber,  T.amberBg, '⏹ Cancelling'],
  };
  const [color, bg, label] = map[status] || [T.gray500, T.gray100, status];
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}30`,
      borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700,
    }}>{label}</span>
  );
}

function StatsCard({ icon, label, value, sub, color = T.teal, trend }) {
  return (
    <div style={{
      background: T.white, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '20px 22px',
      boxShadow: T.shadow, flex: 1, minWidth: 170,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        {trend && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: trend > 0 ? T.green : T.red,
          }}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)}%</span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.gray900, marginTop: 10, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.gray600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.gray400, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr>
        {cols.map(c => (
          <th key={c} style={{
            padding: '10px 14px', textAlign: 'left', fontWeight: 700,
            fontSize: 11, color: T.gray500, textTransform: 'uppercase',
            letterSpacing: 0.7, background: T.gray50,
            borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap',
          }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function BarChart({ data, color = T.teal }) {
  if (!data || Object.keys(data).length === 0) return (
    <div style={{ textAlign: 'center', padding: 24, color: T.gray400, fontSize: 13 }}>No data</div>
  );
  const entries = Object.entries(data).slice(-14);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, padding: '4px 0' }}>
      {entries.map(([date, val]) => (
        <div key={date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 2 }}>
          <div style={{ fontSize: 9, color: T.gray400 }}>{val}</div>
          <div style={{
            width: '100%', background: color,
            borderRadius: '3px 3px 0 0', opacity: 0.85,
            height: `${(val / max) * 68}px`,
            transition: 'height 0.3s ease',
            minHeight: val > 0 ? 3 : 0,
          }} />
          <div style={{ fontSize: 8, color: T.gray400, transform: 'rotate(-30deg)', marginTop: 2 }}>
            {date.slice(5)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  Main component
// ═════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'overview',   icon: '📊', label: 'Overview' },
  { id: 'sync',       icon: '🔄', label: 'Sync' },
  { id: 'documents',  icon: '📁', label: 'Documents' },
  { id: 'analytics',  icon: '📈', label: 'Analytics' },
  { id: 'logs',       icon: '📋', label: 'Search Logs' },
  { id: 'settings',   icon: '⚙️',  label: 'Settings' },
];

export default function AdminKnowledge() {
  const [activeTab, setActiveTab] = useState('overview');

  // Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Sync
  const [syncStatus, setSyncStatus]   = useState(null);
  const [syncJobs, setSyncJobs]       = useState([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [isSyncing, setIsSyncing]     = useState(false);
  const pollRef = useRef(null);

  // Documents
  const [docs, setDocs]             = useState([]);
  const [docsTotal, setDocsTotal]   = useState(0);
  const [docsPage, setDocsPage]     = useState(1);
  const [docsSearch, setDocsSearch] = useState('');
  const [docsCategory, setDocsCategory] = useState('');
  const [docsStatus, setDocsStatus] = useState('active');
  const [docsLoading, setDocsLoading] = useState(false);
  const [docAction, setDocAction]   = useState(null);  // { id, type }

  // Analytics
  const [analytics, setAnalytics]   = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Logs
  const [logs, setLogs]           = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage]   = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // Settings
  const [settings, setSettings] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Initial loads ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadStats();
    loadSyncStatus();
  }, []);

  useEffect(() => {
    if (activeTab === 'documents') loadDocs();
  }, [activeTab, docsPage, docsSearch, docsCategory, docsStatus]);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, analyticsDays]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, logsPage]);

  useEffect(() => {
    if (activeTab === 'settings') getAISettings().then(setSettings).catch(() => {});
  }, [activeTab]);

  // ── Sync polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSyncing) {
      pollRef.current = setInterval(async () => {
        const s = await getSyncStatus().catch(() => null);
        if (s) {
          setSyncStatus(s);
          if (!s.isRunning) {
            setIsSyncing(false);
            clearInterval(pollRef.current);
            loadStats();
            loadSyncJobs();
            showToast('Sync completed!');
          }
        }
      }, 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [isSyncing]);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadStats = () => {
    setStatsLoading(true);
    getKbStats().then(setStats).catch(() => {}).finally(() => setStatsLoading(false));
  };

  const loadSyncStatus = () => {
    getSyncStatus().then(s => { setSyncStatus(s); setIsSyncing(!!s.isRunning); }).catch(() => {});
    loadSyncJobs();
  };

  const loadSyncJobs = () => {
    setSyncLoading(true);
    getSyncJobs().then(r => setSyncJobs(r.data || [])).catch(() => {}).finally(() => setSyncLoading(false));
  };

  const loadDocs = useCallback(() => {
    setDocsLoading(true);
    adminListDocuments({
      page: docsPage, limit: 25,
      category: docsCategory || undefined,
      search:   docsSearch   || undefined,
      status:   docsStatus,
    })
      .then(r => { setDocs(r.data || []); setDocsTotal(r.total || 0); })
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [docsPage, docsSearch, docsCategory, docsStatus]);

  const loadAnalytics = () => {
    setAnalyticsLoading(true);
    getAnalytics(analyticsDays).then(setAnalytics).catch(() => {}).finally(() => setAnalyticsLoading(false));
  };

  const loadLogs = useCallback(() => {
    setLogsLoading(true);
    getSearchLogs({ page: logsPage, limit: 30 })
      .then(r => { setLogs(r.data || []); setLogsTotal(r.total || 0); })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [logsPage]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    try {
      await triggerSync();
      setIsSyncing(true);
      setSyncStatus(prev => ({ ...prev, isRunning: true }));
      showToast('Sync started…', 'info');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleReindex = async (id) => {
    setDocAction({ id, type: 'reindex' });
    try {
      await reindexDocument(id);
      showToast('Queued for reindex. Trigger sync to rebuild.');
      loadDocs();
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setDocAction(null); }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this document? It will be hidden from search.')) return;
    setDocAction({ id, type: 'deactivate' });
    try {
      await deactivateDocument(id);
      showToast('Document deactivated.');
      loadDocs();
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setDocAction(null); }
  };

  const handleReindexAll = async () => {
    if (!window.confirm('Clear all embeddings and queue full reindex? This will require a sync to rebuild.')) return;
    try {
      await reindexAll();
      showToast('Full reindex queued. Trigger sync to rebuild all embeddings.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: T.white, border: `1px solid ${T.border}`,
    borderRadius: 14, padding: '20px 22px',
    boxShadow: T.shadow, marginBottom: 16,
  };
  const secTitle = {
    fontSize: 15, fontWeight: 800, color: T.gray900, marginBottom: 14,
    display: 'flex', alignItems: 'center', gap: 8,
  };
  const inputStyle = {
    border: `1.5px solid ${T.border}`, borderRadius: 8,
    padding: '7px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
    color: T.gray900,
  };
  const btnPrimary = {
    background: `linear-gradient(135deg, ${T.teal}, ${T.tealDk})`,
    color: T.white, border: 'none', borderRadius: 8, padding: '8px 20px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  };
  const btnDanger = {
    background: T.redBg, color: T.red, border: `1px solid ${T.red}30`,
    borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };
  const btnSecondary = {
    background: T.sky, color: T.tealDk, border: `1px solid ${T.teal}30`,
    borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  };

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: T.gray50, fontFamily: "'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes ak-spin { to { transform: rotate(360deg); } }
        @keyframes ak-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .ak-row:hover { background: ${T.gray50} !important; }
        button:hover { opacity:0.88; }
        * { box-sizing:border-box; }
      `}</style>

      {/* Page header */}
      <div style={{
        background: `linear-gradient(135deg, ${T.navy}, ${T.navyL})`,
        padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.white, margin: 0, letterSpacing: -0.3 }}>
            Knowledge Base Admin
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
            Manage AI search index, Drive sync, documents and analytics
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Spinner size={15} color={T.white} /> : '🔄'}
            {isSyncing ? 'Syncing…' : 'Sync Drive'}
          </button>
          <button
            style={{ ...btnPrimary, background: `${T.white}15`, border: `1px solid ${T.white}30` }}
            onClick={loadStats}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: T.white, borderBottom: `1px solid ${T.border}`,
        display: 'flex', padding: '0 24px', overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            border: 'none', background: 'none', cursor: 'pointer',
            padding: '14px 18px', fontSize: 13, fontWeight: 700,
            color: activeTab === tab.id ? T.teal : T.gray500,
            borderBottom: activeTab === tab.id ? `2px solid ${T.teal}` : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 999,
            background: toast.type === 'error' ? T.redBg : (toast.type === 'info' ? T.sky : T.greenBg),
            color:      toast.type === 'error' ? T.red    : (toast.type === 'info' ? T.tealDk : T.green),
            border: `1px solid ${toast.type === 'error' ? T.red : (toast.type === 'info' ? T.teal : T.green)}30`,
            borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 600,
            boxShadow: T.shadow, animation: 'ak-fade 0.25s ease',
          }}>
            {toast.msg}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={36} /></div>
            ) : stats ? (
              <>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
                  <StatsCard icon="📄" label="Active Documents" value={fmt(stats.activeDocuments)} sub={`${fmt(stats.totalDocuments)} total`} color={T.navy} />
                  <StatsCard icon="🧩" label="Indexed Chunks" value={fmt(stats.totalChunks)} color={T.teal} />
                  <StatsCard icon="🔍" label="Total Searches" value={fmt(stats.totalSearches)} sub="all time" color={T.purple} />
                  <StatsCard icon="📅" label="Searches (30d)" value={fmt(stats.searchesLast30Days)} color={T.amber} />
                  <StatsCard icon="🎯" label="Avg Confidence" value={stats.avgConfidence ? `${Math.round(stats.avgConfidence * 100)}%` : '—'} color={T.green} />
                  <StatsCard icon="👍" label="Satisfaction" value={pct(stats.satisfactionPct)} sub={`${fmt(stats.thumbsUp)} up / ${fmt(stats.thumbsDown)} down`} color={T.green} />
                </div>
                <div style={cardStyle}>
                  <div style={secTitle}><span>📂</span> Documents by Category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {Object.entries(stats.categoryBreakdown || {}).map(([cat, count]) => (
                      <div key={cat} style={{
                        background: T.sky, border: `1px solid ${T.teal}30`,
                        borderRadius: 10, padding: '10px 18px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.navy }}>{count}</div>
                        <div style={{ fontSize: 12, color: T.tealDk, fontWeight: 600, textTransform: 'capitalize' }}>{cat}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={secTitle}><span>⚡</span> Quick Actions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button style={btnPrimary} onClick={handleSync} disabled={isSyncing}>
                      {isSyncing ? <Spinner size={14} color={T.white} /> : '🔄'} Sync Drive Now
                    </button>
                    <button style={{ ...btnPrimary, background: `linear-gradient(135deg,${T.purple},#6D28D9)` }}
                      onClick={handleReindexAll}>
                      ♻️ Full Reindex
                    </button>
                    <button style={{ ...btnPrimary, background: T.gray100, color: T.gray700 }}
                      onClick={() => setActiveTab('analytics')}>
                      📈 View Analytics
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: T.gray400, padding: 40 }}>Failed to load stats. Refresh to retry.</div>
            )}
          </div>
        )}

        {/* ── SYNC ── */}
        {activeTab === 'sync' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            <div style={cardStyle}>
              <div style={secTitle}><span>🔄</span> Google Drive Sync</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
                <button style={btnPrimary} onClick={handleSync} disabled={isSyncing}>
                  {isSyncing ? <Spinner size={15} color={T.white} /> : '▶'} Trigger Sync
                </button>
                {isSyncing && (
                  <button style={btnDanger} onClick={cancelSync}>⏹ Cancel</button>
                )}
                {syncStatus && (
                  <div style={{ fontSize: 13, color: T.gray600 }}>
                    Last run: <strong>{relTime(syncStatus.started_at)}</strong> ·{' '}
                    <StatusPill status={syncStatus.status || 'completed'} />
                  </div>
                )}
              </div>
              {syncStatus && isSyncing && (
                <div style={{ background: T.sky, borderRadius: 10, padding: '12px 16px', marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: T.tealDk, fontWeight: 700, marginBottom: 8 }}>
                    ⏳ Sync in progress…
                  </div>
                  {['files_processed','files_added','files_updated','files_skipped','files_failed'].map(k => (
                    syncStatus[k] !== undefined && (
                      <div key={k} style={{ fontSize: 12, color: T.gray600, marginBottom: 3 }}>
                        {k.replace('files_','').replace('_',' ')}: <strong>{syncStatus[k]}</strong>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <div style={secTitle}><span>📜</span> Job History</div>
              {syncLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <TableHead cols={['Started', 'Status', 'Processed', 'Added', 'Updated', 'Failed', 'Duration']} />
                  <tbody>
                    {syncJobs.map(job => (
                      <tr key={job.id} className="ak-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                        {[
                          relTime(job.started_at),
                          <StatusPill key="s" status={job.status} />,
                          fmt(job.files_processed),
                          fmt(job.files_added),
                          fmt(job.files_updated),
                          <span key="f" style={{ color: job.files_failed > 0 ? T.red : T.gray500 }}>{fmt(job.files_failed)}</span>,
                          job.completed_at && job.started_at
                            ? `${Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000)}s`
                            : '—',
                        ].map((cell, i) => (
                          <td key={i} style={{ padding: '10px 14px', fontSize: 13, color: T.gray700 }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                    {syncJobs.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: T.gray400, fontSize: 13 }}>No sync jobs yet</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === 'documents' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
                <input style={{ ...inputStyle, width: 220 }} placeholder="Search documents…"
                  value={docsSearch} onChange={e => { setDocsSearch(e.target.value); setDocsPage(1); }} />
                <select style={{ ...inputStyle, cursor: 'pointer' }}
                  value={docsCategory} onChange={e => { setDocsCategory(e.target.value); setDocsPage(1); }}>
                  <option value="">All categories</option>
                  {['iso','iaf','procedures','formats','audit','competency','policies','manuals','supporting'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select style={{ ...inputStyle, cursor: 'pointer' }}
                  value={docsStatus} onChange={e => { setDocsStatus(e.target.value); setDocsPage(1); }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: T.gray400 }}>{fmt(docsTotal)} documents</span>
              </div>
              {docsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <TableHead cols={['Title', 'Category', 'Type', 'Version', 'Updated', 'Status', 'Actions']} />
                    <tbody>
                      {docs.map(doc => {
                        const acting = docAction?.id === doc.id;
                        return (
                          <tr key={doc.id} className="ak-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: '10px 14px', fontSize: 13, color: T.gray900, fontWeight: 500, maxWidth: 260 }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</div>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: T.sky, color: T.tealDk, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                {doc.category}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: T.gray500 }}>{doc.file_type || '—'}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: T.gray500 }}>v{doc.version || '1'}</td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: T.gray500 }}>{relTime(doc.updated_at)}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <StatusPill status={doc.is_active ? 'completed' : 'failed'} />
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={btnSecondary} onClick={() => handleReindex(doc.id)} disabled={acting}>
                                  {acting && docAction?.type === 'reindex' ? '…' : '♻ Reindex'}
                                </button>
                                {doc.is_active && (
                                  <button style={btnDanger} onClick={() => handleDeactivate(doc.id)} disabled={acting}>
                                    {acting && docAction?.type === 'deactivate' ? '…' : 'Deactivate'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {docs.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: T.gray400, fontSize: 13 }}>No documents found</td></tr>
                      )}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  {docsTotal > 25 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                      <button style={btnSecondary} disabled={docsPage === 1} onClick={() => setDocsPage(p => p - 1)}>← Prev</button>
                      <span style={{ fontSize: 13, color: T.gray500, padding: '4px 8px' }}>
                        Page {docsPage} of {Math.ceil(docsTotal / 25)}
                      </span>
                      <button style={btnSecondary} disabled={docsPage * 25 >= docsTotal} onClick={() => setDocsPage(p => p + 1)}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              {[7, 30, 90].map(d => (
                <button key={d}
                  onClick={() => setAnalyticsDays(d)}
                  style={{
                    ...btnSecondary,
                    background: analyticsDays === d ? T.teal : T.sky,
                    color:      analyticsDays === d ? T.white : T.tealDk,
                    padding: '7px 16px',
                  }}>
                  {d}d
                </button>
              ))}
              {analyticsLoading && <Spinner size={18} />}
            </div>
            {analytics && (
              <>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
                  <StatsCard icon="🔍" label="Total Searches" value={fmt(analytics.totalSearches)} color={T.teal} />
                  <StatsCard icon="🪙" label="Tokens Used" value={fmt(analytics.totalTokensUsed)} color={T.purple} />
                  <StatsCard icon="💰" label="Est. Cost" value={`$${analytics.estimatedCost}`} color={T.amber} />
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ ...cardStyle, flex: 2, minWidth: 300 }}>
                    <div style={secTitle}><span>📊</span> Daily Search Volume</div>
                    <BarChart data={analytics.dailyVolume} color={T.teal} />
                  </div>
                  <div style={{ ...cardStyle, flex: 1, minWidth: 220 }}>
                    <div style={secTitle}><span>🎯</span> Confidence Distribution</div>
                    {Object.entries(analytics.confidenceDistribution || {}).map(([level, cnt]) => (
                      <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{
                          width: 60, fontSize: 12, fontWeight: 700,
                          color: level === 'High' ? T.green : level === 'Medium' ? T.amber : T.red,
                        }}>{level}</span>
                        <div style={{ flex: 1, height: 8, background: T.gray200, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(cnt / (analytics.totalSearches || 1)) * 100}%`,
                            height: '100%',
                            background: level === 'High' ? T.green : level === 'Medium' ? T.amber : T.red,
                            borderRadius: 4,
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: T.gray500, width: 30 }}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={secTitle}><span>🔥</span> Top Queries</div>
                  {analytics.topQueries?.map((q, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0', borderBottom: `1px solid ${T.border}`,
                    }}>
                      <span style={{ width: 22, height: 22, background: T.navy, color: T.white, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, fontSize: 13, color: T.gray800 }}>{q.query}</div>
                      <span style={{ background: T.sky, color: T.tealDk, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {q.count}×
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LOGS ── */}
        {activeTab === 'logs' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={secTitle}><span>📋</span> Search Logs</div>
                <span style={{ fontSize: 12, color: T.gray400 }}>{fmt(logsTotal)} total</span>
              </div>
              {logsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <TableHead cols={['Query', 'Type', 'Confidence', 'Tokens', 'Response', 'Feedback', 'When']} />
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="ak-row" style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: T.gray800, maxWidth: 280 }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.query}</div>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 11, color: T.gray500 }}>{log.query_type || 'general'}</td>
                          <td style={{ padding: '9px 14px' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: log.confidence_score >= 0.7 ? T.green : log.confidence_score >= 0.4 ? T.amber : T.red,
                            }}>
                              {log.confidence_score ? `${Math.round(log.confidence_score * 100)}%` : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: T.gray500 }}>{fmt(log.tokens_used)}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: T.gray500 }}>{log.response_time_ms ? `${log.response_time_ms}ms` : '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: 15 }}>
                            {log.user_feedback === 1 ? '👍' : log.user_feedback === -1 ? '👎' : '—'}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12, color: T.gray400 }}>{relTime(log.created_at)}</td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: T.gray400, fontSize: 13 }}>No logs yet</td></tr>
                      )}
                    </tbody>
                  </table>
                  {logsTotal > 30 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                      <button style={btnSecondary} disabled={logsPage === 1} onClick={() => setLogsPage(p => p - 1)}>← Prev</button>
                      <span style={{ fontSize: 13, color: T.gray500, padding: '4px 8px' }}>
                        Page {logsPage} of {Math.ceil(logsTotal / 30)}
                      </span>
                      <button style={btnSecondary} disabled={logsPage * 30 >= logsTotal} onClick={() => setLogsPage(p => p + 1)}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === 'settings' && (
          <div style={{ animation: 'ak-fade 0.25s ease' }}>
            <div style={cardStyle}>
              <div style={secTitle}><span>⚙️</span> AI & Indexing Settings</div>
              {settings ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(settings).map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: `1px solid ${T.border}` }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: T.gray700, width: '40%', textTransform: 'capitalize' }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: T.gray900, fontFamily: 'monospace' }}>
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
              )}
              <div style={{
                marginTop: 16, background: T.amberBg, border: `1px solid ${T.amber}30`,
                borderRadius: 10, padding: '12px 16px', fontSize: 13, color: T.amber,
              }}>
                ⚠️ These settings are configured via environment variables. Changes require a service restart. Contact your system administrator to update production values.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
