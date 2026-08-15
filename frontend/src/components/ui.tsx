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
    title: 'Open',
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

export function InsightsHero({
  n,
  classified,
  runId,
  status,
  title,
}: {
  n: number
  classified?: number
  runId?: string | null
  status?: string
  title?: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-1">Research frame</div>
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">Insights</h2>
      <p className="text-sm text-slate-500 mt-1 max-w-2xl">
        Grounded · sample of <span className="font-medium text-slate-700">{n || '—'}</span>
        {n ? ' · not a market census' : ''}
      </p>
      {title && <p className="text-sm text-slate-700 font-medium mt-3 border-l-4 border-atlas-600 pl-3">{title}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <Badge tone="blue">{n} in sample</Badge>
        {classified != null && <Badge>{classified} classified</Badge>}
        {runId && <Badge tone="slate">run {String(runId).slice(0, 8)}</Badge>}
        {status && (
          <Badge tone={status === 'completed' ? 'green' : status === 'partial' ? 'amber' : 'slate'}>{status}</Badge>
        )}
      </div>
    </div>
  )
}

export type LineageFilter = {
  kind: 'genre' | 'trope'
  key: string
  count: number
  total: number
  claim?: string
}

type TakeawayCard = {
  title: string
  primary: string
  secondary?: string
  items?: { label: string; value: string; filter?: LineageFilter | null }[]
  filter?: LineageFilter | null
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
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Decide</div>
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
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Crowded vs open</div>
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
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Open</h3>
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