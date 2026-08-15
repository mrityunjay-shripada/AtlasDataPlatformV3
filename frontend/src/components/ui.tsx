import type { ReactNode } from 'react'

export type LineageFilter = {
  kind: 'genre' | 'trope' | 'channel'
  key: string
  count: number
  total: number
  claim?: string
}

export function Toast({
  message,
  onClose,
  onAction,
}: {
  message: string
  onClose: () => void
  onAction?: () => void
}) {
  if (!message) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-start gap-3">
      {onAction ? (
        <button type="button" className="flex-1 text-left leading-snug hover:underline" onClick={onAction}>
          {message}
        </button>
      ) : (
        <span className="flex-1 leading-snug">{message}</span>
      )}
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

export function BarChart({
  data,
  title,
  onRowClick,
}: {
  data: Record<string, number>
  title: string
  onRowClick?: (key: string, count: number, total: number) => void
}) {
  // Rank only real labels — never promote unknown/other into the bar list
  const cleaned = Object.entries(data || {}).filter(
    ([k]) => !['unknown', 'other', 'n/a', 'null', ''].includes(String(k).toLowerCase().trim()),
  )
  const entries = cleaned.sort((a, b) => b[1] - a[1]).slice(0, 10)
  const max = Math.max(...entries.map(([, v]) => v), 1)
  const total = cleaned.reduce((a, [, b]) => a + b, 0) || 1
  if (!entries.length) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h4>
        <span className="text-[11px] text-slate-400 font-medium">{total} labeled</span>
      </div>
      <div className="space-y-1">
        {entries.map(([k, v], i) => {
          const pct = Math.round((v / total) * 100)
          const interactive = !!onRowClick
          const RowTag = interactive ? 'button' : 'div'
          return (
            <RowTag
              key={k}
              type={interactive ? 'button' : undefined}
              onClick={interactive ? () => onRowClick!(String(k), Number(v), total) : undefined}
              className={`group w-full text-left rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                interactive
                  ? 'cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-xs font-medium capitalize truncate ${interactive ? 'text-slate-800 group-hover:text-slate-950' : 'text-slate-700'}`} title={k}>
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
            </RowTag>
          )
        })}
      </div>
    </div>
  )
}

export function formatViews(n: number | null | undefined): string {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  if (v >= 10_000) return `${Math.round(v / 1000)}K`
  return v.toLocaleString()
}

