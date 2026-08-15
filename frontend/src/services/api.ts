const API_BASE = (import.meta as any).env?.VITE_API_URL || ''

function token() {
  try { return localStorage.getItem('atlas_v3_token') || '' } catch { return '' }
}
export function setToken(t: string) {
  try {
    if (t) localStorage.setItem('atlas_v3_token', t)
    else localStorage.removeItem('atlas_v3_token')
  } catch {}
}
export function clearAuth() { setToken('') }
export function isLoggedIn() { return !!token() }
export function apiBase() { return API_BASE }

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers as any),
  }
  const t = token()
  if (t) headers['Authorization'] = `Bearer ${t}`
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    let detail: any = `HTTP ${res.status}`
    try {
      const b = await res.json()
      detail = b.detail || b.message || detail
    } catch {}
    if (res.status === 401) setToken('')
    throw new Error(typeof detail === 'string' ? detail : (detail.message || JSON.stringify(detail)))
  }
  return res.json()
}

export async function health() {
  return req<{ status: string }>('/health')
}
export async function login(username: string, password: string) {
  const d = await req<{ access_token: string; username: string; role: string }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  })
  setToken(d.access_token)
  try { localStorage.setItem('atlas_v3_role', d.role) } catch {}
  return d
}
export async function me() {
  return req<{ username: string; role: string }>('/api/auth/me')
}
export async function preflight() {
  return req<any>('/api/research/preflight')
}
export async function getBudget() {
  return req<any>('/api/research/budget')
}
export async function getQuota() {
  // Prefer research alias (live UI); fall back to ops. Never throw for pink-error.
  try {
    return await req<any>('/api/research/quota')
  } catch {
    try {
      return await req<any>('/api/ops/quota')
    } catch {
      return null
    }
  }
}
export async function startResearch(question: string, target: number, preset?: string) {
  return req<any>('/api/research/start', {
    method: 'POST',
    body: JSON.stringify({ research_question: question, target_records: target, preset }),
  })
}
export async function getStatus(runId: string) {
  return req<any>(`/api/research/status/${runId}`)
}
export async function listRuns() {
  return req<any[]>('/api/research/runs')
}
export async function getDataset(runId: string, minConfidence = 0) {
  return req<any>(`/api/research/dataset/${runId}?min_confidence=${minConfidence}`)
}
export async function getAnalysis(runId: string) {
  return req<any>(`/api/research/analysis/${runId}`)
}
export async function getReport(runId: string) {
  return req<any>(`/api/research/report/${runId}`)
}
export async function shareRun(runId: string) {
  return req<{ share_token: string; app_path: string; api_path: string }>(`/api/research/share/${runId}`, { method: 'POST' })
}
export async function resumeRun(runId: string) {
  return req(`/api/research/resume/${runId}`, { method: 'POST' })
}
export async function nextBatch(runId: string, batchSize = 15) {
  return req<any>(`/api/research/next-batch/${runId}?batch_size=${batchSize}`, { method: 'POST' })
}
export async function compareRuns(a: string, b: string) {
  return req<any>(`/api/research/compare?a=${a}&b=${b}`)
}
export async function reclassifyLow(runId: string, threshold = 0.5) {
  return req<any>(`/api/research/reclassify-low-confidence/${runId}?threshold=${threshold}`, { method: 'POST' })
}
export async function getPublicReport(token: string) {
  return req<any>(`/api/public/report/${token}`)
}
export async function getEvents(runId: string) {
  return req<any[]>(`/api/ops/events/${runId}`)
}
export async function getPackage(runId: string) {
  return req<any>(`/api/ops/package/${runId}`)
}
export async function getReviewQueue() {
  return req<any[]>('/api/research/review-queue')
}
export async function reviewOne(id: number, status: 'accepted' | 'rejected') {
  return req(`/api/research/review/${id}?status=${status}`, { method: 'POST' })
}
export function downloadRecordsCsv(records: any[], filename: string) {
  if (!records?.length) return
  const fields = Object.keys(records[0])
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [fields.join(','), ...records.map(r => fields.map(f => esc(r[f])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
export function downloadJson(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export async function askMemory(question: string, runIds?: string[], runId?: string) {
  return req<any>('/api/research/memory/ask', {
    method: 'POST',
    body: JSON.stringify({ question, run_ids: runIds, run_id: runId }),
  })
}

export async function indexMemory(runId: string) {
  return req<any>(`/api/research/memory/index/${runId}`, { method: 'POST' })
}

export async function memoryStats() {
  return req<{ chunks: number; embedded: number }>('/api/research/memory/stats')
}

export async function listStudies() {
  return req<any[]>('/api/research/studies')
}
export async function getStudy(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}`)
}
export async function listRunClaims(runId: string) {
  return req<{ run_id: string; study_id?: string; claims: any[] }>(`/api/research/runs/${runId}/claims`)
}
export async function getClaim(claimId: string) {
  return req<any>(`/api/research/claims/${claimId}`)
}
export async function rebuildClaims(runId: string) {
  return req<any>(`/api/research/runs/${runId}/rebuild-claims`, { method: 'POST' })
}

export async function getAnalyzeLayers(runId: string) {
  return req<any>(`/api/research/runs/${runId}/analyze`)
}

export async function askAtlas(question: string, opts?: { runId?: string; studyId?: string; runIds?: string[] }) {
  return req<any>('/api/research/ask', {
    method: 'POST',
    body: JSON.stringify({
      question,
      run_id: opts?.runId,
      study_id: opts?.studyId,
      run_ids: opts?.runIds,
    }),
  })
}
export async function getStudyRunToRun(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}/run-to-run`)
}

export async function getStudyPulse(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}/pulse`)
}
export async function refreshStudy(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}/refresh`, { method: 'POST' })
}
export async function getStudyMonitor(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}/monitor`)
}

export async function getPrescriptive(runId: string) {
  return req<any>(`/api/research/runs/${runId}/prescriptive`)
}

export async function getStudyPredictive(studyId: string) {
  return req<any>(`/api/research/studies/${studyId}/predictive`)
}
export async function getRunPredictive(runId: string) {
  return req<any>(`/api/research/runs/${runId}/predictive`)
}
