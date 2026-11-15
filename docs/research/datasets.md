# Open data for the astronaut health challenge

Researched 2026-11-12. Official Space Apps resources are due after 13 Nov.

**The key fact:** raw vitals of individual astronauts (blood pressure, heart rate, sleep per person) are **protected by privacy law** and are **not openly downloadable**. What *is* open: molecular data, live space weather, radiation measurements, NASA's risk reports, and published summary numbers from studies.

## A. Download now (fully open)

| Source | What's inside | Use in our app |
|---|---|---|
| **NASA OSDR**, osdr.nasa.gov: Inspiration4 studies OSD-569 to OSD-575, OSD-630, OSD-656 | Blood, plasma, serum, skin, stool and urine "omics" data from 4 civilian astronauts (2021 flight) | "Real astronaut data" story: immune and blood changes over time. Background for the body map. |
| **SOMA portal** (Space Omics & Medical Atlas) | Combined data from the NASA Twins Study, JAXA, Inspiration4, Axiom and Polaris | Same as above; shows how the body changes in spaceflight |
| **OSDR rodent studies**, e.g. RR-5 bone loss (OSD-240/241), rat bone density (OSD-310) | Mouse and rat bone loss and micro-CT scans from ISS flights | Bone-loss explainer on the body map |
| **NASA DONKI API**, api.nasa.gov (free key) | **Live** solar flares, solar particle storms (SEP) and coronal mass ejections | Live radiation alert: "Solar storm detected → go to shelter" |
| **ESA DOSIS 3D** radiation data (swe.ssa.esa.int/human-space-flight) | Radiation dose measured inside the ISS Columbus module, 2009 onward | Realistic radiation dose numbers for the dose tracker |

## B. Free to read (thresholds, risks, and normal ranges)

| Source | What we take from it |
|---|---|
| **NASA Human Research Roadmap**, humanresearchroadmap.nasa.gov: risks and evidence reports | Official list of health risks (heart and blood vessels, bone, immune, behavior, sleep, balance, eyes) with explanations. Use for every "Why this matters" and as citations. |
| **Spaceflight Standard Measures** (npj Microgravity 2025) | Which measurements NASA routinely takes before, during and after flight (cardiovascular, biochemistry, immune, behavior, balance). Shows our check-ins match real practice. |
| **Barger et al. 2014, sleep on shuttle and ISS** | Astronauts average **under 6 h** of sleep per night; only 24% of ISS nights reach 7 h or more. Gives realistic sample data and the "Watch" level for sleep. |
| **Flynn-Evans, ISS circadian study** | Sleep is 6.4 h when the body clock is aligned and 5.4 h when it is misaligned |
| **NASA Cognition test battery** papers (ISS 6-month study; HERA) | 10 short tests (reaction time, attention, memory) and normal scores for astronauts. Model for an in-app 60-second brain check. |
| **HERA analog** papers | How confinement and sleep restriction affect brain test scores |

## C. Request only (not usable within hackathon time)

- **NASA Life Sciences Portal** (nlsp.nasa.gov): LSDA, LSAH (Lifetime Surveillance of Astronaut Health) and Standard Measures data for 52 crew members. Needs a formal request and approval.
- **TRISH EXPAND (TrialX)**: Inspiration4 Apple Watch heart rate, ECG, sleep and cognitive data. Access terms are unclear and may need approval.

## Plan

1. **Our own live data:** measure heart rate with the phone camera, plus brain-test and balance-test results.
2. **Realistic sample crew data:** build it from the published numbers in section B, e.g. sleep around 6 h, blood pressure changes from fluid shift. **Label it clearly as simulated.**
3. **Live NASA data:** DONKI solar particle storms drive radiation alerts.
4. **Real astronaut science:** Inspiration4/SOMA findings and HRP risks feed the body map explanations, with citations.
5. After 13 Nov, add whatever the official Resources tab provides.
