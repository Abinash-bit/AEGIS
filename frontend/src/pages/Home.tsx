import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpenText, Eye, Radar, Users } from 'lucide-react'
import { Footer, SiteNav } from '../components/SiteNav'
import { Provenance } from '../components/ui'
import { api, apiUrl } from '../lib/api'
import { HAZARDS, fmtDelay } from '../lib/hazards'
import type { Environment, SpaceWeather } from '../lib/types'

function ago(iso?: string) {
  if (!iso) return ''
  const h = (Date.now() - new Date(iso).getTime()) / 36e5
  return h < 48 ? `${Math.max(1, Math.round(h))} h ago` : `${Math.round(h / 24)} days ago`
}

function useLive() {
  const [sw, setSw] = useState<SpaceWeather>()
  const [marsDelay, setMarsDelay] = useState<number>()
  const [chunks, setChunks] = useState<number>()
  useEffect(() => {
    api.spaceWeather().then(setSw).catch(() => {})
    fetch(apiUrl('/api/meta')).then((r) => r.json())
      .then((m) => setMarsDelay((m.environments as Environment[]).find((e) => e.id === 'mars_transit')?.comms_delay_s))
      .catch(() => {})
    api.health().then((h) => setChunks(h.kb_chunks)).catch(() => {})
  }, [])
  const flare = sw?.events.find((e) => e.type === 'FLR' && e.class_or_value === sw.max_flare_class)
  return { sw, flare, marsDelay, chunks }
}

function HazardRow({ i, wide = false, portrait = false, overlay }: { i: number; wide?: boolean; portrait?: boolean; overlay?: React.ReactNode }) {
  const h = HAZARDS[i]
  const text = (
    <div className="max-w-md">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: h.color }} aria-hidden />
        <span className="kicker">Hazard {i + 1} of 5 · watched by the {h.agent}</span>
      </div>
      <h3 className="font-display text-4xl leading-tight">{h.name}</h3>
      <p className="mt-4 text-lg leading-relaxed text-ink-2">{h.blurb}</p>
      <p className="kicker mt-6 mb-2">AEGIS watches</p>
      <ul className="space-y-1.5">
        {h.watches.map((w) => (
          <li key={w} className="flex gap-2 text-[15px] text-ink-2"><span style={{ color: h.color }}>—</span>{w}</li>
        ))}
      </ul>
      <Link to={`/hazards/${h.id}`} className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-ink underline decoration-ink-3 underline-offset-4 hover:decoration-ink">
        Read about {h.short.toLowerCase()} <ArrowRight size={14} />
      </Link>
    </div>
  )
  if (wide) {
    return (
      <div className="my-24">
        <div className="relative">
          <img src={h.image} alt={h.imageAlt} className="w-full border-y border-ink-3/50 object-cover" loading="lazy" />
          {overlay}
        </div>
        <div className="mx-auto mt-10 max-w-6xl px-6">{text}</div>
      </div>
    )
  }
  const flip = i % 2 === 1
  return (
    <div className={`mx-auto my-24 grid max-w-6xl items-center gap-12 px-6 ${portrait ? 'md:grid-cols-[0.9fr_1.1fr]' : 'md:grid-cols-[1.25fr_1fr]'}`}>
      <figure className={`relative ${flip ? 'md:order-2' : ''}`}>
        <img src={h.image} alt={h.imageAlt} loading="lazy"
             className={`w-full border border-ink-3/60 shadow-[6px_6px_0_rgba(43,38,33,.12)] ${portrait ? 'mx-auto max-w-sm' : ''}`} />
        {overlay}
      </figure>
      <div className={flip ? 'md:order-1' : ''}>{text}</div>
    </div>
  )
}

