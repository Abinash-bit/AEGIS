import { useMemo, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { hazard } from '../lib/hazards'
import type { Dashboard, HazardId, Status } from '../lib/types'
import { STATUS_COLOR, StatusPill } from './ui'

interface Region {
  id: string; label: string; hazard: HazardId; x: number; y: number; r: number
  about: string; risks: string[]; vitals: string[]; labs: string[]; signals: string[]; ask: string
}

// Hotspots on the 1024 × 1536 vintage anatomical plate (public/images/body.webp). Each region pulls its readings, lab markers and hazard signals from the dashboard.
const REGIONS: Region[] = [
  { id: 'mind', label: 'Mind & sleep', hazard: 'ISO', x: 509, y: 62, r: 40,
    about: 'Isolation, confinement and shift work affect sleep, mood, reactions and teamwork.',
    risks: ['Behavioral changes & psychiatric disorders', 'Inadequate sleep & irregular schedules', 'Inadequate teamwork'],
    vitals: ['sleep', 'mood', 'reaction'], labs: [], signals: ['sleep', 'mood', 'reaction'],
    ask: 'How are my sleep and mood affecting me, and what can I do?' },
  { id: 'eyes', label: 'Eyes & brain fluid', hazard: 'GRAV', x: 540, y: 128, r: 16,
    about: 'Fluid shifting toward the head in weightlessness can change the eyes and brain (SANS), NASA’s leading spaceflight health risk.',
    risks: ['Spaceflight Associated Neuro-ocular Syndrome (SANS)'], vitals: [], labs: [], signals: ['microgravity', 'bp'],
    ask: 'What is SANS, and should I watch for changes in my vision?' },
  { id: 'ear', label: 'Inner ear & balance', hazard: 'GRAV', x: 441, y: 146, r: 15,
    about: 'The balance organs must readjust with every change in gravity, which can cause motion sickness and disorientation.',
    risks: ['Altered sensorimotor & vestibular function'], vitals: ['balance'], labs: [], signals: ['balance', 'gravity_transition'],
    ask: 'How does gravity change affect my balance and orientation?' },
  { id: 'lungs', label: 'Lungs & cabin air', hazard: 'ENV', x: 447, y: 360, r: 44,
    about: 'Every breath comes from the sealed cabin: CO₂, other gases and temperature are part of crew health.',
    risks: ['Hypoxia', 'Host–microorganism interactions'], vitals: ['co2', 'cabin_temp'], labs: [], signals: ['co2'],
    ask: 'Is the cabin CO₂ level affecting me?' },
  { id: 'heart', label: 'Heart & blood vessels', hazard: 'GRAV', x: 530, y: 378, r: 36,
    about: 'Without gravity the heart works less and fluids move upward; after landing, standing up can make you dizzy.',
    risks: ['Cardiovascular adaptations', 'Reduced cardiorespiratory fitness'], vitals: ['hr', 'sbp', 'dbp'], labs: ['fibrinogen'], signals: ['bp', 'hr'],
    ask: 'What do my heart rate and blood pressure tell you?' },
  { id: 'immune', label: 'Immune system & blood', hazard: 'ENV', x: 512, y: 560, r: 44,
    about: 'Stress, radiation and the closed environment can alter immune responses and reactivate dormant viruses.',
    risks: ['Altered immune system responses'], vitals: ['temp'], labs: ['white_blood_cell_count', 'absolute_lymphocytes', 'crp'], signals: ['lymphocytes_drop', 'fever'],
    ask: 'Is my immune system affected? Explain my lymphocyte results.' },
  { id: 'cells', label: 'Cells & radiation dose', hazard: 'RAD', x: 676, y: 548, r: 28,
    about: 'Space radiation can damage DNA in every cell, raising long-term cancer risk; solar storms bring short-term danger.',
    risks: ['Radiation-induced cancers', 'Cardiovascular & nervous-system effects'], vitals: ['dose'], labs: [], signals: ['flare_X', 'flare_M', 'sep', 'fast_cme', 'dose'],
    ask: 'How much radiation have I had, and what does the latest solar activity mean for me?' },
  { id: 'bones', label: 'Bones', hazard: 'GRAV', x: 600, y: 1026, r: 32,
    about: 'Without load, bones lose minerals; calcium released from bone can also raise kidney-stone risk.',
    risks: ['Spaceflight-induced bone changes'], vitals: [], labs: ['calcium'], signals: ['lab_calcium'],
    ask: 'How do I protect my bones in weightlessness?' },
  { id: 'muscles', label: 'Muscles & fitness', hazard: 'GRAV', x: 428, y: 855, r: 42,
    about: 'Leg and back muscles weaken quickly without gravity; daily exercise is the main countermeasure.',
    risks: ['Reduced musculoskeletal fitness'], vitals: [], labs: [], signals: [],
    ask: 'What exercise keeps my muscles strong in space?' },
]

const ORDER: Record<Status, number> = { nominal: 0, watch: 1, alert: 2, critical: 3 }

export function BodyMap({ d, onAsk }: { d: Dashboard; onAsk: (q: string) => void }) {
  const [sel, setSel] = useState('heart')
  const status = useMemo(() => {
    const out: Record<string, Status> = {}
    const trig = d.hazards.flatMap((h) => h.triggers)
    for (const r of REGIONS) {
      const ss: Status[] = [
        ...r.vitals.map((k) => d.vitals.find((v) => v.key === k)?.status).filter(Boolean) as Status[],
        ...trig.filter((t) => r.signals.includes(t.signal)).map((t) => t.status),
        ...r.labs.map((k) => d.labs.find((s) => s.marker === k)?.points.at(-1)?.status).filter(Boolean) as Status[],
      ]
      out[r.id] = ss.reduce<Status>((a, b) => (ORDER[b] > ORDER[a] ? b : a), 'nominal')
    }
    return out
  }, [d])
  const region = REGIONS.find((r) => r.id === sel)!
  const meta = hazard(region.hazard)

  return (
    <div className="grid items-start gap-5 md:grid-cols-[minmax(260px,0.85fr)_1.15fr]">
      <figure data-theme="light" className="plate relative flex justify-center bg-[#f1e6cc] p-2">
        <svg viewBox="0 0 1024 1536" className="h-auto max-h-[calc(100vh-230px)] w-full" role="img" aria-label="Body map: vintage anatomical illustration with clickable regions">
          <image href="/images/body.webp" x="0" y="0" width="1024" height="1536" preserveAspectRatio="xMidYMid meet" />
          {REGIONS.map((r) => {
            const c = STATUS_COLOR[status[r.id]], on = sel === r.id
            return (
              <g key={r.id} onClick={() => setSel(r.id)} className="cursor-pointer" role="button" aria-label={r.label}>
                <circle cx={r.x} cy={r.y} r={r.r * 0.8} fill={c} opacity={on ? 0.3 : 0.14} className={status[r.id] !== 'nominal' ? 'pulse-dot' : ''} />
                <circle cx={r.x} cy={r.y} r={Math.max(8, r.r * 0.26)} fill={c} stroke="#f4ecd8" strokeWidth={4} />
                {on && <circle cx={r.x} cy={r.y} r={r.r + 6} fill="none" stroke="#2b2621" strokeWidth={4} strokeDasharray="10 8" />}
              </g>
            )
          })}
        </svg>
        <figcaption className="absolute bottom-2 left-3 font-mono text-[10.5px] text-ink-3">Tap a region</figcaption>
      </figure>

      <div className="flex min-h-0 flex-col">
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button key={r.id} onClick={() => setSel(r.id)}
                    className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[12.5px] ${sel === r.id ? 'border-ink text-ink' : 'border-ink-3/50 text-ink-2'}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status[r.id]] }} />{r.label}
            </button>
          ))}
        </div>
        <section className="plate mt-4 flex-1 p-5 fade-up" key={region.id}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-3xl">{region.label}</h3>
            <StatusPill status={status[region.id]} size="md" />
          </div>
          <p className="mt-1 text-[13px] text-ink-3">Watched by the {meta.agent}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{region.about}</p>

          {(region.vitals.length > 0 || region.labs.length > 0) && <p className="kicker mt-5 mb-2">Your readings</p>}
          <ul className="space-y-1.5">
            {region.vitals.map((k) => d.vitals.find((v) => v.key === k)).filter(Boolean).map((v) => (
              <li key={v!.key} className="flex items-center justify-between border-b border-rule/60 pb-1 text-[14px]">
                <span>{v!.label} {v!.provenance === 'LOGGED' && <span className="ml-1 font-mono text-[10px] uppercase text-ink-3">logged</span>}</span>
                <span className="flex items-center gap-3 font-mono"><b>{v!.value}</b> {v!.unit}<StatusPill status={v!.status} /></span>
              </li>
            ))}
            {region.labs.map((k) => d.labs.find((s) => s.marker === k)).filter(Boolean).map((s) => {
              const last = s!.points.at(-1)!
              return (
                <li key={s!.marker} className="flex items-center justify-between border-b border-rule/60 pb-1 text-[14px]">
                  <span>{s!.label} <span className="ml-1 font-mono text-[10px] uppercase text-ink-3">real · {last.timepoint}</span></span>
                  <span className="flex items-center gap-3 font-mono"><b>{last.value}</b> {s!.unit}
                    {s!.change_r1_vs_l3_pct != null && <span className="text-[11px] text-ink-3">R+1 {s!.change_r1_vs_l3_pct > 0 ? '+' : ''}{s!.change_r1_vs_l3_pct}%</span>}</span>
                </li>
              )
            })}
          </ul>

          <p className="kicker mt-5 mb-2">Related NASA risks</p>
          <ul className="space-y-1">{region.risks.map((x) => <li key={x} className="text-[14px] text-ink-2">— Risk of {x.charAt(0).toLowerCase() + x.slice(1)}</li>)}</ul>

          <button onClick={() => onAsk(region.ask)} className="mt-6 inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-paper hover:bg-navy">
            <MessageSquareText size={14} /> Ask the {meta.agent}
          </button>
        </section>
      </div>
    </div>
  )
}
