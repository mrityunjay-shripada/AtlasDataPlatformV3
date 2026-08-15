import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  health, login, me, isLoggedIn, clearAuth,
  startResearch, getStatus, listRuns, getDataset, getAnalysis, getReport,
  shareRun, resumeRun, nextBatch, preflight, getBudget, getQuota, compareRuns, reclassifyLow,
  getPublicReport, downloadRecordsCsv, downloadJson, getPackage, getEvents,
  askMemory, askAtlas, indexMemory, memoryStats,
  listRunClaims, getClaim, rebuildClaims, getAnalyzeLayers, getStudyRunToRun,
  getStudyPulse, refreshStudy, getStudyMonitor, getPrescriptive,
  getStudyPredictive, getRunPredictive,
} from './services/api'
import {
  Toast, Badge, GenreChip, ConfidenceBar, BarChart, EmptyState,
  ReportSection, InsightsHero, TakeawayRow, GapBoard, InsightsActionBar, ReportAccordion, StoryPatternCallout, cleanReportProse,
  KeySignals, CompactStat, CompactActions, PredictiveLock, FindingActions, BreakoutCard, StickyResearchBar, ProximityStrip, PotentialMatrix, filterChartData, ClassificationGapNote, AnalyzeEmpty, HealthCard, formatViews,
  deriveTakeaways,
  STAGE_COPY, ERROR_COPY, PRESET_META,
} from './components/ui'
import type { LineageFilter } from './components/ui'



type Mode = 'compose' | 'run' | 'insights' | 'evidence' | 'library'

const DEFAULT_Q =
  'Analyze YouTube micro-dramas for storytelling patterns, genre saturation, and whitespace opportunities.'

const MODES: { id: Mode; label: string; short: string }[] = [
  { id: 'compose', label: 'Compose', short: 'New' },
  { id: 'run', label: 'Run', short: 'Run' },
  { id: 'insights', label: 'Insights', short: 'Insights' },
  { id: 'evidence', label: 'Evidence', short: 'Data' },
  { id: 'library', label: 'Library', short: 'Library' },
]

function Login({ onOk }: { onOk: (u: string, role: string) => void }) {
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    try {
      const r = await login(u, p)
      onOk(r.username, r.role)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4">
      <form onSubmit={submit} className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="text-3xl">◈</div>
          <h1 className="text-2xl font-bold text-atlas-900">Atlas Data Platform V3</h1>
          <p className="text-sm text-slate-500">YouTube micro-drama research</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Username</label>
          <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-atlas-600/30 focus:border-atlas-600 outline-none" value={u} onChange={e => setU(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Password</label>
          <input type="password" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-atlas-600/30 focus:border-atlas-600 outline-none" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-lg">{err}</div>}
        <button disabled={loading} className="w-full bg-atlas-600 hover:bg-atlas-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 transition min-h-[44px]">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function SharePage({ token }: { token: string }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    getPublicReport(token).then(setData).catch(e => setErr(e.message))
  }, [token])
  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <EmptyState title="Report unavailable" body={err} />
      </div>
    )
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading shared report…</div>
  }
  const report = data.report || {}
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-atlas-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Shared research · Atlas Data Platform V3</div>
          <h1 className="text-2xl font-bold leading-tight">{report.title || 'Research report'}</h1>
          <p className="text-sm text-slate-300 mt-3">{data.research_question}</p>
          <div className="mt-4 flex gap-2">
            <Badge tone="green">{data.status}</Badge>
            <Badge>{data.collected_count} videos</Badge>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {(() => {
          const n = data.collected_count || 0
          const takes = deriveTakeaways({ analysis: data.analysis }, report, n)
          const aRoot = data.analysis || {}
          return (
            <>
              <p className="text-xs text-slate-500">Grounded sample of {n} videos · not a market census</p>
              <TakeawayRow crowded={takes.crowded} open={takes.open} emerging={takes.emerging} />
              <GapBoard n={n} crowdedChips={takes.crowdedChips} openChips={takes.openChips} saturation={aRoot.saturation_notes || []} whitespace={aRoot.whitespace_opportunities || []} />
              {aRoot.genre_distribution && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                  <BarChart data={aRoot.genre_distribution} title="Genre distribution" />
                  <p className="text-[11px] text-slate-400 mt-3">In this shared sample only.</p>
                </div>
              )}
              {report.executive_summary && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Executive summary</div>
                  <p className="text-[15px] text-slate-800 leading-relaxed">{cleanReportProse(report.executive_summary)}</p>
                </div>
              )}
              <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                  <h2 className="text-sm font-semibold text-slate-900">Full write-up</h2>
                </div>
                <div className="p-6 space-y-8">
                  {['dataset_overview', 'genre_analysis', 'storytelling_pattern_analysis', 'engagement_analysis', 'limitations', 'conclusion'].map(k =>
                    report[k] ? (
                      <ReportSection key={k} field={k}>
                      {k === 'storytelling_pattern_analysis' ? (
                        <StoryPatternCallout prose={report[k]} analysis={undefined} />
                      ) : (
                        <p className="text-slate-700 leading-relaxed">{cleanReportProse(String(report[k]))}</p>
                      )}
                    </ReportSection>
                    ) : null
                  )}
                </div>
              </div>
            </>
          )
        })()}
      </main>
    </div>
  )
}