export default function Home() {
  const { sw, flare, marsDelay, chunks } = useLive()
  return (
    <div>
      <SiteNav />

      {/* HERO */}
      {/* the image keeps its natural 21:9 shape; text sits only on its empty paper side (left ~42%) */}
      <header className="relative border-b border-ink-3/50">
        <img src="/images/hero.webp" alt="Vintage illustration of an astronaut on a rocky ridge beside a small lander, looking up at Earth"
             className="block h-auto w-full" />
        <div data-theme="light" className="flex items-center bg-paper px-6 py-10 text-ink md:absolute md:inset-y-0 md:left-0 md:w-[42%] md:bg-transparent md:py-0 md:pl-[4.5%] md:pr-2">
          <div className="fade-up">
            <p className="kicker mb-4">Crew health companion · NASA Space Apps 2026</p>
            <h1 className="font-display text-[clamp(2.2rem,4vw,4.1rem)] leading-[1.04]">When help is twenty light&#8209;minutes away.</h1>
            <p className="mt-5 max-w-md text-[clamp(1rem,1.35vw,1.25rem)] leading-relaxed text-ink-2">
              AEGIS helps astronauts understand their own health, guided by NASA research.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link to="/mission" className="inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-mono text-sm uppercase tracking-[0.14em] text-paper hover:bg-navy">
                Begin a health check <ArrowRight size={16} />
              </Link>
              <a href="#how" className="font-mono text-sm uppercase tracking-[0.14em] text-ink underline decoration-ink-3 underline-offset-4">See how it works</a>
            </div>
          </div>
        </div>
      </header>

      {/* LIVE STRIP */}
      <div className="border-b border-ink-3/50 bg-paper-2/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-3 font-mono text-[12px] text-ink-2">
          <Provenance p="LIVE_DONKI" stale={sw?.stale} />
          <span>Strongest flare this week <b className="text-ink">{sw?.max_flare_class ?? '…'}</b>{flare ? ` · ${ago(flare.time)}` : ''}</span>
          <span className="hidden text-ink-3 md:inline">|</span>
          <span>Message delay to a ship bound for Mars <b className="text-ink">{marsDelay ? fmtDelay(marsDelay) : '…'}</b></span>
          <span className="hidden text-ink-3 md:inline">|</span>
          <span><b className="text-ink">{chunks ?? '…'}</b> NASA passages</span>
        </div>
      </div>

      {/* THE PROBLEM */}
      <section className="mx-auto max-w-3xl px-6 pt-24 text-center">
        <p className="kicker mb-4">The problem</p>
        <h2 className="font-display text-4xl leading-tight">Astronauts are not doctors.</h2>
        <p className="mt-6 text-xl leading-relaxed text-ink-2">
          On a Mars mission, a message to Earth takes up to twenty minutes each way. When something feels wrong,
          the crew must understand it, measure it and act on it themselves.
        </p>
        <blockquote className="mx-auto mt-10 max-w-2xl border-l-2 border-orange pl-6 text-left font-sans text-lg italic text-ink-2">
          “So imagine you’re halfway to Mars. Suddenly your fellow crewmate feels a sharp pain in the chest and collapses. What should you do?”
          <footer className="kicker mt-3 not-italic">Brazilian Space Agency · challenge brief</footer>
        </blockquote>
      </section>

      {/* THE FIVE HAZARDS */}
      <section id="hazards" className="pt-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="kicker mb-4">NASA Human Research Program</p>
          <h2 className="font-display text-4xl">The five hazards of human spaceflight</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-2">Each hazard has its own specialist agent inside AEGIS.</p>
          <div className="rule-double mx-auto mt-8 max-w-xs" />
        </div>

        <HazardRow i={0} overlay={
          <figcaption data-theme="light" className="absolute bottom-[3.2%] left-[2.5%] right-[2.5%] flex h-[9%] items-center justify-center overflow-hidden whitespace-nowrap px-3 font-mono text-[11px] text-ink-2">
            Live from NASA DONKI · strongest flare this week <b className="mx-1 text-ink">{sw?.max_flare_class ?? '…'}</b>· {sw?.events.length ?? '…'} events
          </figcaption>
        } />
        <HazardRow i={1} />
        <HazardRow i={2} wide overlay={
          <div data-theme="light" className="absolute left-1/2 top-[10%] -translate-x-1/2 border border-ink-3/60 bg-paper/85 px-4 py-2 text-center font-mono text-ink">
            <div className="kicker">one-way message delay</div>
            <div className="font-display text-3xl">{marsDelay ? fmtDelay(marsDelay) : '…'}</div>
          </div>
        } />
        <HazardRow i={3} overlay={
          <div className="mt-2 grid grid-cols-3 text-center font-mono text-[11px] uppercase tracking-wider text-ink-2">
            <span>Space station · 0 g</span><span>Moon · 0.16 g</span><span>Mars · 0.38 g</span>
          </div>
        } />
        <HazardRow i={4} portrait />
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-y border-ink-3/50 bg-paper-2/60 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <p className="kicker mb-4">How AEGIS works</p>
            <h2 className="font-display text-4xl">From a reading to a reason</h2>
          </div>
          <ol className="mt-14 grid gap-10 md:grid-cols-4">
            {[
              { icon: Eye, t: 'Watch', d: 'Live NASA space weather, real crew blood tests and daily readings arrive on the dashboard.' },
              { icon: Radar, t: 'Detect', d: 'Simple, traceable rules flag each of the five hazards: nominal, watch, alert or critical.' },
              { icon: Users, t: 'Consult', d: 'Five specialist agents search AEGIS’s NASA knowledge base for what applies to you.' },
              { icon: BookOpenText, t: 'Advise', d: 'You get a calm briefing with sources: what is happening, what to do, what comes next. Then ask anything.' },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink"><Icon size={18} strokeWidth={1.5} /></span>
                  <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl">{t}</h3>
                <p className="mt-2 leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* REAL DATA */}
      <section className="mx-auto max-w-6xl px-6 pt-24">
        <div className="text-center">
          <p className="kicker mb-4">Grounded in real data</p>
          <h2 className="font-display text-4xl">Nothing is made up, and nothing is hidden</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { p: 'LIVE_DONKI' as const, t: 'NASA DONKI', d: 'Solar flares, particle events and solar storms, fetched live and shown with their source.' },
            { p: 'REAL_OSDR' as const, t: 'Inspiration4 crew labs', d: 'Real blood tests from four civilian astronauts, before launch and after return (NASA OSDR).' },
            { p: null, t: 'NASA knowledge base', d: `${chunks ?? 200}+ passages from NASA’s Human Research Program, podcasts and videos. Every piece of advice cites one.` },
          ].map((c) => (
            <div key={c.t} className="plate p-6">
              {c.p ? <Provenance p={c.p} /> : <span className="inline-flex border border-ink-3/60 px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-ink-2">Cited · NASA HRP</span>}
              <h3 className="mt-4 font-display text-2xl">{c.t}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="mx-auto max-w-3xl px-6 pt-28 text-center">
        <h2 className="font-display text-4xl">Choose a crew member and begin.</h2>
        <p className="mt-4 text-lg text-ink-2">Pick where the mission is, and AEGIS will read the dashboard and brief you.</p>
        <Link to="/mission" className="mt-8 inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-mono text-sm uppercase tracking-[0.14em] text-paper hover:bg-navy">
          Begin a health check <ArrowRight size={16} />
        </Link>
      </section>

      <Footer />
    </div>
  )
}
