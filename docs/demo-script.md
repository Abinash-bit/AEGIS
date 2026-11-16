# AEGIS demo video script

The full walkthrough runs about 5 minutes, plus a 30-second cut.
Each scene has three columns: **On screen** (what you click or show), **Say** (your narration) and **Time**.
Speak calmly and a little slower than normal. Pause for a beat when something streams in.

> **Space Apps rule check:** the official project submission has asked for a **30-second video** (or a short slide deck) in recent years. Check this year's rules. Use the 30-second cut for the official submission and the full version for your own channels, the README or the judges' live session.

---

## Before you record (checklist)

1. **Wake the backend.** The free Render plan sleeps after 15 minutes. Open `https://aegis-api-dxc3.onrender.com/api/health` about 2 minutes before you record.
2. **Warm the briefing.** Open the console once for **C001 · Deep-space transit · Mid-mission check**, so the first briefing is ready. You will still show a live briefing later with the refresh button.
3. **Start clean.** On the **Memory** page, use "Forget everything" for C001 so the memory moment in the demo is fresh. Clear old conversations too.
4. **Set up the browser.** Chrome, window about 1440×900, zoom 100%, bookmarks bar hidden, only the AEGIS tab open. Start in **day mode**.
5. **Camera heart rate.** Test once beforehand: turn the laptop screen brightness up and cover the webcam with your fingertip.
6. **Microphone.** Test voice input once in Chrome.
7. **Pre-type** the questions somewhere you can copy them from (listed in each scene).

---

## Full version (~5 min)

### Scene 1: Hook (0:00–0:15)

| On screen | Say |
|---|---|
| Home page hero (astronaut looking at Earth). Hold still. | "Imagine you're halfway to Mars. A crewmate feels a sharp pain in the chest. You call Earth, and your message takes twelve minutes to arrive. The answer takes twelve more." |

### Scene 2: The challenge (0:15–0:40)

| On screen | Say |
|---|---|
| Scroll slowly to **"Astronauts are not doctors."** | "We took the NASA Space Apps challenge *Create health monitoring software for astronauts on space missions*, set by the Brazilian Space Agency." |
| Keep scrolling to the quote. | "On long missions, astronauts face radiation, isolation, altered gravity and a sealed environment, far from help. They have to notice health changes and act on them themselves. But astronauts are not doctors." |

### Scene 3: Our idea (0:40–1:10)

| On screen | Say |
|---|---|
| Scroll through **The five hazards** (Sun, porthole, star chart, three worlds, cutaway). | "Our answer is **AEGIS**, a crew health companion built around NASA's five hazards of human spaceflight. Each hazard has its own AI specialist: Space Radiation, Isolation and Confinement, Distance from Earth, Gravity Fields, and Hostile and Closed Environments." |
| Pause on the star chart showing the live delay. | "AEGIS reads live NASA space weather and real astronaut blood data. Then the specialists explain what is happening, what to do, and what comes next. Every sentence is backed by NASA research." |
| Point at the **live strip** under the hero (scroll back up briefly, or skip). | "Everything you see is labelled: live data, real data, or simulated." |

### Scene 4: Mission setup (1:10–1:30)

| On screen | Say |
|---|---|
| Click **Begin a health check**. | "Let's start a health check." |
| Pick **C001**; click the **Deep-space transit** card; keep **Mid-mission check**. | "We choose a crew member. These are anonymised astronauts from the Inspiration4 mission, with their real blood tests from NASA's Open Science Data Repository. And we choose where the mission is. That changes gravity, radiation dose and the message delay to Earth." |
| Click **Enter mission console**. | |

### Scene 5: The console (1:30–1:55)

| On screen | Say |
|---|---|
| Console overview. Move the cursor across the hazard tiles. | "This is the mission console. Everything fits on one screen. Readiness, and the five hazards, each with its status." |
| Point at **Space weather** (Live) and **Blood markers** (Real), including the hatched gap. | "On the right of the dashboard is live space weather from NASA's DONKI database. Below are the astronaut's real blood markers before launch and after return. The hatched band is honest: no samples were taken during the flight." |
| Point at the badges **Live · Real · Simulated**. | "Status comes from simple, readable rules, never from the AI." |

### Scene 6: The proactive briefing, live (1:55–2:40)

| On screen | Say |
|---|---|
| In the AEGIS panel, click **↻ Refresh briefing**. The live steps start appearing. | "Now watch AEGIS work. It reads the dashboard and calls in the specialists whose hazards need attention." |
| Let the steps fill in: *"The Gravity Fields agent found 6 NASA passages…"* | "Each specialist searches our NASA knowledge base: two hundred passages from NASA's Human Research Program, podcasts and videos. They work in parallel, and you can see what each one found." |
| Briefing appears. Read the headline aloud and point at the three parts. | "Then a coordinator writes one calm briefing: what is happening, what to do now, and what comes next." |
| Click a citation number. The source drawer opens. | "Every claim has a source. Click it, and you see the exact NASA passage. If a sentence has no valid source, AEGIS removes it before you ever see it." |
| Close it. Click the **flow icon** ("How this was made"). | "And for full transparency, this shows how the briefing was made: the signals, the specialists, every passage they read, and the checks." |

