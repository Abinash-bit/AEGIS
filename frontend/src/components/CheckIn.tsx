import { useState } from 'react'
import { ArrowLeft, ClipboardCheck, Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { GUIDES, type Guide } from '../lib/guides'
import { hazard } from '../lib/hazards'
import { CameraHR } from './CameraHR'

/** Guided check-in: how to measure, why it matters, what is typical, then log the value. */
export function CheckIn({ crew, onClose, onSaved, initial }: {
  crew: string; onClose: () => void; initial?: Guide['key']
  onSaved: (question: string) => void   // ask AEGIS to explain the new reading
}) {
  const [g, setG] = useState<Guide | undefined>(GUIDES.find((x) => x.key === initial))
  const [vals, setVals] = useState<Record<string, string>>({})
  const [source, setSource] = useState<'manual' | 'camera'>('manual')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!g) return
    const v = Number(vals.value), v2 = vals.value2 ? Number(vals.value2) : undefined
    if (!vals.value || Number.isNaN(v)) { setErr('Please enter a value.'); return }
    setBusy(true); setErr('')
    try {
      await api.addReading(crew, { key: g.key, value: v, value2: v2, source, note: note || undefined })
      const shown = g.key === 'bp' ? `${v}/${v2} mmHg` : `${v} ${g.fields[0].unit}`
      onSaved(`I just logged my ${g.title.toLowerCase()}: ${shown}${source === 'camera' ? ' (camera measurement)' : ''}.` +
              `${note ? ` Note: ${note}.` : ''} What does it mean for me, and is there anything I should do?`)
    } catch (e) {
      setErr(String((e as Error).message || e)); setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="plate scroll-thin max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {g && <button onClick={() => { setG(undefined); setVals({}); setSource('manual') }} aria-label="Back" className="text-ink-2 hover:text-ink"><ArrowLeft size={18} /></button>}
            <p className="kicker">Guided check-in</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-2 hover:text-ink"><X size={20} /></button>
        </div>

        {!g && (
          <>
            <h2 className="mt-2 font-display text-3xl">What would you like to measure?</h2>
            <p className="mt-1 text-ink-2">Each check-in shows you how to measure, why it matters in space, and what is typical.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {GUIDES.map((x) => (
                <button key={x.key} onClick={() => setG(x)} className="plate p-4 text-left hover:-translate-y-[1px]"
                        style={{ borderLeft: `3px solid ${hazard(x.hazard).color}` }}>
                  <span className="block font-display text-xl">{x.title}</span>
                  <span className="text-[13px] text-ink-3">{x.minutes} · {hazard(x.hazard).name}{x.camera ? ' · camera option' : ''}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {g && (
          <>
            <h2 className="mt-2 font-display text-3xl">{g.title}</h2>
            <p className="mt-1 text-[13px] text-ink-3">About {g.minutes} · watched by the {hazard(g.hazard).agent}</p>

            <p className="kicker mt-5 mb-2">How to measure</p>
            <ol className="space-y-2">
              {g.how.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px]"><span className="font-mono text-ink-3">{i + 1}</span>{s}</li>
              ))}
            </ol>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><p className="kicker mb-1">Why it matters in space</p><p className="text-[14px] leading-relaxed text-ink-2">{g.why}</p></div>
              <div><p className="kicker mb-1">What is typical</p><p className="text-[14px] leading-relaxed text-ink-2">{g.typical}</p></div>
            </div>

            {g.camera && (
              <div className="mt-5">
                <CameraHR onResult={(bpm) => { setVals({ value: String(bpm) }); setSource('camera') }} />
              </div>
            )}

            <p className="kicker mt-5 mb-2">Your reading</p>
            <div className="flex flex-wrap items-end gap-4">
              {g.fields.map((f) => (
                <label key={f.name} className="flex flex-col">
                  <span className="text-[13px] text-ink-2">{f.label}</span>
                  <span className="mt-1 flex items-center gap-2 border border-ink-3/70 bg-card px-3 py-2">
                    <input type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={vals[f.name] ?? ''}
                           onChange={(e) => { setVals({ ...vals, [f.name]: e.target.value }); if (f.name === 'value') setSource('manual') }}
                           className="w-24 bg-transparent font-mono text-xl outline-none" aria-label={f.label} />
                    <span className="font-mono text-[12px] text-ink-3">{f.unit}</span>
                  </span>
                </label>
              ))}
              {source === 'camera' && <span className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">from camera</span>}
            </div>
            <label className="mt-3 block">
              <span className="text-[13px] text-ink-2">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. measured after exercise, felt dizzy"
                     className="mt-1 w-full border border-ink-3/70 bg-card px-3 py-2 text-[15px] outline-none" />
            </label>
            {err && <p className="mt-3 text-sm text-critical">{err}</p>}
            <div className="mt-5 flex items-center justify-between">
              <p className="text-[12px] text-ink-3">Saved readings update your dashboard; AEGIS then explains the result with NASA sources.</p>
              <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase tracking-wider text-paper hover:bg-navy disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ClipboardCheck size={15} />} Save and explain
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
