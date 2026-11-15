# Inspiration4 clinical blood data (NASA OSDR)

Real, public data from the 4 civilian astronauts of SpaceX Inspiration4 (3-day orbital flight, Sept 2021). Downloaded 2026-11-14 from NASA's Open Science Data Repository.

| File | OSDR study | What |
|---|---|---|
| `LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv` | OSD-569 | Complete blood count: white cells (neutrophils, lymphocytes, monocytes, eosinophils, basophils), red cells, hemoglobin, hematocrit, platelets, MCV/MCH/MCHC, RDW, MPV |
| `LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv` | OSD-575 | Metabolic panel: **glucose**, sodium, potassium, chloride, CO2, calcium, BUN, creatinine, eGFR, albumin, globulin, total protein, ALP, ALT, AST, bilirubin |
| `LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv` | OSD-575 | Cardiovascular and inflammation markers: CRP, fibrinogen, haptoglobin, AGP, alpha-2-macroglobulin, fetuin-A, L-selectin, PF4, SAP |

- **Crew IDs:** C001–C004 (anonymised).
- **Time points (7 per crew member):** L-92, L-44, L-3 (days before launch); R+1, R+45, R+82, R+194 (days after return).
  - **No in-flight blood draws.**
- **Reference ranges:** CBC and CMP rows include the lab's normal range (`*_range_min_*`, `*_range_max_*`) for each value, which is ready to use for normal/abnormal color coding.

Study pages:
- https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- https://osdr.nasa.gov/bio/repo/data/studies/OSD-575

Citation: Overbey et al., *Nature* 2024, "Molecular and physiological changes in the SpaceX Inspiration4 civilian crew".
