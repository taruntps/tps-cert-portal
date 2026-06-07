/**
 * AskAIWidget.jsx  v4
 * - Half screen on desktop (50vw), full screen on mobile
 * - Clickable links in answers
 * - Fixed JSON leak — smarter extractor
 * - Mobile responsive
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSuggestedQuestions,
  submitFeedback,
  createSession,
  sendChatMessage,
} from '../services/knowledgeApi';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  navy: '#0B2447', navyL: '#1A3A6E',
  teal: '#19A7CE', tealDk: '#1190B2', sky: '#EBF7FD',
  white: '#FFFFFF', offWhite: '#F7F9FC',
  g100: '#F1F5F9', g200: '#E2E8F0',
  g400: '#94A3B8', g500: '#64748B', g700: '#334155', g900: '#0F172A',
  green: '#10B981', greenBg: '#ECFDF5',
  amber: '#F59E0B', amberBg: '#FFFBEB',
  red: '#EF4444', redBg: '#FEF2F2',
  border: '#DDE3EC',
};

const shared = { open: false, toggle: null };

// ─── Is mobile ────────────────────────────────────────────────────────────────
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

// ─── Panel dimensions ─────────────────────────────────────────────────────────
function getPanelStyle(isOpen) {
  if (!isOpen) return {};
  if (isMobile()) {
    return {
      position: 'fixed', bottom: 0, left: 0, right: 0,
      width: '100vw', height: '92vh',
      borderRadius: '16px 16px 0 0',
      boxShadow: '0 -4px 40px rgba(11,36,71,0.18)',
    };
  }
  return {
    position: 'fixed', top: 0, right: 0,
    width: 'min(50vw, 800px)',
    minWidth: '480px',
    height: '100vh',
    borderRadius: 0,
    boxShadow: '-6px 0 40px rgba(11,36,71,0.14)',
  };
}

// ─── Format answer — extract directAnswer, convert \n, strip JSON ─────────────
function formatAnswer(text) {
  if (!text) return '';
  let t = text.trim();

  // Strategy 1: if JSON object, extract directAnswer
  if (t.includes('"directAnswer"')) {
    try {
      // Find the value of directAnswer — handles escaped content inside
      const match = t.match(/"directAnswer"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (match) {
        t = match[1];
      } else {
        // Try full JSON parse
        const s = t.indexOf('{');
        const e = t.lastIndexOf('}');
        if (s !== -1 && e !== -1) {
          const parsed = JSON.parse(t.slice(s, e + 1));
          if (parsed.directAnswer) t = parsed.directAnswer;
        }
      }
    } catch { /* keep as is */ }
  }

  // Clean up escape sequences
  return t
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}

// ─── Render text with links, bold, bullets, tables ───────────────────────────
function renderInline(text) {
  // URL regex
  const urlRegex = /(https?:\/\/[^\s)"]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset regex
      urlRegex.lastIndex = 0;
      const label = part.includes('drive.google.com') ? '📎 Open in Drive' :
                    part.includes('docs.google.com')  ? '📄 Open Document' :
                    '🔗 Open Link';
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          style={{
            color: C.tealDk, textDecoration: 'underline',
            fontWeight: 600, fontSize: 12,
            display: 'inline-block', marginTop: 2,
          }}>
          {label}
        </a>
      );
    }
    // Bold **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return <strong key={j}>{bp.slice(2, -2)}</strong>;
      }
      return <span key={j}>{bp}</span>;
    });
  });
}

