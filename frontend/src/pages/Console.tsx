import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, ClipboardPlus, FileText, Loader2, MessageSquareText, Radio, Siren, X } from 'lucide-react'
import { BodyMap } from '../components/BodyMap'
import { CheckIn } from '../components/CheckIn'
import { CrewView } from '../components/CrewView'
import { Emergency } from '../components/Emergency'
import { RoutineView } from '../components/RoutineView'
import type { Guide } from '../lib/guides'
import { Assistant } from '../components/assistant/Assistant'
import { Logo } from '../components/SiteNav'
import { LabDotPlot, Plate, Provenance, STATUS_COLOR, Sparkline, StatusPill } from '../components/ui'
import { api } from '../lib/api'
import { ENVIRONMENTS, fmtDelay, hazard } from '../lib/hazards'
import { useMission } from '../lib/mission'
import { ThemeToggle } from '../lib/theme'
import type { Dashboard, HazardSummary, Vital } from '../lib/types'

function ago(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min ago` : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`
}

function TopBar({ d, onCheckIn, onEmergency }: { d?: Dashboard; onCheckIn: () => void; onEmergency: () => void }) {
  const m = useMission()
  const env = ENVIRONMENTS.find((e) => e.id === m.env)!
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t) }, [])
  const link = 'font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 hover:text-ink'
  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-ink-3/50 px-5">
      <Logo small />
      <div className="flex items-center gap-4 font-mono text-[12px] text-ink-2">
        <span className="text-ink"><b>{m.crew}</b></span>
        <Link to="/mission" className="underline decoration-ink-3 underline-offset-4 hover:text-ink">{env.label}</Link>
        {d && <span>Sol {d.environment.mission_day}/{d.environment.mission_length_days}</span>}
        {d && <span title="One-way message delay to Earth">↯ {fmtDelay(d.environment.comms_delay_s)}</span>}
        {m.replay && <span className="border border-orange/70 px-1.5 text-orange">May 2024 storm replay</span>}
        {m.scenario === 'landing' && <span className="border border-mustard/70 px-1.5 text-mustard">Landing day</span>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onCheckIn} className="inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper hover:bg-navy">
          <ClipboardPlus size={14} /> Check in
        </button>
        <button onClick={onEmergency} className="inline-flex items-center gap-1.5 border border-critical px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-critical hover:bg-critical hover:text-paper">
          <Siren size={14} /> Emergency
        </button>
      </div>
      <nav className="ml-auto hidden items-center gap-4 lg:flex">
        <Link to="/report" className={`${link} inline-flex items-center gap-1`}><FileText size={12} /> Report</Link>
        <Link to="/labs" className={link}>Labs</Link>
        <Link to="/space-weather" className={link}>Space weather</Link>
        <Link to="/library" className={link}>Library</Link>
        <Link to="/memory" className={link}>Memory</Link>
      </nav>
      <span className="font-mono text-[12px] text-ink-3">{now.toISOString().slice(11, 16)} UTC</span>
      <ThemeToggle />
    </header>
  )
}

function HazardTile({ h, onOpen }: { h: HazardSummary; onOpen: () => void }) {
  const meta = hazard(h.id)
  return (
    <button onClick={onOpen} className="plate group flex min-w-0 flex-col p-3 text-left transition hover:-translate-y-[1px]"
            style={{ borderTop: `3px solid ${meta.color}` }}>
      <div className="flex items-center justify-between">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} aria-hidden />
        <StatusPill status={h.status} />
      </div>
      <p className="mt-2 font-display text-[15.5px] leading-tight" title={meta.agent}>{meta.name}</p>
      <p className="mt-1 truncate font-mono text-[11px] text-ink-2" title={h.key_metric}>{h.key_metric}</p>
      <div className="mt-auto pt-2"><Sparkline data={h.spark} color={meta.color} width={110} height={18} /></div>
    </button>
  )
}

const SHORT: Record<string, string> = {
  sleep: 'Sleep', mood: 'Mood', reaction: 'Reaction time', hr: 'Resting heart rate', sbp: 'Blood pressure',
  dbp: 'BP (diastolic)', temp: 'Body temperature', co2: 'Cabin CO₂', cabin_temp: 'Cabin temperature', dose: 'Radiation dose',
}

function VitalRow({ v }: { v: Vital }) {
  const d = v.delta_vs_baseline_pct
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-rule/60 py-1.5 last:border-0">
      <span className="truncate text-[13.5px]" title={v.label}>{SHORT[v.key] ?? v.label}
        {v.provenance === 'LOGGED' && <span className="ml-1.5 border border-ink-3/60 px-1 font-mono text-[9.5px] uppercase text-ink-2">logged</span>}</span>
      <span className="font-mono text-[13px]"><b>{v.value}</b> <span className="text-ink-3">{v.unit}</span>
        {d != null && <span className="ml-1 text-[11px] text-ink-3">({d > 0 ? '+' : ''}{d}%)</span>}</span>
      <Sparkline data={v.spark} color={STATUS_COLOR[v.status]} width={64} height={16} />
      <span className="w-16 text-right"><StatusPill status={v.status} /></span>
    </li>
  )
}

