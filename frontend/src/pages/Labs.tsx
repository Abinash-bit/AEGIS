import { useEffect, useState } from 'react'
import { Footer, SiteNav } from '../components/SiteNav'
import { LabDotPlot, Provenance } from '../components/ui'
import { apiUrl } from '../lib/api'
import { useMission } from '../lib/mission'
import type { LabSeries } from '../lib/types'

const PANELS = [
  { id: 'CBC', label: 'Blood count' },
  { id: 'CMP', label: 'Metabolic panel' },
  { id: 'CARDIO', label: 'Cardiovascular & inflammation' },
] as const

export default function Labs() {
  const m = useMission()
  const [crew, setCrew] = useState(m.crew)
  const [panel, setPanel] = useState<(typeof PANELS)[number]['id']>('CBC')
  const [labs, setLabs] = useState<LabSeries[]>([])
  useEffect(() => { fetch(apiUrl(`/api/labs/${crew}`)).then((r) => r.json()).then(setLabs).catch(() => setLabs([])) }, [crew])
  const shown = labs.filter((s) => s.panel === panel)

  return (
    <div>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-6 pt-10">
        <Provenance p="REAL_OSDR" />
        <h1 className="mt-3 font-display text-5xl">Clinical labs</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          Real blood tests from the four civilian astronauts of Inspiration4 (2021, three days in orbit), taken 92, 44 and 3 days before launch
          and 1, 45, 82 and 194 days after return. No samples were taken during the flight.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-6 border-y border-ink-3/50 py-3">
          <div className="flex gap-1">
            {['C001', 'C002', 'C003', 'C004'].map((c) => (
              <button key={c} onClick={() => setCrew(c)} className={`px-3 py-1 font-mono text-sm ${crew === c ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-4">
            {PANELS.map((p) => (
              <button key={p.id} onClick={() => setPanel(p.id)}
                      className={`font-mono text-xs uppercase tracking-wider ${panel === p.id ? 'text-ink underline underline-offset-4' : 'text-ink-3 hover:text-ink'}`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <figure key={s.marker} className="plate p-4">
              <figcaption className="flex items-baseline justify-between gap-2">
                <span className="font-display text-xl">{s.label}</span>
                <span className="font-mono text-[11px] text-ink-3">{s.unit}</span>
              </figcaption>
              <LabDotPlot s={s} height={80} />
              <p className="mt-1 font-mono text-[11px] text-ink-3">
                {s.points[0]?.range_min != null ? `Normal ${s.points[0].range_min}–${s.points[0].range_max}` : 'Research assay · no clinical range'}
                {s.change_r1_vs_l3_pct != null && ` · R+1 vs L-3 ${s.change_r1_vs_l3_pct > 0 ? '+' : ''}${s.change_r1_vs_l3_pct}%`}
                {` · ${s.points[0]?.source}`}
              </p>
            </figure>
          ))}
        </div>
        <p className="mt-6 font-mono text-[11px] text-ink-3">Source: NASA Open Science Data Repository OSD-569, OSD-575 · Overbey et al., Nature 2024.</p>
      </main>
      <Footer />
    </div>
  )
}
