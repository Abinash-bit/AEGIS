import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, Check, ChevronDown, ChevronRight, ExternalLink, Loader2, Mic, RotateCcw, Send, Square, SquarePen, Stethoscope, Trash2, Volume2, Workflow, X, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { hazard } from '../../lib/hazards'
import { useMission } from '../../lib/mission'
import type { Briefing, Citation, Dashboard, Memory } from '../../lib/types'
import { AgentBadge, StatusPill } from '../ui'
import { CiteChip, Rich } from './rich'
import { TraceDrawer, listen, speak } from './Trace'
import { applyEvent, type AnswerItem, type BriefingItem, type Step, type ThreadItem } from './steps'

const uid = () => Math.random().toString(36).slice(2, 10)

/* ---------------- thinking trail ---------------- */
function Trail({ steps, running, seconds }: { steps: Step[]; running: boolean; seconds?: number }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  const expanded = running || open
  return (
    <div className="mb-2">
      {!running && (
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          How I got this · {steps.length} steps{seconds ? ` · ${Math.round(seconds)} s` : ''}
        </button>
      )}
      {expanded && (
        <ol className={`space-y-1.5 border-l border-rule pl-3 ${running ? '' : 'mt-2'}`}>
          {steps.map((s) => (
            <li key={s.key} className="fade-up text-[13px] leading-snug text-ink-2">
              <span className="flex items-start gap-1.5">
                <span className="mt-[2px] shrink-0">
                  {s.state === 'running' ? <Loader2 size={13} className="animate-spin text-ink-3" />
                    : s.state === 'error' ? <XCircle size={13} className="text-critical" /> : <Check size={13} className="text-ok" />}
                </span>
                <span>
                  {s.agent && <span className="mr-1 font-mono text-[11px] font-semibold" style={{ color: hazard(s.agent).color }}>●</span>}
                  {s.text}
                </span>
              </span>
              {s.sub && s.sub.length > 0 && (
                <ul className="ml-5 mt-0.5 space-y-0.5">
                  {s.sub.map((t) => <li key={t} className="truncate font-mono text-[11px] text-ink-3">· {t}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* ---------------- briefing card ---------------- */
function BriefingCard({ item, onCite, onRetry, onTrace, onSpeak }: { item: BriefingItem; onCite: (c: Citation) => void; onRetry: () => void; onTrace: (b: Briefing) => void; onSpeak: (text: string) => void }) {
  const b = item.briefing
  const [done, setDone] = useState<Record<number, boolean>>({})
  const cite = (n: number) => { const c = b?.citations.find((x) => x.n === n); if (c) onCite(c) }
  return (
    <article className="plate fade-up p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="kicker">AEGIS briefing</span>
        {b && <StatusPill status={b.severity} />}
        {b?.agents.map((a) => <AgentBadge key={a} id={a} color={hazard(a).color} />)}
        {b && <span className="ml-auto font-mono text-[10.5px] text-ink-3">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        {b && <button onClick={() => onSpeak([b.headline, ...b.happening.map((h) => h.text), 'What to do now.', ...b.actions.map((a) => a.text), b.next].join(' '))} title="Read aloud" aria-label="Read briefing aloud" className="text-ink-3 hover:text-ink"><Volume2 size={14} /></button>}
        {b && <button onClick={() => onTrace(b)} title="How this was made" aria-label="How this briefing was made" className="text-ink-3 hover:text-ink"><Workflow size={14} /></button>}
      </header>
      <Trail steps={item.steps} running={item.running} seconds={item.seconds} />
      {item.running && !b && <p className="text-sm italic text-ink-3">The specialists are reviewing your dashboard…</p>}
      {item.error && (
        <p className="text-sm text-critical">Could not prepare the briefing: {item.error}{' '}
          <button onClick={onRetry} className="underline">Try again</button></p>
      )}
      {b && (
        <div className="text-[14.5px] leading-relaxed">
          <h4 className="font-display text-xl leading-snug">{b.headline}</h4>
          <p className="kicker mt-3 mb-1">What is happening</p>
          <ul className="space-y-2">
            {b.happening.map((h, i) => (
              <li key={i} className="flex gap-2"><span className="text-ink-3">–</span>
                <span>{h.text} {h.cites.map((n) => <CiteChip key={n} n={n} onClick={() => cite(n)} />)}</span></li>
            ))}
          </ul>
          <p className="kicker mt-3 mb-1">What to do now</p>
          <ul className="space-y-2">
            {b.actions.map((a, i) => (
              <li key={i} className="flex gap-2">
                <button onClick={() => setDone({ ...done, [i]: !done[i] })} aria-label="Mark done"
                        className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center border border-ink ${done[i] ? 'bg-ink text-paper' : ''}`}>
                  {done[i] && <Check size={11} />}
                </button>
                <span className={done[i] ? 'text-ink-3 line-through' : ''}>{a.text} {a.cites.map((n) => <CiteChip key={n} n={n} onClick={() => cite(n)} />)}</span>
              </li>
            ))}
          </ul>
          <p className="kicker mt-3 mb-1">What comes next</p>
          <p>{b.next}</p>
          {b.escalate_to_flight_surgeon && (
            <p className="mt-3 flex items-center gap-2 border border-alert/50 bg-alert/5 px-2 py-1.5 text-[13px] text-alert">
              <Stethoscope size={14} /> Share these trends with your flight surgeon.
            </p>
          )}
        </div>
      )}
    </article>
  )
}

/* ---------------- source drawer ---------------- */
function SourceDrawer({ c, onClose }: { c: Citation; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col border-l border-ink-3/40 bg-paper p-5 shadow-[-8px_0_24px_rgba(43,38,33,.08)] fade-up">
      <div className="flex items-center justify-between">
        <span className="kicker">NASA source [{c.n}]</span>
        <button onClick={onClose} aria-label="Close source" className="text-ink-2 hover:text-ink"><X size={18} /></button>
      </div>
      <h4 className="mt-3 font-display text-2xl leading-snug">{c.title}</h4>
      <p className="mt-1 font-mono text-[11px] text-ink-3">{c.heading_path.join(' › ')}</p>
      <blockquote className="scroll-thin mt-4 flex-1 overflow-y-auto border-l-2 border-orange pl-4 font-sans text-[15px] leading-relaxed text-ink-2">
        {c.quote}
      </blockquote>
      <a href={c.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-ink underline underline-offset-4">
        Open original page <ExternalLink size={13} />
      </a>
    </div>
  )
}

/* ---------------- memory popover ---------------- */
function MemoryButton({ crew, refreshKey }: { crew: string; refreshKey: number }) {
  const [mems, setMems] = useState<Memory[]>([])
  const [open, setOpen] = useState(false)
  const load = useCallback(() => api.memories(crew).then(setMems).catch(() => {}), [crew])
  useEffect(() => { load() }, [load, refreshKey])
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 border border-ink-3/60 px-2 py-0.5 font-mono text-[11px] text-ink-2 hover:border-ink">
        <Brain size={13} /> remembers {mems.length}
      </button>
      {open && (
        <div className="plate absolute right-0 top-8 z-30 w-72 p-3 fade-up">
          <p className="kicker mb-2">What AEGIS remembers about {crew}</p>
          {mems.length === 0 && <p className="text-sm italic text-ink-3">Nothing yet. Tell AEGIS about your habits or how you feel, and it will remember.</p>}
          <ul className="space-y-1.5">
            {mems.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
                <span>{m.text}</span>
                <button onClick={() => api.deleteMemory(crew, m.id).then(load)} aria-label="Forget" className="text-ink-3 hover:text-critical"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------------- assistant ---------------- */
export function Assistant({ dashboard, prefill, onPrefillUsed, autoAsk, sendNow }: {
  dashboard: Dashboard; prefill?: string; onPrefillUsed?: () => void; autoAsk?: string
  sendNow?: { text: string; nonce: number }   // e.g. "I just logged my blood pressure…" after a check-in
}) {
  const m = useMission()
  const [items, setItems] = useState<ThreadItem[]>([])
  const [citations, setCitations] = useState<Record<number, Citation>>({})
  const [source, setSource] = useState<Citation>()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [memKey, setMemKey] = useState(0)
  const [trace, setTrace] = useState<Briefing>()
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const stopListen = useRef<(() => void) | null>(null)
  const toggleSpeak = (text: string) => {
    if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false); return }
    if (speak(text, () => setSpeaking(false))) setSpeaking(true)
  }
  const toggleListen = () => {
    if (listening) { stopListen.current?.(); return }
    const stop = listen((t, final) => { setInput(t); if (final) setListening(false) }, () => setListening(false))
    if (!stop) { alert('Voice input is not supported in this browser. Try Chrome or Edge.'); return }
    stopListen.current = stop
    setListening(true)
  }
  const scroller = useRef<HTMLDivElement>(null)
  const started = useRef<string>('')
  const missionKey = `${m.crew}|${m.env}|${m.scenario}|${m.replay}`

  const patch = (id: string, fn: (it: BriefingItem | AnswerItem) => BriefingItem | AnswerItem) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.kind !== 'user' ? fn(x) : x)))

  const runBriefing = useCallback(async (force = false) => {
    const id = uid()
    const item: BriefingItem = { id, kind: 'briefing', steps: [], running: true, startedAt: Date.now() }
    setItems((xs) => [item, ...xs.filter((x) => x.kind !== 'briefing')])
    for await (const ev of api.briefingStream(m, force)) patch(id, (it) => applyEvent(it, ev))
  }, [m.crew, m.env, m.scenario, m.replay]) // eslint-disable-line react-hooks/exhaustive-deps

  // first load: restore the saved conversation, then stream (or fetch cached) briefing
  useEffect(() => {
    if (started.current === missionKey) return
    started.current = missionKey
    setItems([]); setCitations({})
    ;(async () => {
      if (m.sessionId) {
        try {
          const s = await api.session(m.sessionId)
          setCitations(Object.fromEntries(s.citations.map((c) => [c.n, c])))
          setItems(s.messages.map((msg): ThreadItem => msg.role === 'user'
            ? { id: uid(), kind: 'user', text: msg.content }
            : { id: uid(), kind: 'answer', text: msg.content, cited: msg.cited, agents: msg.agents, memories: [], steps: [], running: false, restored: true, startedAt: 0 }))
        } catch { m.setSessionId(undefined) }
      }
      await runBriefing(false)
      if (autoAsk) await ask(autoAsk)
    })()
  }, [missionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }) }, [items])
  useEffect(() => { if (prefill) { setInput(prefill); onPrefillUsed?.() } }, [prefill, onPrefillUsed])
  useEffect(() => { if (sendNow?.text) ask(sendNow.text) }, [sendNow?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  async function ask(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput(''); setBusy(true)
    const id = uid()
    setItems((xs) => [...xs, { id: uid(), kind: 'user', text: q },
      { id, kind: 'answer', text: '', cited: [], agents: [], memories: [], steps: [], running: true, startedAt: Date.now() }])
    for await (const ev of api.chatStream(m, q, m.sessionId)) {
      if (ev.type === 'session' && ev.session_id !== m.sessionId) m.setSessionId(ev.session_id)
      if (ev.type === 'citations') setCitations(Object.fromEntries(ev.citations.map((c) => [c.n, c])))
      if (ev.type === 'memory_saved') setMemKey((k) => k + 1)
      patch(id, (it) => applyEvent(it, ev))
    }
    setBusy(false)
  }

  function newConversation() {
    m.setSessionId(undefined); setCitations({})
    setItems((xs) => xs.filter((x) => x.kind === 'briefing'))
  }

  const top = [...dashboard.hazards].sort((a, b) => b.level - a.level)[0]
  const chips = [`Explain my ${hazard(top.id).short.toLowerCase()} ${top.status} in simple words`, 'How am I doing today?', 'What should I do next?']

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-ink-3/40 px-4 py-2.5">
        <h2 className="font-display text-2xl">AEGIS</h2>
        <span className="font-mono text-[10.5px] text-ink-3">5 specialists · NASA sources</span>
        <div className="ml-auto flex items-center gap-2">
          <MemoryButton crew={m.crew} refreshKey={memKey} />
          <button onClick={() => runBriefing(true)} title="Refresh briefing" className="text-ink-3 hover:text-ink"><RotateCcw size={15} /></button>
          <button onClick={newConversation} title="New conversation" className="text-ink-3 hover:text-ink"><SquarePen size={15} /></button>
        </div>
      </header>

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {items.map((it) => {
          if (it.kind === 'briefing') return <BriefingCard key={it.id} item={it} onCite={setSource} onRetry={() => runBriefing(true)} onTrace={setTrace} onSpeak={toggleSpeak} />
          if (it.kind === 'user') return (
            <div key={it.id} className="ml-10 fade-up border-r-2 border-ink-3/50 pr-3 text-right font-sans text-[15px] italic text-ink-2">{it.text}</div>
          )
          return (
            <article key={it.id} className="fade-up">
              <div className="mb-1 flex items-center gap-2">
                <span className="kicker">AEGIS</span>
                {it.agents.map((a) => <AgentBadge key={a} id={a} color={hazard(a).color} />)}
                {!it.running && it.text && <button onClick={() => toggleSpeak(it.text)} title="Read aloud" aria-label="Read answer aloud" className="ml-auto text-ink-3 hover:text-ink">{speaking ? <Square size={13} /> : <Volume2 size={14} />}</button>}
              </div>
              <Trail steps={it.steps} running={it.running && !it.text} seconds={it.seconds} />
              {it.error && <p className="text-sm text-critical">{it.error}</p>}
              <div className={`text-[14.5px] leading-relaxed ${it.running && it.text ? 'caret' : ''}`}>
                <Rich text={it.text} onCite={(n) => citations[n] && setSource(citations[n])} known={(n) => !!citations[n]} />
              </div>
            </article>
          )
        })}
      </div>

      <footer className="border-t border-ink-3/40 px-4 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} onClick={() => ask(c)} disabled={busy}
                    className="border border-ink-3/60 px-2 py-0.5 text-[12.5px] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50">{c}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex items-end gap-2 border border-ink-3/70 bg-card px-3 py-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
                    placeholder="Ask AEGIS about your health…" aria-label="Ask AEGIS"
                    className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
          <button type="button" onClick={toggleListen} aria-label={listening ? 'Stop voice input' : 'Speak your question'} title="Speak" className={listening ? 'text-critical pulse-dot' : 'text-ink-3 hover:text-ink'}><Mic size={18} /></button>
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="text-ink disabled:text-ink-3">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
        <p className="mt-1.5 text-center font-mono text-[10px] text-ink-3">Guidance from NASA sources · not a medical diagnosis</p>
      </footer>

      {source && <SourceDrawer c={source} onClose={() => setSource(undefined)} />}
      {trace && <TraceDrawer b={trace} onClose={() => setTrace(undefined)} />}
    </div>
  )
}
