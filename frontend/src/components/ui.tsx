import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Eye, OctagonAlert } from 'lucide-react'
import { HAZARDS, STATUS_LABEL } from '../lib/hazards'
import type { LabSeries, Provenance, Status } from '../lib/types'

export const STATUS_COLOR: Record<Status, string> = {
  nominal: 'var(--color-ok)', watch: 'var(--color-watch)', alert: 'var(--color-alert)', critical: 'var(--color-critical)',
}
const STATUS_ICON = { nominal: CheckCircle2, watch: Eye, alert: AlertTriangle, critical: OctagonAlert }

/** Status is never colour-only: icon + word + colour. */
export function StatusPill({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'md' }) {
  const Icon = STATUS_ICON[status]
  return (
    <span className={`inline-flex items-center gap-1 font-mono uppercase tracking-wider ${size === 'md' ? 'text-xs' : 'text-[10.5px]'}`}
          style={{ color: STATUS_COLOR[status] }}>
      <Icon size={size === 'md' ? 14 : 12} strokeWidth={2} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}

const PROV: Record<Provenance, { label: string; title: string }> = {
  LIVE_DONKI: { label: 'Live · NASA DONKI', title: 'Live space weather from NASA DONKI' },
  REAL_OSDR: { label: 'Real · NASA OSDR', title: 'Real Inspiration4 crew data from NASA OSDR' },
  SIMULATED: { label: 'Simulated', title: 'Simulated daily telemetry built from published NASA values' },
  LOGGED: { label: 'Logged by you', title: 'A reading you entered in a guided check-in' },
}
export function Provenance({ p, stale }: { p: Provenance; stale?: boolean }) {
  return (
    <span title={PROV[p].title}
          className="inline-flex items-center gap-1 border border-ink-3/60 px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-ink-2">
      {p === 'LIVE_DONKI' && <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-watch' : 'bg-ok pulse-dot'}`} />}
      {PROV[p].label}{stale ? ' · stale' : ''}
    </span>
  )
}

export function Plate({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`plate p-4 ${className}`}>
      {(title || extra) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="kicker">{title}</h3>}
          {extra}
        </header>
      )}
      {children}
    </section>
  )
}

export function Sparkline({ data, color = 'var(--color-ink-2)', width = 84, height = 22 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)])
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}

const TP = ['L-92', 'L-44', 'L-3', 'R+1', 'R+45', 'R+82', 'R+194']

/** Dot plot for one lab marker over the 7 time points, with the normal range band and the in-flight gap. */
export function LabDotPlot({ s, width = 300, height = 64, labels = true }: { s: LabSeries; width?: number; height?: number; labels?: boolean }) {
  const lo = s.points[0]?.range_min ?? undefined, hi = s.points[0]?.range_max ?? undefined
  const vals = s.points.map((p) => p.value).concat(lo !== undefined ? [lo] : [], hi !== undefined ? [hi] : [])
  const min = Math.min(...vals), max = Math.max(...vals)
  const pad = (max - min) * 0.15 || 1
  const y = (v: number) => height - 14 - ((v - (min - pad)) / (max - min + 2 * pad)) * (height - 22)
  // x slots: 3 pre-flight, gap, 4 post-flight
  const slot = (tp: string) => { const i = TP.indexOf(tp); return i < 3 ? i : i + 1 }
  const M = 20 // side margin so the first/last time labels are not clipped
  const x = (tp: string) => M + (slot(tp) / 7) * (width - 2 * M)
  const gapX = M + (2.55 / 7) * (width - 2 * M), gapW = (0.9 / 7) * (width - 2 * M)
  const pts = s.points.map((p) => [x(p.timepoint), y(p.value), p] as const)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${s.label} over time`}>
      {lo !== undefined && hi !== undefined && (
        <rect x={4} width={width - 8} y={y(hi)} height={Math.max(1, y(lo) - y(hi))} fill="rgba(94,127,82,.13)" />
      )}
      <foreignObject x={gapX} y={2} width={gapW} height={height - 16}><div className="hatch h-full w-full opacity-70" /></foreignObject>
      <polyline points={pts.filter((p) => TP.indexOf(p[2].timepoint) < 3).map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="var(--color-ink-3)" strokeWidth={1} />
      <polyline points={pts.filter((p) => TP.indexOf(p[2].timepoint) >= 3).map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="var(--color-ink-3)" strokeWidth={1} />
      {pts.map(([px, py, p]) => (
        <g key={p.timepoint}>
          <circle cx={px} cy={py} r={3.2} fill={p.status === 'nominal' ? 'var(--color-ink)' : STATUS_COLOR[p.status]}>
            <title>{`${p.timepoint}: ${p.value} ${s.unit}${lo !== undefined ? ` (normal ${lo}–${hi})` : ''} · ${p.source}`}</title>
          </circle>
          {labels && <text x={px} y={height - 2} textAnchor="middle" className="fill-ink-3 font-mono" fontSize={8.5}>{p.timepoint}</text>}
        </g>
      ))}
    </svg>
  )
}

/** Agent label with its full name (e.g. "Gravity Fields"); internal IDs like GRAV are never shown. */
export function AgentBadge({ id, color }: { id: string; color: string }) {
  const h = HAZARDS.find((x) => x.id === id)
  return (
    <span className="inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium"
          style={{ borderColor: color, color }} title={h?.agent}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{h?.name ?? id}
    </span>
  )
}
