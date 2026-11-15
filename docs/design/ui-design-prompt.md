# Prompt for Claude Design: "AEGIS", crew health intelligence

## 0. One-paragraph brief

Design a desktop-first web app called **AEGIS** (working name) for the **2026 NASA Space Apps Challenge**, challenge *"Create health monitoring software for astronauts on space missions."* AEGIS shows one astronaut's health on a live **dashboard** built from **real NASA data**. Beside it, a **proactive AI assistant** watches the dashboard and tells the astronaut **what is happening, what to do, and what comes next**. The assistant is a team of **5 specialist agents**, one per NASA spaceflight hazard, plus a coordinator. Every answer **cites NASA sources** from our knowledge base, and the astronaut can ask follow-up questions at any time.

**Visual style: scientific editorial.** The app should feel like a beautifully designed NASA research report or a high-end science journal that has come alive: off-white paper tone, refined serif headings, precise minimal charts, generous whitespace, and footnote-style citations. Calm, credible, intelligent.

**Strictly avoid:**
- sci-fi or cyberpunk looks: neon, glow, HUD brackets, scan lines, grids, holograms;
- dark "cockpit" themes;
- glassmorphism and heavy gradients;
- illustrations, photos and stock imagery;
- emoji.

---

## 1. Context the designer must understand

- **Users:** astronauts on long missions. They are not doctors, may be tired, and on a Mars mission are 4–24 light-minutes from help. The secondary audience is flight surgeons on Earth and the hackathon judges, who are NASA and space agency scientists.
- **NASA's 5 hazards of human spaceflight.** These organize the whole app. Each one has a color, an icon and an agent:

| Hazard | Agent | Color (muted, print-friendly) | Simple line icon |
|---|---|---|---|
| Space Radiation | **RAD** | `#C77700` ochre | atom / particle rays |
| Isolation & Confinement | **ISO** | `#5B4FC4` indigo | capsule with one figure |
| Distance from Earth | **DIST** | `#2563B0` blue | dot with a dashed signal arc |
| Gravity Fields | **GRAV** | `#0E7C6B` teal | concentric circles |
| Hostile/Closed Environments | **ENV** | `#B23A2B` brick | sealed hatch / molecule |
| Coordinator | **AEGIS** | ink `#1C1B19` | pentagon mark |

- **The three data sources.** Design for this real data, not generic placeholders.
  1. **NASA DONKI (live space weather API):**
     - solar flares (class B/C/M/X, peak time);
     - solar energetic particle (SEP) events;
     - coronal mass ejections (CME speed km/s, Earth-directed yes/no);
     - geomagnetic storms (Kp index 0–9).
     - It updates every few minutes and drives the **radiation** hazard.
  2. **NASA OSDR, Inspiration4 crew clinical labs (real astronaut data):**
     - 4 anonymised crew (C001–C004), 7 time points each: **L-92, L-44, L-3** days before launch and **R+1, R+45, R+82, R+194** days after return.
     - Every value includes the lab's **normal range**.
     - Panels:
       - Complete blood count: white cells, lymphocytes, neutrophils, hemoglobin, platelets.
       - Metabolic panel: **glucose**, calcium, potassium, creatinine, liver enzymes.
       - Cardiovascular/inflammation: CRP, fibrinogen.
     - **No in-flight blood draws** were taken. Show the gap honestly.
  3. **Simulated daily telemetry:** sleep hours, resting heart rate, blood pressure, mood (1–5), reaction time, cumulative radiation dose, cabin CO₂ and temperature, comms delay. It is generated from published NASA study values and **always labelled "Simulated"**.
- **Provenance labels** appear on every number, styled quietly like a source line under a figure: `Live · NASA DONKI`, `Real data · NASA OSDR` or `Simulated`.

---

## 2. Visual direction: scientific editorial

### 2.1 The feel
- The layout of a **science journal or a NASA technical report**:
  - clear section numbering ("01 Hazards", "02 Space weather", "03 Clinical labs");
  - figure captions ("Fig. 3, Lymphocyte count, crew member C001");
  - footnote citations ([1], [2]) and a references list.
