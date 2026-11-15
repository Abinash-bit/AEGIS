import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw } from 'lucide-react'

/**
 * Heart rate from the camera (fingertip photoplethysmography).
 * Each heartbeat pushes blood into the fingertip, which slightly changes how much light reaches the camera.
 * We average the red channel of the frame centre at ~30 fps for 20 s, remove drift, keep 0.7–3.5 Hz,
 * then estimate the rate two ways (strongest frequency + peak intervals) and only accept agreeing results.
 * Video never leaves the device.
 */
const DURATION = 20

type Phase = 'idle' | 'starting' | 'measuring' | 'done' | 'error'

function movingAvg(x: number[], w: number) {
  const out = new Array(x.length).fill(0)
  let s = 0
  for (let i = 0; i < x.length; i++) {
    s += x[i]; if (i >= w) s -= x[i - w]
    out[i] = s / Math.min(i + 1, w)
  }
  return out
}

function estimate(samples: { t: number; v: number }[]) {
  if (samples.length < 120) return null
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t
  const fs = (samples.length - 1) / ((t1 - t0) / 1000)
  const raw = samples.map((s) => s.v)
  const trend = movingAvg(raw, Math.round(fs))                 // ~1 s window: drift
  const detr = raw.map((v, i) => v - trend[i])
  const sig = movingAvg(detr, Math.max(2, Math.round(fs / 8))) // light smoothing
  // 1) strongest frequency in 0.7–3.5 Hz (simple DFT scan, 0.01 Hz steps)
  let best = { f: 0, p: 0 }
  for (let f = 0.7; f <= 3.5; f += 0.01) {
    let re = 0, im = 0
    for (let i = 0; i < sig.length; i++) { const a = (2 * Math.PI * f * i) / fs; re += sig[i] * Math.cos(a); im -= sig[i] * Math.sin(a) }
    const p = re * re + im * im
    if (p > best.p) best = { f, p }
  }
  const bpmFreq = best.f * 60
  // 2) peak intervals (peaks at least 0.3 s apart, above the median)
  const sorted = [...sig].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)]
  const minGap = Math.round(fs * 0.3)
  const peaks: number[] = []
  for (let i = 1; i < sig.length - 1; i++) {
    if (sig[i] > med && sig[i] >= sig[i - 1] && sig[i] > sig[i + 1] && (!peaks.length || i - peaks[peaks.length - 1] >= minGap)) peaks.push(i)
  }
  const gaps = peaks.slice(1).map((p, i) => (p - peaks[i]) / fs).filter((g) => g > 0.28 && g < 1.5)
  const bpmPeaks = gaps.length >= 5 ? 60 / (gaps.reduce((a, b) => a + b, 0) / gaps.length) : NaN
  const agree = Number.isFinite(bpmPeaks) && Math.abs(bpmFreq - bpmPeaks) <= 6
  return { bpm: Math.round(agree ? (bpmFreq + bpmPeaks) / 2 : bpmFreq), agree, bpmFreq, bpmPeaks, sig }
}

