/**
 * knowledgeApi.js  —  Frontend service layer for the AI Knowledge system.
 *
 * Wraps every backend endpoint with consistent error handling, loading state
 * management helpers, and typed response shapes.
 *
 * Place in: tps-xperts-frontend/src/services/knowledgeApi.js
 *
 * Usage:
 *   import { search, sendChatMessage, listDocuments } from './knowledgeApi';
 *
 * Auth: reads JWT from localStorage key 'tps_token' and attaches as Bearer.
 *       Replace getToken() if your auth flow differs.
 */

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.tpscert.com';

// ─── Auth helper ──────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('tps_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${getToken()}`,
  };
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = json.error || `Request failed (${response.status})`;
    throw new Error(msg);
  }
  return json;
}

// ═════════════════════════════════════════════════════════════════════════════
//  SEARCH
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Single-turn RAG search.
 * @param {Object} params
 * @param {string} params.query
 * @param {string} [params.category]   iso | iaf | procedures | formats | audit | competency
 * @param {string} [params.mode]       general | audit_planning | gap_analysis | accreditation | competency | internal_audit
 * @param {string} [params.sessionId]
 * @param {number} [params.maxResults]
 * @returns {Promise<SearchResult>}
 */
export async function search({ query, category, mode, sessionId, maxResults }) {
  const { data } = await apiFetch('/api/knowledge/search', {
    method: 'POST',
    body:   JSON.stringify({ query, category, mode, sessionId, maxResults }),
  });
  return data;
}

/**
 * Get suggested questions for a category.
 * @param {string} [category]
 * @returns {Promise<string[]>}
 */
export async function getSuggestedQuestions(category = 'general') {
  const { data } = await apiFetch(`/api/knowledge/suggest?category=${encodeURIComponent(category)}`);
  return data;
}

/**
 * Submit feedback on a search result.
 * @param {string} logId
 * @param {1|-1}   feedback
 */
export async function submitFeedback(logId, feedback) {
  await apiFetch('/api/knowledge/feedback', {
    method: 'POST',
    body:   JSON.stringify({ logId, feedback }),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  DOCUMENTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * List indexed documents.
 * @param {Object} [params]
 * @param {string} [params.category]
 * @param {string} [params.search]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function listDocuments({ category, search, page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (search)   qs.set('search', search);
  qs.set('page',  String(page));
  qs.set('limit', String(limit));

  return apiFetch(`/api/knowledge/documents?${qs.toString()}`);
}

/**
 * Get a single document's metadata.
 * @param {string} id
 */
export async function getDocument(id) {
  const { data } = await apiFetch(`/api/knowledge/documents/${id}`);
  return data;
}

// ═════════════════════════════════════════════════════════════════════════════
//  CHAT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Create a new chat session.
 * @param {Object} [params]
 * @param {string} [params.title]
 * @param {string} [params.category]
 * @param {string} [params.mode]
 * @returns {Promise<Session>}
 */
export async function createSession({ title, category, mode } = {}) {
  const { data } = await apiFetch('/api/knowledge/chat', {
    method: 'POST',
    body:   JSON.stringify({ title, category, mode }),
  });
  return data;
}

/**
 * Send a message to an existing session.
 * @param {string} sessionId
 * @param {string} message
 * @returns {Promise<ChatTurn>}
 */
export async function sendChatMessage(sessionId, message) {
  const { data } = await apiFetch(`/api/knowledge/chat/${sessionId}/message`, {
    method: 'POST',
    body:   JSON.stringify({ message }),
  });
  return data;
}

/**
 * Load full session history.
 * @param {string} sessionId
 */
export async function getSession(sessionId) {
  const { data } = await apiFetch(`/api/knowledge/chat/${sessionId}`);
  return data;
}

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN — SYNC
// ═════════════════════════════════════════════════════════════════════════════

export async function triggerSync() {
  return apiFetch('/api/sync/trigger', { method: 'POST' });
}

export async function getSyncStatus() {
  const { data, isRunning, activeJobId } = await apiFetch('/api/sync/status');
  return { ...data, isRunning, activeJobId };
}

export async function getSyncJobs({ page = 1, limit = 20 } = {}) {
  return apiFetch(`/api/sync/jobs?page=${page}&limit=${limit}`);
}

export async function cancelSync() {
  return apiFetch('/api/sync/cancel', { method: 'POST' });
}

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN — KNOWLEDGE BASE
// ═════════════════════════════════════════════════════════════════════════════

export async function getKbStats() {
  const { data } = await apiFetch('/api/admin/kb/stats');
  return data;
}

export async function adminListDocuments(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
  );
  return apiFetch(`/api/admin/kb/documents?${qs.toString()}`);
}

export async function updateDocument(id, updates) {
  const { data } = await apiFetch(`/api/admin/kb/documents/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(updates),
  });
  return data;
}

export async function deactivateDocument(id) {
  return apiFetch(`/api/admin/kb/documents/${id}`, { method: 'DELETE' });
}

export async function reindexDocument(id) {
  return apiFetch(`/api/admin/kb/reindex/${id}`, { method: 'POST' });
}

export async function reindexAll() {
  return apiFetch('/api/admin/kb/reindex-all', { method: 'POST' });
}

export async function getSearchLogs(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)),
  );
  return apiFetch(`/api/admin/kb/logs?${qs.toString()}`);
}

export async function getAnalytics(days = 30) {
  const { data } = await apiFetch(`/api/admin/kb/analytics?days=${days}`);
  return data;
}

export async function getAISettings() {
  const { data } = await apiFetch('/api/admin/kb/settings');
  return data;
}

export async function updateAISettings(settings) {
  return apiFetch('/api/admin/kb/settings', {
    method: 'PATCH',
    body:   JSON.stringify(settings),
  });
}