- **Restraint.** Mostly ink on paper. Color appears only where it carries meaning (hazards and status).
- **Charts in the spirit of Edward Tufte:**
  - minimal ink, direct labels instead of legends, thin lines;
  - normal ranges as soft tinted bands;
  - no heavy gridlines and no 3D.
- **Spacious:** generous margins and comfortable line length for reading.

### 2.2 Color tokens (CSS variables)

```
--paper:#FAF8F3      --paper-2:#F3F0E8    --surface:#FFFFFF
--rule:#E4DFD3       --rule-strong:#CFC8B8
--ink:#1C1B19        --ink-2:#4A4740      --ink-3:#7C776C
--ok:#2F7D4F  --watch:#B7791F  --alert:#C05621  --critical:#B42318
--band-normal:rgba(47,125,79,0.08)   (normal-range bands on charts)
--rad:#C77700 --iso:#5B4FC4 --dist:#2563B0 --grav:#0E7C6B --env:#B23A2B
```

- Cards are white (`--surface`) on paper, with 1px `--rule` borders and **no shadows** (at most a 1px soft shadow on floating drawers).
- **Optional:** a gentle "Evening" variant (warm dark brown-gray paper, cream ink) for night shifts. It keeps the editorial character: no glow, no neon.

### 2.3 Typography
- **Headings:** a refined serif, *Source Serif 4*, *Newsreader* or *Literata*. Use for page titles, section titles, the astronaut name and big key figures. Regular to semibold, optical sizing at large sizes.
- **Body and UI:** *Inter* (or *Source Sans 3*). Calm and highly legible.
- **Data:** *IBM Plex Mono* for numbers, units, timestamps, IDs and flare classes, with tabular numerals. Use it sparingly; it is not the main voice.
- **Small caps / uppercase labels** for section kickers ("SPACE WEATHER · LIVE"), 11px with +6% tracking, `--ink-3`.
- **Type scale:** 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48. Body line-height 1.55.

### 2.4 Iconography
- Thin 1.25–1.5px line icons (lucide style), always ink-colored unless they mark a hazard.
- Agent avatars are simple circular monograms (RAD, ISO, DIST, GRAV, ENV, AEGIS) with a thin ring in the hazard color.

### 2.5 Motion (subtle, like turning a page)
- Gentle fades and 8px slide-ins.
- Chart lines draw in once.
- Numbers update with a short cross-fade (no slot-machine counting).
- The radar shape eases between states.
- Assistant text streams in smoothly.
- A small dot beside "Live" pulses softly when DONKI updates.
- Honor `prefers-reduced-motion`.

---

## 3. Layout (desktop 1440×900 primary; also 1280×800 and tablet 1024×768)

