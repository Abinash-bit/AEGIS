# AEGIS frontend

React + Vite + TypeScript + Tailwind. The look is taken from the six vintage illustrations in `public/images/`.

## Run

```bash
# 1. backend (from backend/)
.venv/Scripts/uvicorn app.main:app --port 8000

# 2. frontend (from frontend/)
npm install
npm run dev            # http://localhost:5173  (Vite proxies /api to :8000)
```

## Pages

| Route | Page |
|---|---|
| `/` | Home: story, the five hazards, how it works, real data |
| `/mission` | Mission setup: crew member + environment (product flow starts here) |
| `/console` | Mission console: compact dashboard + AEGIS assistant (live step trail, briefing, chat). `?ask=...` sends a question automatically (demo link) |
| `/hazards/:id` | One page per hazard (RAD, ISO, DIST, GRAV, ENV) |
| `/labs` | Real Inspiration4 blood data |
| `/space-weather` | NASA DONKI events |
| `/library` | Search the NASA knowledge base |
| `/memory` | What AEGIS remembers, past conversations |
| `/about` | Method and data |
| `/report` | Report to Earth: printable telemetry sheet, "send" with live arrival countdown |

## Console features

- **Check in** (top bar): guided measurements (how / why / typical) for blood pressure, heart rate, temperature, blood sugar, sleep and mood.
  - Saved values replace today's simulated value (labelled "logged"), and AEGIS explains them.
  - Heart rate can be measured with the **camera** (fingertip PPG, ~20 s, runs on the device).
- **Emergency** (top bar): scripted step-by-step guides for chest pain, collapse and trouble breathing.
  - Big yes/no buttons, a timer and vital-sign recording.
  - The auto-drafted report can be sent to Mission Control, with its arrival time shown.
- **View tabs:**
  - **Overview:** compact dashboard.
  - **Body map:** clickable figure, regions coloured by status.
  - **Routine:** daily check-ins, streaks, badges and crew points.
  - **Crew:** all four crew members.
- **Assistant:**
  - "How this was made" trace for every briefing.
  - Read-aloud button on briefings and answers.
  - Microphone for spoken questions (Chrome/Edge).
- **Landing day** scenario (mission setup): gravity transition after months of weightlessness.

## Structure

```
src/lib/          api.ts (REST + SSE streaming), types.ts, mission.tsx (crew/env/session state), hazards.ts
src/components/   ui.tsx (status, provenance, sparkline, lab dot plot), SiteNav.tsx
src/components/assistant/   Assistant.tsx, steps.ts (stream events -> plain-language steps), rich.tsx
src/pages/        one file per route
```