export function AnalyzeEmpty({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 min-h-[120px]">
      <div className="text-sm font-extrabold tracking-tight text-slate-800">{title}</div>
      <p className="text-[13px] text-slate-500 font-medium mt-1.5 max-w-sm leading-relaxed">{body}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function HealthCard({
  tone = 'amber',
  title,
  body,
}: {
  tone?: 'amber' | 'slate' | 'blue'
  title: string
  body: string
}) {
  const map = {
    amber: 'bg-amber-50 border-amber-200/80 text-amber-950',
    slate: 'bg-slate-50 border-slate-200/80 text-slate-900',
    blue: 'bg-slate-50 border-slate-200 text-slate-900',
  }
  const titleC = {
    amber: 'text-amber-900',
    slate: 'text-slate-900',
    blue: 'text-slate-900',
  }
  const bodyC = {
    amber: 'text-amber-900/90',
    slate: 'text-slate-600',
    blue: 'text-slate-600',
  }
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${map[tone]}`}>
      <h5 className={`text-sm font-extrabold tracking-tight ${titleC[tone]}`}>{title}</h5>
      <p className={`text-sm mt-1 leading-relaxed ${bodyC[tone]}`}>{body}</p>
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


/** Strip YouTube-like video ids from narrative report text. */
export function cleanReportProse(text: string): string {
  if (!text) return ''
  return String(text)
    .replace(/\(\s*ID\s*:\s*[^)]*\)/gi, '')
    .replace(/\bID\s*:\s*[0-9A-Za-z_-]*/gi, '')
    .replace(/\b[0-9A-Za-z_-]{10,12}\b/g, (m) => {
      const hasDigit = /\d/.test(m)
      const hasLetter = /[A-Za-z]/.test(m)
      return hasDigit && hasLetter ? '' : m
    })
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+—\s+/g, ' — ')
    .trim()
}

function sentenceBullets(text: string, max = 4): string[] {
  const cleaned = cleanReportProse(text)
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28 && !/^[0-9%.\s]+$/.test(s))
  return parts.slice(0, max)
}

const GENRE_DOT: Record<string, string> = {
  romance: 'bg-pink-400',
  comedy: 'bg-amber-400',
  thriller: 'bg-slate-800',
  revenge: 'bg-orange-500',
  family: 'bg-sky-400',
  mystery: 'bg-indigo-400',
  drama: 'bg-violet-400',
  default: 'bg-slate-400',
}


export function InsightCallout({
  kicker,
  headline,
  metric,
  bullets,
  footnote,
}: {
  kicker?: string
  headline: string
  metric?: string
  bullets: string[]
  footnote?: string
}) {
  const dots = ['bg-pink-400', 'bg-violet-400', 'bg-amber-400', 'bg-sky-400', 'bg-slate-400']
  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 shadow-sm">
      {kicker && (
        <div className="text-[11px] font-extrabold tracking-tight text-slate-500 uppercase mb-1">{kicker}</div>
      )}
      <p className="text-base md:text-lg font-medium text-slate-900 leading-snug">
        {headline}
        {metric && (
          <>
            {' '}
            <span className="inline-flex items-center bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-sm tabular-nums">
              {metric}
            </span>
          </>
        )}
      </p>
      {footnote && <p className="text-[11px] text-slate-500 mt-1">{footnote}</p>}
      {bullets.length > 0 && (
        <ul className="mt-4 space-y-3 text-sm">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dots[i % dots.length]}`} />
              <p className="text-slate-600 leading-relaxed">{b}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Build a simple callout from free prose when structured JSON is not available. */
export function proseToInsightCallout(field: string, prose: string, analysis?: any): {
  kicker: string
  headline: string
  metric?: string
  bullets: string[]
  footnote?: string
} {
  const cleaned = cleanReportProse(prose)
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

  // --- Limitations: fixed, scannable, honest ---
  if (field === 'limitations') {
    const root = analysis?.analysis || analysis || {}
    const n =
      root.engagement_stats?.count ||
      Object.values(root.genre_distribution || {}).reduce((s: number, v: any) => s + Number(v), 0) ||
      0
    const sampleMatch = cleaned.match(/(\d+)\s+videos?/i)
    const sampleN = sampleMatch ? sampleMatch[1] : n || '—'
    const bullets = [
      `Sample size is ${sampleN} videos in this pull.`,
      /engagement proxy|likes and comments|0\.0|recorded as 0/i.test(cleaned)
        ? 'Likes and comments were not available (engagement proxy is 0) — views are the main performance signal.'
        : 'Some engagement fields may be incomplete in this pull.',
      'Figures describe this set only — not the full YouTube micro-drama market.',
    ]
    return {
      kicker: 'Limitations',
      headline: `What this study cannot claim`,
      bullets,
      footnote: 'Applies to this pull only.',
    }
  }

  // --- Conclusion: sample-bound; strip opportunity/market advice ---
  if (field === 'conclusion') {
    const root = analysis?.analysis || analysis || {}
    const genres = root.genre_distribution || {}
    const total = Object.values(genres).reduce((s: number, v: any) => s + Number(v), 0) || 1
    const ranked = Object.entries(genres)
      .filter(([k]) => !['unknown', 'other'].includes(String(k).toLowerCase()))
      .sort((a, b) => Number(b[1]) - Number(a[1]))
    const top = ranked.slice(0, 2).map(([k, v]) => {
      const pct = Math.round((Number(v) / total) * 100)
      return `${String(k).replace(/_/g, ' ')} (~${pct}%)`
    })
    const sparse = ranked.filter(([, v]) => Number(v) / total < 0.05).slice(0, 3).map(([k]) => String(k).replace(/_/g, ' '))
    // strip market-advice sentences from model prose
    const safe = sentences
      .map((s) =>
        s
          .replace(/strategic whitespace[^.]*\.?/gi, '')
          .replace(/untapped audience[^.]*\.?/gi, '')
          .replace(/creators and producers can[^.]*\.?/gi, '')
          .replace(/developing content in[^.]*\.?/gi, '')
          .replace(/capturing untapped[^.]*\.?/gi, '')
          .trim(),
      )
      .filter((s) => s.length > 25 && !/whitespace|opportunity|should develop|market interest/i.test(s))

    const bullets: string[] = []
    if (top.length) {
      bullets.push(`In this set, ${top.join(' and ')} account for most labeled videos and strong view counts.`)
    }
    if (sparse.length) {
      bullets.push(`${sparse.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} barely appear here — rare in this sample, not proof of demand.`)
    }
    bullets.push('Use Evidence and further batches to test whether these patterns hold beyond this pull.')
    if (safe[0] && bullets.length < 4) bullets.unshift(safe[0].slice(0, 180))

    return {
      kicker: 'Conclusion',
      headline: 'What this set of videos shows',
      bullets: bullets.slice(0, 4),
      footnote: 'Descriptive of this sample only — not market advice.',
    }
  }

  const meta: Record<string, string> = {
    dataset_overview: 'Dataset overview',
    genre_analysis: 'Genre analysis',
    engagement_analysis: 'Engagement',
    storytelling_pattern_analysis: 'Storytelling patterns',
    limitations: 'Limitations',
    conclusion: 'Conclusion',
  }
  const kicker = meta[field] || field.replace(/_/g, ' ')
  const headline = sentences[0] || cleaned.slice(0, 120) || 'Summary for this set of videos.'
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*%/)
  const metric = m ? `${m[1]}%` : undefined
  const bullets = sentences.slice(1, 5)
  return {
    kicker,
    headline: metric ? headline.replace(m![0], '').replace(/\s{2,}/g, ' ').trim() : headline,
    metric,
    bullets: bullets.length ? bullets : sentences.slice(0, 3),
    footnote: 'In this set of videos only.',
  }
}

export function StoryPatternCallout({
  prose,
  analysis,
}: {
  prose?: string
  analysis?: any
}) {
  const root = analysis?.analysis || analysis || {}
  const tropes = root.trope_distribution || {}
  const genres = root.genre_distribution || {}
  const total =
    Object.values(genres as Record<string, number>).reduce((s, v) => s + Number(v), 0) ||
    Object.values(tropes as Record<string, number>).reduce((s, v) => s + Number(v), 0) ||
    1
  const topTrope = Object.entries(tropes as Record<string, number>)
    .filter(([k]) => !['unknown', 'other'].includes(String(k).toLowerCase()))
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  const topGenre = Object.entries(genres as Record<string, number>).sort(
    (a, b) => Number(b[1]) - Number(a[1]),
  )[0]
  const pct = topTrope ? Math.round((Number(topTrope[1]) / total) * 1000) / 10 : null
  const tropeLabel = topTrope
    ? String(topTrope[0]).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null
  const genreLabel = topGenre
    ? String(topGenre[0]).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  const bullets = sentenceBullets(prose || '', 4)
  // Prefer short bullets that mention genres when possible
  const dots = ['romance', 'thriller', 'comedy', 'revenge', 'family']

  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h4 className="text-[11px] font-extrabold tracking-tight text-slate-500 uppercase mb-1">
          What shows up together
        </h4>
        <p className="text-base md:text-lg font-medium text-slate-900 leading-snug">
          {genreLabel && tropeLabel ? (
            <>
              {genreLabel} and {tropeLabel} often appear together
              {pct != null && (
                <>
                  {' '}
                  <span className="inline-flex items-center bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-bold text-sm tabular-nums">
                    {pct}%
                  </span>
                  {' '}
                  of this set
                </>
              )}
              .
            </>
          ) : (
            <>Common pairings in this set of videos.</>
          )}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">In this set of videos only — not a market forecast.</p>
      </div>
      {bullets.length > 0 ? (
        <ul className="space-y-3 text-sm">
          {bullets.map((b, i) => {
            const lower = b.toLowerCase()
            const g = dots.find((d) => lower.includes(d)) || 'default'
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${GENRE_DOT[g] || GENRE_DOT.default}`} />
                <p className="text-slate-600 leading-relaxed">{b}</p>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 leading-relaxed">{cleanReportProse(prose || 'No pairing narrative yet.')}</p>
      )}
    </div>
  )
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
  queued: 'Queued — starting shortly…',
  planning: 'Planning how to search YouTube…',
  collecting: 'Finding micro-dramas on YouTube…',
  cleaning: 'Removing duplicate videos…',
  classifying: 'Labeling story patterns…',
  analyzing: 'Looking for common patterns and sparse themes…',
  generating_report: 'Drafting insights…',
  completed: 'Research complete',
  partial: 'Finished early — you can still use these results',
  failed: 'Something went wrong with this run',
}

export const ERROR_COPY: Record<string, string> = {
  quota_youtube: 'YouTube daily limit reached. Try again tomorrow or use Quick scan.',
  auth: 'Server API keys are missing or invalid. Check your deployment settings.',
  llm_parse: 'AI generation failed. Click Resume to try this step again.',
  timeout: 'This step timed out. Resume, or try a smaller Quick scan.',
  db: 'We hit a database snag. Please try again in a moment.',
  unknown: 'Something unexpected happened. Resume the run, or check the event log.',
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
        openItems.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value: `${count} of ${total}` })
      }
    }
  }
  // Fallback: known thin genres not in top set
  if (!openItems.length) {
    for (const name of ['mystery', 'supernatural', 'thriller', 'tragedy']) {
      const count = Number(g[name] ?? 0)
      if (count === 0 && !seen.has(name)) {
        seen.add(name)
        openItems.push({ label: name.charAt(0).toUpperCase() + name.slice(1), value: `0 of ${total}` })
      }
    }
  }

  const crowded = topG
    ? {
        title: 'High share',
        primary: `${String(topG[0]).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ${Math.round((Number(topG[1]) / total) * 100)}%`,
        secondary: `${topG[1]} of ${total}`,
      }
    : { title: 'High share', primary: '—', secondary: 'No genre tags yet' }

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
        secondary: 'No story-pattern tags yet',
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
        items: [{
          label: String(topG[0]).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: `${Math.round((Number(topG[1]) / total) * 100)}%`,
          filter: { kind: 'genre' as const, key: String(topG[0]), count: Number(topG[1]), total },
        }],
        secondary: `${topG[1]} of ${total}`,
        filter: { kind: 'genre' as const, key: String(topG[0]), count: Number(topG[1]), total },
      }
    : { ...crowded, items: [], filter: null as any }
  const emergingFull = topT
    ? {
        ...emerging,
        items: [{
          label: String(topT[0]).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          value: `${Math.round((Number(topT[1]) / total) * 100)}%`,
          filter: { kind: 'trope' as const, key: String(topT[0]), count: Number(topT[1]), total },
        }],
        secondary: `${topT[1]} of ${total}`,
        filter: { kind: 'trope' as const, key: String(topT[0]), count: Number(topT[1]), total },
      }
    : { ...emerging, items: [], filter: null as any }
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


export function filterChartData(data: Record<string, number> | undefined | null, drop: string[] = ['unknown', 'other']) {
  const out: Record<string, number> = {}
  let dropped = 0
  const gaps: { label: string; count: number }[] = []
  let total = 0
  for (const [k, v] of Object.entries(data || {})) {
    const n = Number(v) || 0
    total += n
    const key = String(k).toLowerCase().replace(/ /g, '_')
    if (drop.includes(key)) {
      dropped += n
      gaps.push({ label: String(k).replace(/_/g, ' '), count: n })
      continue
    }
    out[k] = n
  }
  const gapShare = total > 0 ? dropped / total : 0
  return { data: out, dropped, total, gapShare, gaps }
}

/** Callout when unknown/other is material — data quality, not a story trope. */
export function ClassificationGapNote({
  dropped,
  total,
  gaps,
  kind = 'trope',
  onOpen,
}: {
  dropped: number
  total: number
  gaps?: { label: string; count: number }[]
  kind?: string
  onOpen?: () => void
}) {
  if (!dropped || !total) return null
  const pct = Math.round((dropped / total) * 100)
  const level = pct >= 25 ? 'High' : pct >= 10 ? 'Moderate' : 'Low'
  const tone =
    pct >= 25
      ? 'border-amber-200 bg-amber-50/80 text-amber-950'
      : pct >= 10
        ? 'border-slate-200 bg-slate-50 text-slate-800'
        : 'border-slate-100 bg-white text-slate-600'
  const interactive = !!onOpen
  const Tag = interactive ? 'button' : 'div'
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onOpen}
      className={`mt-3 w-full text-left rounded-xl border border-slate-200/60 shadow-sm px-3.5 py-3 text-[11px] leading-snug transition-colors ${tone} ${
        interactive ? 'cursor-pointer hover:bg-amber-50/95 hover:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200' : ''
      }`}
    >
      <div className="font-semibold tracking-wide uppercase text-[10px] text-slate-500">
        Review untagged data · {level}
      </div>
      <p className="mt-1.5 text-slate-700 font-medium">
        About{' '}
        <span
          className={`inline-block bg-amber-100/90 text-amber-900 px-1.5 py-0.5 rounded-md font-semibold ${
            pct < 25 ? 'bg-slate-100 text-slate-700' : ''
          }`}
        >
          {pct >= 25 ? `1 in ${Math.max(2, Math.round(100 / pct))}` : `${pct}%`}
        </span>
        {' '}
        videos ({dropped} of {total}) don&apos;t have a clear {kind} tag yet. Untagged items aren&apos;t ranked as story patterns.
      </p>
      <p className="mt-1.5 text-slate-500">This is a labeling gap, not a story trend.</p>
    </Tag>
  )
}

export function shortStudyTitle(question?: string) {
  const q = (question || '').trim()
  if (!q) return 'Micro-drama research'
  const lower = q.toLowerCase()
  if (lower.includes('micro-drama') || lower.includes('micro drama')) return 'YouTube micro-drama patterns'
  if (q.length <= 48) return q
  return q.slice(0, 46).trim() + '…'
}

export function StickyResearchBar({
  question,
  n,
  classified,
  statusLabel,
}: {
  question?: string
  n: number
  classified?: number
  statusLabel?: string
  onAsk?: () => void
  onEvidence?: () => void
  onCompare?: () => void
}) {
  // Full research question in sticky — counts live in the hero below
  const title = (question || '').trim() || shortStudyTitle(question)
  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2.5 bg-white/70 backdrop-blur-md border-b border-slate-200/60 mb-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Atlas research</div>
        <div
          className="text-sm font-extrabold tracking-tight text-slate-900 leading-snug line-clamp-2 max-w-4xl"
          title={title}
        >
          {title}
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
              onError={(e) => { const el = e.currentTarget; el.style.display = 'none' }}
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
  signals: { label?: string; genre?: string; name?: string; level?: string; note?: string; evidence?: string; representation?: string; performance?: string; theme?: string; trope?: string; title?: string; signal?: string; key?: string; code?: string }[]
}) {
  const list = signals || []
  const nameOf = (s: any): string | null => {
    const raw =
      s.label || s.genre || s.name || s.theme || s.trope || s.title || s.signal || s.key || s.code || ''
    const n = String(raw).trim()
    if (!n || /^signal$/i.test(n) || n === '—' || n === '-') return null
    if (/^(unknown|other|n\/a)$/i.test(n)) return null
    return n.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  }
  const withNames = list.map((s) => ({ s, name: nameOf(s) })).filter((x) => !!x.name)
  const sparse = withNames.filter(({ s }) => {
    const l = `${s.level || ''} ${s.note || ''} ${s.representation || ''}`.toLowerCase()
    return !l.trim() || l.includes('sparse') || l.includes('potential') || l.includes('under') || l.includes('open') || l.includes('white')
  })
  const sat = withNames.filter(({ s }) => {
    const l = `${s.level || ''} ${s.note || ''}`.toLowerCase()
    return l.includes('crowd') || l.includes('saturat') || l.includes('high')
  })
  const weak = withNames.filter(({ s }) => {
    const l = `${s.level || ''} ${s.note || ''} ${s.performance || ''}`.toLowerCase()
    return l.includes('weak') || l.includes('low')
  })
  const sparseItems = (sparse.length ? sparse : withNames).slice(0, 6).map((x) => x.name!)
  const satItems = sat.slice(0, 4).map((x) => x.name!)
  const weakItems = weak.slice(0, 4).map((x) => x.name!)

  const Chip = ({ label, tone }: { label: string; tone: 'emerald' | 'amber' | 'slate' }) => {
    const cls =
      tone === 'emerald'
        ? 'bg-emerald-100/80 text-emerald-800 border-emerald-200/60'
        : tone === 'amber'
          ? 'bg-amber-100/80 text-amber-900 border-amber-200/60'
          : 'bg-slate-100 text-slate-700 border-slate-200/60'
    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold border shadow-sm ${cls}`}>
        {label}
      </span>
    )
  }

  const Cell = ({
    title,
    tone,
    items,
    empty,
    chipTone,
  }: {
    title: string
    tone: string
    items: string[]
    empty: string
    chipTone: 'emerald' | 'amber' | 'slate'
  }) => (
    <div className={`rounded-xl border p-3 min-h-[100px] ${tone}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{title}</div>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((x, i) => (
            <Chip key={i} label={x} tone={chipTone} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-slate-500 leading-snug">{empty}</p>
      )}
    </div>
  )

  if (!withNames.length) {
    return (
      <AnalyzeEmpty
        title="No sparse themes flagged yet"
        body="When genres or tropes barely appear in this set, they will show up here as chips — not as market opportunities."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 font-medium">
        How common vs how it performs in this set · not proof of demand
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Cell
          title="Open questions"
          tone="border-2 border-dashed border-slate-300 bg-slate-50/80"
          items={[]}
          empty="Nothing parked here yet — sparse themes land on the right when we find them."
          chipTone="slate"
        />
        <Cell
          title="Sparse areas"
          tone="border-emerald-100 bg-emerald-50/60"
          items={sparseItems}
          empty="No sparse themes flagged in this set."
          chipTone="emerald"
        />
        <Cell
          title="Low traction"
          tone="border-slate-200 bg-slate-50/80"
          items={weakItems}
          empty="No low-traction themes called out."
          chipTone="slate"
        />
        <Cell
          title="Saturated"
          tone="border-amber-100 bg-amber-50/70"
          items={satItems}
          empty="No saturation flags beyond the top genres above."
          chipTone="amber"
        />
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
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-extrabold tracking-tight text-slate-900 tabular-nums">{n}</span>
        <span>videos</span>
        <span className="text-slate-300">·</span>
        <span className="tabular-nums font-medium text-slate-800">{classified ?? n}</span>
        <span>analyzed</span>
        {statusLabel && (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold uppercase">
            {statusLabel}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Based on this batch</p>
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
  const btn = 'text-[11px] font-semibold px-2 py-1 rounded-md border border-slate-200/80 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-colors'
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
      <div className={`grid gap-3 ${items.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
        {items.map((it) => {
          const interactive = !!(it.filter && onSelect)
          const isGap = /untagged|unclassified/i.test(it.label || '')
          return (
            <div
              key={it.label}
              className={`rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-300 ${
                interactive ? 'hover:-translate-y-1 hover:shadow-md cursor-pointer' : ''
              } ${it.tone || ''}`}
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => it.filter && onSelect?.(it.filter)}
                className="w-full text-left"
              >
                <div className="text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">
                  {isGap && String(it.value).includes('%') ? (
                    <span className="inline-flex items-center bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md">{it.value}</span>
                  ) : (
                    it.value
                  )}
                </div>
                <div className="text-xs font-extrabold tracking-tight text-slate-900 mt-1.5">{it.label}</div>
                {it.sub && (
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">{it.sub}</div>
                )}
              </button>
</div>
          )
        })}
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
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-slate-400">Common vs rare in this set</div>
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
          <p className="text-[10px] text-slate-500 mb-3">Based on this set of videos only</p>
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
  analysis,
}: {
  open: boolean
  onToggle: () => void
  report: Record<string, any>
  analysis?: any
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
          <div className="text-xs text-slate-500">Optional full write-up</div>
        </div>
        <span className="text-slate-400 text-lg">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-5 pb-6 pt-2 space-y-8 border-t border-slate-100">
          {keys.map(k =>
            report[k] ? (
              <ReportSection key={k} field={k}>
                {k === 'storytelling_pattern_analysis' ? (
                  <StoryPatternCallout prose={report[k]} analysis={analysis} />
                ) : ['dataset_overview', 'genre_analysis', 'engagement_analysis', 'limitations', 'conclusion'].includes(k) ? (
                  (() => {
                    const c = proseToInsightCallout(k, String(report[k]), analysis)
                    return (
                      <InsightCallout
                        headline={c.headline}
                        metric={c.metric}
                        bullets={c.bullets}
                        footnote={c.footnote}
                      />
                    )
                  })()
                ) : (
                  <p className="text-slate-700 leading-relaxed">{cleanReportProse(String(report[k]))}</p>
                )}
              </ReportSection>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}