import { hazard } from '../../lib/hazards'
import type { Briefing, HazardId, StreamEvent } from '../../lib/types'

export interface Step { key: string; text: string; sub?: string[]; state: 'running' | 'done' | 'error'; agent?: HazardId }

interface Base { id: string; steps: Step[]; running: boolean; error?: string; seconds?: number; startedAt: number }
export interface BriefingItem extends Base { kind: 'briefing'; briefing?: Briefing; cached?: boolean }
export interface AnswerItem extends Base { kind: 'answer'; text: string; cited: number[]; agents: HazardId[]; memories: string[]; restored?: boolean }
export interface UserItem { id: string; kind: 'user'; text: string }
export type ThreadItem = BriefingItem | AnswerItem | UserItem

const name = (id: HazardId) => hazard(id).agent
/** "the Space Radiation agent, the Isolation & Confinement agent and the Gravity Fields agent" */
const list = (ids: HazardId[]) => {
  const n = ids.map((id) => `the ${name(id)}`)
  return n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

function upsert(steps: Step[], step: Step): Step[] {
  const i = steps.findIndex((s) => s.key === step.key)
  if (i < 0) return [...steps, step]
  const copy = steps.slice()
  copy[i] = { ...copy[i], ...step }
  return copy
}

/** Turn backend stream events into plain-language steps (the live "thinking trail"). */
export function applyEvent<T extends BriefingItem | AnswerItem>(item: T, ev: StreamEvent): T {
  const isBriefing = item.kind === 'briefing'
  switch (ev.type) {
    case 'dashboard_read':
      return { ...item, steps: upsert(item.steps, {
        key: 'read', state: 'done',
        text: `Read your dashboard: ${ev.hazards} hazards, ${ev.signals} signal${ev.signals === 1 ? '' : 's'} need attention`,
        sub: ev.highlights,
      }) }
    case 'routing': {
      const who = list(ev.agents)
      let steps = upsert(item.steps, {
        key: 'route', state: 'done',
        text: isBriefing ? `Calling in ${who}` : ev.followup ? `This is a follow-up, so I’m asking ${who}` : `I’m asking ${who}`,
      })
      for (const a of ev.agents) steps = upsert(steps, { key: `agent-${a}`, agent: a, state: 'running', text: `The ${name(a)} is searching the NASA knowledge base…` })
      return { ...item, steps }
    }
    case 'retrieval': {
      const titles = [...new Set(ev.passages.map((p) => p.title))].slice(0, 3)
      return { ...item, steps: upsert(item.steps, {
        key: `agent-${ev.agent}`, agent: ev.agent, state: 'running',
        text: `The ${name(ev.agent)} found ${ev.count} NASA passage${ev.count === 1 ? '' : 's'} and is reading them…`, sub: titles,
      }) }
    }
    case 'agent_done': {
      const prev = item.steps.find((s) => s.key === `agent-${ev.agent}`)
      return { ...item, steps: upsert(item.steps, {
        key: `agent-${ev.agent}`, agent: ev.agent, state: 'done',
        text: `${name(ev.agent)}: “${ev.summary}”`, sub: prev?.sub,
      }) }
    }
    case 'agent_error':
      return { ...item, steps: upsert(item.steps, { key: `agent-${ev.agent}`, agent: ev.agent, state: 'error', text: `The ${name(ev.agent)} could not finish: ${ev.error}` }) }
    case 'writing':
      return { ...item, steps: upsert(item.steps, { key: 'write', state: 'running', text: isBriefing ? 'Writing your briefing…' : 'Writing your answer…' }) }
    case 'token':
      return item.kind === 'answer' ? { ...item, text: (item as AnswerItem).text + ev.text } : item
    case 'memory_saved':
      return item.kind === 'answer'
        ? { ...item, memories: [...(item as AnswerItem).memories, ...ev.memories.map((m) => m.text)],
            steps: upsert(item.steps, { key: 'memory', state: 'done', text: `Remembered: ${ev.memories.map((m) => `“${m.text}”`).join(', ')}` }) }
        : item
    case 'briefing':
      return { ...item, briefing: ev.briefing, cached: ev.cached, running: false,
               seconds: (Date.now() - item.startedAt) / 1000,
               steps: item.steps.map((s) => (s.state === 'running' ? { ...s, state: 'done', text: s.key === 'write' ? 'Wrote your briefing' : s.text } : s)) } as T
    case 'done':
      return { ...item, running: false, seconds: ev.seconds, cited: ev.cited, agents: ev.agents,
               steps: item.steps.map((s) => (s.key === 'write' ? { ...s, state: 'done', text: 'Wrote your answer' } : s)) } as T
    case 'error':
      return { ...item, running: false, error: ev.error, steps: item.steps.map((s) => (s.state === 'running' ? { ...s, state: 'error' } : s)) }
    default:
      return item
  }
}
