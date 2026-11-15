import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { hazard } from '../lib/hazards'
import { useMission } from '../lib/mission'
import type { CrewCard } from '../lib/types'
import { STATUS_COLOR, StatusPill } from './ui'

/** All four crew members at a glance (commander / flight-surgeon view). Click a card to switch crew member. */
export function CrewView({ onPick }: { onPick: () => void }) {
  const m = useMission()
  const [cards, setCards] = useState<CrewCard[]>()
  useEffect(() => { api.crewOverview(m).then(setCards).catch(() => setCards([])) }, [m.env, m.scenario, m.replay]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!cards) return <p className="flex items-center gap-2 text-ink-3"><Loader2 size={16} className="animate-spin" /> Reading all crew dashboards…</p>

  return (
    <div>
      <p className="mb-3 text-[14px] text-ink-2">Same mission, all four crew members. Lab values are each person’s real Inspiration4 data; daily readings are simulated.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <button key={c.crew_id} onClick={() => { m.set({ crew: c.crew_id }); onPick() }}
                  className={`plate p-4 text-left transition hover:-translate-y-[1px] ${c.crew_id === m.crew ? 'outline outline-2 outline-offset-2 outline-ink' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-3xl">{c.crew_id}</p>
                <p className="text-[12.5px] text-ink-3">Inspiration4 crew · anonymised</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl leading-none">{c.readiness}</p>
                <StatusPill status={c.overall_status} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.hazards.map((h) => (
                <span key={h.id} title={`${h.name}: ${h.status}`} className="inline-flex items-center gap-1 border border-ink-3/40 px-1.5 py-0.5 text-[11.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[h.status] }} />{hazard(h.id).short}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[13.5px] text-ink-2"><span className="text-ink-3">Most urgent ({hazard(c.top.id).name}):</span> {c.top.headline}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
