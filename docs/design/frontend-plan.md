# AEGIS frontend plan

**Look:** taken from our five vintage illustrations: aged paper, ink, lithograph colors, and a calm, scientific, old-school feel. No sci-fi styling.

---

## 1. Visual system (from the images)

| Token | Value | Taken from |
|---|---|---|
| Paper | `#F2E8D2` (page), `#E9DDC1` (card) | Star chart and cutaway paper |
| Ink | `#2B2621` (text), `#6B5E50` (secondary) | Engraving lines |
| Night navy | `#1E2A44` | Sun image sky, porthole night |
| Burnt orange | `#C8622A` | The Sun, Mars |
| Faded teal | `#4F7F86` | Earth, cutaway air arrows |
| Mustard | `#C9952B` | Gravity triptych |
| Brick | `#9E2B25` | Cutaway red panels |
| Sage | `#6B8F5E` | Isolation image (plant) |

- **Status colors** (always paired with an icon and a word): Nominal = sage, Watch = mustard, Alert = burnt orange, Critical = brick.
- **Hazard colors:**

| Agent | Hazard | Color | Image |
|---|---|---|---|
| RAD | Radiation | burnt orange | Sun |
| ISO | Isolation | sage | Quiet view |
| DIST | Distance | faded teal | Star chart |
| GRAV | Gravity | mustard | Three worlds |
| ENV | Closed environment | slate blue | Cutaway |

- **Type:**
  - Headings in a classic serif (*DM Serif Display* or *Libre Caslon*).
  - Body in *Source Serif 4* or *Inter*.
  - Numbers and data in a typewriter mono (*IBM Plex Mono* or *Courier Prime*).
- **Surfaces:**
  - Soft paper-grain texture on the page background.
  - Cards with a thin ink border and a second inner hairline, like an engraved plate.
  - Corner radius 2–4px. No glow, no glass, no heavy shadows.
- **Image treatment:**
  - Home page: full color and large.
  - Inside the app: small, cropped and slightly faded (multiplied onto the paper), so data stays readable.

---

## 2. Pages and routes

| Route | Page | Purpose |
|---|---|---|
| `/` | **Home** | The story, the five hazards, how AEGIS works, entry to the product |
| `/mission` | **Mission setup** | Choose a crew member (C001–C004) and an environment. This is where the product flow starts |
| `/console` | **Mission console** | Compact dashboard + AEGIS assistant (briefing and chat). The main app |
| `/hazards/:id` | **Hazard page** ×5 | Deep dive: the hazard's image header, indicators, linked NASA risks, the agent's notes |
| `/labs` | **Clinical labs** | Real Inspiration4 blood data explorer (OSDR) |
| `/space-weather` | **Space weather** | Live DONKI events and charts |
| `/library` | **Knowledge library** | Search the 202 NASA passages AEGIS cites |
| `/memory` | **What AEGIS remembers** | Long-term memories (deletable) and past conversations |
| `/about` | **Method & data** | Data sources, how the agents work, limits, for judges |

**Product flow:** Home → "Begin a health check" → `/mission` (pick crew + environment) → `/console`. The console loads the dashboard, then AEGIS automatically writes the first briefing, streaming its steps.

---

## 3. Home page layout (top to bottom)

1. **Top navigation (thin):** AEGIS wordmark · The five hazards · How it works · Data & sources · button **Open mission console**.
2. **Hero:** **new image** (prompt below), full width at about 80% of the viewport height.
   - Headline on the empty paper area: *"When help is twenty light-minutes away."*
   - One-line subtitle: *"AEGIS helps astronauts understand their own health, guided by NASA research."*
   - Buttons: **Begin a health check** → `/mission` and *See how it works*.
3. **Live strip under the hero** (proves the app is live), in mono type on paper:
   `LIVE · NASA DONKI  Latest flare M1.7 · 3 days ago   |   Comms delay to Mars today 11.7 min   |   202 NASA passages`
4. **The problem:** short centered text. "Astronauts are not doctors…" plus one quote from the challenge video.
5. **The five hazards:** editorial rows that alternate image left/right. Each row has:
   - the image;
   - hazard name and agent badge;
   - a two-sentence explanation;
   - "AEGIS watches:" (e.g. flares, particle events, dose);
   - a link to the hazard page.

   Rows:
   - **Radiation:** *Sun and space probe* (16:9). The image's blank caption band at the bottom shows live DONKI text.
   - **Isolation:** *Quiet view of Earth* (4:3).
   - **Distance:** *Earth-to-Mars star chart* as a **full-width banner** that breaks the rhythm, with the live comms-delay number set on the dotted trajectory.
   - **Gravity:** *Three worlds, one astronaut* (triptych). Captions under each panel: ISS 0 g · Moon 0.16 g · Mars 0.38 g.
   - **Closed environment:** *Spacecraft airflow cutaway* (portrait), placed beside a tall text column.
6. **How AEGIS works:** 4 steps in a row, with small ink icons:
   1. **Watch:** live NASA space weather, real crew labs, daily readings.
   2. **Detect:** fixed rules flag each hazard.
   3. **Consult:** five specialist agents search the NASA knowledge base.
   4. **Advise:** a cited briefing, and you can ask follow-ups.
7. **Grounded in real data:** three plate-style cards, each with its provenance badge:
   - **LIVE: NASA DONKI**
   - **REAL: NASA OSDR Inspiration4**
   - **KNOWLEDGE: 202 NASA HRP passages**
8. **Closing band:** "Choose a crew member and begin" → `/mission`.
9. **Footer:** sources, NASA Space Apps 2026, disclaimer ("Guidance from NASA sources, not a medical diagnosis").

---

## 4. Mission setup (`/mission`)