function FormattedText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');

  // Detect table groups
  const rendered = [];
  let tableLines = [];
  let inTable = false;

  const flushTable = (key) => {
    if (!tableLines.length) return;
    // Parse table
    const rows = tableLines
      .filter(l => !l.trim().match(/^\|[-| :]+\|$/))
      .map(l => l.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim()));

    if (rows.length > 0) {
      const header = rows[0];
      const body   = rows.slice(1);
      rendered.push(
        <div key={key} style={{ overflowX: 'auto', margin: '8px 0', borderRadius: 8, border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.navy }}>
                {header.map((h, i) => (
                  <th key={i} style={{
                    padding: '7px 10px', color: C.white, fontWeight: 700,
                    textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? C.white : C.offWhite }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '6px 10px', borderBottom: `1px solid ${C.border}`,
                      color: C.g900, fontSize: 12, whiteSpace: ci > 0 ? 'nowrap' : 'normal',
                    }}>
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableLines = [];
    inTable = false;
  };

  lines.forEach((line, i) => {
    if (line.trim().startsWith('|')) {
      inTable = true;
      tableLines.push(line);
      return;
    }
    if (inTable) flushTable(`table-${i}`);

    // Empty line
    if (!line.trim()) { rendered.push(<div key={i} style={{ height: 6 }} />); return; }

    // Divider
    if (line.trim().match(/^[-─=]{3,}$/)) {
      rendered.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '6px 0' }} />);
      return;
    }

    // Heading
    if (line.trim().match(/^#{1,4}\s/) || (line.trim().startsWith('**') && line.trim().endsWith('**') && line.trim().length < 80)) {
      const content = line.trim().replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
      rendered.push(
        <div key={i} style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginTop: 10, marginBottom: 4 }}>
          {renderInline(content)}
        </div>
      );
      return;
    }

    // Bullet
    if (line.trim().match(/^[•\-\*] /)) {
      const content = line.trim().slice(2);
      rendered.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
          <span style={{ color: C.teal, fontSize: 12, marginTop: 2, flexShrink: 0 }}>•</span>
          <span style={{ fontSize: 13, color: C.g900 }}>{renderInline(content)}</span>
        </div>
      );
      return;
    }

    // Numbered
    if (/^\d+\.\s/.test(line.trim())) {
      const m = line.trim().match(/^(\d+)\.\s(.*)$/);
      rendered.push(
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
          <span style={{ color: C.teal, fontSize: 12, marginTop: 2, flexShrink: 0, minWidth: 16 }}>{m?.[1]}.</span>
          <span style={{ fontSize: 13, color: C.g900 }}>{renderInline(m?.[2] || '')}</span>
        </div>
      );
      return;
    }

    // Normal line
    rendered.push(
      <div key={i} style={{ fontSize: 13, color: C.g900, marginBottom: 2, lineHeight: 1.6 }}>
        {renderInline(line)}
      </div>
    );
  });

  if (inTable) flushTable('table-end');
  return <div>{rendered}</div>;
}

// ─── Confidence dot ───────────────────────────────────────────────────────────
function ConfDot({ level }) {
  const m = { High: C.green, Medium: C.amber, Low: C.red };
  const col = m[level] || C.g400;
  return (
    <span title={level} style={{
      display: 'inline-block', width: 10, height: 10,
      borderRadius: '50%', background: col, flexShrink: 0,
    }} />
  );
}

