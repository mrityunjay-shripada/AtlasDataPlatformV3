import type { ReactNode } from 'react'

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-3">
      <span className="flex-1 leading-snug">{message}</span>
      <button type="button" className="text-slate-400 hover:text-white text-lg leading-none" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}


export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-100',
    red: 'bg-red-50 text-red-800 ring-1 ring-red-100',
    blue: 'bg-blue-50 text-blue-800 ring-1 ring-blue-100',
  }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${map[tone] || map.slate}`}>
      {children}
    </span>
  )
}

export function GenreChip({ genre }: { genre?: string }) {
  const colors: Record<string, string> = {
    romance: 'bg-pink-100 text-pink-800',
    thriller: 'bg-violet-100 text-violet-800',
    family: 'bg-sky-100 text-sky-800',
    revenge: 'bg-orange-100 text-orange-900',
    comedy: 'bg-yellow-100 text-yellow-900',
    tragedy: 'bg-slate-200 text-slate-800',
    mystery: 'bg-indigo-100 text-indigo-800',
    slice_of_life: 'bg-teal-100 text-teal-800',
    supernatural: 'bg-purple-100 text-purple-800',
  }
  const g = genre || 'other'
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${colors[g] || 'bg-slate-100 text-slate-700'}`}>
      {g.replace(/_/g, ' ')}
    </span>
  )
}

export function ConfidenceBar({ value }: { value?: number }) {
  if (value == null) return <span className="text-slate-400">—</span>
  const pct = Math.round(value * 100)
  const tone = value < 0.5 ? 'bg-amber-500' : value < 0.75 ? 'bg-blue-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${tone} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-600 w-8">{pct}%</span>
    </div>
  )
}

const BAR_TONES = [
  'from-blue-600 to-indigo-500',
  'from-violet-600 to-purple-500',
  'from-pink-500 to-rose-400',
  'from-amber-500 to-orange-400',
  'from-emerald-600 to-teal-500',
  'from-sky-500 to-cyan-400',
  'from-fuchsia-500 to-pink-400',
  'from-slate-500 to-slate-400',
]

