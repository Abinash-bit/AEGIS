import type { EnvId, HazardId, Status } from './types'

export interface HazardMeta {
  /** full agent name shown to the astronaut, e.g. "Gravity Fields agent" (IDs like GRAV stay internal) */
  agent: string
  id: HazardId; name: string; short: string; color: string; image: string; imageAlt: string
  blurb: string; watches: string[]
}

export const HAZARDS: HazardMeta[] = [
  {
    id: 'RAD', name: 'Space Radiation', agent: 'Space Radiation agent', short: 'Radiation', color: '#c8622a', image: '/images/radiation.webp',
    imageAlt: 'Vintage illustration of the Sun with flares and a small space probe',
    blurb: 'Beyond Earth’s magnetic shield, crews meet galactic cosmic rays and solar storms. Particle events bring short-term danger; every dose adds long-term risk.',
    watches: ['Solar flares and particle events (live NASA DONKI)', 'Fast coronal mass ejections', 'Cumulative radiation dose'],
  },
  {
    id: 'ISO', name: 'Isolation & Confinement', agent: 'Isolation & Confinement agent', short: 'Isolation', color: '#6b8f5e', image: '/images/isolation.webp',
    imageAlt: 'An astronaut seen from behind looking at Earth through a porthole in a warm cabin',
    blurb: 'Months in a small space, far from family, wear on sleep, mood and teamwork. Small changes are easier to fix when they are noticed early.',
    watches: ['Sleep hours and short-night streaks', 'Self-reported mood', 'Reaction-time tests'],
  },
  {
    id: 'DIST', name: 'Distance from Earth', agent: 'Distance from Earth agent', short: 'Distance', color: '#4f7f86', image: '/images/distance.webp',
    imageAlt: 'Antique star chart showing a dotted route from Earth to Mars',
    blurb: 'On the way to Mars a message takes minutes to reach Earth, and there is no quick way home. The crew must make the first decisions themselves.',
    watches: ['One-way communication delay', 'Evacuation options', 'Medical autonomy'],
  },
  {
    id: 'GRAV', name: 'Gravity Fields', agent: 'Gravity Fields agent', short: 'Gravity', color: '#c9952b', image: '/images/gravity.webp',
    imageAlt: 'Triptych of an astronaut floating in a spacecraft, hopping on the Moon and standing on Mars',
    blurb: 'Weightlessness shifts fluids toward the head and unloads bones and muscles. Each change of gravity, to the Moon, Mars or home, asks the body to adapt again.',
    watches: ['Blood pressure and heart rate', 'Calcium and blood markers (real NASA labs)', 'Fluid shift and eye (SANS) risk'],
  },
  {
    id: 'ENV', name: 'Hostile & Closed Environments', agent: 'Hostile & Closed Environments agent', short: 'Environment', color: '#5a6e8c', image: '/images/environment.webp',
    imageAlt: 'Engineering cutaway of a spacecraft cabin showing airflow and microbes',
    blurb: 'The spacecraft is a sealed world: its air, temperature and microbes are part of every crew member’s health, and stress can weaken the immune system.',
    watches: ['Cabin CO₂ and temperature', 'Body temperature', 'Immune markers (real NASA labs)'],
  },
]

export const hazard = (id: string) => HAZARDS.find((h) => h.id === id)!

export const STATUS_LABEL: Record<Status, string> = { nominal: 'Nominal', watch: 'Watch', alert: 'Alert', critical: 'Critical' }

export const ENVIRONMENTS: { id: EnvId; label: string; caption: string }[] = [
  { id: 'iss', label: 'Space station', caption: 'Low Earth orbit · 0 g · help within hours' },
  { id: 'lunar_base', label: 'Moon base', caption: 'Lunar surface · 0.16 g · 1.3 s delay' },
  { id: 'mars_base', label: 'Mars base', caption: 'Mars surface · 0.38 g · ~20 min delay' },
  { id: 'mars_transit', label: 'Deep-space transit', caption: 'On the way to Mars · 0 g · ~12 min delay' },
]

export function fmtDelay(s: number) {
  if (s >= 60) return `${(s / 60).toFixed(1)} min`
  if (s >= 1) return `${s.toFixed(1)} s`
  return 'near real-time'
}