// ─── Source pills ─────────────────────────────────────────────────────────────
function SourcePills({ sources }) {
  if (!sources?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
      {sources.slice(0, 5).map((s, i) => (
        <span key={i} style={{
          background: C.g100, border: `1px solid ${C.border}`,
          borderRadius: 5, padding: '2px 8px',
          fontSize: 10, color: C.g500, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: C.teal }}>📎</span>
          {(s.title || 'Source').replace(/\(TPS Portal DB\)/, '').trim()}
          {s.clauseNumber && (
            <span style={{ background: C.sky, color: C.tealDk, borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700 }}>
              {s.clauseNumber}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px' }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: C.g200,
          display: 'inline-block',
          animation: `asdot 1.2s ease-in-out ${i*0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, onFeedback }) {
  const isUser = msg.role === 'user';
  const [fb, setFb] = useState(0);
  const sendFb = (v) => { if (fb || !msg.logId) return; setFb(v); onFeedback?.(msg.logId, v); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: isUser ? C.tealDk : C.g400, marginBottom: 4, textTransform: 'uppercase' }}>
        {isUser ? 'You' : 'TPS AI'}
      </div>
      <div style={{
        maxWidth: '90%',
        background: isUser ? `linear-gradient(135deg,${C.navy},${C.navyL})` : C.white,
        border: isUser ? 'none' : `1px solid ${C.border}`,
        borderRadius: isUser ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
        padding: '10px 13px',
        boxShadow: isUser ? '0 2px 12px rgba(11,36,71,0.2)' : '0 1px 6px rgba(11,36,71,.06)',
      }}>
        {isUser
          ? <span style={{ fontSize: 13.5, color: C.white, lineHeight: 1.5 }}>{msg.content}</span>
          : <FormattedText text={msg.content} />
        }
      </div>
      {!isUser && (
        <div style={{ maxWidth: '90%' }}>
          <SourcePills sources={msg.sources} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {msg.confidence && <ConfDot level={msg.confidence} />}
            {msg.logId && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {[1,-1].map(v => (
                  <button key={v} onClick={() => sendFb(v)} style={{
                    background: fb===v ? (v===1?C.greenBg:C.redBg) : 'transparent',
                    border: `1px solid ${fb===v?(v===1?C.green:C.red):C.g200}`,
                    borderRadius: 5, width: 26, height: 22, cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{v===1?'👍':'👎'}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggest chip ─────────────────────────────────────────────────────────────
function SuggestChip({ text, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.sky : C.white, border: `1px solid ${hov?C.teal:C.border}`,
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
        color: hov ? C.tealDk : C.g700, textAlign: 'left',
        cursor: 'pointer', lineHeight: 1.4, width: '100%', marginBottom: 7,
        display: 'flex', alignItems: 'flex-start', gap: 7, transition: 'all .15s',
      }}>
      <span style={{ color: C.teal, fontSize: 11, marginTop: 1 }}>→</span>
      {text}
    </button>
  );
}

// ─── History item ─────────────────────────────────────────────────────────────
function HistoryItem({ session, onClick }) {
  const last = session.messages?.[session.messages.length-1];
  const when = session.updated_at
    ? new Date(session.updated_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '';
  return (
    <button onClick={onClick} style={{
      background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: '11px 13px', width: '100%', textAlign: 'left',
      cursor: 'pointer', marginBottom: 8, transition: 'all .15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.g900, flex: 1 }}>{session.title||'Conversation'}</div>
        <div style={{ fontSize: 10, color: C.g400 }}>{when}</div>
      </div>
      <div style={{ fontSize: 11, color: C.g400, lineHeight: 1.4 }}>
        {last?.content?.slice(0,80)||'Empty session'}
      </div>
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AskAIWidget() {
  const [open,        setOpen]        = useState(false);
  const [activeTab,   setActiveTab]   = useState('chat');
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [sessionId,   setSessionId]   = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [sessLoad,    setSessLoad]    = useState(false);
  const [mobile,      setMobile]      = useState(isMobile());

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  shared.toggle = () => setOpen(o => !o);

  // Detect mobile on resize
  useEffect(() => {
    const h = () => setMobile(isMobile());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    getSuggestedQuestions('general').then(setSuggestions).catch(() =>
      setSuggestions([
        'When is the next MRM meeting?',
        'Show upcoming surveillance audit schedule',
        'How to evaluate ISO 22000 auditor competency?',
        'Compare our impartiality procedure with ISO 17021-1',
        'What are open non-conformances for our clients?',
      ])
    );
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setSessLoad(true);
    fetch(`${import.meta.env.VITE_API_URL||''}/api/knowledge/chat/recent`, {
      headers: { Authorization: `Bearer ${(()=>{ try{ return JSON.parse(localStorage.getItem('sb-ukpmypsuzuoecwpxavty-auth-token')||'{}').access_token||''; }catch{return '';} })()}` },
    }).then(r=>r.json()).then(r=>setSessions(r.data||[])).catch(()=>setSessions([])).finally(()=>setSessLoad(false));
  }, [activeTab]);

  const send = useCallback(async (text = input) => {
    const q = (text||'').trim();
    if (!q || isLoading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: q }]);
    setIsLoading(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const sess = await createSession({ title: q.slice(0,60), mode: 'general' });
        sid = sess.id; setSessionId(sid);
      }
      const result = await sendChatMessage(sid, q);
      const res    = result.response || result;
      setMessages(p => [...p, {
        role:       'assistant',
        content:    formatAnswer(res.directAnswer || 'No answer generated.'),
        sources:    res.sourceDocuments || [],
        confidence: res.confidenceLevel,
        logId:      res.logId,
      }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', content: `Sorry, something went wrong. Please try again.` }]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, sessionId]);

  const handleKey = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const newChat   = () => { setMessages([]); setSessionId(null); setInput(''); setActiveTab('chat'); };
  const loadSession = (s) => {
    setSessionId(s.id);
    setMessages((s.messages||[]).map(m => ({
      role: m.role,
      content: m.role==='assistant' ? formatAnswer(m.content||'') : (m.content||''),
      sources: m.sources||[], confidence: m.confidence,
    })));
    setActiveTab('chat');
  };

  const panelStyle = getPanelStyle(open);

  // ── Panel animation style ──
  const animStyle = mobile
    ? 'asslideup .28s cubic-bezier(.4,0,.2,1)'
    : 'aspanelin .28s cubic-bezier(.4,0,.2,1)';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes asdot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes aspanelin { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes asslideup  { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes asfadeup   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .asmsg   { animation: asfadeup .25s ease both; }
        .askai-w * { box-sizing: border-box; font-family: 'DM Sans','Segoe UI',sans-serif; }
        .askai-w textarea:focus { outline: none; }
        .askai-scroll { scrollbar-width: thin; scrollbar-color: #E2E8F0 transparent; }
        button:hover { opacity: .88; }
      `}</style>

      {/* Float button */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed',
        bottom: 24,
        right: open && !mobile ? 'min(50vw, 800px)' : (open ? 8 : 22),
        zIndex: 9997,
        background: open ? C.g100 : `linear-gradient(135deg,${C.teal},${C.tealDk})`,
        color: open ? C.g700 : C.white,
        border: `1.5px solid ${open?C.border:'transparent'}`,
        borderRadius: 12, padding: '9px 18px',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: open && mobile ? 'none' : 'flex',
        alignItems: 'center', gap: 7,
        boxShadow: open ? 'none' : '0 4px 20px rgba(25,167,206,.38)',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
      }}>
        <span style={{ fontSize: 15 }}>{open ? '✕' : '⚡'}</span>
        {open ? 'Close' : 'Ask AI'}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div className="askai-w" style={{
          ...panelStyle,
          background: C.offWhite,
          borderLeft: mobile ? 'none' : `1px solid ${C.border}`,
          zIndex: 9998,
          display: 'flex', flexDirection: 'column',
          animation: animStyle,
        }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyL})`, padding: '14px 16px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>TPS AI Assistant</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>Powered by your Drive documents</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={newChat} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 7, padding: '5px 10px', color: C.white, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✎ New</button>
                <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 7, width: 28, height: 28, color: C.white, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {[['chat','💬 Chat'],['history','🕐 History']].map(([id,label]) => (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  background: activeTab===id ? C.white : 'transparent',
                  color: activeTab===id ? C.navy : 'rgba(255,255,255,.65)',
                  border: 'none', borderRadius: '8px 8px 0 0',
                  padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* CHAT TAB */}
          {activeTab === 'chat' && (<>
            <div className="askai-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
              {messages.length === 0 && (
                <div style={{ animation: 'asfadeup .3s ease' }}>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.g900, marginBottom: 3 }}>Ask anything about TPS certification</div>
                    <div style={{ fontSize: 12, color: C.g400, lineHeight: 1.5 }}>Schedule queries, procedure comparisons, audit planning, ISO requirements — all from your TPS data and Drive documents.</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Suggested questions</div>
                  {suggestions.slice(0,5).map((q,i) => <SuggestChip key={i} text={q} onClick={() => send(q)} />)}
                </div>
              )}
              {messages.map((msg, i) => <div key={i} className="asmsg"><Bubble msg={msg} onFeedback={(lid,v) => submitFeedback(lid,v).catch(()=>{})} /></div>)}
              {isLoading && (
                <div className="asmsg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, color: C.g400, marginBottom: 4, textTransform: 'uppercase' }}>TPS AI</div>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '3px 14px 14px 14px', boxShadow: '0 1px 6px rgba(11,36,71,.06)' }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            {/* Input */}
            <div style={{ padding: '10px 12px 14px', background: C.white, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: C.offWhite, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '8px 8px 8px 12px' }}>
                <textarea ref={inputRef} rows={1} value={input}
                  onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                  disabled={isLoading}
                  placeholder="Ask about ISO clauses, schedules, audits…"
                  onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,100)+'px'; }}
                  style={{ flex:1, border:'none', outline:'none', background:'transparent', resize:'none', fontSize:13.5, color:C.g900, fontFamily:'inherit', lineHeight:1.5, maxHeight:100, overflowY:'auto', padding:0 }} />
                <button onClick={() => send()} disabled={!input.trim()||isLoading} style={{
                  background: (!input.trim()||isLoading) ? C.g200 : C.teal,
                  color: (!input.trim()||isLoading) ? C.g400 : C.white,
                  border:'none', borderRadius:9, width:34, height:34, flexShrink:0,
                  cursor:(!input.trim()||isLoading)?'default':'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, transition:'all .15s',
                }}>{isLoading ? '⏳' : '➤'}</button>
              </div>
              <div style={{ fontSize: 10, color: C.g400, textAlign: 'center', marginTop: 6 }}>
                Answers cite your Drive documents. Verify critical decisions.
              </div>
            </div>
          </>)}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="askai-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: .8 }}>Past conversations</div>
                <button onClick={newChat} style={{ background: C.teal, color: C.white, border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ New</button>
              </div>
              {sessLoad ? (
                <div style={{ textAlign: 'center', padding: 32, color: C.g400, fontSize: 13 }}>Loading…</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: C.g400, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🕐</div>
                  No past conversations yet.
                </div>
              ) : sessions.map(s => <HistoryItem key={s.id} session={s} onClick={() => loadSession(s)} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Header button export
export function AskAIHeaderButton() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => { setIsOpen(shared.open); }, 200);
    return () => clearInterval(id);
  }, []);
  return (
    <button onClick={() => { shared.toggle?.(); }} style={{
      background: isOpen ? 'rgba(255,255,255,.15)' : `linear-gradient(135deg,${C.teal},${C.tealDk})`,
      color: '#fff', border: `1.5px solid ${isOpen?'rgba(255,255,255,.3)':'transparent'}`,
      borderRadius: 10, padding: '7px 16px',
      fontSize: 13, fontWeight: 700, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 7,
      boxShadow: isOpen ? 'none' : '0 2px 12px rgba(25,167,206,.35)',
      transition: 'all .2s', fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}>
      <span style={{ fontSize: 14 }}>⚡</span> Ask AI
    </button>
  );
}
