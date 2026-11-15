import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer, Send } from 'lucide-react'
import { EMERGENCY_KEY, draftMessage, type EmergencyLog } from '../components/Emergency'
import { api } from '../lib/api'
import { ENVIRONMENTS, fmtDelay, hazard } from '../lib/hazards'
import { useMission } from '../lib/mission'
import type { Briefing, Dashboard, Reading, SentReport } from '../lib/types'

const T = ({ children }: { children: React.ReactNode }) => <th className="border-b border-ink py-1 pr-4 text-left font-mono text-[10.5px] font-normal uppercase tracking-wider text-ink-3">{children}</th>
const D = ({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) => <td className={`border-b border-rule py-1 pr-4 align-top ${mono ? 'font-mono text-[12.5px]' : 'text-[13px]'}`}>{children}</td>

/** One-page report for the flight surgeon, styled as a printed telemetry sheet (always light, prints cleanly). */
export default function Report() {
  const m = useMission()
  const [d, setD] = useState<Dashboard>()
  const [b, setB] = useState<Briefing>()
  const [readings, setReadings] = useState<Reading[]>([])
  const [sent, setSent] = useState<SentReport[]>([])
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const emergency = useMemo<EmergencyLog | undefined>(() => {
    try { const l = JSON.parse(localStorage.getItem(EMERGENCY_KEY) || 'null'); return l?.crew === m.crew ? l : undefined } catch { return undefined }
  }, [m.crew])

  useEffect(() => {
    api.dashboard(m).then(setD).catch(() => {})
    api.latestBriefing(m).then(setB).catch(() => setB(undefined))
    api.readings(m.crew, 12).then(setReadings).catch(() => {})
    api.reports(m.crew).then(setSent).catch(() => {})
  }, [m.crew, m.env, m.scenario]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  async function send() {
    if (!d) return
    setBusy(true)
    try {
      const data = {
        type: 'daily', readiness: d.readiness, overall: d.overall_status,
        hazards: d.hazards.map((h) => ({ name: h.name, status: h.status, headline: h.headline })),
        vitals: d.vitals.map((v) => ({ label: v.label, value: v.value, unit: v.unit, status: v.status, source: v.provenance })),
        briefing: b ? { headline: b.headline, actions: b.actions.map((a) => a.text) } : null,
        emergency: emergency ? draftMessage(emergency) : null,
      }
      const r = await api.sendReport(m.crew, m.env, data)
      setSent((s) => [r, ...s])
    } finally { setBusy(false) }
  }

  const env = ENVIRONMENTS.find((e) => e.id === m.env)!
  const latest = sent[0]
  const remaining = latest ? Math.max(0, Math.round((new Date(latest.arrives_at).getTime() - now) / 1000)) : 0

  return (
    <div className="min-h-full pb-16">
      <div className="no-print mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <Link to="/console" className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Mission console</Link>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 border border-ink px-3 py-2 font-mono text-xs uppercase tracking-wider"><Printer size={14} /> Print / save PDF</button>
          <button onClick={send} disabled={busy || !d} className="inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-2 font-mono text-xs uppercase tracking-wider text-paper disabled:opacity-60"><Send size={14} /> {busy ? 'Sending…' : 'Send to Mission Control'}</button>
        </div>
      </div>
      {latest && (
        <p className="no-print mx-auto mb-4 max-w-4xl px-6 font-mono text-[13px] text-ink-2">
          {remaining > 0
            ? <>In transit · arrives at Mission Control in <b className="text-ink">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</b> ({new Date(latest.arrives_at).toISOString().slice(11, 16)} UTC)</>
            : <>Delivered to Mission Control at {new Date(latest.arrives_at).toISOString().slice(11, 16)} UTC</>}
          {sent.length > 1 && <span className="text-ink-3"> · {sent.length} reports sent</span>}
        </p>
      )}

      <article data-theme="light" className="mx-auto max-w-4xl border border-ink bg-[#f4ecd8] px-10 py-8 text-ink shadow-[6px_6px_0_rgba(0,0,0,.12)] print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-ink pb-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em]">AEGIS · crew health report to flight surgeon</p>
            <h1 className="mt-1 font-display text-4xl">Crew member {m.crew}</h1>
            <p className="font-mono text-[12px] text-ink-2">{env.label} · {d ? `mission day ${d.environment.mission_day}` : ''} · message delay {d ? fmtDelay(d.environment.comms_delay_s) : '…'}</p>
          </div>
          <div className="text-right font-mono text-[12px]">
            <p>Generated {new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC</p>
            {d && <p className="mt-1 text-2xl font-display">Readiness {d.readiness}/100</p>}
            {d && <p className="uppercase">{d.overall_status}</p>}
          </div>
        </header>

        {!d ? <p className="mt-6 font-mono text-sm">Loading…</p> : (<>
          <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">1 · Hazards</h2>
          <table className="mt-1 w-full border-collapse"><thead><tr><T>Hazard</T><T>Status</T><T>Main signal</T></tr></thead>
            <tbody>{d.hazards.map((h) => <tr key={h.id}><D>{hazard(h.id).name}</D><D mono>{h.status.toUpperCase()}</D><D>{h.headline}</D></tr>)}</tbody></table>

          <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">2 · Readings today</h2>
          <table className="mt-1 w-full border-collapse"><thead><tr><T>Measure</T><T>Value</T><T>Baseline</T><T>Status</T><T>Source</T></tr></thead>
            <tbody>{d.vitals.map((v) => <tr key={v.key}><D>{v.label}</D><D mono>{v.value} {v.unit}</D><D mono>{v.baseline ?? '—'}</D><D mono>{v.status.toUpperCase()}</D><D mono>{v.provenance === 'LOGGED' ? 'logged' : v.provenance === 'SIMULATED' ? 'simulated' : v.provenance}</D></tr>)}</tbody></table>

          {readings.length > 0 && (<>
            <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">3 · Recent check-ins</h2>
            <table className="mt-1 w-full border-collapse"><thead><tr><T>Time (UTC)</T><T>Measure</T><T>Value</T><T>Note</T></tr></thead>
              <tbody>{readings.map((r) => <tr key={r.id}><D mono>{r.created_at.replace('T', ' ').slice(5, 16)}</D><D>{r.key}{r.source === 'camera' ? ' (camera)' : ''}</D><D mono>{r.value}{r.value2 ? `/${r.value2}` : ''}</D><D>{r.note || ''}</D></tr>)}</tbody></table>
          </>)}

          <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">4 · Blood markers (real · NASA OSDR)</h2>
          <table className="mt-1 w-full border-collapse"><thead><tr><T>Marker</T><T>L-3</T><T>R+1</T><T>Change</T><T>Normal</T></tr></thead>
            <tbody>{d.labs.filter((s) => ['glucose', 'absolute_lymphocytes', 'white_blood_cell_count', 'hemoglobin', 'calcium'].includes(s.marker)).map((s) => {
              const v = (tp: string) => s.points.find((p) => p.timepoint === tp)?.value ?? '—'
              return <tr key={s.marker}><D>{s.label} ({s.unit})</D><D mono>{v('L-3')}</D><D mono>{v('R+1')}</D><D mono>{s.change_r1_vs_l3_pct != null ? `${s.change_r1_vs_l3_pct > 0 ? '+' : ''}${s.change_r1_vs_l3_pct}%` : '—'}</D><D mono>{s.points[0]?.range_min != null ? `${s.points[0].range_min}–${s.points[0].range_max}` : '—'}</D></tr>
            })}</tbody></table>

          {b && (<>
            <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">5 · AEGIS assessment</h2>
            <p className="mt-1 font-display text-xl">{b.headline}</p>
            <ul className="mt-2 list-disc pl-5 text-[13.5px]">{b.happening.map((h, i) => <li key={i}>{h.text} <span className="font-mono text-[11px]">[{h.cites.join(',')}]</span></li>)}</ul>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider">Recommended actions</p>
            <ol className="list-decimal pl-5 text-[13.5px]">{b.actions.map((a, i) => <li key={i}>{a.text} <span className="font-mono text-[11px]">[{a.cites.join(',')}]</span></li>)}</ol>
          </>)}

          {emergency && (<>
            <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">6 · Emergency log</h2>
            <pre className="mt-1 whitespace-pre-wrap border border-ink p-3 font-mono text-[12px]">{draftMessage(emergency)}</pre>
          </>)}

          {b && (<>
            <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em]">References</h2>
            <ol className="mt-1 space-y-0.5 text-[12px]">{b.citations.map((c) => <li key={c.n}>[{c.n}] {c.title} · {c.heading_path.slice(-2).join(' › ')} · <span className="break-all font-mono text-[11px]">{c.url}</span></li>)}</ol>
          </>)}
          <p className="mt-8 border-t border-ink pt-2 font-mono text-[10.5px] text-ink-2">Guidance drawn from NASA sources; not a medical diagnosis. Daily readings marked “simulated” are demo telemetry.</p>
        </>)}
      </article>
    </div>
  )
}