A **report layout with a margin column**: the assistant lives in the right margin, like the sidenotes in an annotated paper.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HEADER: AEGIS · Ares Transit · Sol 142 of 210 · Comms delay 11 min 42 s    │
│         Data: Live (DONKI) · Real (OSDR) · Simulated        12:04 UTC      │
├──────┬───────────────────────────────────────────────┬─────────────────────┤
│ NAV  │ MAIN COLUMN (report)                          │ MARGIN: AEGIS       │
│      │  Title block: Crew Member C001 · status       │ assistant notes     │
│ 220px│  01 Overview: hazard radar + summary text     │ (briefings, chat,   │
│ text │  02 Hazards: 5 hazard rows                    │  footnote sources)  │
│ menu │  03 Space weather (live)                      │ 400px               │
│      │  04 Vital signs (simulated)                   │                     │
│      │  05 Clinical labs (real)                      │                     │
└──────┴───────────────────────────────────────────────┴─────────────────────┘
```

- **Navigation:** a quiet text menu with section numbers, like a table of contents.
  - 01 Overview · 02 Hazards · 03 Space Weather · 04 Vital Signs · 05 Clinical Labs · 06 Assistant · 07 Knowledge Library · 08 Report to Earth · Settings
- The assistant margin can collapse to a narrow column of note markers, or open full width.

---

## 4. Screens to design

### Screen 1: Overview (hero screen; make it exceptional)

1. **Title block**, like the top of a paper:
   - A small kicker: "CREW HEALTH SUMMARY · SOL 142".
   - A large serif title: "Crew Member C001".
   - A subtitle line: "Inspiration4 crew, anonymised · Real clinical data from NASA OSDR".
   - Right-aligned: the overall status as a word with an icon ("Watch") and a readiness score in serif numerals (`82 / 100`).

2. **A plain-language summary paragraph** written by the assistant, like an abstract. For example: "Overall status is *watch*. A moderate solar flare was detected 14 minutes ago [1]. Sleep has been below 6 hours for three nights [2]. Lymphocytes were 38% lower one day after return than before launch, then recovered [3]." The footnote numbers link to sources.

3. **Fig. 1: Hazard profile.** A clean **5-axis radar chart** (pentagon), one axis per hazard. Thin ink axes, each hazard's point in its color, the filled shape very light. Directly labelled values. Caption underneath.

4. **Mission timeline (schematic).** A thin horizontal rule from Earth to the destination, with the ship position at 64% and small tick labels: Sol 142/210, 118 million km, comms delay 11 min 42 s. It is drawn like a diagram in a report.

5. **02 Hazards: 5 hazard rows** (table-like, not glowing tiles). Each row has:
   - a hazard color mark and icon, the hazard name, and the agent;
   - a status word with an icon;
   - a key metric in mono, e.g.:
     - RAD: "Dose 182 mSv · SEP risk high"
     - ISO: "Sleep 5.4 h · Mood 3/5"
     - DIST: "Delay 11 min 42 s"
     - GRAV: "Calcium 9.4 mg/dL"
     - ENV: "CO₂ 3.1 mmHg · 22.4 °C"
   - a small 7-day sparkline;
   - a "Read more →" link.

   The row of the agent currently speaking in the margin gets a thin colored left rule.

6. **03 Space weather** (`Live · NASA DONKI`):
   - Fig. 2: a 72-hour event timeline with flare class on a log scale (B, C, M, X), SEP markers, and CME markers labelled with speed.
   - A small Kp scale (0–9) showing the current value.
   - "Updated 2 min ago".

7. **04 Vital signs today** (`Simulated`): a compact table-like grid of 6 measures:
   - resting heart rate (bpm)
   - blood pressure (mmHg)
   - sleep (h)
   - mood (1–5)
   - reaction time (ms)
   - body temperature (°C)

   Each shows its value, unit, status word, change vs. personal baseline, and a sparkline.

8. **05 Clinical labs** (`Real data · NASA OSDR`):
   - **Fig. 3**: a timeline L-92 · L-44 · L-3 | Launch | hatched band "No in-flight samples" | Splashdown | R+1 · R+45 · R+82 · R+194.
   - One small chart per marker: dots joined by a thin line, the normal range as a soft green band, and direct value labels. Use these real values for C001:
     - **Glucose (mg/dL)**, range 65–99: 83 · 80 · 69 · 90 · 84 · 91 · 87
     - **White blood cells (×10³/µL)**, range 3.8–10.8: 5.4 · 5.5 · 7.0 · 5.0 · 4.9 · 4.9 · 4.9
     - **Lymphocytes (cells/µL)**, range 850–3900: 2241 · 1859 · 2667 · **1640** · 2146 · 2171 · 1847
     - **Hemoglobin (g/dL)**, range 13.2–17.1: 14.1 · 14.9 · 14.7 · 14.7 · 14.3 · 15.7 · 14.1
     - **Calcium (mg/dL)**, range 8.6–10.3: 9.7 · 10.0 · 9.6 · 9.7 · 9.6 · 10.1 · 9.4
     - **CRP (mg/L):** 18.4 · 2.2 · 5.1 · 10.6 · 6.7 · 25.0 · 15.4
   - Hovering shows a small tooltip card with value, range, time point and "Source: OSD-575".
   - Caption: "Fig. 3, Selected blood markers, crew member C001. Source: NASA OSDR OSD-569, OSD-575; Overbey et al., Nature 2024."

### Screen 2: AEGIS assistant (margin column; second hero)

It is styled like **margin notes in an annotated paper**: each message is a note with a thin top rule, not a chat bubble. Design these states:

- **A. Proactive briefing note**, posted without being asked:
  - **Kicker:** "AEGIS BRIEFING · 12:04 UTC · WATCH", with the avatars of the contributing agents (e.g. RAD + DIST).
  - **Three short labelled paragraphs:**
    - **What is happening.** E.g. "A class M2.1 solar flare was detected 14 minutes ago; a solar particle event may follow.¹"
    - **What to do now.** 2–3 actions as a checklist, e.g. "Review storm-shelter location.²"
    - **What comes next.** E.g. "I will check DONKI every 5 minutes and tell you if particle levels rise."
  - **Footnotes:**
    - ¹ NASA HRP · Hazard: Space Radiation
    - ² Houston We Have a Podcast · Radiation episode

    Clicking a footnote opens the **Source panel**, which shows the exact quoted passage (in serif, like a block quote), its heading path and a link.
  - **Quiet text links:** Ask a follow-up · Done · Send to flight surgeon · Why this note?
- **B. Conversation:**
  - The astronaut's questions are set in italic serif (like a reader's annotation); the assistant's answers are set in body text with superscript footnotes.
  - A small line "Answered by GRAV and ISO".
  - 2–3 suggested follow-up questions as underlined text links.
- **C. Working state:** the 5 agent monograms in a row, with active ones showing a small status line ("RAD · reading 12 sources"). A thin progress rule.
- **D. No-source state:** "The NASA knowledge base has no guidance on this. Please contact your flight surgeon (message arrives in about 11 minutes)." Include a "Draft message" link.
- **E. Input:** a simple underlined text field "Ask AEGIS…" with 3 suggestion links ("How am I doing?", "Explain this note", "What should I do next?").
- **F. Collapsed:** a narrow column of numbered note markers, with the newest one highlighted.

### Screen 3: Hazard page (one template; show Space Radiation and Isolation)

- **Header:** kicker "HAZARD 1 OF 5", serif title "Space Radiation", and a short definition paragraph with a footnote.
- **Main column:**
  - this hazard's measures and charts;
  - "Health risks linked to this hazard": NASA risk entries, each with the subheads *Top risks*, *What can be done*, *Did you know?* as quoted excerpts with footnotes;
  - RAD example risks: radiation-induced cancer, cardiovascular, central nervous system.
  - ISO example risks: sleep, behavioral health, teamwork.
- **Margin:** this agent's notes and its watch list.

### Screen 4: Space weather (full page)

- An event table (time, type, class/speed, Earth-directed, link).
- Fig.: flare class over 7 days. Fig.: Kp over 7 days.
- Short explainer paragraphs with footnotes.
- **States:** live / delayed / offline ("Showing last known data, 6 minutes old").

### Screen 5: Clinical labs (full page)

- Tabs: Blood count / Metabolic / Cardiovascular.
- A grid of small-multiple charts with normal bands.
- A crew selector (C001–C004).
- A "change after return vs. before launch" view.
- A table with export.
- Figure captions with sources.

### Screen 6: Knowledge library

- Like a **bibliography or index**: search plus filters for hazard, NASA risk (17) and type (article, risk card, podcast, video).
- Results show the heading path, a snippet with the match highlighted, the source, and "cited in N notes".

### Screen 7: "How this note was made" (for judges)

A side panel laid out like a **methods section**, with 4 numbered steps:

1. **Trigger:** which data signal fired.
2. **Routing:** which agents were consulted, and why.
3. **Retrieval:** the passages found, with relevance bars.
4. **Answer:** each sentence linked to its passage.

Use clean thin-line connectors, no flashy diagram.

### Screen 8: Report to Earth

- A printable one-page report: title block, summary, tables, figures, recommendations and references.
- A "Send to Mission Control" button with the note "Arrives in about 11 minutes."

### Screen 9: Start / crew select

- **Title page:** "AEGIS" in a large serif with the subtitle "Crew health intelligence, grounded in NASA research".
- **3 steps:**
  1. Choose crew member C001–C004.
  2. Choose environment (Deep-space transit / Space station / Lunar base / Mars base). This changes the comms delay and the timeline.
  3. Begin.

---

## 5. Components (component sheet with variants)

**Layout and data**
- `AppHeader`
- `SectionNav` (table-of-contents style)
- `TitleBlock`
- `SummaryAbstract` (with footnotes)
- `HazardRadar`
- `MissionTimeline`
- `HazardRow` (5 hazards × nominal/watch/alert/critical, plus a "speaking" left rule)
- `MeasureCell`
- `Sparkline`
- `ProvenanceLabel` (Live / Real data / Simulated)
- `StatusLabel` (icon + word)
- `FigureFrame` (number, chart slot, caption, source line)
- `SpaceWeatherTimeline`
- `KpScale`
- `LabTimeline` (with the hatched in-flight gap and normal bands)
- `LabSmallMultiple`
- `CrewSelect`
- `EnvironmentSelect`
- `CommsDelay`

**Assistant**
- `AgentMonogram` (6 variants × idle/working/speaking)
- `BriefingNote` (severity variants)
- `ActionChecklist`
- `Footnote`
- `SourcePanel` (block-quote passage)
- `QuestionNote`
- `AnswerNote`
- `SuggestedQuestionLink`
- `WorkingIndicator`
- `NoSourceNotice`
- `MethodsStep`

**States**
- `EmptyState` (text + small icon)
- `Skeleton` (soft paper-tone shimmer)
- `ErrorState`
- `OfflineState`

---

## 6. Rules (non-negotiable)

1. **Status is never color-only.** Always pair color with an icon and a word.
2. **WCAG AA contrast** on the paper background.
3. **Every number shows its unit and provenance.**
4. **Every assistant statement has a footnote source.**
5. **The assistant guides; it does not diagnose.** Footer note: "Guidance drawn from NASA sources. Not a medical diagnosis. Contact your flight surgeon when advised."
6. **Click targets of at least 44px.**
7. **Be honest about data gaps** (no in-flight labs, live feed offline).
8. **No illustrations, photos, glow, neon, HUD elements or sci-fi styling.**

---

## 7. Technical handoff (the frontend is built right after this design)

- **Stack:** React 18 + Vite + TypeScript, Tailwind CSS (the tokens above as CSS variables), Framer Motion for subtle motion, Recharts or visx for charts, lucide-react icons, and custom SVG for the radar, mission timeline and hazard icons.
- **Grid:** 8px base unit, 12-column main area with 24px gutters, card radius 8px, 1px `--rule` borders, no shadows. Main column max reading width about 760px for text blocks.
- Name components exactly as in section 5 (they map 1:1 to React components).
- **Data contracts:**

```ts
type Provenance = "LIVE_DONKI" | "REAL_OSDR" | "SIMULATED";
type Status = "nominal" | "watch" | "alert" | "critical";
type HazardId = "RAD" | "ISO" | "DIST" | "GRAV" | "ENV";