Product flow step 1, on one screen:

- **Choose a crew member:** 4 small cards (C001–C004, "Inspiration4 crew, anonymised").
- **Choose where you are:** the **Three worlds** triptych becomes the selector. Click a panel to choose **Space station / Moon base / Mars**, plus a fourth card "Deep-space transit" using the star chart. The selected panel gets an ink frame and shows gravity and comms delay.
- **Options:** Demo scenario on/off, and "Replay the May 2024 solar storm" (real historical DONKI data).
- **Button:** **Enter mission console**.

---

## 5. Mission console (`/console`): fits one screen, no page scroll

Target 1440×900 and 1280×800. Each panel scrolls internally if needed.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ AEGIS · C001 · Deep-space transit · Sol 142 · ↯ 11.7 min · LIVE REAL SIM · 12:04  │  56px
├───────────────────────────────────────────────┬───────────────────────────────────┤
│ READINESS 56 · WATCH   [faded star-chart strip]│  AEGIS                (remembers 3)│
│ ┌────┐┌────┐┌────┐┌────┐┌────┐                 │  ┌───────────────────────────────┐ │
│ │RAD ││ISO ││DIST││GRAV││ENV │  5 hazard tiles │  │ BRIEFING · WATCH · RAD ISO …  │ │
│ └────┘└────┘└────┘└────┘└────┘                 │  │ What is happening ¹²          │ │
│ ┌──────────────────────┐┌─────────────────────┐│  │ What to do  ☐ ☐ ☐             │ │
│ │ VITALS TODAY (SIM)   ││ SPACE WEATHER (LIVE)││  │ What comes next               │ │
│ │ 6 rows + sparklines  ││ last events + mini  ││  │ ▸ How I got this (5 steps)    │ │
│ └──────────────────────┘└─────────────────────┘│  └───────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐│  … chat thread …                   │
│ │ LABS (REAL · OSDR): glucose · lymphocytes · ││  [How am I doing?] [Explain alert] │
│ │ calcium  L-92 L-44 L-3 |gap| R+1 … R+194    ││  ┌───────────────────────────────┐ │
│ └─────────────────────────────────────────────┘│  │ Ask AEGIS…                  ➤ │ │
│                    ~60%                        │  └───────────────────────────────┘ │
│                                                │                ~40%               │
└───────────────────────────────────────────────┴───────────────────────────────────┘
```

**Dashboard (left, compact):**
- **Readiness** number + status word.
- **5 hazard tiles:** color mark, status word + icon, one key metric, tiny sparkline. Clicking a tile opens a side drawer with details; the user doesn't leave the console.
- **Vitals today:** 6 compact rows (value, unit, change vs baseline, sparkline, status).
- **Space weather:** the last 4 DONKI events + a tiny 7-day flare strip + Kp.
- **Labs:** 3 small dot plots with the normal band and the hatched "no in-flight samples" gap, plus a link to `/labs`.
- A faded crop of the star chart behind the readiness row is the only image in the console.

**AEGIS panel (right):** one thread. The proactive briefing is the first card, and chat continues below it.
- **Briefing card:** severity, the agents involved, *What is happening / What to do / What comes next*, numbered citation chips.
- **Clicking a citation** opens the **source drawer**: the quoted NASA passage, its heading path and a link.
- **"AEGIS remembers (3)"** pill in the header opens a popover listing memories with delete buttons.
- **Composer:** suggested-question chips and an input box.

### Live "thinking trail" (streaming events shown as plain sentences)

While AEGIS works, a step list fills in live. When finished it collapses to **"How I got this · 5 steps · 18 s"**.

```
✓ Read your dashboard: 5 hazards, 7 signals (sleep short 3 nights, BP rising, M1.7 flare…)
✓ This is a follow-up about sleep, so I'm asking ISO and GRAV
✓ ISO searched the NASA knowledge base: 4 passages
    · Risk from Inadequate Sleep and Irregular Schedules
    · Houston We Have a Podcast: Isolation (Dr. Tom Williams)
✓ ISO summary: "Three short nights fit NASA's sleep-loss pattern; protect a longer sleep window."
✓ GRAV summary: "BP rise is consistent with fluid shift; no threshold in sources, log daily."
… Writing your answer (streams in below)
✓ Remembered: "Sleeps badly after night shifts"
```

**Backend additions needed for this:**
- Per-agent `retrieval` events listing passage titles.
- `agent_done` carrying a one-line summary.
- A **streaming briefing endpoint** (SSE), so the first briefing shows the same steps instead of a 30 s wait.

---

## 6. Other pages (short)

- **Hazard page:** large hazard image as a header band.
  - Left: indicators with charts.
  - Center: the linked NASA risks as quoted excerpts with sources.
  - Right: this agent's latest notes and "Ask RAD…".
- **Clinical labs:** tabs for blood count / metabolic / cardiovascular; small multiples with normal bands; a crew selector; R+1 vs L-3 change; caption with sources.
- **Space weather:** the Sun image as a header; event table; 7-day charts; live/stale/replay state.
- **Knowledge library:** search box and filters (hazard, risk, type); results look like index cards.
- **What AEGIS remembers:** memory list with delete and clear-all; past conversations to reopen.
- **Method & data:** data provenance, the agent architecture diagram, rules vs. AI, limitations.

## 7. Responsive

- **Tablet:** the assistant becomes a slide-over panel opened from a button in the top bar.
- **Phone:** dashboard cards stack; AEGIS opens full screen.

## 8. Stack

React + Vite + TypeScript, React Router, Tailwind (tokens as CSS variables), Recharts, a small amount of Framer Motion (fades only), and EventSource/fetch streaming for SSE.
