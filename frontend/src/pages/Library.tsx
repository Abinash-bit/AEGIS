import { useEffect, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Footer, SiteNav } from '../components/SiteNav'
import { AgentBadge } from '../components/ui'
import { api } from '../lib/api'
import { HAZARDS } from '../lib/hazards'
import type { Chunk } from '../lib/types'

const KB_TO_ID: Record<string, string> = {
  space_radiation: 'RAD', isolation_confinement: 'ISO', distance_from_earth: 'DIST', gravity_fields: 'GRAV', hostile_closed_environments: 'ENV',
}

export default function Library() {
  const [q, setQ] = useState('How does sleep affect performance in space?')
  const [hz, setHz] = useState<string>('')
  const [res, setRes] = useState<Chunk[]>([])
  const [busy, setBusy] = useState(false)
  const run = () => { setBusy(true); api.kbSearch(q, hz || undefined, 10).then(setRes).finally(() => setBusy(false)) }
  useEffect(run, [hz]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 pt-10">
        <p className="kicker">Knowledge library</p>
        <h1 className="mt-2 font-display text-5xl">What AEGIS reads</h1>
        <p className="mt-3 text-lg text-ink-2">Every piece of advice cites one of these passages from NASA’s Human Research Program pages, podcasts and videos. Search them yourself.</p>
        <form onSubmit={(e) => { e.preventDefault(); run() }} className="mt-8 flex items-center gap-2 border border-ink bg-card px-3 py-2">
          <Search size={18} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent text-lg outline-none" aria-label="Search the knowledge base" />
          <button className="font-mono text-xs uppercase tracking-wider">{busy ? 'Searching…' : 'Search'}</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setHz('')} className={`px-2 py-0.5 font-mono text-xs ${hz === '' ? 'bg-ink text-paper' : 'border border-ink-3/60 text-ink-2'}`}>All hazards</button>
          {HAZARDS.map((h) => (
            <button key={h.id} onClick={() => setHz(h.id)} className={`px-2 py-0.5 font-mono text-xs ${hz === h.id ? 'bg-ink text-paper' : 'border border-ink-3/60 text-ink-2'}`}>{h.short}</button>
          ))}
        </div>
        <div className="mt-8 space-y-4">
          {res.map((c) => (
            <article key={c.id} className="plate p-4">
              <div className="flex flex-wrap items-center gap-2">
                {c.hazards.map((h) => KB_TO_ID[h] && <AgentBadge key={h} id={KB_TO_ID[h]} color={HAZARDS.find((x) => x.id === KB_TO_ID[h])!.color} />)}
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{c.content_type.replace('_', ' ')}</span>
              </div>
              <h3 className="mt-2 font-display text-xl">{c.title}</h3>
              <p className="font-mono text-[11px] text-ink-3">{c.heading_path.join(' › ')}</p>
              <p className="mt-2 line-clamp-4 leading-relaxed text-ink-2">{c.text}</p>
              <a href={c.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider underline underline-offset-4">Source <ExternalLink size={11} /></a>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