export function BarChart({ data, title }: { data: Record<string, number>; title: string }) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const rest = Object.entries(data || {}).sort((a, b) => b[1] - a[1]).slice(8)
  const other = rest.reduce((s, [, v]) => s + v, 0)
  const rows = other ? [...entries, ['other', other] as [string, number]] : entries
  const max = Math.max(...rows.map(([, v]) => v), 1)
  const total = Object.values(data || {}).reduce((a, b) => a + b, 0) || 1
  if (!rows.length) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h4>
        <span className="text-[11px] text-slate-400 font-medium">{total} labeled</span>
      </div>
      <div className="space-y-2.5">
        {rows.map(([k, v], i) => {
          const pct = Math.round((v / total) * 100)
          return (
            <div key={k} className="group">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-slate-700 capitalize truncate" title={k}>
                  {String(k).replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] tabular-nums text-slate-500 shrink-0">
                  <span className="font-semibold text-slate-800">{v}</span>
                  <span className="text-slate-400"> · {pct}%</span>
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${BAR_TONES[i % BAR_TONES.length]} transition-all duration-700 ease-out`}
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6 rounded-3xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-atlas-600 to-indigo-600 text-white flex items-center justify-center text-xl mb-4 shadow-md shadow-blue-500/20">
        ◈
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

const REPORT_META: Record<string, { label: string; accent: string; icon: string }> = {
  dataset_overview: { label: 'Dataset overview', accent: 'border-l-blue-500', icon: '▣' },
  genre_analysis: { label: 'Genre analysis', accent: 'border-l-violet-500', icon: '◈' },
  storytelling_pattern_analysis: { label: 'Storytelling patterns', accent: 'border-l-pink-500', icon: '◇' },
  engagement_analysis: { label: 'Engagement', accent: 'border-l-amber-500', icon: '▲' },
  genre_saturation: { label: 'Genre saturation', accent: 'border-l-orange-500', icon: '●' },
  whitespace_opportunities: { label: 'Whitespace', accent: 'border-l-emerald-500', icon: '○' },
  limitations: { label: 'Limitations', accent: 'border-l-slate-400', icon: '!' },
  conclusion: { label: 'Conclusion', accent: 'border-l-indigo-600', icon: '★' },
  executive_summary: { label: 'Executive summary', accent: 'border-l-atlas-600', icon: '◆' },
}

export function ReportSection({ field, children }: { field: string; children: ReactNode }) {
  const meta = REPORT_META[field] || {
    label: field.replace(/_/g, ' '),
    accent: 'border-l-slate-300',
    icon: '·',
  }
  return (
    <section className={`relative pl-4 border-l-4 ${meta.accent} py-1`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-semibold">
          {meta.icon}
        </span>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {meta.label}
        </h4>
      </div>
      <div className="text-[15px] text-slate-700 leading-relaxed">{children}</div>
    </section>
  )
}

export function StatPill({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-3 min-w-[7rem] border border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-slate-300 font-medium">{label}</div>
      <div className="text-xl font-semibold text-white tabular-nums mt-0.5">{value}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}

export const STAGE_COPY: Record<string, string> = {
  queued: 'Queued — waiting for the research worker…',
  planning: 'Planning search strategy…',
  collecting: 'Finding micro-dramas on YouTube…',
  cleaning: 'Cleaning and deduplicating results…',
  classifying: 'Labeling story patterns…',
  analyzing: 'Measuring genre saturation & whitespace…',
  generating_report: 'Writing grounded findings…',
  completed: 'Research complete',
  partial: 'Finished early — results are still usable',
  failed: 'Run failed',
}

export const ERROR_COPY: Record<string, string> = {
  quota_youtube: 'YouTube daily limit reached. Try tomorrow or use Quick scan.',
  auth: 'API keys missing or invalid on the server.',
  llm_parse: 'Model returned unusable output. Resume to retry this stage.',
  timeout: 'Time or rate limit hit. Resume or lower the preset.',
  db: 'Database issue. Check Render/Neon connectivity.',
  unknown: 'Unexpected error. Check event log or resume.',
}

export const PRESET_META = [
  { id: 'quick' as const, label: 'Quick scan', n: 15, time: '2–5 min', cost: 'Low YouTube use', blurb: 'Best on free Render' },
  { id: 'standard' as const, label: 'Standard', n: 30, time: '5–12 min', cost: 'Moderate', blurb: 'Balanced depth' },
  { id: 'deep' as const, label: 'Deep', n: 50, time: '10–20 min', cost: 'Higher quota', blurb: 'May hit free-tier limits', warn: true },
]

/** Deterministic takeaways from analysis — no extra LLM. Lean metric-first copy. */
export function deriveTakeaways(analysis: any, report: any, n: number) {
  const root = analysis?.analysis || analysis || {}
  const g = root.genre_distribution || {}
  const tropes = root.trope_distribution || {}
  const gapsRaw: string[] = root.whitespace_opportunities || []
  const genres = Object.entries(g as Record<string, number>).sort((a, b) => b[1] - a[1])
  const topG = genres[0]
  const topT = Object.entries(tropes as Record<string, number>)
    .filter(([k]) => String(k).toLowerCase() !== 'unknown' && String(k).toLowerCase() !== 'other')
    .sort((a, b) => b[1] - a[1])[0]
  const total = (n && n > 0 ? n : genres.reduce((s, [, v]) => s + Number(v), 0)) || 1

  // Parse open genres from whitespace strings or zero-count genres
  const openItems: { label: string; value: string }[] = []
  const seen = new Set<string>()
  for (const note of gapsRaw) {
    const m = String(note).match(/genre ['"]?([a-z_ ]+)['"]?/i) || String(note).match(/['"]([a-z_ ]+)['"]/i)
    if (m) {
      const label = m[1].replace(/_/g, ' ').trim()
      const key = label.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        const count = g[m[1].replace(/ /g, '_')] ?? g[m[1]] ?? 0
        openItems.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value: String(count) })
      }
    }
  }
  // Fallback: known thin genres not in top set
  if (!openItems.length) {
    for (const name of ['mystery', 'supernatural', 'thriller', 'tragedy']) {
      const count = Number(g[name] ?? 0)
      if (count === 0 && !seen.has(name)) {
        seen.add(name)
        openItems.push({ label: name.charAt(0).toUpperCase() + name.slice(1), value: '0' })
      }
    }
  }

  const crowded = topG
    ? {
        title: 'Crowded',
        primary: `${String(topG[0]).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ${Math.round((Number(topG[1]) / total) * 100)}%`,
        secondary: `${topG[1]} of ${total}`,
      }
    : { title: 'Crowded', primary: '—', secondary: 'No genre labels yet' }

  const open = {
    title: 'Underrepresented',
    items: openItems.slice(0, 3),
    primary: openItems[0] ? `${openItems[0].label} ${openItems[0].value}` : '—',
    secondary: openItems.length > 1 ? openItems.slice(1).map((i) => `${i.label} ${i.value}`).join(' · ') : '',
  }

  const emerging = topT
    ? {
        title: 'Emerging',
        primary: `${String(topT[0]).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ${Math.round((Number(topT[1]) / total) * 100)}%`,
        secondary: `${topT[1]} of ${total}`,
      }
    : {
        title: 'Emerging',
        primary: '—',
        secondary: 'No trope labels yet',
      }

  // Board chips from distributions (not prose notes) + lineage keys
  const crowdedChips = genres.slice(0, 3).map(([k, v]) => ({
    label: String(k).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: `${Math.round((Number(v) / total) * 100)}%`,
    filter: { kind: 'genre' as const, key: String(k), count: Number(v), total },
  }))
  const openChips = openItems.slice(0, 4).map((it) => ({
    ...it,
    filter: {
      kind: 'genre' as const,
      key: it.label.toLowerCase().replace(/ /g, '_'),
      count: Number(it.value) || 0,
      total,
    },
  }))

  const crowdedFull = topG
    ? {
        ...crowded,
        filter: { kind: 'genre' as const, key: String(topG[0]), count: Number(topG[1]), total },
      }
    : { ...crowded, filter: null as any }
  const emergingFull = topT
    ? {
        ...emerging,
        filter: { kind: 'trope' as const, key: String(topT[0]), count: Number(topT[1]), total },
      }
    : { ...emerging, filter: null as any }
  const openFull = {
    ...open,
    items: openItems.slice(0, 3).map((it) => ({
      ...it,
      filter: {
        kind: 'genre' as const,
        key: it.label.toLowerCase().replace(/ /g, '_'),
        count: Number(it.value) || 0,
        total,
      },
    })),
    filter: openItems[0]
      ? {
          kind: 'genre' as const,
          key: openItems[0].label.toLowerCase().replace(/ /g, '_'),
          count: Number(openItems[0].value) || 0,
          total,
        }
      : null,
  }

  return {
    crowded: crowdedFull,
    open: openFull,
    emerging: emergingFull,
    pattern: emergingFull,
    crowdedChips,
    openChips,
    sampleSize: total,
  }
}


export function StickyResearchBar({
  question,
  n,
  classified,
  onAsk,
  onEvidence,
  onCompare,
}: {
  question?: string
  n: number
  classified?: number
  onAsk?: () => void
  onEvidence?: () => void
  onCompare?: () => void
}) {
  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-200/80 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Atlas · research</div>
          <div className="text-sm font-medium text-slate-900 truncate max-w-[28rem]">
            {question || 'Micro-drama research'}
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            {n} videos · {classified ?? n} classified
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {onAsk && (
            <button type="button" className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white" onClick={onAsk}>
              Ask Atlas
            </button>
          )}
          {onEvidence && (
            <button type="button" className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white" onClick={onEvidence}>
              Evidence
            </button>
          )}
          {onCompare && (
            <button type="button" className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white" onClick={onCompare}>
              Compare
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProximityStrip({
  pairs,
}: {
  pairs: { youtube_id?: string; a?: string; b?: string; title?: string; title_a?: string; title_b?: string; score?: number; shared_genre?: string; shared_trope?: string }[]
}) {
  if (!pairs?.length) {
    return <p className="text-xs text-slate-400">No proximity pairs</p>
  }
  // Flatten to unique videos with best score for display
  const seen = new Map<string, { id: string; title: string; score: number; tags: string }>()
  for (const p of pairs.slice(0, 12)) {
    for (const [id, title] of [[p.a || p.youtube_id, p.title_a || p.title], [p.b, p.title_b]] as const) {
      if (!id) continue
      const score = Number(p.score || 0)
      const tags = [p.shared_genre, p.shared_trope].filter(Boolean).join(' · ')
      const prev = seen.get(String(id))
      if (!prev || score > prev.score) {
        seen.set(String(id), { id: String(id), title: String(title || id), score, tags })
      }
    }
  }
  const items = Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, 8)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((it) => (
        <a
          key={it.id}
          href={`https://www.youtube.com/watch?v=${it.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-slate-300 shadow-sm"
        >
          <div className="aspect-video bg-slate-100 relative">
            <img
              src={`https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div className="p-2">
            <div className="text-sm font-semibold tabular-nums text-slate-900">{Math.round(it.score * 100)}%</div>
            <div className="text-[11px] text-slate-500">similar</div>
            <div className="text-xs text-slate-800 line-clamp-2 mt-1">{it.title}</div>
            {it.tags && <div className="text-[10px] text-slate-500 mt-0.5">{it.tags}</div>}
          </div>
        </a>
      ))}
    </div>
  )
}

export function PotentialMatrix({
  signals,
}: {
  signals: { label?: string; genre?: string; name?: string; level?: string; note?: string; evidence?: string; representation?: string; performance?: string }[]
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">Signal matrix in this sample only · not market validation</p>
      <div className="relative rounded-2xl border border-slate-200 bg-slate-50/50 p-4 min-h-[200px]">
        <div className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] uppercase font-semibold text-slate-400">Performance →</div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[10px] uppercase font-semibold text-slate-400">Representation →</div>
        <div className="grid grid-cols-2 gap-2 mt-4 ml-4">
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 p-3 min-h-[88px]">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Investigate</div>
            <div className="mt-2 space-y-1">
              {signals.filter((s) => (s.level || '').includes('invest') || (s.note || '').toLowerCase().includes('performance')).slice(0, 3).map((s, i) => (
                <div key={i} className="text-xs font-medium text-slate-800">{s.label || s.genre || s.name}</div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 min-h-[88px]">
            <div className="text-[10px] font-semibold text-emerald-700 uppercase">Potential signals</div>
            <div className="mt-2 space-y-1">
              {signals.slice(0, 4).map((s, i) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold text-slate-900">{s.label || s.genre || s.name}</span>
                  <span className="text-slate-500"> · limited evidence</span>
                </div>
              ))}
              {!signals.length && <div className="text-[11px] text-slate-400">None computed</div>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3 min-h-[88px]">
            <div className="text-[10px] font-semibold text-slate-400 uppercase">Weak</div>
            <div className="text-[11px] text-slate-500 mt-2">Low representation · low engagement in sample</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 min-h-[88px]">
            <div className="text-[10px] font-semibold text-amber-800 uppercase">Crowded</div>
            <div className="text-[11px] text-slate-600 mt-2">High representation in sample</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InsightsHero({
  n,
  classified,
  runId,
  statusLabel,
  question,
}: {
  n: number
  classified?: number
  runId?: string | null
  statusLabel?: string
  question?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-800 tabular-nums">{n}</span>
        <span>videos</span>
        <span className="text-slate-300">·</span>
        <span className="tabular-nums">{classified ?? n}</span>
        <span>classified</span>
        {runId && (
          <>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px]">run {String(runId).slice(0, 8)}</span>
          </>
        )}
        {statusLabel && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase">
            {statusLabel}
          </span>
        )}
      </div>
      {question && (
        <p className="text-sm text-slate-600 line-clamp-2">{question}</p>
      )}
      <p className="text-[11px] text-slate-400">Sample only · not a market census</p>
    </div>
  )
}

export function FindingActions({
  onWhy,
  onEvidence,
  onAsk,
}: {
  onWhy?: () => void
  onEvidence?: () => void
  onAsk?: () => void
}) {
  const btn = 'text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {onWhy && <button type="button" className={btn} onClick={onWhy}>Why?</button>}
      {onEvidence && <button type="button" className={btn} onClick={onEvidence}>Evidence</button>}
      {onAsk && <button type="button" className={btn} onClick={onAsk}>Ask Atlas</button>}
    </div>
  )
}

export function BreakoutCard({
  title,
  views,
  multiple,
  tags,
  onInvestigate,
  onEvidence,
}: {
  title: string
  views?: number | string
  multiple?: string
  tags?: string
  onInvestigate?: () => void
  onEvidence?: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Breakout</div>
      <div className="text-2xl font-semibold tabular-nums text-slate-900">
        {typeof views === 'number' ? views.toLocaleString() : (views || '—')}
      </div>
      <div className="text-xs text-slate-500">{multiple || 'Outlier in sample'}</div>
      <div className="text-sm font-medium text-slate-800 line-clamp-2">{title}</div>
      {tags && <div className="text-[11px] text-slate-500">{tags}</div>}
      <div className="flex gap-2 pt-1">
        {onInvestigate && (
          <button type="button" className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white" onClick={onInvestigate}>
            Investigate
          </button>
        )}
        {onEvidence && (
          <button type="button" className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200" onClick={onEvidence}>
            Evidence
          </button>
        )}
      </div>
    </div>
  )
}

export function KeySignals({
  items,
  onSelect,
  onAsk,
}: {
  items: { label: string; value: string; sub?: string; tone?: string; filter?: any; ask?: string }[]
  onSelect?: (f: any) => void
  onAsk?: (prompt: string) => void
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2">Key findings</div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded-2xl border bg-white p-4 shadow-sm ${it.tone || 'border-slate-200'}`}
          >
            <button
              type="button"
              disabled={!it.filter || !onSelect}
              onClick={() => it.filter && onSelect?.(it.filter)}
              className={`w-full text-left ${it.filter ? 'cursor-pointer' : ''}`}
            >
              <div className="text-2xl md:text-3xl font-semibold tabular-nums text-slate-900 tracking-tight">{it.value}</div>
              <div className="text-xs font-semibold text-slate-800 mt-1">{it.label}</div>
              {it.sub && <div className="text-[11px] text-slate-500 mt-0.5">{it.sub}</div>}
            </button>
            <FindingActions
              onEvidence={it.filter && onSelect ? () => onSelect(it.filter) : undefined}
              onAsk={onAsk ? () => onAsk(it.ask || `Why is ${it.label} significant in this sample?`) : undefined}
              onWhy={onAsk ? () => onAsk(it.ask || `Explain ${it.label} (${it.value}) in this research sample.`) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}


export function CompactStat({
  title,
  primary,
  secondary,
  rows,
}: {
  title: string
  primary?: string
  secondary?: string
  rows?: { k: string; v: string }[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">{title}</div>
      {primary && <div className="text-2xl font-semibold tabular-nums text-slate-900">{primary}</div>}
      {secondary && <div className="text-xs text-slate-500 mt-0.5">{secondary}</div>}
      {rows && (
        <dl className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.k} className="flex justify-between gap-2 text-sm">
              <dt className="text-slate-500">{r.k}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

export function CompactActions({
  items,
  onAction,
}: {
  items: { title: string; hint?: string; actionLabel: string; id: string }[]
  onAction?: (id: string) => void
}) {
  if (!items.length) return null
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2">Next actions</div>
      <div className="grid md:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <div key={it.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-400">#{i + 1}</div>
            <div className="text-sm font-semibold text-slate-900 mt-1">{it.title}</div>
            {it.hint && <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{it.hint}</div>}
            <button
              type="button"
              className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white"
              onClick={() => onAction?.(it.id)}
            >
              {it.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PredictiveLock({ have, need }: { have: number; need: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Prediction</div>
        <div className="text-sm font-semibold text-slate-800 mt-1">Not available yet</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Complete more comparable runs in this study</div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-semibold tabular-nums text-slate-900">{have}/{need}</div>
        <div className="text-[11px] text-slate-500">runs</div>
      </div>
    </div>
  )
}

export function TakeawayRow({
  crowded,
  open,
  emerging,
  pattern,
  onSelect,
}: {
  crowded: TakeawayCard
  open: TakeawayCard
  emerging?: TakeawayCard
  pattern?: TakeawayCard
  onSelect?: (f: LineageFilter) => void
}) {
  const third = emerging || pattern || { title: 'Emerging', primary: '—', secondary: '' }
  const cards: { data: TakeawayCard; tone: string; hover: string }[] = [
    { data: crowded, tone: 'bg-amber-50/90 border-amber-100', hover: 'hover:border-amber-300 hover:shadow-md' },
    { data: open, tone: 'bg-emerald-50/90 border-emerald-100', hover: 'hover:border-emerald-300 hover:shadow-md' },
    { data: third, tone: 'bg-slate-50 border-slate-200', hover: 'hover:border-slate-300 hover:shadow-md' },
  ]
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Crowded · Underrepresented · Emerging</div>
        <div className="text-[11px] font-medium text-slate-900">Click a claim → Evidence</div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {cards.map(({ data: c, tone, hover }) => (
          <div key={c.title} className={`rounded-2xl border p-4 shadow-sm ${tone} ${onSelect ? `cursor-pointer transition-all ${hover}` : ''}`}>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">{c.title}</div>
            {c.items && c.items.length > 0 ? (
              <ul className="space-y-1">
                {c.items.map((it) => (
                  <li key={it.label}>
                    <button
                      type="button"
                      className="w-full flex items-baseline justify-between gap-2 text-left rounded-lg px-1 py-0.5 hover:bg-white/60"
                      onClick={() => it.filter && onSelect?.(it.filter)}
                    >
                      <span className="text-base font-semibold text-slate-900 tracking-tight">{it.label}</span>
                      <span className="text-lg font-semibold tabular-nums text-slate-800">{it.value}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => c.filter && onSelect?.(c.filter)}
                disabled={!c.filter}
              >
                <div className="text-xl font-semibold text-slate-900 tracking-tight leading-tight">{c.primary}</div>
                {c.secondary ? <div className="text-xs text-slate-500 mt-1 tabular-nums">{c.secondary}</div> : null}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function GapBoard({
  n,
  saturation,
  whitespace,
  crowdedChips,
  openChips,
  onSelect,
}: {
  n: number
  saturation?: string[]
  whitespace?: string[]
  crowdedChips?: { label: string; value: string; filter?: LineageFilter }[]
  openChips?: { label: string; value: string; filter?: LineageFilter }[]
  onSelect?: (f: LineageFilter) => void
}) {
  let crowded: any[] = crowdedChips || []
  let open: any[] = openChips || []
  if (!crowded.length && saturation?.length) {
    crowded = saturation.slice(0, 3).map((s) => {
      const m = String(s).match(/'([^']+)'.*?(\d+)\s*\/\s*(\d+).*?(\d+)\s*%/i) || String(s).match(/([A-Za-z_ ]+).*?(\d+)\s*%/)
      if (m && m[4]) return { label: m[1].replace(/_/g, ' '), value: `${m[4]}%` }
      if (m && m[2]) return { label: m[1].replace(/_/g, ' '), value: `${m[2]}%` }
      return { label: String(s).slice(0, 40), value: '' }
    })
  }
  if (!open.length && whitespace?.length) {
    open = whitespace.slice(0, 4).map((s) => {
      const m = String(s).match(/genre ['"]?([a-z_ ]+)['"]?/i)
      const c = String(s).match(/\((\d+)/)
      return {
        label: m ? m[1].replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()) : String(s).slice(0, 24),
        value: c ? c[1] : '0',
      }
    })
  }
  const Chip = ({ it, tone }: { it: any; tone: string }) => {
    const clickable = !!(onSelect && it.filter)
    const inner = (
      <>
        <span className="font-medium capitalize">{it.label}</span>
        <span className="tabular-nums font-semibold">{it.value}</span>
      </>
    )
    if (clickable) {
      return (
        <button
          type="button"
          onClick={() => onSelect!(it.filter)}
          className={`w-full flex items-center justify-between gap-2 text-sm rounded-xl px-3 py-2 border text-left transition-all hover:shadow-sm ${tone}`}
        >
          {inner}
        </button>
      )
    }
    return (
      <li className={`flex items-center justify-between gap-2 text-sm rounded-xl px-3 py-2 border ${tone}`}>
        {inner}
      </li>
    )
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Crowded vs underrepresented</div>
        <div className="text-[11px] font-medium text-slate-900">Click a row → Evidence</div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-amber-100 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Crowded</h3>
          <ul className="space-y-2">
            {crowded.length ? crowded.map((it, i) => (
              <li key={i} className="list-none">
                <Chip it={it} tone="bg-amber-50 text-amber-950 border-amber-100/80" />
              </li>
            )) : (
              <li className="text-sm text-slate-500">—</li>
            )}
          </ul>
        </div>
        <div className="bg-white border border-emerald-100 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Underrepresented</h3>
          <p className="text-[10px] text-slate-500 mb-3">In this sample only · not market validation</p>
          <ul className="space-y-2">
            {open.length ? open.map((it, i) => (
              <li key={i} className="list-none">
                <Chip it={it} tone="bg-emerald-50 text-emerald-950 border-emerald-100/80" />
              </li>
            )) : (
              <li className="text-sm text-slate-500">—</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function InsightsActionBar({
  canNext,
  onNext,
  onEvidence,
  deliverOpen,
  setDeliverOpen,
  deliverMenu,
}: {
  canNext: boolean
  onNext: () => void
  onEvidence: () => void
  deliverOpen: boolean
  setDeliverOpen: (v: boolean | ((o: boolean) => boolean)) => void
  deliverMenu: ReactNode
}) {
  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2.5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-1.5 px-1">Act</div>
      <div className="flex flex-wrap gap-2 items-center">
        {canNext && (
          <button
            type="button"
            className="text-sm bg-white border border-atlas-200 text-atlas-800 px-3 py-2 rounded-xl font-medium hover:bg-atlas-50"
            onClick={onNext}
          >
            Next batch (+15)
          </button>
        )}
        <button
          type="button"
          className="text-sm bg-white border border-slate-200 text-slate-800 px-3 py-2 rounded-xl font-medium hover:bg-slate-50"
          onClick={onEvidence}
        >
          Evidence
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDeliverOpen(o => !o)}
            className="text-sm bg-atlas-600 text-white px-3 py-2 rounded-xl font-medium hover:bg-atlas-700"
          >
            Deliver ▾
          </button>
          {deliverOpen && deliverMenu}
        </div>
        <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">Expand · verify · share</span>
      </div>
    </div>
  )
}

export function ReportAccordion({
  open,
  onToggle,
  report,
}: {
  open: boolean
  onToggle: () => void
  report: Record<string, any>
}) {
  const keys = [
    'dataset_overview',
    'genre_analysis',
    'storytelling_pattern_analysis',
    'engagement_analysis',
    'limitations',
    'conclusion',
  ]
  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
      <button type="button" className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50" onClick={onToggle}>
        <div>
          <div className="text-sm font-semibold text-slate-900">Full research write-up</div>
          <div className="text-xs text-slate-500">Collapsed by default · open for full memo</div>
        </div>
        <span className="text-slate-400 text-lg">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-5 pb-6 pt-2 space-y-8 border-t border-slate-100">
          {keys.map(k =>
            report[k] ? (
              <ReportSection key={k} field={k}>
                <p>{report[k]}</p>
              </ReportSection>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}