import { useEffect, useMemo, useState } from 'react'
import { Send, Siren, X } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDelay } from '../lib/hazards'
import { PROTOCOLS, type Protocol } from '../lib/protocols'
import type { EnvId } from '../lib/types'

export interface EmergencyLog {
  protocol: string; crew: string; started: string; finished?: string
  events: { t: string; text: string }[]; vitals: { hr?: number; sbp?: number; dbp?: number; temp?: number }; note: string
}
export const EMERGENCY_KEY = 'aegis.emergencyLog'

const hhmm = (d: Date) => d.toISOString().slice(11, 19)

export function draftMessage(log: EmergencyLog) {
  const v = log.vitals
  const lines = [
    `EMERGENCY REPORT · crew member ${log.crew} · ${log.protocol}`,
    `Started ${log.started.replace('T', ' ').slice(0, 19)} UTC${log.finished ? ` · report written ${hhmm(new Date(log.finished))} UTC` : ''}`,
    '',
    'Steps taken:',
    ...log.events.map((e) => `  ${hhmm(new Date(e.t))}  ${e.text}`),
    '',
    `Vital signs: HR ${v.hr ?? '—'} bpm · BP ${v.sbp ?? '—'}/${v.dbp ?? '—'} mmHg · temp ${v.temp ?? '—'} °C`,
    log.note ? `Notes: ${log.note}` : '',
    '',
    'Request: please advise on next steps.',
  ]
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n')
}

