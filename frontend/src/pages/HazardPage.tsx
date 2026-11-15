import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Footer, SiteNav } from '../components/SiteNav'
import { LabDotPlot, STATUS_COLOR, StatusPill } from '../components/ui'
import { api } from '../lib/api'
import { HAZARDS, hazard } from '../lib/hazards'
import { useMission } from '../lib/mission'
import type { Chunk, Dashboard } from '../lib/types'

const QUERY: Record<string, string> = {
  RAD: 'space radiation health risks cancer solar particle events protection shielding',
  ISO: 'isolation confinement sleep behavioral health teamwork risks countermeasures',
  DIST: 'distance from Earth communication delay autonomy medical care food',
  GRAV: 'microgravity bone muscle cardiovascular fluid shift eyes SANS countermeasures',
  ENV: 'closed environment air microbes immune system habitat risks',
}

export default function HazardPage() {
  const { id = 'RAD' } = useParams()
  const meta = hazard(id) ?? HAZARDS[0]
  const m = useMission()
  const [d, setD] = useState<Dashboard>()
  const [refs, setRefs] = useState<Chunk[]>([])
  useEffect(() => {
    api.dashboard(m).then(setD).catch(() => {})
    api.kbSearch(QUERY[meta.id], meta.id, 6).then(setRefs).catch(() => {})
  }, [meta.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const h = d?.hazards.find((x) => x.id === meta.id)

  return (
    <div>
      <SiteNav />
      <header className="relative">
        <img src={meta.image} alt={meta.imageAlt} className="h-[46vh] min-h-[300px] w-full border-b border-ink-3/50 object-cover" />
      </header>
      <main className="mx-auto max-w-6xl px-6 pt-10">
        <Link to="/console" className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-ink-2 hover:text-ink"><ArrowLeft size={14} /> Mission console</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} aria-hidden />
          <span className="kicker">Watched by the {meta.agent}</span>
          {h && <StatusPill status={h.status} size="md" />}
        </div>
        <h1 className="mt-2 font-display text-5xl">{meta.name}</h1>
        <p className="mt-4 max-w-3xl text-xl leading-relaxed text-ink-2">{meta.blurb}</p>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <section>
            <h2 className="kicker mb-3">Right now for {m.crew}</h2>
            {!h && <p className="text-ink-3">Loading…</p>}
            {h && (
              <ul className="space-y-3">
                {h.triggers.map((t) => (
                  <li key={t.signal} className="plate flex gap-3 p-3 text-[15px]">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />{t.message}
                  </li>
                ))}
              </ul>
            )}
            {d && d.labs.filter((s) => s.hazard === meta.id).slice(0, 4).map((s) => (
              <div key={s.marker} className="mt-5">
                <p className="text-[14px]">{s.label} <span className="font-mono text-[11px] text-ink-3">{s.unit} · real NASA OSDR</span></p>
                <LabDotPlot s={s} height={60} />
              </div>
            ))}
            <h2 className="kicker mt-8 mb-2">AEGIS watches</h2>
            <ul className="space-y-1.5">{meta.watches.map((w) => <li key={w} className="text-ink-2">— {w}</li>)}</ul>
          </section>

          <section>
            <h2 className="kicker mb-3">What NASA says · from the knowledge base</h2>
            <div className="space-y-5">
              {refs.map((c) => (
                <article key={c.id} className="border-l-2 pl-4" style={{ borderColor: meta.color }}>
                  <h3 className="font-display text-xl leading-snug">{c.title}</h3>
                  <p className="font-mono text-[11px] text-ink-3">{c.heading_path.join(' › ')}</p>
                  <p className="mt-2 line-clamp-5 leading-relaxed text-ink-2">{c.text}</p>
                  <a href={c.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider underline underline-offset-4">Source <ExternalLink size={11} /></a>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-16 flex flex-wrap gap-3 border-t border-ink-3/50 pt-6">
          {HAZARDS.filter((x) => x.id !== meta.id).map((x) => (
            <Link key={x.id} to={`/hazards/${x.id}`} className="border border-ink-3/60 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-ink-2 hover:border-ink hover:text-ink">{x.name}</Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
