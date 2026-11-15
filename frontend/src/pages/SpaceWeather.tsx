import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Footer, SiteNav } from '../components/SiteNav'
import { Provenance } from '../components/ui'
import { api } from '../lib/api'
import { useMission } from '../lib/mission'
import type { SpaceWeather as SW } from '../lib/types'

const TYPE: Record<string, string> = { FLR: 'Solar flare', SEP: 'Solar particle event', CME: 'Coronal mass ejection', GST: 'Geomagnetic storm' }

export default function SpaceWeather() {
  const m = useMission()
  const [sw, setSw] = useState<SW>()
  const [err, setErr] = useState<string>()
  useEffect(() => { api.spaceWeather(!!m.replay).then(setSw).catch((e) => setErr(String(e.message || e))) }, [m.replay])

  return (
    <div>
      <SiteNav />
      <header><img src="/images/radiation.webp" alt="Vintage illustration of the Sun and a space probe" className="h-[40vh] min-h-[260px] w-full border-b border-ink-3/50 object-cover object-right" /></header>
      <main className="mx-auto max-w-6xl px-6 pt-10">
        {sw && <Provenance p="LIVE_DONKI" stale={sw.stale} />}
        <h1 className="mt-3 font-display text-5xl">Space weather</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-2">
          Events from NASA’s DONKI database {sw ? `from ${sw.window_start} to ${sw.window_end}` : ''}.
          {sw?.replay && ' This is the May 2024 storm replay, not live data.'}
          {sw?.stale && ' The live feed is unreachable, so this is the last data we received.'}
        </p>
        {err && <p className="mt-4 text-critical">{err}</p>}
        {sw && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[['Strongest flare', sw.max_flare_class ?? '—'], ['Particle events', sw.sep_count], ['Fast CMEs (≥1000 km/s)', sw.fast_cme_count], ['Highest Kp', sw.max_kp ?? '—']].map(([k, v]) => (
                <div key={String(k)} className="plate p-4"><p className="kicker">{k}</p><p className="mt-1 font-display text-4xl">{v}</p></div>
              ))}
            </div>
            <table className="mt-10 w-full border-collapse text-left">
              <thead><tr className="border-b border-ink-3/60">{['Time (UTC)', 'Type', 'Class / value', 'Notes', ''].map((t) => <th key={t} className="kicker py-2 pr-4 font-normal">{t}</th>)}</tr></thead>
              <tbody>
                {sw.events.map((e) => (
                  <tr key={e.id} className="border-b border-rule/70 align-top">
                    <td className="py-2 pr-4 font-mono text-[13px] text-ink-2">{e.time?.replace('T', ' ').replace('Z', '')}</td>
                    <td className="py-2 pr-4 text-[14px]">{TYPE[e.type]}</td>
                    <td className="py-2 pr-4 font-mono text-[13px]">{e.class_or_value}</td>
                    <td className="max-w-md py-2 pr-4 text-[13px] text-ink-2">{e.note}</td>
                    <td className="py-2">{e.link && <a href={e.link} target="_blank" rel="noreferrer" aria-label="Open in DONKI" className="text-ink-2 hover:text-ink"><ExternalLink size={14} /></a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