/** Full-screen, calm, scripted emergency guide. One step per screen, big buttons, elapsed timer. */
export function Emergency({ crew, env, delayS, onClose }: { crew: string; env: EnvId; delayS: number; onClose: () => void }) {
  const [p, setP] = useState<Protocol>()
  const [stepId, setStepId] = useState('')
  const [log, setLog] = useState<EmergencyLog>()
  const [now, setNow] = useState(Date.now())
  const [sent, setSent] = useState<{ arrives_at: string }>()
  const [sending, setSending] = useState(false)

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (log) { try { localStorage.setItem(EMERGENCY_KEY, JSON.stringify(log)) } catch { /* ignore */ } } }, [log])

  const step = p?.steps[stepId]
  const elapsed = log ? Math.max(0, Math.floor((now - new Date(log.started).getTime()) / 1000)) : 0
  const add = (text: string) => setLog((l) => (l ? { ...l, events: [...l.events, { t: new Date().toISOString(), text }] } : l))

  function begin(pr: Protocol) {
    setP(pr); setStepId(pr.start); setSent(undefined)
    setLog({ protocol: pr.title, crew, started: new Date().toISOString(), events: [{ t: new Date().toISOString(), text: `Emergency started: ${pr.title}` }], vitals: {}, note: '' })
  }
  function go(next: string, said?: string) {
    if (step) add(said ? `${step.text} → ${said}` : step.text)
    if (next === 'end') setLog((l) => (l ? { ...l, finished: new Date().toISOString() } : l))
    setStepId(next)
  }
  function switchToCollapse() {
    const c = PROTOCOLS.find((x) => x.id === 'collapse')!
    add('Crewmate collapsed: switching to collapse steps')
    setP(c); setStepId(c.start)
  }
  const message = useMemo(() => (log ? draftMessage(log) : ''), [log])

  async function send() {
    if (!log) return
    setSending(true)
    try {
      const r = await api.sendReport(crew, env, { type: 'emergency', protocol: log.protocol, message, log: log as unknown as Record<string, unknown> })
      setSent(r)
    } finally { setSending(false) }
  }

  const big = 'min-h-[64px] w-full border-2 px-6 text-2xl font-display transition'
  return (
    <div data-theme="dark" className="fixed inset-0 z-[60] flex flex-col bg-paper text-ink" role="dialog" aria-label="Emergency guide">
      <div className="pointer-events-none absolute inset-2 border-2 border-critical" />
      <header className="relative flex items-center gap-4 px-8 py-5">
        <Siren className="text-critical" />
        <span className="font-mono text-sm uppercase tracking-[0.2em] text-critical">Emergency guide</span>
        {log && <span className="font-mono text-lg">{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</span>}
        <span className="ml-auto font-mono text-xs text-ink-3">Message delay to Earth {fmtDelay(delayS)}</span>
        <button onClick={onClose} className="ml-4 inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-ink-2 hover:text-ink"><X size={16} /> Close</button>
      </header>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-8 pb-10">
        {!p && (
          <>
            <h1 className="font-display text-5xl">What is happening?</h1>
            <p className="mt-3 text-lg text-ink-2">Stay calm. AEGIS will guide you one step at a time.</p>
            <div className="mt-10 grid gap-4">
              {PROTOCOLS.map((x) => (
                <button key={x.id} onClick={() => begin(x)} className={`${big} border-ink-3 py-4 text-left hover:border-critical`}>
                  {x.title}<span className="block font-sans text-base text-ink-3">{x.subtitle}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {p && step && step.kind !== 'end' && (
          <div key={step.id} className="fade-up">
            <p className="kicker mb-3">{p.title}</p>
            <h1 className="font-display text-[44px] leading-tight">{step.text}</h1>
            {'detail' in step && step.detail && <p className="mt-4 text-xl leading-relaxed text-ink-2">{step.detail}</p>}

            {step.kind === 'ask' && (
              <div className="mt-10 grid grid-cols-2 gap-4">
                <button onClick={() => go(step.yes, 'yes')} className={`${big} border-ok text-ok hover:bg-ok/10`}>Yes</button>
                <button onClick={() => go(step.no, 'no')} className={`${big} border-critical text-critical hover:bg-critical/10`}>No</button>
              </div>
            )}
            {step.kind === 'do' && (
              <button onClick={() => go(step.next, 'done')} className={`${big} mt-10 border-ink hover:bg-ink hover:text-paper`}>Done, next step</button>
            )}
            {step.kind === 'record' && log && (
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {([['hr', 'Heart rate', 'bpm'], ['sbp', 'BP top', 'mmHg'], ['dbp', 'BP bottom', 'mmHg'], ['temp', 'Temp', '°C']] as const).map(([k, l, u]) => (
                    <label key={k} className="flex flex-col border border-ink-3 p-3">
                      <span className="text-sm text-ink-3">{l}</span>
                      <span className="flex items-baseline gap-1">
                        <input type="number" inputMode="decimal" className="w-full bg-transparent font-mono text-3xl outline-none"
                               value={log.vitals[k] ?? ''} onChange={(e) => setLog({ ...log, vitals: { ...log.vitals, [k]: e.target.value ? Number(e.target.value) : undefined } })} />
                        <span className="font-mono text-xs text-ink-3">{u}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <textarea placeholder="Notes (what they said, when it started…)" value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })}
                          className="mt-4 h-20 w-full border border-ink-3 bg-transparent p-3 text-lg outline-none" />
                <button onClick={() => go(step.next, `HR ${log.vitals.hr ?? '—'}, BP ${log.vitals.sbp ?? '—'}/${log.vitals.dbp ?? '—'}`)}
                        className={`${big} mt-4 border-ink hover:bg-ink hover:text-paper`}>Saved, next step</button>
              </div>
            )}
            {p.id === 'chest' && (
              <button onClick={switchToCollapse} className="mt-6 font-mono text-sm uppercase tracking-wider text-critical underline">They collapsed</button>
            )}
          </div>
        )}

        {p && step?.kind === 'end' && log && (
          <div className="fade-up">
            <h1 className="font-display text-[40px] leading-tight">{step.text}</h1>
            <p className="mt-3 text-lg text-ink-2">{step.detail}</p>
            <pre className="scroll-thin mt-6 max-h-[36vh] overflow-y-auto whitespace-pre-wrap border border-ink-3 bg-paper-2 p-4 font-mono text-[13px] leading-relaxed">{message}</pre>
            {!sent ? (
              <button onClick={send} disabled={sending} className={`${big} mt-6 flex items-center justify-center gap-3 border-critical bg-critical text-paper hover:opacity-90`}>
                <Send /> {sending ? 'Sending…' : 'Send to Mission Control'}
              </button>
            ) : (
              <p className="mt-6 border border-ok p-4 text-lg text-ok">
                Sent. It will reach Mission Control at about {new Date(sent.arrives_at).toISOString().slice(11, 16)} UTC
                ({fmtDelay(delayS)} from now). Keep caring for your crewmate while you wait.
              </p>
            )}
          </div>
        )}
      </main>
      <footer className="relative px-8 pb-5 text-center font-mono text-[11px] text-ink-3">
        Demo protocol written from general first-aid steps · follow your mission’s medical checklist and flight surgeon
      </footer>
    </div>
  )
}
