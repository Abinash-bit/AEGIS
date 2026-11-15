import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { Footer, SiteNav } from '../components/SiteNav'
import { api } from '../lib/api'
import { useMission } from '../lib/mission'
import type { EnvId, Memory } from '../lib/types'

type SessionRow = { id: string; crew_id: string; environment: EnvId; scenario: string; title?: string; updated_at: string }

export default function MemoryPage() {
  const m = useMission()
  const nav = useNavigate()
  const [mems, setMems] = useState<Memory[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const load = useCallback(() => {
    api.memories(m.crew).then(setMems).catch(() => {})
    api.sessions(m.crew).then((s) => setSessions(s as SessionRow[])).catch(() => {})
  }, [m.crew])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <SiteNav />
      <main className="mx-auto max-w-4xl px-6 pt-10">
        <p className="kicker">Crew member {m.crew}</p>
        <h1 className="mt-2 font-display text-5xl">What AEGIS remembers</h1>
        <p className="mt-3 text-lg text-ink-2">Facts you told AEGIS about yourself are kept so later advice can be personal. You can remove any of them.</p>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="kicker">Long-term memory</h2>
            {mems.length > 0 && <button onClick={() => api.clearMemories(m.crew).then(load)} className="font-mono text-xs uppercase tracking-wider text-critical underline">Forget everything</button>}
          </div>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {mems.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-4 py-3">
                <span><span className="text-[16px]">{x.text}</span> <span className="ml-2 font-mono text-[11px] text-ink-3">{x.category.replace('_', ' ')}</span></span>
                <button onClick={() => api.deleteMemory(m.crew, x.id).then(load)} aria-label="Forget" className="text-ink-3 hover:text-critical"><Trash2 size={16} /></button>
              </li>
            ))}
            {mems.length === 0 && <li className="py-3 italic text-ink-3">Nothing remembered yet.</li>}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="kicker">Past conversations</h2>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <button className="text-left" onClick={() => { m.set({ env: s.environment, scenario: s.scenario }); setTimeout(() => { m.setSessionId(s.id); nav('/console') }, 0) }}>
                  <span className="block text-[16px] underline decoration-ink-3 underline-offset-4">{s.title || 'Untitled conversation'}</span>
                  <span className="font-mono text-[11px] text-ink-3">{s.environment.replace('_', ' ')} · {new Date(s.updated_at).toLocaleString()}</span>
                </button>
                <button onClick={() => api.deleteSession(s.id).then(load)} aria-label="Delete conversation" className="text-ink-3 hover:text-critical"><Trash2 size={16} /></button>
              </li>
            ))}
            {sessions.length === 0 && <li className="py-3 italic text-ink-3">No conversations yet.</li>}
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
