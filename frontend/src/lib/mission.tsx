import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MissionParams } from './api'
import type { EnvId } from './types'

interface MissionCtx extends MissionParams {
  set: (p: Partial<MissionParams>) => void
  sessionId?: string
  setSessionId: (id?: string) => void
}

const KEY = 'aegis.mission'
const DEFAULT: MissionParams = { crew: 'C001', env: 'mars_transit' as EnvId, scenario: 'demo', replay: false }

function load(): MissionParams {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULT }
}
const sessionKey = (p: MissionParams) => `aegis.session.${p.crew}.${p.env}.${p.scenario}`

const Ctx = createContext<MissionCtx | null>(null)

export function MissionProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useState<MissionParams>(load)
  const [sessionId, setSid] = useState<string | undefined>(() => {
    try { return localStorage.getItem(sessionKey(load())) || undefined } catch { return undefined }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(params)) } catch { /* storage unavailable */ }
    try { setSid(localStorage.getItem(sessionKey(params)) || undefined) } catch { setSid(undefined) }
  }, [params])

  const value = useMemo<MissionCtx>(() => ({
    ...params,
    set: (p) => setParams((old) => ({ ...old, ...p })),
    sessionId,
    setSessionId: (id) => {
      setSid(id)
      try { id ? localStorage.setItem(sessionKey(params), id) : localStorage.removeItem(sessionKey(params)) } catch { /* ignore */ }
    },
  }), [params, sessionId])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMission() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useMission outside MissionProvider')
  return c
}