function HazardDrawer({ h, d, onClose, onAsk }: { h: HazardSummary; d: Dashboard; onClose: () => void; onAsk: (q: string) => void }) {
  const meta = hazard(h.id)
  const vitals = d.vitals.filter((v) => v.hazard === h.id)
  const labs = d.labs.filter((s) => s.hazard === h.id).slice(0, 3)
  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-ink/10" onClick={onClose}>
      <aside className="scroll-thin h-full w-full max-w-md overflow-y-auto border-l border-ink-3/60 bg-paper p-5 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="kicker">Hazard · watched by the {meta.agent}</p>
            <h3 className="mt-1 font-display text-3xl">{meta.name}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink"><X size={20} /></button>
        </div>
        <img src={meta.image} alt="" className="faded-print mt-3 h-28 w-full object-cover" />
        <div className="mt-3"><StatusPill status={h.status} size="md" /></div>
        <p className="kicker mt-5 mb-2">Signals</p>
        <ul className="space-y-2">
          {h.triggers.map((t) => (
            <li key={t.signal} className="flex items-start gap-2 text-[14px]">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />
              <span>{t.message}</span>
            </li>
          ))}
          {h.triggers.length === 0 && <li className="text-sm italic text-ink-3">No active signals.</li>}
        </ul>
        {vitals.length > 0 && (<><p className="kicker mt-5 mb-1">Readings</p><ul>{vitals.map((v) => <VitalRow key={v.key} v={v} />)}</ul></>)}
        {labs.length > 0 && (
          <><p className="kicker mt-5 mb-1">Blood markers · real NASA OSDR</p>
            {labs.map((s) => <div key={s.marker} className="mb-2"><p className="text-[13px]">{s.label} <span className="font-mono text-[11px] text-ink-3">{s.unit}</span></p><LabDotPlot s={s} height={56} /></div>)}</>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => { onAsk(`What does my ${meta.short.toLowerCase()} status mean, and what should I do?`); onClose() }}
                  className="inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-paper">
            <MessageSquareText size={14} /> Ask the {meta.agent}
          </button>
          <Link to={`/hazards/${h.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider underline underline-offset-4">
            Full hazard page <ArrowUpRight size={13} />
          </Link>
        </div>
      </aside>
    </div>
  )
}

export default function Console() {
  const m = useMission()
  const [params] = useSearchParams()
  const autoAsk = params.get('ask') ?? undefined   // e.g. /console?ask=How%20am%20I%20doing%3F (demo deep link)
  const [d, setD] = useState<Dashboard>()
  const [err, setErr] = useState<string>()
  const [open, setOpen] = useState<HazardSummary>()
  const [prefill, setPrefill] = useState<string>()
  const [chatOpen, setChatOpen] = useState(false)  // tablet / phone: assistant as slide-over
  const [view, setView] = useState<'overview' | 'body' | 'routine' | 'crew'>('overview')
  const [checkIn, setCheckIn] = useState<{ open: boolean; key?: Guide['key'] }>({ open: false })
  const [emergency, setEmergency] = useState(false)
  const [sendNow, setSendNow] = useState<{ text: string; nonce: number }>()
  const [reloadKey, setReloadKey] = useState(0)
  const ask = (q: string) => { setSendNow({ text: q, nonce: Date.now() }); setChatOpen(true) }

  useEffect(() => {
    let alive = true
    const load = () => api.dashboard(m).then((x) => { if (alive) { setD(x); setErr(undefined) } }).catch((e) => alive && setErr(String(e.message || e)))
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [m.crew, m.env, m.scenario, m.replay, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearPrefill = useCallback(() => setPrefill(undefined), [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar d={d} onCheckIn={() => setCheckIn({ open: true })} onEmergency={() => setEmergency(true)} />
      {!d ? (
        <div className="flex flex-1 items-center justify-center text-ink-2">
          {err ? <p>Could not load the dashboard: {err}. Is the backend running on port 8000?</p>
            : <p className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Reading the mission data…</p>}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,1fr)]">
          {/* DASHBOARD */}
          <main className="scroll-thin relative min-h-0 overflow-y-auto px-5 py-4">
            <div className="relative mb-4 flex items-end justify-between overflow-hidden border-b border-ink-3/40 pb-3">
              <img src="/images/distance.webp" alt="" className="faded-print pointer-events-none absolute left-[30%] top-[-30%] h-[150%] w-[38%] object-cover opacity-30 [mask-image:linear-gradient(90deg,transparent,#000_25%,#000_75%,transparent)]" />
              <div className="relative">
                <p className="kicker">Crew readiness</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl leading-none">{d.readiness}</span>
                  <span className="font-mono text-ink-3">/ 100</span>
                  <StatusPill status={d.overall_status} size="md" />
                </div>
              </div>
              <div className="relative flex flex-wrap justify-end gap-2">
                <Provenance p="LIVE_DONKI" stale={d.space_weather.stale} />
                <Provenance p="REAL_OSDR" />
                <Provenance p="SIMULATED" />
              </div>
            </div>

            <div className="mb-4 flex gap-5 border-b border-ink-3/30" role="tablist">
              {([['overview', 'Overview'], ['body', 'Body map'], ['routine', 'Routine'], ['crew', 'Crew']] as const).map(([k, l]) => (
                <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                        className={`-mb-px border-b-2 pb-2 font-mono text-[11.5px] uppercase tracking-[0.12em] ${view === k ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}>{l}</button>
              ))}
            </div>

            {view === 'body' && <BodyMap d={d} onAsk={ask} />}
            {view === 'routine' && <RoutineView crew={m.crew} refreshKey={reloadKey} onCheckIn={(key) => setCheckIn({ open: true, key })} />}
            {view === 'crew' && <CrewView onPick={() => setView('overview')} />}

            {view === 'overview' && (<>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {d.hazards.map((h) => <HazardTile key={h.id} h={h} onOpen={() => setOpen(h)} />)}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Plate title="Vitals today" extra={<Provenance p="SIMULATED" />}>
                <ul>{d.vitals.filter((v) => ['sleep', 'mood', 'reaction', 'hr', 'sbp', 'temp', 'glucose', 'balance'].includes(v.key)).map((v) => <VitalRow key={v.key} v={v} />)}</ul>
              </Plate>
              <Plate title={<span className="inline-flex items-center gap-1.5"><Radio size={12} /> Space weather</span>}
                     extra={<Provenance p="LIVE_DONKI" stale={d.space_weather.stale} />}>
                <div className="mb-2 flex gap-5 font-mono text-[12px] text-ink-2">
                  <span>Max flare <b className="text-ink">{d.space_weather.max_flare_class ?? '—'}</b></span>
                  <span>SEP <b className="text-ink">{d.space_weather.sep_count}</b></span>
                  <span>Fast CME <b className="text-ink">{d.space_weather.fast_cme_count}</b></span>
                  <span>Kp <b className="text-ink">{d.space_weather.max_kp ?? '—'}</b></span>
                </div>
                <ul className="space-y-1">
                  {d.space_weather.events.slice(0, 5).map((e) => (
                    <li key={e.id} className="grid grid-cols-[42px_1fr_auto] items-center gap-2 font-mono text-[12px]">
                      <span className="text-ink-3">{e.type}</span>
                      <span className="truncate text-ink">{e.class_or_value}</span>
                      <span className="text-ink-3">{ago(e.time)}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/space-weather" className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-2 underline underline-offset-4">All events <ArrowUpRight size={12} /></Link>
              </Plate>
            </div>

            <Plate className="mt-4" title="Blood markers · before launch → after return" extra={<Provenance p="REAL_OSDR" />}>
              <div className="grid gap-4 md:grid-cols-3">
                {['glucose', 'absolute_lymphocytes', 'calcium'].map((k) => {
                  const s = d.labs.find((x) => x.marker === k)
                  if (!s) return null
                  return (
                    <div key={k}>
                      <p className="text-[13.5px]">{s.label} <span className="font-mono text-[11px] text-ink-3">{s.unit}</span>
                        {s.change_r1_vs_l3_pct != null && <span className="ml-1 font-mono text-[11px] text-ink-3">R+1 vs L-3 {s.change_r1_vs_l3_pct > 0 ? '+' : ''}{s.change_r1_vs_l3_pct}%</span>}</p>
                      <LabDotPlot s={s} height={60} />
                    </div>
                  )
                })}
              </div>
              <p className="mt-1 font-mono text-[10.5px] text-ink-3">Hatched band: no samples during flight · green band: lab normal range · <Link to="/labs" className="underline">all markers</Link></p>
            </Plate>

            </>)}

            {open && <HazardDrawer h={open} d={d} onClose={() => setOpen(undefined)} onAsk={(q) => { setPrefill(q); setChatOpen(true) }} />}
          </main>

          {/* ASSISTANT: docked on desktop, slide-over on smaller screens */}
          <aside className={`min-h-0 border-l border-ink-3/50 bg-paper-2/40 ${chatOpen ? 'fixed inset-0 z-40 bg-paper lg:static' : 'hidden lg:block'}`}>
            {chatOpen && <button onClick={() => setChatOpen(false)} className="absolute right-3 top-3 z-50 lg:hidden" aria-label="Close assistant"><X /></button>}
            <Assistant dashboard={d} prefill={prefill} onPrefillUsed={clearPrefill} autoAsk={autoAsk} sendNow={sendNow} />
          </aside>
          {!chatOpen && (
            <button onClick={() => setChatOpen(true)} className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-paper lg:hidden">
              <MessageSquareText size={16} /> AEGIS
            </button>
          )}
        </div>
      )}
      {checkIn.open && (
        <CheckIn crew={m.crew} initial={checkIn.key} onClose={() => setCheckIn({ open: false })}
                 onSaved={(q) => { setCheckIn({ open: false }); setReloadKey((k) => k + 1); ask(q) }} />
      )}
      {emergency && d && <Emergency crew={m.crew} env={m.env} delayS={d.environment.comms_delay_s} onClose={() => setEmergency(false)} />}
    </div>
  )
}
