const API_BASE = import.meta.env.VITE_API_URL || 'https://tps-cert-backend.onrender.com';

function getToken() {
  // Supabase stores token here — matches your portal auth
  const raw = localStorage.getItem(
    `sb-ukpmypsuzuoecwpxavty-auth-token`
  );
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed.access_token || '';
  } catch {
    return '';
  }
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization:  `Bearer ${getToken()}`,
  };
}

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

export async function search({ query, category, mode, sessionId, maxResults }) {
  const { data } = await apiFetch('/api/knowledge/search', {
    method: 'POST',
    body:   JSON.stringify({ query, category, mode, sessionId, maxResults }),
  });
  return data;
}

export async function getSuggestedQuestions(category = 'general') {
  const { data } = await apiFetch(`/api/knowledge/suggest?category=${encodeURIComponent(category)}`);
  return data;
}

export async function submitFeedback(logId, feedback) {
  await apiFetch('/api/knowledge/feedback', {
    method: 'POST',
    body:   JSON.stringify({ logId, feedback }),
  });
}

export async function listDocuments({ category, search, page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (search)   qs.set('search', search);
  qs.set('page',  String(page));
  qs.set('limit', String(limit));
  return apiFetch(`/api/knowledge/documents?${qs.toString()}`);
}

export async function getDocument(id) {
  const { data } = await apiFetch(`/api/knowledge/documents/${id}`);
  return data;
}

export async function createSession({ title, category, mode } = {}) {
  const { data } = await apiFetch('/api/knowledge/chat', {
    method: 'POST',
    body:   JSON.stringify({ title, category, mode }),
  });
  return data;
}

export async function sendChatMessage(sessionId, message) {
  const { data } = await apiFetch(`/api/knowledge/chat/${sessionId}/message`, {
    method: 'POST',
    body:   JSON.stringify({ message }),
  });
  return data;
}

export async function getSession(sessionId) {
  const { data } = await apiFetch(`/api/knowledge/chat/${sessionId}`);
  return data;
}

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

export async function deactivateDocument(id) {
  return apiFetch(`/api/admin/kb/documents/${id}`, { method: 'DELETE' });
}

export async function reindexDocument(id) {
  return apiFetch(`/api/admin/kb/reindex/${id}`, { method: 'POST' });
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
  return {
    model:               'claude-sonnet-4-6',
    maxTokens:           1500,
    similarityThreshold: 0.35,
    chunkSize:           512,
    embeddingModel:      'voyage-3-lite',
    driveRootFolderId:   '1u4JP9LTMsfv-dAbSQyFEA03iQ5rdnqtM',
  };
}

export async function updateAISettings(settings) {
  return apiFetch('/api/admin/kb/settings', {
    method: 'PATCH',
    body:   JSON.stringify(settings),
  });
}
