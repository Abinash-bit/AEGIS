import type { Briefing, Chunk, CrewCard, Dashboard, EnvId, Memory, Reading, Routine, SentReport, SessionFull, SpaceWeather, StreamEvent } from './types'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) {
    let detail = `${r.status} ${r.statusText}`
    try { detail = (await r.json()).detail ?? detail } catch { /* not json */ }
    throw new Error(detail)
  }
  return r.json() as Promise<T>
}

export interface MissionParams { crew: string; env: EnvId; scenario: string; replay?: boolean }

// The May 2024 "Gannon" solar storms: a real historical DONKI window with X-class flares and SEP events.
export const REPLAY_WINDOW = { start: '2024-05-08', end: '2024-05-15' }

function qs(p: MissionParams, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ env: p.env, scenario: p.scenario, ...extra })
  if (p.replay) { q.set('replay_start', REPLAY_WINDOW.start); q.set('replay_end', REPLAY_WINDOW.end) }
  return q.toString()
}

export const api = {
  health: () => json<{ ok: boolean; claude_configured: boolean; kb_chunks: number; retrieval_mode: string }>('/api/health'),
  dashboard: (p: MissionParams) => json<Dashboard>(`/api/dashboard/${p.crew}?${qs(p)}`),
  spaceWeather: (replay = false) =>
    json<SpaceWeather>(`/api/space-weather${replay ? `?replay_start=${REPLAY_WINDOW.start}&replay_end=${REPLAY_WINDOW.end}` : ''}`),
  kbSearch: (q: string, hazard?: string, k = 8) =>
    json<Chunk[]>(`/api/kb/search?${new URLSearchParams({ q, k: String(k), ...(hazard ? { hazard } : {}) })}`),
  session: (id: string) => json<SessionFull>(`/api/sessions/${id}`),
  sessions: (crew: string) => json<Omit<SessionFull, 'messages' | 'citations'>[]>(`/api/sessions?crew_id=${crew}`),
  deleteSession: (id: string) => json(`/api/sessions/${id}`, { method: 'DELETE' }),
  memories: (crew: string) => json<Memory[]>(`/api/memory/${crew}`),
  deleteMemory: (crew: string, id: string) => json(`/api/memory/${crew}/${id}`, { method: 'DELETE' }),
  clearMemories: (crew: string) => json(`/api/memory/${crew}`, { method: 'DELETE' }),
  addReading: (crew: string, r: { key: string; value: number; value2?: number; source?: 'manual' | 'camera'; note?: string }) =>
    json<Reading>(`/api/readings/${crew}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }),
  readings: (crew: string, limit = 50) => json<Reading[]>(`/api/readings/${crew}?limit=${limit}`),
  routine: (crew: string) => json<Routine>(`/api/routine/${crew}`),
  crewOverview: (p: MissionParams) => json<CrewCard[]>(`/api/crew-overview?${qs(p)}`),
  latestBriefing: (p: MissionParams) => json<Briefing>(`/api/briefing/${p.crew}/latest?env=${p.env}&scenario=${p.scenario}`),
  sendReport: (crew: string, environment: EnvId, data: Record<string, unknown>) =>
    json<SentReport>(`/api/reports/${crew}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ environment, data }) }),
  reports: (crew: string) => json<SentReport[]>(`/api/reports/${crew}`),
  briefingStream: (p: MissionParams, force = false) =>
    sse(`/api/briefing/${p.crew}/stream?${qs(p, force ? { force: 'true' } : {})}`),
  chatStream: (p: MissionParams, message: string, sessionId?: string) =>
    sse(`/api/chat?${p.replay ? `replay_start=${REPLAY_WINDOW.start}&replay_end=${REPLAY_WINDOW.end}` : ''}`, {
      crew_id: p.crew, environment: p.env, scenario: p.scenario, message, session_id: sessionId,
    }),
}

/** POST + read a text/event-stream body, yielding parsed `data:` events. */
async function* sse(url: string, body?: unknown): AsyncGenerator<StreamEvent> {
  const r = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok || !r.body) {
    let detail = `${r.status} ${r.statusText}`
    try { detail = (await r.json()).detail ?? detail } catch { /* not json */ }
    yield { type: 'error', error: detail }
    return
  }
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (line) {
        try { yield JSON.parse(line.slice(6)) as StreamEvent } catch { /* skip malformed */ }
      }
    }
  }
}
