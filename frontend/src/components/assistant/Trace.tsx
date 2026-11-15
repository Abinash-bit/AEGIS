import { X } from 'lucide-react'
import { hazard } from '../../lib/hazards'
import type { Briefing, HazardId } from '../../lib/types'
import { STATUS_COLOR } from '../ui'

interface TraceData {
  triggers?: { hazard: HazardId; status: keyof typeof STATUS_COLOR; signal: string; message: string }[]
  routing?: Record<string, string>
  retrieval?: Record<string, { pid: string; chunk_id: string; title: string; score?: number }[]>
  agents?: { agent: HazardId; findings: { text: string; passage_ids: string[] }[]; actions: unknown[]; coverage: string; seconds: number; escalate: boolean }[]
  agent_errors?: string[]; coordinator_seconds?: number; uncited_items_dropped?: number; total_seconds?: number
  retrieval_mode?: string; models?: Record<string, string>
}

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="relative pl-9">
    <span className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-ink font-mono text-[11px]">{n}</span>
    <h4 className="font-display text-xl">{title}</h4>
    <div className="mt-1.5 text-[13.5px] text-ink-2">{children}</div>
  </li>
)

/** "How this was made": the full reasoning trail behind a briefing, for the astronaut and for judges. */
export function TraceDrawer({ b, onClose }: { b: Briefing; onClose: () => void }) {
  const t = b.trace as TraceData
  const cited = new Set(b.citations.map((c) => c.chunk_id))
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-paper fade-up">
      <div className="flex items-center justify-between border-b border-ink-3/40 px-5 py-3">
        <span className="kicker">How this briefing was made</span>
        <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink"><X size={18} /></button>
      </div>
      <ol className="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <Step n={1} title="Signals on the dashboard">
          <p className="mb-1">Fixed rules (not AI) flagged these signals:</p>
          <ul className="space-y-1">
            {(t.triggers ?? []).filter((x) => x.status !== 'nominal').map((x, i) => (
              <li key={i} className="flex gap-2"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[x.status] }} />
                <span><b className="font-medium text-ink">{hazard(x.hazard).name}:</b> {x.message}</span></li>
            ))}
          </ul>
        </Step>
        <Step n={2} title="Specialists called in">
          <ul className="space-y-1">{Object.entries(t.routing ?? {}).map(([id, why]) => <li key={id}>{hazard(id).agent} · <span className="font-mono text-[12px]">{why}</span></li>)}</ul>
        </Step>
        <Step n={3} title="NASA passages each specialist read">
          <p className="mb-2 font-mono text-[11px] text-ink-3">Search: {t.retrieval_mode}</p>
          {Object.entries(t.retrieval ?? {}).map(([id, items]) => {
            const max = Math.max(...items.map((x) => x.score ?? 0), 0.0001)
            return (
              <div key={id} className="mb-3">
                <p className="font-medium text-ink">{hazard(id).agent}</p>
                <ul className="mt-1 space-y-1">
                  {items.map((x) => (
                    <li key={x.pid} className="grid grid-cols-[70px_1fr_auto] items-center gap-2 text-[12.5px]">
                      <span className="h-1.5 bg-paper-3"><span className="block h-full" style={{ width: `${(100 * (x.score ?? 0)) / max}%`, background: hazard(id).color }} /></span>
                      <span className="truncate">{x.title}</span>
                      {cited.has(x.chunk_id) && <span className="font-mono text-[10px] uppercase text-ok">cited</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </Step>
        <Step n={4} title="What each specialist found">
          <ul className="space-y-2">
            {(t.agents ?? []).map((a) => (
              <li key={a.agent}><b className="font-medium text-ink">{hazard(a.agent).agent}</b>
                <span className="font-mono text-[11px] text-ink-3"> · {a.findings.length} findings · coverage {a.coverage} · {a.seconds}s{a.escalate ? ' · flagged for flight surgeon' : ''}</span>
                {a.findings[0] && <p className="mt-0.5 italic">“{a.findings[0].text}”</p>}
              </li>
            ))}
            {(t.agent_errors ?? []).map((e) => <li key={e} className="text-critical">{e}</li>)}
          </ul>
        </Step>
        <Step n={5} title="Merged and checked">
          <p>The coordinator merged the findings in {t.coordinator_seconds}s. Every sentence must point to a passage; {t.uncited_items_dropped ?? 0} item{t.uncited_items_dropped === 1 ? ' was' : 's were'} dropped for lacking a valid source.</p>
          <p className="mt-1 font-mono text-[11px] text-ink-3">Total {t.total_seconds ?? '—'}s · models: {Object.values(t.models ?? {}).join(', ')}</p>
        </Step>
      </ol>
    </div>
  )
}

/** Read text aloud with the browser's built-in speech (citation numbers and markdown removed). */
export function speak(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const clean = text.replace(/\[\d+\]/g, '').replace(/\*\*/g, '').replace(/^\s*[-•]\s+/gm, '').replace(/\s+/g, ' ').trim()
  const u = new SpeechSynthesisUtterance(clean)
  u.rate = 1.02
  u.onend = () => onEnd?.()
  window.speechSynthesis.speak(u)
  return true
}

/** Browser speech recognition (Chrome/Edge). Returns a stop function, or null when unsupported. */
export function listen(onText: (t: string, final: boolean) => void, onEnd: () => void): (() => void) | null {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false
  r.onresult = (e) => {
    const res = Array.from(e.results)
    onText(res.map((x) => x[0].transcript).join(''), res.at(-1)?.isFinal ?? false)
  }
  r.onend = onEnd
  r.onerror = onEnd
  r.start()
  return () => r.stop()
}

interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void
  onend: () => void; onerror: () => void; start: () => void; stop: () => void
}