### Scene 7: Ask anything, with voice and memory (2:40–3:20)

| On screen | Say |
|---|---|
| Click the **microphone** and say: *"I always sleep badly after night shifts. What can I do tonight?"* | "The astronaut can simply ask." |
| Answer streams in with citations. | "The answer streams in, personal to this astronaut's data, and cited." |
| Point at the step **"Remembered: Sleeps badly after night shifts"** and the **remembers** pill. | "And AEGIS remembers what the astronaut shares, so future advice gets more personal. The astronaut can see and delete every memory." |
| Optional: click 🔊 on the answer for 2 seconds. | "Answers can also be read aloud, for when your hands are busy." |

### Scene 8: Guided check-in and camera heart rate (3:20–3:50)

| On screen | Say |
|---|---|
| Click **Check in** → **Resting heart rate**. | "The challenge asked for a tool that explains how to take each measurement and why it matters. Every check-in shows how to measure, why it matters in space, and what's typical." |
| Click **Start** under camera, cover the webcam. The pulse line draws. | "There's no medical kit nearby? Just cover the camera with your fingertip. AEGIS reads your pulse from tiny color changes, right on the device." |
| Use the result → **Save and explain**. The dashboard updates and AEGIS explains. | "The reading lands on the dashboard, and the Gravity Fields agent explains what it means." |

*(If the camera is unreliable on the day, use **Blood pressure** instead and type 141 / 91. The Gravity Fields tile turns to Alert.)*

### Scene 9: Body map, routine and crew (3:50–4:15)

| On screen | Say |
|---|---|
| Click the **Body map** tab, then click the **heart**, then **bones**. | "The body map makes it visual. Each region glows with its status and shows its readings, the related NASA risks, and the right specialist to ask." |
| Click **Routine**. | "A daily routine with streaks and cooperative crew points keeps check-ins a habit." |
| Click **Crew**. | "And the commander can see all four crew members at once." |

### Scene 10: Emergency (4:15–4:40)

| On screen | Say |
|---|---|
| Click **Emergency** → **Chest pain**. Tap through 2–3 steps. | "Back to our opening. A crewmate has chest pain. AEGIS switches to a calm, step-by-step guide: one action per screen, big buttons, a timer. These steps are pre-written, never generated by AI." |
| Jump to the end screen with the drafted report → **Send to Mission Control**. | "Every step and reading is logged into a report for the flight surgeon, and AEGIS tells you exactly when it will arrive across the delay." |

### Scene 11: Report and other worlds (4:40–4:55)

| On screen | Say |
|---|---|
| Open **Report** (printed sheet, arrival countdown). | "The daily report to Earth is one click, ready to print or send." |
| Optional, quick: toggle **night mode**; mention **Landing day** and the **May 2024 solar storm replay**. | "AEGIS also handles landing day on Mars, when gravity changes again, and can replay real solar storms." |

### Scene 12: Close (4:55–5:15)

| On screen | Say |
|---|---|
| Back to the home page hero. | "AEGIS turns live NASA data, real astronaut data and NASA's own research into calm, cited guidance. It's built so the crew can act even when Earth is twenty minutes away. And the same idea can help anyone far from a doctor, here on Earth." |
| Hold on the hero. | "AEGIS. When help is twenty light-minutes away." |

---

## 30-second cut (official submission)

| Time | On screen | Say |
|---|---|---|
| 0–5 s | Home hero | "Halfway to Mars, a message to Earth takes twelve minutes. Astronauts are not doctors." |
| 5–12 s | Console: refresh the briefing, live agent steps appearing | "AEGIS gives each of NASA's five spaceflight hazards its own AI specialist. They read live NASA space weather and real astronaut blood data." |
| 12–19 s | Briefing + click a citation (source drawer) | "And they explain what's happening and what to do, with every sentence cited from NASA research." |
| 19–25 s | Camera heart rate → body map → Emergency step | "Guided check-ins, even heart rate from the camera, a living body map, and a calm emergency guide." |
| 25–30 s | Report "arrives in 11:40" → hero | "So the crew can act, even when help is twenty light-minutes away. AEGIS." |

---

## Recording tips

- **Record the screen** at 1440×900 or 1920×1080. Record the voice separately if you can, which gives cleaner audio and is easier to fix.
- **Use the live streaming.** Watching the specialist agents work in real time is the most impressive moment, so don't cut it too short.
- **Use a prepared question if voice input misbehaves.** Type it or paste it.
- **Captions:** add captions or subtitles; many judges watch muted.
- **Music:** if you use any, keep it soft and calm, matching the vintage look.
