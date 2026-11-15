import { Link, NavLink } from 'react-router-dom'
import { ThemeToggle } from '../lib/theme'

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 text-ink no-underline">
      <svg width={small ? 22 : 26} height={small ? 22 : 26} viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 20 Q16 10 27 20" fill="none" stroke="var(--color-orange)" strokeWidth="1.8" />
        <circle cx="16" cy="11" r="2.4" fill="var(--color-teal)" />
      </svg>
      <span className={`font-display ${small ? 'text-xl' : 'text-2xl'} tracking-wide`}>AEGIS</span>
    </Link>
  )
}

export function SiteNav() {
  const link = 'font-mono text-xs uppercase tracking-[0.14em] text-ink-2 hover:text-ink'
  return (
    <nav className="sticky top-0 z-30 border-b border-ink-3/40 bg-paper/90 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Logo />
        <div className="hidden items-center gap-7 md:flex">
          <a href="/#hazards" className={link}>The five hazards</a>
          <a href="/#how" className={link}>How it works</a>
          <NavLink to="/about" className={link}>Method &amp; data</NavLink>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/mission" className="border border-ink bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-paper hover:bg-navy">
            Open mission console
          </Link>
        </div>
      </div>
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-3/50 bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm text-ink-2 md:grid-cols-3">
        <div>
          <Logo small />
          <p className="mt-3 leading-relaxed">A crew health companion for long space missions. Built for the 2026 NASA Space Apps Challenge.</p>
        </div>
        <div>
          <p className="kicker mb-2">Sources</p>
          <ul className="space-y-1 leading-relaxed">
            <li>NASA Human Research Program: hazards, risks, research</li>
            <li>NASA DONKI space weather (CCMC)</li>
            <li>NASA OSDR: Inspiration4 crew labs (OSD-569, OSD-575)</li>
            <li>Canadian Space Agency: radiation monitoring</li>
          </ul>
        </div>
        <div>
          <p className="kicker mb-2">Please note</p>
          <p className="leading-relaxed">AEGIS gives guidance drawn from NASA sources. It is not a medical diagnosis. Daily readings in the demo are simulated and labelled as such.</p>
        </div>
      </div>
    </footer>
  )
}