export function CameraHR({ onResult }: { onResult: (bpm: number) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const trace = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const samples = useRef<{ t: number; v: number }[]>([])
  const raf = useRef(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [left, setLeft] = useState(DURATION)
  const [hint, setHint] = useState('')
  const [result, setResult] = useState<{ bpm: number; agree: boolean }>()

  const stop = () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  useEffect(() => stop, [])

  async function start() {
    setResult(undefined); setHint(''); samples.current = []; setLeft(DURATION); setPhase('starting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 320, height: 240 }, audio: false })
      stream.current = s
      const track = s.getVideoTracks()[0]
      // turn on the phone torch where the browser supports it (much stronger signal)
      try { await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }) } catch { /* no torch */ }
      video.current!.srcObject = s
      await video.current!.play()
      setPhase('measuring')
      loop(performance.now())
    } catch {
      setPhase('error'); setHint('Camera not available. Allow camera access, or enter the value by hand.')
    }
  }

  function loop(startT: number) {
    const v = video.current!, c = canvas.current!, ctx = c.getContext('2d', { willReadFrequently: true })!
    const tick = () => {
      const now = performance.now()
      ctx.drawImage(v, 0, 0, c.width, c.height)
      const { data } = ctx.getImageData(c.width * 0.3, c.height * 0.3, c.width * 0.4, c.height * 0.4)
      let r = 0, g = 0, b = 0
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2] }
      const n = data.length / 4; r /= n; g /= n; b /= n
      const covered = r > 60 && r > g * 1.4 && r > b * 1.4   // a lit fingertip looks strongly red
      if (!covered) {
        setHint('Cover the camera completely with your fingertip and hold still.')
        samples.current = []; startT = now
      } else {
        setHint('')
        samples.current.push({ t: now, v: r })
      }
      drawTrace()
      const elapsed = (now - startT) / 1000
      setLeft(Math.max(0, Math.ceil(DURATION - elapsed)))
      if (covered && elapsed >= DURATION) return finish()
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  function drawTrace() {
    const c = trace.current; if (!c) return
    const ctx = c.getContext('2d')!, s = samples.current.slice(-150).map((x) => x.v)
    ctx.clearRect(0, 0, c.width, c.height)
    if (s.length < 10) return
    const trend = movingAvg(s, 30), d = s.map((v, i) => v - trend[i])
    const max = Math.max(...d.map(Math.abs)) || 1
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-orange') || '#c8622a'
    ctx.lineWidth = 1.6; ctx.beginPath()
    d.forEach((v, i) => { const x = (i / 149) * c.width, y = c.height / 2 - (v / max) * (c.height * 0.4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
    ctx.stroke()
  }

  function finish() {
    stop()
    const est = estimate(samples.current)
    if (!est || est.bpm < 40 || est.bpm > 200) {
      setPhase('error'); setHint('The signal was too weak. Warm your finger, press lightly and try again.'); return
    }
    setResult({ bpm: est.bpm, agree: est.agree })
    setPhase('done')
  }

  return (
    <div className="plate p-4">
      <div className="flex items-center justify-between">
        <p className="kicker">Measure with the camera · estimate</p>
        {phase === 'measuring' && <span className="font-mono text-sm">{left}s</span>}
      </div>
      <video ref={video} playsInline muted className="hidden" />
      <canvas ref={canvas} width={80} height={60} className="hidden" />
      <canvas ref={trace} width={520} height={70} className="mt-2 h-[70px] w-full border border-rule bg-paper" />
      {phase === 'idle' && (
        <p className="mt-2 text-[13.5px] text-ink-2">
          Cover the camera lens with your fingertip, pressing lightly. On a laptop, turn the screen brightness up. Hold still for {DURATION} seconds.
        </p>
      )}
      {hint && <p className="mt-2 text-[13.5px] text-alert">{hint}</p>}
      {phase === 'done' && result && (
        <p className="mt-2 text-[15px]"><b className="font-display text-2xl">{result.bpm}</b> bpm
          <span className="ml-2 text-[13px] text-ink-3">{result.agree ? 'good signal' : 'weak signal, treat as rough'}</span></p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {(phase === 'idle' || phase === 'error') && (
          <button onClick={start} className="inline-flex items-center gap-1.5 border border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider"><Camera size={14} /> Start</button>
        )}
        {phase === 'done' && result && (<>
          <button onClick={() => onResult(result.bpm)} className="border border-ink bg-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-paper">Use {result.bpm} bpm</button>
          <button onClick={start} className="inline-flex items-center gap-1 px-2 font-mono text-[11px] uppercase tracking-wider text-ink-2"><RotateCcw size={13} /> Again</button>
        </>)}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Heart rate only, not a medical device. The video stays on this device.</p>
    </div>
  )
}
