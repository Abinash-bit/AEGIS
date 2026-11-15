import { useNavigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { Logo } from '../components/SiteNav'
import { ENVIRONMENTS } from '../lib/hazards'
import { useMission } from '../lib/mission'
import { ThemeToggle } from '../lib/theme'
import type { EnvId } from '../lib/types'

const CREW = ['C001', 'C002', 'C003', 'C004']

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
              className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border border-ink px-0.5 transition ${on ? 'bg-ink' : 'bg-card'}`}>
        <span className={`h-3.5 w-3.5 rounded-full transition ${on ? 'translate-x-4 bg-paper' : 'bg-ink'}`} />
      </button>
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        <span className="block text-sm text-ink-3">{hint}</span>
      </span>
    </label>
  )
}

export default function Mission() {
  const m = useMission()
  const nav = useNavigate()
  const panels: EnvId[] = ['iss', 'lunar_base', 'mars_base']
  const selectedEnv = ENVIRONMENTS.find((e) => e.id === m.env)!

  return (
    <div className="min-h-full">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Logo small />
        <span className="flex items-center gap-4"><span className="kicker">Step 1 of 2 · Mission setup</span><ThemeToggle /></span>
      </div>
      <main className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        <h1 className="font-display text-5xl">Set up the health check</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">Choose a crew member and where the mission is. The environment changes gravity, the message delay to Earth and the radiation dose rate.</p>

        <section className="mt-10">
          <h2 className="kicker mb-3">1 · Crew member</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {CREW.map((c) => (
              <button key={c} onClick={() => m.set({ crew: c })}
                      className={`plate p-4 text-left transition ${m.crew === c ? 'outline outline-2 outline-offset-2 outline-ink' : 'opacity-80 hover:opacity-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl">{c}</span>
                  {m.crew === c && <Check size={18} />}
                </div>
                <p className="mt-1 text-sm text-ink-3">Inspiration4 crew · anonymised · real blood data</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="kicker mb-3">2 · Where is the mission?</h2>
          <div className="grid gap-4 md:grid-cols-[2.6fr_1fr]">
            <div className="relative border border-ink-3/60">
              <img src="/images/gravity.webp" alt="Astronaut floating in a station, hopping on the Moon, standing on Mars" className="block w-full" />
              <div className="absolute inset-0 grid grid-cols-3">
                {panels.map((id) => {
                  const e = ENVIRONMENTS.find((x) => x.id === id)!
                  const on = m.env === id
                  return (
                    <button key={id} onClick={() => m.set({ env: id })} aria-pressed={on}
                            className={`group relative m-1.5 transition ${on ? 'outline outline-[3px] outline-ink' : 'hover:bg-paper/20'}`}>
                      <span className={`absolute bottom-2 left-2 right-2 bg-paper/90 px-2 py-1.5 text-left transition ${on ? 'opacity-100' : 'opacity-75 group-hover:opacity-100'}`}>
                        <span className="block font-display text-lg leading-tight">{e.label}</span>
                        <span className="block font-mono text-[10.5px] text-ink-2">{e.caption}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            <button onClick={() => m.set({ env: 'mars_transit' })} aria-pressed={m.env === 'mars_transit'}
                    className={`relative flex flex-col justify-end overflow-hidden border border-ink-3/60 bg-cover bg-center p-2 text-left transition ${m.env === 'mars_transit' ? 'outline outline-[3px] outline-ink' : ''}`}
                    style={{ backgroundImage: 'url(/images/distance.webp)', minHeight: 180 }}>
              <span className="bg-paper/90 px-2 py-1.5">
                <span className="block font-display text-lg leading-tight">Deep-space transit</span>
                <span className="block font-mono text-[10.5px] text-ink-2">On the way to Mars · 0 g · ~12 min delay</span>
              </span>
            </button>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="kicker mb-3">3 · Scenario</h2>
          <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
            {([
              ['demo', 'Mid-mission check', 'Three short nights, blood pressure creeping up from fluid shift, cabin CO₂ rising.'],
              ['landing', 'Landing day (gravity transition)', 'Day 1 on Mars after months weightless: faster heart rate, blood pressure drop on standing, worse balance.'],
              ['nominal', 'All nominal', 'Readings close to the crew member’s own baseline.'],
            ] as const).map(([id, title, hint]) => (
              <button key={id} role="radio" aria-checked={m.scenario === id}
                      onClick={() => m.set(id === 'landing' ? { scenario: id, env: 'mars_base' } : { scenario: id })}
                      className={`plate p-4 text-left transition ${m.scenario === id ? 'outline outline-2 outline-offset-2 outline-ink' : 'opacity-80 hover:opacity-100'}`}>
                <span className="block font-display text-lg leading-tight">{title}</span>
                <span className="mt-1 block text-[13px] text-ink-3">{hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <Toggle on={!!m.replay} onChange={(v) => m.set({ replay: v })}
                  label="Replay the May 2024 solar storm" hint="Uses real historical NASA DONKI data with X-class flares and particle events, instead of this week’s space weather." />
        </section>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3/50 pt-6">
          <p className="text-ink-2"><b className="text-ink">{m.crew}</b> · {selectedEnv.label} · {m.scenario === 'demo' ? 'demo scenario' : 'nominal'}{m.replay ? ' · May 2024 storm replay' : ''}</p>
          <button onClick={() => nav('/console')}
                  className="inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3 font-mono text-sm uppercase tracking-[0.14em] text-paper hover:bg-navy">
            Enter mission console <ArrowRight size={16} />
          </button>
        </div>
      </main>
    </div>
  )
}
