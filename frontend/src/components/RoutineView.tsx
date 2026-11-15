import { useEffect, useState } from 'react'
import { Award, Check, Flame, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { hazard } from '../lib/hazards'
import type { Guide } from '../lib/guides'
import type { Routine } from '../lib/types'
import { Plate } from './ui'

/** Daily check-in routine, streak, badges and cooperative crew points. */
export function RoutineView({ crew, refreshKey, onCheckIn }: { crew: string; refreshKey: number; onCheckIn: (key: Guide['key']) => void }) {
  const [r, setR] = useState<Routine>()
  useEffect(() => { api.routine(crew).then(setR).catch(() => {}) }, [crew, refreshKey])
  if (!r) return <p className="text-ink-3">Loading routine…</p>
  const nowHM = new Date().toISOString().slice(11, 16)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <Plate title={`Today’s routine · ${r.done} of ${r.total} done`}>
        <div className="mb-3 h-1.5 w-full bg-paper-3"><div className="h-full bg-ok transition-all" style={{ width: `${(100 * r.done) / r.total}%` }} /></div>
        <ol className="space-y-1">
          {r.items.map((it) => {
            const due = !it.done && it.when <= nowHM
            return (
              <li key={it.key} className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0">
                <span className="w-12 font-mono text-[12px] text-ink-3">{it.when}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: hazard(it.hazard).color }} />
                <span className={`flex-1 text-[14.5px] ${it.done ? 'text-ink-3 line-through' : ''}`}>{it.label}</span>
                {it.done ? <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-ok"><Check size={13} /> done</span>
                  : <button onClick={() => onCheckIn(it.key as Guide['key'])}
                            className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[11px] uppercase ${due ? 'border-watch text-watch' : 'border-ink-3/60 text-ink-2'}`}>
                      <Plus size={12} /> {due ? 'due now' : 'check in'}
                    </button>}
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-[12px] text-ink-3">Times are mission time (UTC). Each check-in shows how to measure and why it matters.</p>
      </Plate>

      <div className="grid gap-4">
        <Plate title="Streak">
          <div className="flex items-center gap-3">
            <Flame className="text-orange" />
            <span className="font-display text-5xl leading-none">{r.streak_days}</span>
            <span className="text-ink-2">day{r.streak_days === 1 ? '' : 's'} with 3 or more check-ins</span>
          </div>
          <ul className="mt-4 space-y-1.5">
            {r.badges.map((b) => (
              <li key={b.days} className={`flex items-center gap-2 text-[14px] ${b.earned ? 'text-ink' : 'text-ink-3'}`}>
                <Award size={16} className={b.earned ? 'text-mustard' : ''} /> {b.name} {b.earned && <span className="font-mono text-[10px] uppercase text-ok">earned</span>}
              </li>
            ))}
          </ul>
        </Plate>
        <Plate title="Crew health points · this week">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-4xl">{r.crew_total}</span>
            <span className="font-mono text-[12px] text-ink-3">goal {r.crew_goal}</span>
          </div>
          <div className="mt-2 h-2 w-full bg-paper-3"><div className="h-full bg-teal" style={{ width: `${Math.min(100, (100 * r.crew_total) / r.crew_goal)}%` }} /></div>
          <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-[12px]">
            {Object.entries(r.crew_points).map(([c, p]) => <li key={c} className={c === crew ? 'text-ink' : 'text-ink-3'}>{c} · {p} pts</li>)}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">Cooperative, not competitive: every check-in adds 10 points to the crew total.</p>
        </Plate>
      </div>
    </div>
  )
}