function Drawer({ open, onClose, row }: { open: boolean; onClose: () => void; row: any | null }) {
  if (!open || !row) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto p-6 space-y-4 animate-[slideIn_0.2s_ease]">
        <div className="flex justify-between items-start gap-3">
          <h3 className="font-semibold text-slate-900 leading-snug">{row.title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Classification</div>
        <div className="flex flex-wrap gap-2">
          <GenreChip genre={row.genre} />
          {row.trope && <Badge>{row.trope}</Badge>}
          {row.emotion && <Badge tone="blue">{row.emotion}</Badge>}
          {row.hook && <Badge tone="amber">{row.hook}</Badge>}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Confidence</div>
          <ConfidenceBar value={row.confidence} />
        </div>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-slate-500">Channel</dt><dd>{row.channel || '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Views</dt><dd>{Number(row.views || 0).toLocaleString()}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-slate-500 shrink-0">Source</dt>
            <dd className="text-right">{row.source_url || row.youtube_id ? (
              <a className="text-atlas-700 underline break-all" href={row.source_url || (row.youtube_id || row.id ? `https://www.youtube.com/watch?v=${row.youtube_id || row.id}` : undefined)} target="_blank" rel="noreferrer">
                Watch on YouTube
              </a>
            ) : '—'}</dd>
          </div>
          {(row.youtube_id || row.id) && (
            <div className="flex justify-between"><dt className="text-slate-500">Video ID</dt><dd className="font-mono text-xs">{row.youtube_id || row.id}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-slate-500">Emotion</dt><dd>{row.emotion || '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Hook</dt><dd>{row.hook || '—'}</dd></div>
        </dl>
        {(row.source_url || row.youtube_id || row.id) && (
          <a href={row.source_url || `https://www.youtube.com/watch?v=${row.youtube_id || row.id}`} target="_blank" rel="noreferrer" className="inline-flex text-sm text-atlas-700 font-medium hover:underline">
            Open on YouTube →
          </a>
        )}
      </aside>
    </div>
  )
}

export default function App() {
  const shareMatch = typeof window !== 'undefined' ? window.location.pathname.match(/^\/share\/([^/]+)/) : null
  if (shareMatch) return <SharePage token={shareMatch[1]} />

  const [authChecked, setAuthChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('admin')
  const [apiReady, setApiReady] = useState(false)
  const [waking, setWaking] = useState(false)
  const [wakeSecs, setWakeSecs] = useState(0)

  const [mode, setMode] = useState<Mode>('compose')
  const [question, setQuestion] = useState(DEFAULT_Q)
  const [preset, setPreset] = useState<'quick' | 'standard' | 'deep'>('quick')
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [budget, setBudget] = useState<any>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [minConf, setMinConf] = useState(0)
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [compareResult, setCompareResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzeTab, setAnalyzeTab] = useState('overview')
  const [inspectItem, setInspectItem] = useState<any | null>(null)
  const [memoryQ, setMemoryQ] = useState('')
  const [toast, setToast] = useState('')
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [drawerRow, setDrawerRow] = useState<any | null>(null)
  const [evidenceFilter, setEvidenceFilter] = useState<LineageFilter | null>(null)
  
  const [memoryAns, setMemoryAns] = useState<any>(null)
  const [memoryBusy, setMemoryBusy] = useState(false)
  const [claimsList, setClaimsList] = useState<any[]>([])
  const [activeClaim, setActiveClaim] = useState<any | null>(null)
  const [analyzeLayers, setAnalyzeLayers] = useState<any | null>(null)
  const [pulseData, setPulseData] = useState<any | null>(null)
  const [monitorData, setMonitorData] = useState<any | null>(null)
  const [prescriptive, setPrescriptive] = useState<any | null>(null)
  const [predictive, setPredictive] = useState<any | null>(null)
  const prevRunStatus = useRef<string | null>(null)
  const [onboarding, setOnboarding] = useState(() => {
    try { return localStorage.getItem('atlas_v3_onboarded') !== '1' } catch { return true }
  })

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 3500)
  }

  const focusAsk = (prompt: string) => {
    setMemoryQ(prompt)
    showToast('Ask Atlas ready — submit below')
    try { document.getElementById('ask-atlas')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
  }

  const openLineage = async (f: LineageFilter) => {

    setEvidenceFilter({
      ...f,
      claim:
        f.kind === 'genre'
          ? `${f.key.replace(/_/g, ' ')} · ${f.count} of ${f.total} (${f.total ? Math.round((f.count / f.total) * 100) : 0}%)`
          : `${f.key.replace(/_/g, ' ')} · ${f.count} of ${f.total} (${f.total ? Math.round((f.count / f.total) * 100) : 0}%)`,
    })
    setActiveClaim(null)
    // Prefer first-class Claim when available (V3 Proof backbone)
    const match = claimsList.find((c) => {
      const inputs = c.inputs || {}
      return inputs.kind === f.kind && String(inputs.key).toLowerCase().replace(/ /g, '_') === String(f.key).toLowerCase().replace(/ /g, '_')
    })
    if (match) {
      try {
        const detail = await getClaim(match.id)
        setActiveClaim(detail)
      } catch { /* fall back to filter-only */ }
    }
    setMode('evidence')
    showToast('Showing the videos and math behind this finding')
  }

  const matchesLineage = (r: any, f: LineageFilter | null) => {
    if (!f) return true
    const norm = (s: any) => String(s || '').toLowerCase().replace(/ /g, '_')
    if (f.kind === 'genre') return norm(r.genre) === norm(f.key)
    return norm(r.trope) === norm(f.key)
  }


  useEffect(() => {
    let cancelled = false
    let secs = 0
    const ping = async () => {
      setWaking(true)
      while (!cancelled) {
        try {
          const h = await health()
          if (h.status === 'ok') {
            if (!cancelled) { setApiReady(true); setWaking(false) }
            return
          }
        } catch { /* cold */ }
        secs += 3
        if (!cancelled) setWakeSecs(secs)
        await new Promise(r => setTimeout(r, 3000))
        if (secs > 120) break
      }
      if (!cancelled) {
        setWaking(false)
        setError('API did not become ready. Check Render and VITE_API_URL.')
      }
    }
    ping()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) { setAuthChecked(true); return }
    me().then(u => {
      setUsername(u.username)
      setRole(u.role || 'admin')
      setAuthed(true)
    }).catch(() => clearAuth()).finally(() => setAuthChecked(true))
  }, [])

  const refreshHistory = useCallback(async () => {
    try { setHistory(await listRuns()) } catch { /* */ }
  }, [])

  useEffect(() => {
    if (authed && apiReady) {
      refreshHistory()
      getBudget().then(setBudget).catch(() => {})
      getQuota().then(q => setBudget((b: any) => ({ ...(b || {}), youtube: q }))).catch(() => {})
    }
  }, [authed, apiReady, refreshHistory])

  useEffect(() => {
    if (!runId || !authed) return
    let cancelled = false
    // Reset transition tracker when switching runs
    prevRunStatus.current = null
    const tick = async () => {
      try {
        const s = await getStatus(runId)
        if (cancelled) return
        const prev = prevRunStatus.current
        setStatus(s)
        const done = s.status === 'completed' || s.status === 'partial'
        const wasActive = !!prev && !['completed', 'partial', 'failed'].includes(prev)
        const justFinished = done && (wasActive || prev === null || prev === 'queued')
        // Only auto-jump to Insights when a run *becomes* done — never yank user off Evidence/Library
        if (done) {
          const [d, a, r] = await Promise.all([
            getDataset(runId, minConf).catch(() => null),
            getAnalysis(runId).catch(() => null),
            getReport(runId).catch(() => null),
          ])
          if (d) setDataset(d)
          if (a) setAnalysis(a)
          if (r) setReport(r)
          try {
            const cl = await listRunClaims(runId)
            if (!cancelled) setClaimsList(cl.claims || [])
          } catch { /* claims optional until rebuild */ }
          try {
            const layers = await getAnalyzeLayers(runId)
            if (!cancelled) setAnalyzeLayers(layers)
          } catch { if (!cancelled) setAnalyzeLayers(null) }
          try {
            const pr = await getPrescriptive(runId)
            if (!cancelled) setPrescriptive(pr)
          } catch { if (!cancelled) setPrescriptive(null) }
          try {
            const pred = await getRunPredictive(runId)
            if (!cancelled) setPredictive(pred)
          } catch { if (!cancelled) setPredictive(null) }
          refreshHistory()
          if (justFinished && (prev !== null)) {
            // Transition from in-progress → done
            setMode('insights')
          } else if (justFinished && prev === null && wasActive === false) {
            // First poll on an already-completed run (opened from Library): do not force mode
          }
        }
        if (s.status === 'failed') {
          const failedNow = prev !== null && prev !== 'failed'
          setError(ERROR_COPY[s.error_code] || s.error_message || 'Failed')
          if (failedNow || (prev !== null && wasActive)) setMode('run')
        }
        prevRunStatus.current = s.status
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      }
    }
    tick()
    const id = setInterval(tick, 2500)
    return () => { cancelled = true; clearInterval(id) }
  }, [runId, authed, refreshHistory, minConf])

  const busy = !!(status && !['completed', 'failed', 'partial'].includes(status.status))
  const progressPct = useMemo(() => {
    if (!status) return 0
    const stages = ['queued', 'planning', 'collecting', 'classifying', 'analyzing', 'generating_report', 'completed']
    const i = stages.indexOf(status.stage_checkpoint || status.status)
    if (i < 0) return 0
    if (status.status === 'classifying' && status.target_records) {
      return Math.min(90, 30 + (status.classified_count / status.target_records) * 40)
    }
    return Math.round((i / (stages.length - 1)) * 100)
  }, [status])

  const onStart = async () => {
    if (!apiReady || busy) return
    setLoading(true)
    setError(null)
    setDataset(null)
    setAnalysis(null)
    setReport(null)
    setEvidenceFilter(null)
    setStatus({ status: 'queued', stage_checkpoint: 'queued', collected_count: 0, classified_count: 0, target_records: PRESET_META.find(p => p.id === preset)!.n })
    setMode('run')
    prevRunStatus.current = 'queued'
    try {
      const pf = await preflight()
      if (!pf.ok) {
        setError(pf.issues?.map((i: any) => i.message).join('; ') || 'Preflight failed')
        setMode('compose')
        return
      }
      const n = PRESET_META.find(p => p.id === preset)!.n
      const res = await startResearch(question, n, preset)
      setRunId(res.run_id)
      setBudget(res.budget || budget)
      showToast('Research queued')
      try { localStorage.setItem('atlas_v3_onboarded', '1'); setOnboarding(false) } catch { /* */ }
    } catch (e: any) {
      setError(e.message)
      setMode('compose')
    } finally {
      setLoading(false)
    }
  }

  const openRun = (id: string) => {
    setRunId(id)
    setStatus(null)
    setDataset(null)
    setAnalysis(null)
    setReport(null)
    setEvidenceFilter(null)
    // Land on Insights; status poll fills data. Active runs still show via Run nav.
    setMode('insights')
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
  }
  if (!authed) {
    return <Login onOk={(u, r) => { setUsername(u); setRole(r); setAuthed(true) }} />
  }

  const navBtn = (m: Mode) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition min-h-[44px] ${
        mode === m ? 'bg-atlas-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {MODES.find(x => x.id === m)?.label}
    </button>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 bg-white border-r border-slate-200 shrink-0">
        <div className="p-5 border-b border-slate-100">
          <div className="font-bold text-atlas-900 text-lg">Atlas V3</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Micro-drama research</div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {MODES.map(m => navBtn(m.id))}
        </nav>
        <div className="p-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${apiReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {apiReady ? 'API ready' : waking ? `Waking… ${wakeSecs}s` : 'API down'}
          </div>
          <div>{username} · {role}</div>
          <button type="button" className="text-atlas-700 hover:underline" onClick={() => { clearAuth(); setAuthed(false) }}>Log out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="md:hidden font-bold text-atlas-900">Atlas V3</div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setBudgetOpen(o => !o)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full min-h-[36px]"
            >
              {budget
                ? `Runs ${budget.runs_this_hour ?? '—'}/${budget.max_runs_per_hour ?? '—'} · YT ${budget.youtube?.youtube_remaining ?? '—'} left`
                : 'Budget'}
            </button>
            <span className={`text-xs px-2 py-1 rounded-full ${apiReady ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
              {apiReady ? 'Ready' : waking ? 'Waking' : 'Down'}
            </span>
          </div>
        </header>

        {budgetOpen && budget && (
          <div className="bg-slate-900 text-slate-100 text-xs px-4 py-3 flex flex-wrap gap-4">
            <span>Runs this hour: <strong>{budget.runs_this_hour}/{budget.max_runs_per_hour}</strong></span>
            <span>Active: <strong>{budget.active_runs}/{budget.max_concurrent_runs}</strong></span>
            {budget.youtube && (
              <span>YouTube units: <strong>{budget.youtube.youtube_units}/{budget.youtube.youtube_budget}</strong></span>
            )}
          </div>
        )}

        {waking && (
          <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 text-amber-950 text-sm p-4 rounded-xl" aria-live="polite">
            <div className="font-medium">Waking research engine…</div>
            <p className="text-amber-800/90 mt-1">Free Render may take 30–60 seconds. Start stays disabled until the API responds.</p>
            {history[0] && (
              <button type="button" className="mt-2 text-xs underline" onClick={() => openRun(history[0].run_id)}>
                Open last run while waiting
              </button>
            )}
          </div>
        )}

        {onboarding && apiReady && (
          <div className="mx-4 mt-4 bg-white border border-slate-200 rounded-xl p-4 text-sm shadow-sm">
            <div className="flex justify-between gap-2">
              <div className="font-semibold text-slate-900">Getting started</div>
              <button type="button" className="text-slate-400" onClick={() => { setOnboarding(false); try { localStorage.setItem('atlas_v3_onboarded', '1') } catch {} }}>Dismiss</button>
            </div>
            <ol className="mt-2 space-y-1 text-slate-600 list-decimal list-inside">
              <li className={apiReady ? 'text-emerald-700' : ''}>API awake {apiReady ? '✓' : ''}</li>
              <li className={authed ? 'text-emerald-700' : ''}>Signed in {authed ? '✓' : ''}</li>
              <li>Run a <button type="button" className="text-atlas-700 underline" onClick={() => { setPreset('quick'); setMode('compose') }}>Quick scan</button></li>
              <li>Results open on Insights when it finishes</li>
            </ol>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-100 text-red-900 text-sm p-4 rounded-xl flex flex-wrap gap-3 items-start justify-between">
            <div>
              <div className="font-medium">Something went wrong</div>
              <p className="mt-1">{error}</p>
            </div>
            <div className="flex gap-2">
              {runId && status?.resumable && (
                <button type="button" className="text-xs bg-white border px-3 py-1.5 rounded-lg" onClick={() => resumeRun(runId).then(() => { setError(null); setMode('run'); showToast('Resumed') })}>Resume</button>
              )}
              <button type="button" className="text-xs bg-white border px-3 py-1.5 rounded-lg" onClick={() => { setPreset('quick'); setMode('compose'); setError(null) }}>Use Quick</button>
              <button type="button" className="text-xs text-red-700" onClick={() => setError(null)}>Dismiss</button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto">
          {/* COMPOSE */}
          {mode === 'compose' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">New research</h2>
                <p className="text-sm text-slate-500 mt-1">One objective: YouTube micro-drama patterns, saturation, and whitespace.</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <label className="block text-sm font-medium text-slate-700">Research question</label>
                <textarea
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-atlas-600/20 focus:border-atlas-600 outline-none"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                />
                <div className="grid sm:grid-cols-3 gap-3">
                  {PRESET_META.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreset(p.id)}
                      className={`text-left p-4 rounded-xl border-2 transition min-h-[44px] ${
                        preset === p.id ? 'border-atlas-600 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{p.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{p.n} videos · {p.time}</div>
                      <div className="text-xs text-slate-500">{p.cost}</div>
                      <div className={`text-xs mt-2 ${p.warn ? 'text-amber-700 font-medium' : 'text-slate-400'}`}>{p.blurb}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onStart}
                  disabled={!apiReady || loading || busy}
                  className="w-full sm:w-auto bg-atlas-600 hover:bg-atlas-700 disabled:opacity-40 text-white font-medium px-6 py-3 rounded-xl transition min-h-[44px]"
                >
                  {loading ? 'Queuing…' : busy ? 'Run in progress…' : 'Start research'}
                </button>
              </div>
            </div>
          )}

          {/* RUN */}
          {mode === 'run' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Live run</h2>
                <p className="text-sm text-slate-500 mt-1" aria-live="polite">
                  {status ? STAGE_COPY[status.status] || status.status : 'Select a run from Library or start a new one.'}
                </p>
              </div>
              {!status && !runId ? (
                <EmptyState
                  title="No active run"
                  body="Compose a Quick scan to watch progress here."
                  action={<button type="button" className="bg-atlas-600 text-white px-4 py-2 rounded-lg text-sm" onClick={() => setMode('compose')}>Go to Compose</button>}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status?.status === 'completed' ? 'green' : status?.status === 'failed' ? 'red' : status?.status === 'partial' ? 'amber' : 'blue'}>
                      {status?.status || '…'}
                    </Badge>
                    {status?.error_code && <Badge tone="amber">{ERROR_COPY[status.error_code] ? status.error_code : status.error_code}</Badge>}
                    <span className="text-xs font-mono text-slate-400">{runId?.slice(0, 8)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-atlas-600 transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-xs text-slate-500">Collected</div><div className="text-lg font-semibold">{status?.collected_count ?? 0}</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-xs text-slate-500">Classified</div><div className="text-lg font-semibold">{status?.classified_count ?? 0}{status?.target_records ? <span className="text-xs text-slate-400 font-normal"> / {status.target_records}</span> : null}</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-xs text-slate-500">Cache hits</div><div className="text-lg font-semibold">{status?.cache?.classification_hits ?? 0}</div></div>
                    <div className="bg-slate-50 rounded-xl p-3"><div className="text-xs text-slate-500">Progress</div><div className="text-lg font-semibold">{progressPct}%</div></div>
                  </div>
                  {status?.status === 'partial' && (
                    <div className="bg-amber-50 text-amber-950 text-sm p-3 rounded-xl border border-amber-100">
                      Partial run — results are still usable. Insights shows what completed; Evidence has the rows.
                    </div>
                  )}
                  {(status?.status === 'failed' || status?.status === 'partial') && runId && (
                    <button type="button" className="text-sm underline text-slate-700" onClick={() => resumeRun(runId).then(() => showToast('Re-queued'))}>
                      Resume (keeps videos & classifications)
                    </button>
                  )}
                  {runId && status?.pagination?.can_next_batch && ['completed','partial','failed'].includes(status?.status) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="text-sm bg-atlas-600 text-white px-3 py-1.5 rounded-lg"
                        onClick={async () => {
                          try {
                            const r = await nextBatch(runId, 15)
                            showToast(r.message || 'Next batch queued')
                            setError(null)
                            setMode('run')
                          } catch (e: any) {
                            setError(e.message || String(e))
                          }
                        }}
                      >
                        Next batch (+15 videos)
                      </button>
                      <span className="text-xs text-slate-500">
                        Batch {status?.pagination?.batch_index ?? 1}
                        {status?.pagination?.more_pages_available ? ' · more pages available' : ' · will try next pages'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* INSIGHTS — hybrid: Frame → Decide → Prove → Act → Deeper */}
          {mode === 'insights' && (
            <div className="space-y-5">
              {(() => {
                const n = status?.collected_count ?? dataset?.record_count ?? 0
                const aRoot = analysis?.analysis || analysis || {}
                const takes = deriveTakeaways(analysis, report, n)
                const canNext = !!(runId && status?.pagination?.can_next_batch && ['completed', 'partial', 'failed'].includes(status?.status))
                const deliverMenu = runId ? (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 text-sm">
                    <button type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={async () => {
                      const r = await shareRun(runId)
                      const url = `${window.location.origin}${r.app_path}`
                      await navigator.clipboard?.writeText(url).catch(() => {})
                      setDeliverOpen(false)
                      showToast('Share link copied')
                    }}>Copy share link</button>
                    <button type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={() => {
                      if (dataset?.records) downloadRecordsCsv(dataset.records, `atlas_v3_${runId}.csv`)
                      setDeliverOpen(false)
                    }}>Download CSV</button>
                    <button type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={() => {
                      downloadJson({ report, analysis, status }, `atlas_v3_${runId}.json`)
                      setDeliverOpen(false)
                    }}>Download JSON</button>
                    <button type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50" onClick={async () => {
                      try {
                        const pkg = await getPackage(runId)
                        downloadJson(pkg, `atlas_package_${runId}.json`)
                      } catch (e: any) {
                        setError(e.message)
                      }
                      setDeliverOpen(false)
                    }}>Reproducibility package</button>
                  </div>
                ) : null

                if (!analysis && !report) {
                  return (
                    <EmptyState
                      title="No insights yet"
                      body="Complete a run to see takeaways, gaps, charts, and the research write-up."
                      action={<button type="button" className="bg-atlas-600 text-white px-4 py-2 rounded-xl text-sm" onClick={() => setMode('compose')}>Start Quick scan</button>}
                    />
                  )
                }

                return (
                  <>
                    <StickyResearchBar
                      question={status?.research_question || report?.title}
                      n={n}
                      classified={status?.classified_count ?? n}
                      onAsk={() => focusAsk('What are the main findings in this research sample?')}
                      onEvidence={() => setMode('evidence')}
                      onCompare={() => setMode('library')}
                    />
                    {/* 1. Frame */}
                    {status?.study_id && (
                      <p className="text-[11px] text-slate-500">
                        Research Study <span className="font-mono">{String(status.study_id).slice(0, 8)}</span>
                        {status.run_kind ? ` · ${status.run_kind}` : ''}
                        {claimsList.length ? ` · ${claimsList.length} claims` : ''}
                        {' · '}
                        <button type="button" className="underline text-slate-800" onClick={() => runId && rebuildClaims(runId).then(async () => {
                          const cl = await listRunClaims(runId)
                          setClaimsList(cl.claims || [])
                          showToast(`Rebuilt ${cl.claims?.length || 0} claims`)
                        }).catch((e: any) => setError(e.message))}>Refresh findings links</button>
                      </p>
                    )}
                    <InsightsHero
                      n={n}
                      classified={status?.classified_count ?? n}
                      runId={runId}
                      statusLabel={status?.status}
                      question={status?.research_question || report?.title}
                    />
                    {(() => {
                      const tropeGap = filterChartData(aRoot.trope_distribution || {})
                      const genreGap = filterChartData(aRoot.genre_distribution || {})
                      const gap = tropeGap.gapShare >= genreGap.gapShare ? tropeGap : genreGap
                      const gapKind = tropeGap.gapShare >= genreGap.gapShare ? 'trope' : 'genre'
                      const base = [
                        {
                          value: takes.crowded?.items?.[0]?.value || takes.crowded?.primary || '—',
                          label: takes.crowded?.items?.[0]?.label || '—',
                          sub: takes.crowded?.secondary || 'Dominant in this set',
                          tone: 'border-amber-100 bg-amber-50/40',
                          filter: takes.crowded?.items?.[0]?.filter || takes.crowded?.filter,
                          ask: `Why is ${takes.crowded?.items?.[0]?.label || 'this genre'} concentrated in this sample?`,
                        },
                        {
                          value: takes.open?.items?.[0]?.value || '0',
                          label: takes.open?.items?.[0]?.label || '—',
                          sub: 'Rare in this set',
                          tone: 'border-emerald-100 bg-emerald-50/40',
                          filter: takes.open?.items?.[0]?.filter || takes.open?.filter,
                          ask: `What does underrepresentation of ${takes.open?.items?.[0]?.label || 'this genre'} mean here?`,
                        },
                        {
                          value: (takes.emerging || takes.pattern)?.items?.[0]?.value
                            || (takes.emerging || takes.pattern)?.primary || '—',
                          label: (takes.emerging || takes.pattern)?.items?.[0]?.label || '—',
                          sub: (takes.emerging || takes.pattern)?.secondary || 'Common story pattern',
                          tone: 'border-slate-200',
                          filter: (takes.emerging || takes.pattern)?.items?.[0]?.filter
                            || (takes.emerging || takes.pattern)?.filter,
                          ask: `Why is ${(takes.emerging || takes.pattern)?.items?.[0]?.label || 'this trope'} common in this sample?`,
                        },
                      ]
                      if (gap.gapShare >= 0.25 && gap.dropped > 0) {
                        const pct = Math.round(gap.gapShare * 100)
                        base.push({
                          value: `${pct}%`,
                          label: 'Untagged videos',
                          sub: `${gap.dropped} of ${gap.total} need a clearer ${gapKind} tag`,
                          tone: 'border-amber-200/80 bg-amber-50/50',
                          filter: undefined as any,
                          ask: `About ${pct}% of videos lack a clear ${gapKind} tag. What does that mean and what should I do next?`,
                        })
                      }
                      return (
                        <KeySignals
                          onSelect={openLineage}
                          onAsk={focusAsk}
                          items={base}
                        />
                      )
                    })()}

                    {/* 2. Decide */}
                    
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2">Prove</div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                          {(() => {
                            const { data: genres, dropped, total, gaps } = filterChartData(aRoot.genre_distribution || {})
                            return (
                              <>
                                <BarChart data={genres} title="Genre distribution" />
                                <ClassificationGapNote dropped={dropped} total={total || 0} gaps={gaps} kind="genre" />
                              </>
                            )
                          })()}
                          <p className="text-[11px] text-slate-400 mt-3">Distribution across tagged videos.</p>
                        </div>
                        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                          {(() => {
                            const { data: tropes, dropped, total, gaps } = filterChartData(aRoot.trope_distribution || {})
                            return (
                              <>
                                <BarChart data={tropes} title="Top tropes" />
                                <ClassificationGapNote dropped={dropped} total={total || 0} gaps={gaps} kind="trope" />
                                <p className="text-[11px] text-slate-400 mt-2">Untagged videos are excluded from ranking. Open Evidence to inspect rows.</p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* 4. Act — always visible */}
                    
                    {/* Analyze workspace — one pane at a time */}
                    {analyzeLayers && (
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 pt-3 pb-2 border-b border-slate-100">
                          <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2">Analyze</div>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              ['overview', 'Overview'],
                              ['patterns', 'Patterns'],
                              ['performance', 'Performance'],
                              ['diagnostic', 'Data health'],
                              ['outliers', 'Exceptions'],
                              ['explore', 'Explore'],
                              ['proximity', 'Topic groupings'],
                              ['potential', 'Sparse areas'],
                            ] as const).map(([id, label]) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setAnalyzeTab(id)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                                  analyzeTab === id
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 space-y-3 min-h-[140px]">
                          {analyzeTab === 'overview' && (
                            <div className="grid md:grid-cols-2 gap-8 pt-1">
                              <div>
                                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Channels in this set</div>
                                {(() => {
                                  const raw = (analyzeLayers.profile?.channels || []) as any[]
                                  const channels = raw.filter((c) => {
                                    const name = String(c.channel || c.name || '').trim().toLowerCase()
                                    return name && name !== 'unknown' && name !== 'n/a' && name !== 'null'
                                  })
                                  const nVid = status?.collected_count || status?.classified_count || 0
                                  if (!channels.length) {
                                    return (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-base font-medium text-slate-500 italic">Channel mix not summarized</span>
                                        {nVid > 0 && (
                                          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                                            {nVid} videos
                                          </span>
                                        )}
                                      </div>
                                    )
                                  }
                                  return (
                                    <ul className="text-sm space-y-1.5">
                                      {channels.slice(0, 6).map((c: any) => (
                                        <li key={c.channel || c.name} className="flex justify-between gap-2">
                                          <span className="truncate text-slate-700">{c.channel || c.name}</span>
                                          <span className="tabular-nums font-semibold text-slate-900">{c.videos ?? c.count}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                })()}
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">Current view</div>
                                <dl className="flex flex-wrap items-baseline gap-10">
                                  <div>
                                    <dt className="text-sm font-medium text-slate-500 mb-0.5">Mean views</dt>
                                    <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">
                                      {formatViews(analyzeLayers.performance?.summary?.mean_views)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-sm font-medium text-slate-500 mb-0.5">Median</dt>
                                    <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">
                                      {formatViews(analyzeLayers.performance?.summary?.median_views)}
                                    </dd>
                                  </div>
                                </dl>
                              </div>
                            </div>
                          )}
                          {analyzeTab === 'performance' && (
                            <dl className="grid grid-cols-2 md:grid-cols-3 gap-6">
                              <div>
                                <dt className="text-sm font-medium text-slate-500 mb-1">Average</dt>
                                <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{formatViews(analyzeLayers.performance?.summary?.mean_views)}</dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500 mb-1">Median</dt>
                                <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{formatViews(analyzeLayers.performance?.summary?.median_views)}</dd>
                              </div>
                              <div>
                                <dt className="text-sm font-medium text-slate-500 mb-1">Maximum</dt>
                                <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{formatViews(analyzeLayers.performance?.summary?.max_views)}</dd>
                              </div>
                              {Number(analyzeLayers.performance?.summary?.mean_engagement_proxy) > 0 && (
                                <div>
                                  <dt className="text-sm font-medium text-slate-500 mb-1">Engagement proxy</dt>
                                  <dd className="text-2xl font-extrabold tracking-tight tabular-nums text-slate-900">{Number(analyzeLayers.performance?.summary?.mean_engagement_proxy).toLocaleString()}</dd>
                                </div>
                              )}
                            </dl>
                          )}
                          {analyzeTab === 'patterns' && (
                            <div className="space-y-3">
                              {(analyzeLayers.patterns?.genre_trope || analyzeLayers.patterns?.top_pairs || []).length ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-[11px] uppercase text-slate-400">
                                        <th className="pb-2 font-semibold">Pattern</th>
                                        <th className="pb-2 font-semibold text-right">Videos</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(analyzeLayers.patterns?.genre_trope || analyzeLayers.patterns?.top_pairs || []).slice(0, 12).map((p: any, i: number) => {
                                        const label = p.label || [p.genre, p.trope].filter(Boolean).join(' × ') || 'Pattern'
                                        const count = p.count ?? p.n ?? p.videos ?? 0
                                        return (
                                          <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80 cursor-pointer" onClick={() => setInspectItem({ label, count, raw: p })}>
                                            <td className="py-2 text-slate-800 font-medium">{label}</td>
                                            <td className="py-2 text-right tabular-nums font-semibold">{count}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <AnalyzeEmpty title="No clear pattern pairs yet" body="Genre and story-pattern combinations will list here once labels are rich enough in this set." actionLabel="Open Evidence" onAction={() => setMode('evidence')} />
                              )}
                              {inspectItem && (
                                <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                                  <div className="text-xs font-semibold text-slate-500 uppercase">Selected</div>
                                  <div className="text-sm font-extrabold text-slate-900 mt-1">{inspectItem.label}</div>
                                  <div className="text-2xl font-semibold tabular-nums mt-1">{inspectItem.count} <span className="text-sm font-normal text-slate-500">videos</span></div>
                                  <FindingActions
                                    onWhy={() => focusAsk(`Why does the pattern ${inspectItem.label} appear in this set of videos?`)}
                                    onEvidence={() => {
                                      const trope = String(inspectItem.raw?.trope || inspectItem.label || '').split('×').pop()?.trim()
                                      if (trope) openLineage({ kind: 'trope', key: trope.replace(/ /g, '_'), count: inspectItem.count, total: status?.collected_count || 0 })
                                      else setMode('evidence')
                                    }}
                                    onAsk={() => focusAsk(`What should I investigate next about ${inspectItem.label}?`)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {analyzeTab === 'diagnostic' && (
                            <div className="grid sm:grid-cols-2 gap-4">
                              {(() => {
                                const flags = analyzeLayers.diagnostic?.flags || []
                                const cards: { tone: 'amber' | 'slate'; title: string; body: string }[] = []
                                for (const f of flags) {
                                  const code = String(f.code || '').toLowerCase()
                                  let msg = String(f.message || '')
                                  if (code.includes('concentrat') || /concentrat|dominat|% of labeled/i.test(msg)) {
                                    msg = msg.replace(/Top genre ['"]([^'"]+)['"] is (\d+)% of labeled rows[^.—–-]*/i, (_, g, p) => {
                                      const name = String(g).replace(/_/g, ' ')
                                      return `${name.charAt(0).toUpperCase()}${name.slice(1)} makes up about ${p}% of labeled videos in this set`
                                    }).replace(/high concentration in this pull\.?/i, 'That is a high share for one genre here.')
                                    cards.push({ tone: 'amber', title: 'High concentration', body: msg })
                                  } else if (code.includes('under') || /underrepresentation/i.test(msg)) {
                                    const n = msg.match(/(\d+)/)?.[1] || 'some'
                                    cards.push({ tone: 'slate', title: 'Sparse themes', body: `We found ${n} theme(s) that barely appear in this set — rare here, not proof of opportunity.` })
                                  } else {
                                    cards.push({ tone: 'slate', title: String(f.code || 'Note').replace(/_/g, ' '), body: msg })
                                  }
                                }
                                if (!cards.length) {
                                  return <AnalyzeEmpty title="No data-health flags" body="Nothing concerning showed up in concentration or sparse-theme checks for this set." />
                                }
                                return cards.map((c, i) => <HealthCard key={i} tone={c.tone} title={c.title} body={c.body} />)
                              })()}
                            </div>
                          )}
                          {analyzeTab === 'outliers' && (
                            <div>
                              {(Array.isArray(analyzeLayers.outliers?.items) ? analyzeLayers.outliers.items : Array.isArray(analyzeLayers.outliers) ? analyzeLayers.outliers : []).length ? (
                                <div className="grid sm:grid-cols-2 gap-3">
                                  {(Array.isArray(analyzeLayers.outliers?.items) ? analyzeLayers.outliers.items : Array.isArray(analyzeLayers.outliers) ? analyzeLayers.outliers : []).slice(0, 6).map((o: any, i: number) => (
                                    <BreakoutCard
                                      key={i}
                                      title={o.title || o.label || 'Exception'}
                                      views={o.views}
                                      multiple={o.multiple || o.x_median}
                                      tags={[o.genre, o.trope].filter(Boolean).join(' · ')}
                                      onInvestigate={() => focusAsk(`Why is this video an exception: ${o.title || o.label}?`)}
                                      onEvidence={() => {
                                        if (o.genre) openLineage({ kind: 'genre', key: String(o.genre).replace(/ /g, '_'), count: 1, total: status?.collected_count || 1 })
                                        else setMode('evidence')
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <AnalyzeEmpty title="No standout exceptions" body="Nothing in this set was flagged as an unusual outlier versus the rest of the videos." actionLabel="Open Evidence" onAction={() => setMode('evidence')} />
                              )}
                            </div>
                          )}
                          {analyzeTab === 'explore' && (
                            <div className="space-y-2 text-sm">
                              {(analyzeLayers.exploratory?.buckets || analyzeLayers.exploratory?.bins || []).length ? (
                                (analyzeLayers.exploratory?.buckets || analyzeLayers.exploratory?.bins || []).map((b: any, i: number) => (
                                  <div key={i} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                                    <span className="text-slate-700 font-medium">{b.label || b.range}</span>
                                    <span className="font-semibold tabular-nums text-slate-900">{b.count ?? b.n}</span>
                                  </div>
                                ))
                              ) : (
                                <AnalyzeEmpty title="Nothing more to explore yet" body="Add more videos (Next batch) if you want deeper groupings beyond the main patterns." actionLabel="Back to Overview" onAction={() => setAnalyzeTab('overview')} />
                              )}
                            </div>
                          )}
                          {analyzeTab === 'proximity' && (
                            <div className="space-y-3">
                              <p className="text-[11px] text-slate-500 font-medium">Matched by topic and title · this set only</p>
                              {(analyzeLayers.proximity?.top_pairs || analyzeLayers.proximity?.pairs || analyzeLayers.proximity?.items || []).length ? (
                                <ProximityStrip pairs={analyzeLayers.proximity?.top_pairs || analyzeLayers.proximity?.pairs || analyzeLayers.proximity?.items || []} />
                              ) : (
                                <AnalyzeEmpty title="No topic matches yet" body="Similar videos will show here when we can match titles and topics in this set." actionLabel="Open Evidence" onAction={() => setMode('evidence')} />
                              )}
                            </div>
                          )}
                          {analyzeTab === 'potential' && (
                            <PotentialMatrix
                              signals={
                                analyzeLayers.potential?.potentials
                                || analyzeLayers.potential?.signals
                                || analyzeLayers.potential?.items
                                || []
                              }
                            />
                          )}
                        </div>
                      </div>
                    )}

{/* Phase 6 Prescriptive */}
                    {prescriptive && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Recommended actions</div>
                          <span className="text-[11px] text-slate-500">{prescriptive.status}</span>
                        </div>
                        <p className="text-xs text-slate-500">{prescriptive.note || prescriptive.message}</p>
                        <div className="space-y-3">
                          {(prescriptive.recommendations || []).map((r: any) => (
                            <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
                                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{String(r.priority || '').toLowerCase() === 'high' ? 'High priority' : String(r.priority || '').toLowerCase() === 'medium' ? 'Medium priority' : String(r.priority || '').toLowerCase() === 'low' ? 'Low priority' : r.priority}</span>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{r.action}</p>
                              <div className="flex flex-wrap gap-2">
                                {(r.claim_ids || []).slice(0, 6).map((cid: string) => (
                                  <button
                                    key={cid}
                                    type="button"
                                    className="text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50"
                                    onClick={async () => {
                                      try {
                                        const detail = await getClaim(cid)
                                        setActiveClaim(detail)
                                        setEvidenceFilter(null)
                                        setMode('evidence')
                                        showToast('Opened the evidence behind this recommendation')
                                      } catch (e: any) {
                                        setError(e.message)
                                      }
                                    }}
                                  >
                                    View evidence
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {!prescriptive.recommendations?.length && (
                            <p className="text-sm text-slate-500">No prescriptions yet — rebuild claims first.</p>
                          )}
                        </div>
                      </div>
                    )}


{/* Phase 7 Predictive */}
                    {predictive && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Trends</div>
                          <span className="text-[11px] font-medium text-slate-800">{predictive.status}</span>
                        </div>
                        <p className="text-sm text-slate-700">{predictive.message}</p>
                        {predictive.status === 'insufficient_data' && (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            More data needed for trends. We need about {predictive.min_required} complete batches on this study (you have {predictive.observation_count}). Run Next batch, then check back here.
                          </div>
                        )}
                        {predictive.status === 'ok' && (
                          <div className="space-y-3">
                            {(predictive.forecasts || []).map((f: any, i: number) => (
                              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                                <div className="text-xs font-semibold text-slate-500 uppercase">{f.metric} · confidence {f.confidence}</div>
                                <p className="text-sm text-slate-800 leading-relaxed">{f.claim || f.statement}</p>
                                {f.illustrative_next_share != null && (
                                  <p className="text-xs font-mono text-slate-600">
                                    {f.genre}: {(f.first_share * 100).toFixed(0)}% → {(f.last_share * 100).toFixed(0)}%
                                    → illus. next {(f.illustrative_next_share * 100).toFixed(0)}%
                                  </p>
                                )}
                              </div>
                            ))}
                            {predictive.disclaimer && (
                              <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">{predictive.disclaimer}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <InsightsActionBar
                      canNext={canNext}
                      onNext={async () => {
                        try {
                          const r = await nextBatch(runId!, 15)
                          showToast(r.message || 'Next batch queued')
                          setError(null)
                          setMode('run')
                        } catch (e: any) {
                          setError(e.message || String(e))
                        }
                      }}
                      onEvidence={() => setMode('evidence')}
                      deliverOpen={deliverOpen}
                      setDeliverOpen={setDeliverOpen}
                      deliverMenu={deliverMenu}
                    />
                    {history.length >= 2 && (
                      <button
                        type="button"
                        className="text-xs text-atlas-700 font-medium"
                        onClick={() => setMode('library')}
                      >
                        Compare runs in Library →
                      </button>
                    )}

                    {/* 5. Go deeper — structured pairings, then summary */}
                    {report?.storytelling_pattern_analysis && (
                      <StoryPatternCallout
                        prose={report.storytelling_pattern_analysis}
                        analysis={analysis}
                      />
                    )}
                    {report?.executive_summary && (
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Executive summary</div>
                        <p className="text-[15px] text-slate-800 leading-relaxed">{cleanReportProse(report.executive_summary)}</p>
                      </div>
                    )}
                    {report && (
                      <ReportAccordion open={reportOpen} onToggle={() => setReportOpen(o => !o)} report={report} analysis={analysis} />
                    )}

                    <p className="text-[11px] text-slate-400 leading-relaxed px-1">
                      Sourced via YouTube · automated story labels · calculated stats. Figures describe this set of videos.
                      Limitations: sample size {n || '—'}; figures describe this pull, not the entire platform.
                    </p>
                  </>
                )
              })()}
            </div>
          )}

          {/* EVIDENCE */}
          {mode === 'evidence' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between gap-3 items-end">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Evidence</h2>
                  <p className="text-sm text-slate-500 mt-1">Videos, labels, sources, and the calculation behind each claim.</p>
                </div>
                {dataset && (
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <label className="flex items-center gap-1 text-slate-600">
                      Min confidence
                      <input type="number" min={0} max={1} step={0.1} value={minConf} onChange={e => setMinConf(Number(e.target.value))} className="w-14 border rounded-lg px-1 py-1" />
                    </label>
                    <button type="button" className="border rounded-lg px-2 py-1" onClick={() => runId && getDataset(runId, minConf).then(setDataset)}>Apply</button>
                    <button type="button" className="border rounded-lg px-2 py-1" onClick={() => dataset.records && downloadRecordsCsv(dataset.records, `atlas_v3_${runId}.csv`)}>CSV</button>
                    {runId && (
                      <button type="button" className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-2 py-1"
                        onClick={() => reclassifyLow(runId).then(r => { showToast(`Reclassified ${r.reclassified}`); getDataset(runId, minConf).then(setDataset) })}>
                        Reclassify low conf.
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!dataset ? (
                <EmptyState title="No dataset loaded" body="Finish a run or open one from Library." />
              ) : (
                <>
                  {(evidenceFilter || activeClaim) && (
                    <div className="rounded-2xl border border-atlas-200 bg-atlas-50/50 p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider font-semibold text-atlas-700">Proof · Why this conclusion</div>
                          {activeClaim ? (
                            <>
                              <div className="text-sm font-semibold text-slate-900 mt-0.5">{activeClaim.statement}</div>
                              <div className="text-xs text-slate-600 mt-1 font-mono">{activeClaim.formula}</div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Claim · n={activeClaim.n_sample} · type={activeClaim.claim_type}
                                {activeClaim.methodology_id ? ` · methodology ${String(activeClaim.methodology_id).slice(0, 8)}` : ''}
                              </div>
                            </>
                          ) : evidenceFilter ? (
                            <>
                              <div className="text-sm font-semibold text-slate-900 mt-0.5 capitalize">
                                {evidenceFilter.kind}: {evidenceFilter.key.replace(/_/g, ' ')}
                              </div>
                              <div className="text-xs text-slate-600 mt-1 font-mono">
                                {evidenceFilter.kind === 'genre'
                                  ? `count(genre = ${evidenceFilter.key}) / n = ${evidenceFilter.count} / ${evidenceFilter.total}`
                                  : `count(trope = ${evidenceFilter.key}) / n = ${evidenceFilter.count} / ${evidenceFilter.total}`}
                                {' = '}
                                {evidenceFilter.total
                                  ? `${Math.round((evidenceFilter.count / evidenceFilter.total) * 100)}%`
                                  : '—'}
                              </div>
                            </>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-xs border border-slate-200 bg-white rounded-lg px-2.5 py-1.5"
                          onClick={() => { setEvidenceFilter(null); setActiveClaim(null) }}
                        >
                          Clear filter
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Evidence rows support this claim. Empty sets are valid proof for underrepresentation signals.
                      </p>
                    </div>
                  )}
                  {(() => {
                    const rows = (dataset.records || []).filter((r: any) => matchesLineage(r, evidenceFilter))
                    const shown = rows.length
                    return (
                      <p className="text-xs text-slate-500">
                        {evidenceFilter
                          ? `${shown} matching row${shown === 1 ? '' : 's'} (of ${dataset.record_count})`
                          : `${dataset.record_count} rows`}
                        {dataset.filtered_low_confidence ? ` · ${dataset.filtered_low_confidence} hidden by confidence filter` : ''}
                      </p>
                    )
                  })()}
                  {/* Mobile cards */}
                  {(dataset.records || []).filter((r: any) => matchesLineage(r, evidenceFilter)).length === 0 && evidenceFilter && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                      No videos match this claim in the sample
                      <span className="block text-xs text-slate-400 mt-1 capitalize">
                        {evidenceFilter.kind} = {evidenceFilter.key.replace(/_/g, ' ')} · count {evidenceFilter.count}
                      </span>
                    </div>
                  )}
                  <div className="md:hidden space-y-2">
                    {(dataset.records || []).filter((r: any) => matchesLineage(r, evidenceFilter)).slice(0, 50).map((r: any) => (
                      <button key={r.id} type="button" onClick={() => setDrawerRow(r)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                        <div className="font-medium text-sm line-clamp-2">{r.title}</div>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <GenreChip genre={r.genre} />
                          <ConfidenceBar value={r.confidence} />
                        </div>
                      </button>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-auto max-h-[28rem]">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr className="text-left text-xs text-slate-500">
                            <th className="p-3 font-medium">Title</th>
                            <th className="p-3 font-medium">Genre</th>
                            <th className="p-3 font-medium">Trope</th>
                            <th className="p-3 font-medium">Confidence</th>
                            <th className="p-3 font-medium text-right">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dataset.records || []).filter((r: any) => matchesLineage(r, evidenceFilter)).slice(0, 50).map((r: any) => (
                            <tr key={r.id} className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${r.confidence != null && r.confidence < 0.5 ? 'bg-amber-50/40' : ''}`} onClick={() => setDrawerRow(r)}>
                              <td className="p-3 max-w-xs truncate">{r.title}</td>
                              <td className="p-3"><GenreChip genre={r.genre} /></td>
                              <td className="p-3 text-slate-600">{r.trope || '—'}</td>
                              <td className="p-3"><ConfidenceBar value={r.confidence} /></td>
                              <td className="p-3 text-right font-mono text-xs">{Number(r.views || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* LIBRARY */}
          {mode === 'library' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Library</h2>
                <p className="text-sm text-slate-500 mt-1">Past runs — open, compare, or ask research memory.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Ask Atlas</div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Metrics, claims/proof, methodology, memory, or run-to-run — routed automatically.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs border rounded-lg px-2.5 py-1.5"
                      onClick={async () => {
                        try {
                          const s = await memoryStats()
                          showToast(`${s.chunks} chunks · ${s.embedded} embedded`)
                        } catch (e: any) {
                          setError(e.message)
                        }
                      }}
                    >
                      Memory stats
                    </button>
                    <button
                      type="button"
                      className="text-xs border rounded-lg px-2.5 py-1.5"
                      onClick={async () => {
                        try {
                          if (!status?.study_id) { showToast('Open a run with a study first'); return }
                          const r = await getStudyRunToRun(status.study_id)
                          setMemoryAns(r)
                          setMemoryQ('run-to-run')
                        } catch (e: any) {
                          setError(e.message)
                        }
                      }}
                    >
                      Run-to-run
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                    placeholder="e.g. Compare runs · Romance % · methodology · mystery signal"
                    id="ask-atlas" value={memoryQ}
                    onChange={e => setMemoryQ(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && memoryQ.trim() && !memoryBusy) {
                        setMemoryBusy(true)
                        try {
                          setMemoryAns(await askAtlas(memoryQ.trim(), { runId: runId || undefined, studyId: status?.study_id || undefined }))
                        } catch (err: any) {
                          setError(err.message)
                        } finally {
                          setMemoryBusy(false)
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={memoryBusy || !memoryQ.trim()}
                    className="bg-atlas-600 text-white text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                    onClick={async () => {
                      setMemoryBusy(true)
                      try {
                        setMemoryAns(await askAtlas(memoryQ.trim(), { runId: runId || undefined, studyId: status?.study_id || undefined }))
                      } catch (err: any) {
                        setError(err.message)
                      } finally {
                        setMemoryBusy(false)
                      }
                    }}
                  >
                    {memoryBusy ? 'Asking…' : 'Ask'}
                  </button>
                </div>
                {memoryAns && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <Badge tone="blue">{memoryAns.intent || 'memory'}</Badge>
                      {memoryAns.numbers_from && <Badge>numbers: {memoryAns.numbers_from}</Badge>}
                      {memoryAns.hit_count != null && <Badge>{memoryAns.hit_count} hits</Badge>}
                    </div>
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{memoryAns.answer}</pre>
                    {(memoryAns.citations || []).length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Citations</div>
                        <ul className="space-y-1">
                          {memoryAns.citations.map((c: any, i: number) => (
                            <li key={i}>
                              <button
                                type="button"
                                className="text-xs text-atlas-700 hover:underline"
                                onClick={() => openRun(c.run_id)}
                              >
                                {c.source_type} · run {String(c.run_id).slice(0, 8)} · n={c.n_sample}
                                {c.claim_key ? ` · ${c.claim_key}` : ''}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Phase 5 — Pulse / Refresh / Monitor */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Continuous intelligence</div>
                    <p className="text-xs text-slate-500 mt-0.5">Pulse · Refresh · Monitor — honest when history is thin</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="text-xs border rounded-lg px-2.5 py-1.5" onClick={async () => {
                      if (!status?.study_id) { showToast('Open a run in this study first'); return }
                      try { setPulseData(await getStudyPulse(status.study_id)) } catch (e: any) { setError(e.message) }
                    }}>Pulse</button>
                    <button type="button" className="text-xs border rounded-lg px-2.5 py-1.5 bg-atlas-600 text-white" onClick={async () => {
                      if (!status?.study_id) { showToast('Open a run in this study first'); return }
                      try {
                        const r = await refreshStudy(status.study_id)
                        showToast(r.message || 'Refresh queued')
                        if (r.run_id) { setRunId(r.run_id); setMode('run') }
                      } catch (e: any) { setError(e.message) }
                    }}>Refresh</button>
                    <button type="button" className="text-xs border rounded-lg px-2.5 py-1.5" onClick={async () => {
                      if (!status?.study_id) { showToast('Open a run in this study first'); return }
                      try { setMonitorData(await getStudyMonitor(status.study_id)) } catch (e: any) { setError(e.message) }
                    }}>Monitor</button>
                    <button type="button" className="text-xs border rounded-lg px-2.5 py-1.5" onClick={async () => {
                      if (!status?.study_id) { showToast('Open a run in this study first'); return }
                      try {
                        setPredictive(await getStudyPredictive(status.study_id))
                        setMode('insights')
                        showToast('Predictive loaded on Insights')
                      } catch (e: any) { setError(e.message) }
                    }}>Predictive</button>
                  </div>
                </div>
                {pulseData && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-2">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Pulse · {pulseData.status}</div>
                    <p className="text-slate-800">{pulseData.message}</p>
                    {pulseData.status === 'ok' && (pulseData.series || []).length > 0 && (
                      <ul className="text-xs space-y-1">
                        {pulseData.series.map((s: any) => (
                          <li key={s.run_id} className="flex justify-between gap-2">
                            <span className="font-mono">{String(s.run_id).slice(0, 8)} · {s.run_kind}</span>
                            <span>n={s.n} · {s.top_genre} {(s.top_genre_share * 100).toFixed(0)}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {pulseData.note && <p className="text-[11px] text-slate-500">{pulseData.note}</p>}
                  </div>
                )}
                {monitorData && (
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Monitor</div>
                    <p className="text-slate-800">{monitorData.message}</p>
                    <p className="text-xs text-slate-600">
                      refresh={String(monitorData.capability?.refresh)} · pulse={String(monitorData.capability?.pulse)} · continuous={String(monitorData.capability?.continuous)}
                    </p>
                  </div>
                )}
              </div>

              {history.length === 0 ? (
                <EmptyState
                  title="No runs yet"
                  body="Your first Quick scan will show up here."
                  action={<button type="button" className="bg-atlas-600 text-white px-4 py-2 rounded-lg text-sm" onClick={() => setMode('compose')}>Compose research</button>}
                />
              ) : (
                <div className="grid gap-3">
                  {history.map(r => (
                    <div key={r.run_id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-3 justify-between items-center">
                      <button type="button" className="text-left flex-1 min-w-0" onClick={() => openRun(r.run_id)}>
                        <div className="font-medium text-slate-900 truncate">{r.research_question}</div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                          <Badge tone={r.status === 'completed' ? 'green' : r.status === 'failed' ? 'red' : r.status === 'partial' ? 'amber' : 'blue'}>{r.status}</Badge>
                          <span>{r.collected_count} videos</span>
                          {r.error_code && <span>{r.error_code}</span>}
                        </div>
                      </button>
                      <div className="flex gap-2 text-xs">
                        <button type="button" className="border rounded-lg px-3 py-1.5 min-h-[36px]" onClick={() => openRun(r.run_id)}>Open</button>
                        <button type="button" className="border rounded-lg px-3 py-1.5 min-h-[36px]" onClick={async () => {
                          try {
                            const res = await indexMemory(r.run_id)
                            showToast(`Indexed ${res.indexed} chunks (${res.embedded} embedded)`)
                          } catch (e: any) {
                            setError(e.message)
                          }
                        }}>Index memory</button>
                        <button type="button" className="border rounded-lg px-3 py-1.5 min-h-[36px]" onClick={() => { setCompareA(r.run_id); showToast('Set as Compare A') }}>Compare A</button>
                        <button type="button" className="border rounded-lg px-3 py-1.5 min-h-[36px]" onClick={() => { setCompareB(r.run_id); showToast('Set as Compare B') }}>Compare B</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold">Compare two runs</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <select className="border rounded-lg text-xs px-2 py-2" value={compareA} onChange={e => setCompareA(e.target.value)}>
                    <option value="">Run A</option>
                    {history.map(h => <option key={h.run_id} value={h.run_id}>{h.run_id.slice(0, 8)} · {h.status}</option>)}
                  </select>
                  <select className="border rounded-lg text-xs px-2 py-2" value={compareB} onChange={e => setCompareB(e.target.value)}>
                    <option value="">Run B</option>
                    {history.map(h => <option key={h.run_id} value={h.run_id}>{h.run_id.slice(0, 8)} · {h.status}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!compareA || !compareB}
                    className="bg-atlas-600 text-white text-xs px-3 py-2 rounded-lg disabled:opacity-40"
                    onClick={() => compareRuns(compareA, compareB).then(setCompareResult).catch(e => setError(e.message))}
                  >
                    Compare genres
                  </button>
                </div>
                {compareResult && (
                  <table className="min-w-full text-xs mt-2">
                    <thead><tr className="text-left text-slate-500"><th className="p-2">Genre</th><th className="p-2">A</th><th className="p-2">B</th><th className="p-2">Δ</th></tr></thead>
                    <tbody>
                      {Object.entries(compareResult.genre_delta || {}).map(([g, v]: any) => (
                        <tr key={g} className="border-t">
                          <td className="p-2 capitalize">{g}</td>
                          <td className="p-2">{v.a}</td>
                          <td className="p-2">{v.b}</td>
                          <td className={`p-2 font-mono ${v.delta > 0 ? 'text-emerald-700' : v.delta < 0 ? 'text-red-700' : ''}`}>{v.delta > 0 ? '+' : ''}{v.delta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-30 safe-pb">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`flex-1 py-3 text-[11px] font-medium min-h-[52px] ${mode === m.id ? 'text-atlas-700' : 'text-slate-500'}`}
          >
            {m.short}
          </button>
        ))}
      </nav>

      <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} row={drawerRow} />
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}
