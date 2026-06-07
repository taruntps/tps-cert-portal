/**
 * AskAIWidget.jsx
 *
 * Floating "Ask AI" button + slide-in right panel for the TPS Cert Portal.
 * Matches the Hostinger Kodee UX pattern — button in nav, panel slides in from right.
 *
 * USAGE — drop this anywhere in your portal layout:
 *   import AskAIWidget from './components/AskAIWidget';
 *   <AskAIWidget />   ← place in App.jsx root, renders above everything
 *
 * For the header button (like Hostinger's "Ask AI" in the navbar):
 *   import { AskAIHeaderButton } from './components/AskAIWidget';
 *   <AskAIHeaderButton />   ← place inside your navbar component
 *
 * Place in: tps-xperts-frontend/src/components/AskAIWidget.jsx
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  search as apiSearch,
  getSuggestedQuestions,
  submitFeedback,
  createSession,
  sendChatMessage,
} from '../services/knowledgeApi';

const C = {
  navy: '#0B2447', navyL: '#1A3A6E',
  teal: '#19A7CE', tealDk: '#1190B2', sky: '#EBF7FD',
  white: '#FFFFFF', offWhite: '#F7F9FC',
  g100: '#F1F5F9', g200: '#E2E8F0', g300: '#CBD5E1',
  g400: '#94A3B8', g500: '#64748B', g700: '#334155', g900: '#0F172A',
  green: '#10B981', greenBg: '#ECFDF5',
  amber: '#F59E0B', amberBg: '#FFFBEB',
  red: '#EF4444',   redBg: '#FEF2F2',
  border: '#DDE3EC',
};

const PANEL_W = 400;

// shared state for header button sync
const shared = { open: false, toggle: null };

// ─── Format answer text ───────────────────────────────────────────────────────
// Converts literal \n → real newlines, strips JSON fences, cleans up output
function formatAnswer(text) {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')   // literal \n → real newline
    .replace(/\\t/g, '\t')   // literal \t → real tab
    .replace(/^```(?:json)?\n?/m, '')  // strip opening JSON fence
    .replace(/\n?```$/m, '')           // strip closing JSON fence
    .trim();
}

// ─── Render formatted text with bold, bullets, and tables ────────────────────
function FormattedText({ text, color }) {
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: 1.65 }}>
      {lines.map((line, i) => {
        // Table row: | col1 | col2 |
        if (line.trim().startsWith('|')) {
          const isHeader = lines[i + 1]?.trim().match(/^\|[-| ]+\|$/);
          const isSep    = line.trim().match(/^\|[-| ]+\|$/);
          if (isSep) return null;
          const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          return (
            <div key={i} style={{
              display: 'flex', gap: 0,
              background: isHeader ? C.g100 : 'transparent',
              borderBottom: `1px solid ${C.border}`,
              marginBottom: 0,
            }}>
              {cells.map((cell, j) => (
                <div key={j} style={{
                  flex: 1, padding: '4px 8px', fontSize: 12,
                  fontWeight: isHeader ? 700 : 400,
                  color: color || C.g900,
                  borderRight: j < cells.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  {renderInline(cell.trim(), color)}
                </div>
              ))}
            </div>
          );
        }

        // Bullet point
        if (line.trim().startsWith('• ') || line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const content = line.trim().slice(2);
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: C.teal, fontSize: 12, marginTop: 2, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 13.5, color: color || C.g900 }}>{renderInline(content, color)}</span>
            </div>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(line.trim())) {
          const match   = line.trim().match(/^(\d+)\.\s(.*)$/);
          const num     = match?.[1];
          const content = match?.[2] || '';
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: C.teal, fontSize: 12, marginTop: 2, flexShrink: 0, minWidth: 16 }}>{num}.</span>
              <span style={{ fontSize: 13.5, color: color || C.g900 }}>{renderInline(content, color)}</span>
            </div>
          );
        }

        // Heading line (##, ###, ──── )
        if (line.trim().startsWith('##') || line.trim().startsWith('**') && line.trim().endsWith('**')) {
          const content = line.trim().replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
          return (
            <div key={i} style={{
              fontWeight: 700, fontSize: 13, color: color || C.g900,
              marginTop: 10, marginBottom: 4, letterSpacing: 0.2,
            }}>
              {content}
            </div>
          );
        }

        // Divider
        if (line.trim().match(/^[-─=]{3,}$/)) {
          return <hr key={i} style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '6px 0' }} />;
        }

        // Empty line → spacing
        if (!line.trim()) {
          return <div key={i} style={{ height: 6 }} />;
        }

        // Normal line
        return (
          <div key={i} style={{ fontSize: 13.5, color: color || C.g900, marginBottom: 2 }}>
            {renderInline(line, color)}
          </div>
        );
      })}
    </div>
  );
}

// Render inline bold **text** and italic _text_
function renderInline(text, color) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function ConfBadge({ level }) {
  const m = { High: [C.greenBg, C.green], Medium: [C.amberBg, C.amber], Low: [C.redBg, C.red] };
  const [bg, col] = m[level] || m.Low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color: col, border: `1px solid ${col}30`,
      borderRadius: 20, padding: '2px 8px',
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: col, display: 'inline-block' }} />
      {level}
    </span>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '10px 14px', alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: C.g300,
          animation: `asdot 1.2s ease-in-out ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </div>
  );
}

function SourcePills({ sources }) {
  if (!sources?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
      {sources.slice(0, 4).map((s, i) => (
        <span key={i} style={{
          background: C.g100, border: `1px solid ${C.border}`,
          borderRadius: 5, padding: '2px 8px',
          fontSize: 10, color: C.g500, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: C.teal }}>📎</span>
          {s.title || 'Source'}
          {s.clauseNumber && (
            <span style={{
              background: C.sky, color: C.tealDk,
              borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700,
            }}>{s.clauseNumber}</span>
          )}
        </span>
      ))}
    </div>
  );
}

function Bubble({ msg, onFeedback }) {
  const isUser = msg.role === 'user';
  const [fb, setFb] = useState(0);
  const sendFb = (v) => {
    if (fb !== 0 || !msg.logId) return;
    setFb(v); onFeedback?.(msg.logId, v);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: isUser ? C.tealDk : C.g400, marginBottom: 4, textTransform: 'uppercase' }}>
        {isUser ? 'You' : 'TPS AI'}
      </div>
      <div style={{
        maxWidth: '88%',
        background: isUser ? `linear-gradient(135deg,${C.navy},${C.navyL})` : C.white,
        color: isUser ? C.white : C.g900,
        border: isUser ? 'none' : `1px solid ${C.border}`,
        borderRadius: isUser ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
        padding: '10px 13px',
        boxShadow: isUser ? '0 2px 12px rgba(11,36,71,0.2)' : '0 1px 6px rgba(11,36,71,0.06)',
      }}>
        {isUser
          ? <span style={{ fontSize: 13.5, color: C.white }}>{msg.content}</span>
          : <FormattedText text={msg.content} color={C.g900} />
        }
      </div>
      {!isUser && (
        <div style={{ maxWidth: '88%' }}>
          <SourcePills sources={msg.sources} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {msg.confidence && <ConfBadge level={msg.confidence} />}
            {msg.logId && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {[1, -1].map(v => (
                  <button key={v} onClick={() => sendFb(v)} style={{
                    background: fb === v ? (v === 1 ? C.greenBg : C.redBg) : 'transparent',
                    border: `1px solid ${fb === v ? (v === 1 ? C.green : C.red) : C.g200}`,
                    borderRadius: 5, width: 26, height: 22, cursor: 'pointer', fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{v === 1 ? '👍' : '👎'}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestChip({ text, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.sky : C.white,
        border: `1px solid ${hov ? C.teal : C.border}`,
        borderRadius: 8, padding: '8px 12px',
        fontSize: 12, color: hov ? C.tealDk : C.g700,
        textAlign: 'left', cursor: 'pointer', lineHeight: 1.4,
        width: '100%', marginBottom: 7,
        display: 'flex', alignItems: 'flex-start', gap: 7,
        transition: 'all 0.15s',
      }}>
      <span style={{ color: C.teal, fontSize: 11, marginTop: 1 }}>→</span>
      {text}
    </button>
  );
}

function HistoryItem({ session, onClick }) {
  const last    = session.messages?.[session.messages.length - 1];
  const preview = last?.content?.slice(0, 80) || 'Empty session';
  const when    = session.updated_at
    ? new Date(session.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? C.offWhite : C.white,
        border: `1px solid ${hov ? C.teal : C.border}`,
        borderRadius: 10, padding: '11px 13px', width: '100%',
        textAlign: 'left', cursor: 'pointer', marginBottom: 8,
        transition: 'all 0.15s',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.g900, flex: 1 }}>{session.title || 'Conversation'}</div>
        <div style={{ fontSize: 10, color: C.g400 }}>{when}</div>
      </div>
      <div style={{ fontSize: 11, color: C.g400, lineHeight: 1.4 }}>{preview}</div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
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

  const endRef   = useRef(null);
  const inputRef = useRef(null);

  shared.toggle = () => setOpen(o => !o);

  useEffect(() => {
    getSuggestedQuestions('general').then(setSuggestions).catch(() =>
      setSuggestions([
        'What are the competency requirements for ISO 22000 auditors?',
        'Which procedure covers non-conformance management?',
        'What records must be maintained for NABCB accreditation?',
        'How often must surveillance audits be conducted?',
        'What does IAF MD5 require for audit duration calculation?',
      ])
    );
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setSessLoad(true);
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/knowledge/chat/recent`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('tps_token') || ''}` },
    }).then(r => r.json()).then(r => setSessions(r.data || [])).catch(() => setSessions([])).finally(() => setSessLoad(false));
  }, [activeTab]);

  const send = useCallback(async (text = input) => {
    const q = (text || '').trim();
    if (!q || isLoading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: q }]);
    setIsLoading(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const sess = await createSession({ title: q.slice(0, 60), mode: 'general' });
        sid = sess.id; setSessionId(sid);
      }
      const result = await sendChatMessage(sid, q);
      const res    = result.response || result;
      setMessages(p => [...p, {
        role: 'assistant',
        content: formatAnswer(res.directAnswer || 'No answer generated.'),
        sources: res.sourceDocuments || [],
        confidence: res.confidenceLevel,
        logId: res.logId,
      }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', content: `Sorry, something went wrong. Please try again.\n\n_${err.message}_` }]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, sessionId]);

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const newChat = () => { setMessages([]); setSessionId(null); setInput(''); setActiveTab('chat'); };

  const loadSession = (sess) => {
    setSessionId(sess.id);
    setMessages((sess.messages || []).map(m => ({ role: m.role, content: m.content, sources: m.sources || [], confidence: m.confidence })));
    setActiveTab('chat');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        @keyframes asdot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes aspanelin { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes asfadeup { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .asmsg { animation: asfadeup .25s ease both; }
        .askai-widget * { box-sizing: border-box; font-family: 'DM Sans','Segoe UI',sans-serif; }
        .askai-widget textarea:focus { outline: none; }
        .askai-ta { scrollbar-width: thin; }
      `}</style>

      {/* Floating button (used when header button not present) */}
      <button id="askai-float-btn" onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: 24, right: open ? PANEL_W + 14 : 22, zIndex: 9997,
        background: open ? C.g100 : `linear-gradient(135deg,${C.teal},${C.tealDk})`,
        color: open ? C.g700 : C.white,
        border: `1.5px solid ${open ? C.border : 'transparent'}`,
        borderRadius: 12, padding: '9px 18px',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 7,
        boxShadow: open ? 'none' : '0 4px 20px rgba(25,167,206,.38)',
        transition: 'all .25s cubic-bezier(.4,0,.2,1)',
      }}>
        <span style={{ fontSize: 15 }}>{open ? '✕' : '⚡'}</span>
        {open ? 'Close' : 'Ask AI'}
      </button>

      {/* Slide-in panel */}
      {open && (
        <div className="askai-widget" style={{
          position: 'fixed', top: 0, right: 0,
          width: PANEL_W, height: '100vh',
          background: C.offWhite,
          borderLeft: `1px solid ${C.border}`,
          boxShadow: '-6px 0 40px rgba(11,36,71,.12)',
          zIndex: 9998, display: 'flex', flexDirection: 'column',
          animation: 'aspanelin .28s cubic-bezier(.4,0,.2,1)',
        }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyL})`, padding: '16px 16px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚡</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.white, lineHeight: 1.2 }}>TPS AI Assistant</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', marginTop: 1 }}>Powered by your Drive documents</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={newChat} style={{
                  background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
                  borderRadius: 7, padding: '5px 10px', color: C.white,
                  cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>✎ New</button>
                <button onClick={() => setOpen(false)} style={{
                  background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)',
                  borderRadius: 7, width: 28, height: 28, color: C.white,
                  cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {[['chat', '💬 Chat'], ['history', '🕐 History']].map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)} style={{
                  background: activeTab === id ? C.white : 'transparent',
                  color: activeTab === id ? C.navy : 'rgba(255,255,255,.65)',
                  border: 'none', borderRadius: '8px 8px 0 0',
                  padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* ── CHAT ── */}
          {activeTab === 'chat' && (<>
            <div className="askai-ta" style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
              {messages.length === 0 && (
                <div style={{ animation: 'asfadeup .3s ease' }}>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 14px 10px', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.g900, marginBottom: 3 }}>Ask anything about TPS certification</div>
                    <div style={{ fontSize: 12, color: C.g400, lineHeight: 1.5 }}>I search your Drive docs — ISO 17021-1, IAF MDs, TPS procedures, formats — and give cited answers.</div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Suggested questions</div>
                  {suggestions.slice(0, 5).map((q, i) => <SuggestChip key={i} text={q} onClick={() => send(q)} />)}
                </div>
              )}
              {messages.map((msg, i) => <div key={i} className="asmsg"><Bubble msg={msg} onFeedback={(lid, v) => submitFeedback(lid, v).catch(() => {})} /></div>)}
              {isLoading && (
                <div className="asmsg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, color: C.g400, marginBottom: 4, textTransform: 'uppercase' }}>TPS AI</div>
                  <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: '3px 14px 14px 14px', boxShadow: '0 1px 6px rgba(11,36,71,.06)' }}><TypingDots /></div>
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
                  placeholder="Ask about ISO clauses, procedures, audits…"
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontSize: 13.5, color: C.g900, fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto', padding: 0 }} />
                <button onClick={() => send()} disabled={!input.trim() || isLoading} style={{
                  background: (!input.trim() || isLoading) ? C.g200 : C.teal,
                  color: (!input.trim() || isLoading) ? C.g400 : C.white,
                  border: 'none', borderRadius: 9, width: 34, height: 34, flexShrink: 0,
                  cursor: (!input.trim() || isLoading) ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, transition: 'all .15s',
                }}>{isLoading ? '⏳' : '➤'}</button>
              </div>
              <div style={{ fontSize: 10, color: C.g400, textAlign: 'center', marginTop: 6 }}>Answers cite your Drive documents. Verify critical decisions.</div>
            </div>
          </>)}

          {/* ── HISTORY ── */}
          {activeTab === 'history' && (
            <div className="askai-ta" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, textTransform: 'uppercase', letterSpacing: .8 }}>Past conversations</div>
                <button onClick={newChat} style={{ background: C.teal, color: C.white, border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ New chat</button>
              </div>
              {sessLoad ? (
                <div style={{ textAlign: 'center', padding: 32, color: C.g400, fontSize: 13 }}>Loading…</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: C.g400, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🕐</div>
                  No past conversations yet.<br />Start a new chat above.
                </div>
              ) : sessions.map(s => <HistoryItem key={s.id} session={s} onClick={() => loadSession(s)} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Header button — place in your portal navbar
export function AskAIHeaderButton() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      const fb = document.getElementById('askai-float-btn');
      if (fb) fb.style.display = 'none';  // hide float when header btn present
    }, 500);
    return () => clearInterval(id);
  }, []);
  const toggle = () => {
    const next = !isOpen; setIsOpen(next);
    shared.toggle && shared.toggle();
  };
  return (
    <button onClick={toggle} style={{
      background: isOpen ? 'rgba(255,255,255,.15)' : `linear-gradient(135deg,${C.teal},${C.tealDk})`,
      color: '#fff', border: `1.5px solid ${isOpen ? 'rgba(255,255,255,.3)' : 'transparent'}`,
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