interface HazardSummary { id: HazardId; status: Status; level: number /*0-100 for radar*/; headline: string; keyMetric: string; spark: number[]; }
interface SpaceWeatherEvent { id: string; type: "FLR"|"SEP"|"CME"|"GST"; time: string; classOrValue: string; earthDirected?: boolean; link: string; }
interface LabPoint { marker: string; unit: string; timepoint: "L-92"|"L-44"|"L-3"|"R+1"|"R+45"|"R+82"|"R+194"; value: number; rangeMin?: number; rangeMax?: number; source: "OSD-569"|"OSD-575"; }
interface Vital { key: "hr"|"bp"|"sleep"|"mood"|"reaction"|"temp"|"dose"|"co2"; value: number|string; unit: string; status: Status; deltaVsBaseline?: string; spark: number[]; provenance: Provenance; }
interface Citation { n: number; title: string; headingPath: string[]; quote: string; url: string; hazard: HazardId; }
interface Briefing { id: string; severity: Status; agents: HazardId[]; happening: string; actions: string[]; next: string; citations: Citation[]; createdAt: string; }
```

- **Deliverables:**
  1. A style tile (paper, ink and hazard colors; type scale; chart style; icons).
  2. The component sheet.
  3. Screens 1–9 at 1440×900.
  4. Screens 1 + 2 at 1024×768.
  5. Assistant states A–F.
  6. Optional: the "Evening" variant of Screen 1.

**The goal:** it should read like the best-designed NASA research report you have ever seen, except it is live: precise, calm, trustworthy, with an AI team of specialists that cites every word it says.
