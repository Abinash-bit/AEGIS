import { Footer, SiteNav } from '../components/SiteNav'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-12">
    <h2 className="font-display text-3xl">{title}</h2>
    <div className="mt-3 space-y-3 text-[17px] leading-relaxed text-ink-2">{children}</div>
  </section>
)

export default function About() {
  return (
    <div>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pt-12">
        <p className="kicker">Method &amp; data</p>
        <h1 className="mt-2 font-display text-5xl">How AEGIS works, and where its knowledge comes from</h1>

        <Section title="Three kinds of data, always labelled">
          <p><b className="text-ink">Live:</b> solar flares, particle events, coronal mass ejections and geomagnetic storms from NASA’s DONKI database. If the feed is down, AEGIS shows the last data and says so.</p>
          <p><b className="text-ink">Real:</b> blood tests from the four Inspiration4 crew members (NASA OSDR studies OSD-569 and OSD-575), before launch and after return.</p>
          <p><b className="text-ink">Simulated:</b> daily readings such as sleep, mood, reaction time, blood pressure and cabin CO₂, generated from published NASA study values for the demo. The demo scenario adds a realistic pattern.</p>
        </Section>

        <Section title="Rules decide the status; AI explains it">
          <p>Each hazard’s status (nominal, watch, alert, critical) comes from fixed, readable rules, for example “three nights under six hours of sleep” or “a solar particle event in the window”. The AI never sets a status.</p>
        </Section>

        <Section title="Five specialists and a coordinator">
          <p>Each of NASA’s five hazards has its own agent: the Space Radiation agent, the Isolation &amp; Confinement agent, the Distance from Earth agent, the Gravity Fields agent and the Hostile &amp; Closed Environments agent. When a hazard needs attention, its agent searches AEGIS’s NASA knowledge base, reads the passages and writes findings that must point to those passages. A coordinator merges the findings into one calm briefing. Any statement without a valid source is removed before you see it.</p>
          <p>You can ask follow-up questions. AEGIS remembers the conversation, keeps source numbers stable, knows its latest briefing, and remembers facts you share about yourself (you can delete them).</p>
        </Section>

        <Section title="The knowledge base">
          <p>About 200 passages from NASA Human Research Program pages on the five hazards, the risks of human spaceflight and ongoing research, plus transcripts of NASA podcasts and videos. Search finds passages by meaning and by keyword, filtered by hazard.</p>
        </Section>

        <Section title="Limits">
          <p>AEGIS gives guidance from NASA sources. It does not diagnose, and its demo thresholds are not medical or NASA flight rules. When the knowledge base has no answer, AEGIS says so and suggests contacting the flight surgeon.</p>
        </Section>
      </main>
      <Footer />
    </div>
  )
}
