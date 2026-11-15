// Mirrors backend/app/models.py

export type Status = 'nominal' | 'watch' | 'alert' | 'critical'
export type HazardId = 'RAD' | 'ISO' | 'DIST' | 'GRAV' | 'ENV'
export type EnvId = 'iss' | 'lunar_base' | 'mars_transit' | 'mars_base'
export type Provenance = 'LIVE_DONKI' | 'REAL_OSDR' | 'SIMULATED' | 'LOGGED'

export interface Environment {
  id: EnvId; name: string; comms_delay_s: number; gravity_g: number; evacuation: string
  mission_day: number; mission_length_days: number; distance_km: number
}

export interface Trigger { hazard: HazardId; status: Status; signal: string; message: string; query: string }

export interface HazardSummary {
  id: HazardId; name: string; status: Status; level: number; headline: string; key_metric: string
  triggers: Trigger[]; spark: number[]
}

export interface Vital {
  key: string; label: string; value: number; unit: string; status: Status; baseline?: number | null
  delta_vs_baseline_pct?: number | null; spark: number[]; provenance: Provenance; hazard: HazardId
}

export interface LabPoint {
  marker: string; label: string; unit: string; timepoint: string; value: number
  range_min?: number | null; range_max?: number | null; status: Status; source: string
}
export interface LabSeries {
  marker: string; label: string; unit: string; panel: 'CBC' | 'CMP' | 'CARDIO'; hazard: HazardId
  points: LabPoint[]; change_r1_vs_l3_pct?: number | null
}

export interface SpaceWeatherEvent {
  id: string; type: 'FLR' | 'SEP' | 'CME' | 'GST'; time: string; class_or_value: string
  earth_directed?: boolean | null; speed_kms?: number | null; kp?: number | null; note: string; link: string
}
export interface SpaceWeather {
  provenance: Provenance; window_start: string; window_end: string; fetched_at: string; stale: boolean; replay: boolean
  events: SpaceWeatherEvent[]; max_flare_class?: string | null; max_kp?: number | null; sep_count: number; fast_cme_count: number
}

export interface Dashboard {
  crew_id: string; environment: Environment; generated_at: string; readiness: number; overall_status: Status
  hazards: HazardSummary[]; vitals: Vital[]; labs: LabSeries[]; space_weather: SpaceWeather; scenario: string
}

export interface Citation {
  n: number; chunk_id: string; title: string; heading_path: string[]; quote: string; url: string; hazards: string[]
}
export interface CitedText { text: string; cites: number[] }
export interface Briefing {
  id: string; crew_id: string; created_at: string; severity: Status; agents: HazardId[]; headline: string
  happening: CitedText[]; actions: CitedText[]; next: string; escalate_to_flight_surgeon: boolean
  citations: Citation[]; trace: Record<string, unknown>
}

export interface Memory { id: string; crew_id: string; text: string; category: string; source_session?: string; created_at: string }

export interface Chunk {
  id: string; doc: string; hazards: string[]; content_type: string; title: string; heading_path: string[]
  source_url: string; risks: string[]; text: string; score?: number
}

export interface SessionMessage { id: number; role: 'user' | 'assistant'; content: string; agents: HazardId[]; cited: number[]; created_at: string }
export interface SessionFull {
  id: string; crew_id: string; environment: EnvId; scenario: string; title?: string
  created_at: string; updated_at: string; messages: SessionMessage[]; citations: Citation[]
}

/** Streaming events from /api/briefing/{crew}/stream and /api/chat */
export type StreamEvent =
  | { type: 'session'; session_id: string }
  | { type: 'dashboard_read'; hazards: number; signals: number; highlights: string[] }
  | { type: 'routing'; agents: HazardId[]; followup?: boolean; reasons?: Record<string, string> }
  | { type: 'retrieval'; agent: HazardId; count: number; passages: { n: string; chunk_id: string; title: string; path: string }[] }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'agent_done'; agent: HazardId; seconds: number; coverage: string; summary: string }
  | { type: 'agent_error'; agent: HazardId; error: string }
  | { type: 'writing'; agents: HazardId[] }
  | { type: 'token'; text: string }
  | { type: 'memory_saved'; memories: Memory[] }
  | { type: 'memory_error'; error: string }
  | { type: 'briefing'; briefing: Briefing; cached: boolean }
  | { type: 'done'; session_id: string; cited: number[]; agents: HazardId[]; seconds: number; followup: boolean; used_briefing: boolean; memories_in_context: number }
  | { type: 'error'; error: string }

export interface Reading { id: number; crew_id: string; key: string; value: number; value2?: number | null; source: 'manual' | 'camera'; note?: string | null; created_at: string }

export interface Routine {
  date: string; done: number; total: number; streak_days: number; points: number
  items: { key: string; label: string; when: string; hazard: HazardId; done: boolean }[]
  badges: { days: number; name: string; earned: boolean }[]
  crew_points: Record<string, number>; crew_total: number; crew_goal: number
}

export interface CrewCard {
  crew_id: string; readiness: number; overall_status: Status
  hazards: { id: HazardId; name: string; status: Status }[]
  top: { id: HazardId; name: string; headline: string }
}

export interface SentReport { id: string; crew_id: string; environment: EnvId; data: Record<string, unknown>; sent_at: string; arrives_at: string }
