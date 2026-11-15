"""Real Inspiration4 clinical labs from NASA OSDR (OSD-569 CBC, OSD-575 CMP + cardiovascular panel)."""
from __future__ import annotations

import csv
import re
from functools import lru_cache
from typing import Optional

from .. import config
from ..models import LabMarkerSeries, LabPoint

TIMEPOINTS = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]
CREW = ["C001", "C002", "C003", "C004"]

FILES = {
    "CBC": ("LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv", "OSD-569"),
    "CMP": ("LSDS-8_Comprehensive_Metabolic_Panel_CMP_TRANSFORMED.csv", "OSD-575"),
    "CARDIO": ("LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv", "OSD-575"),
}

# (panel, column prefix, label, display unit, hazard, scale factor)
# Hazard mapping: immune/inflammation -> ENV (closed environment, microbes);
# blood, bone minerals, metabolism, clotting -> GRAV (microgravity adaptation).
MARKERS = [
    ("CBC", "white_blood_cell_count", "White blood cells", "×10³/µL", "ENV", 1),
    ("CBC", "absolute_lymphocytes", "Lymphocytes", "cells/µL", "ENV", 1),
    ("CBC", "absolute_neutrophils", "Neutrophils", "cells/µL", "ENV", 1),
    ("CBC", "hemoglobin", "Hemoglobin", "g/dL", "GRAV", 1),      # column is mislabelled '_percent' in the source file
    ("CBC", "red_blood_cell_count", "Red blood cells", "×10⁶/µL", "GRAV", 1),
    ("CBC", "platelet_count", "Platelets", "×10³/µL", "GRAV", 1),
    ("CMP", "glucose", "Glucose", "mg/dL", "GRAV", 1),
    ("CMP", "calcium", "Calcium", "mg/dL", "GRAV", 1),
    ("CMP", "potassium", "Potassium", "mmol/L", "GRAV", 1),
    ("CMP", "sodium", "Sodium", "mmol/L", "GRAV", 1),
    ("CMP", "creatinine", "Creatinine", "mg/dL", "GRAV", 1),
    ("CARDIO", "crp", "C-reactive protein (research assay)", "mg/L", "ENV", 1e-6),          # pg/mL -> mg/L
    ("CARDIO", "fibrinogen", "Fibrinogen (research assay)", "µg/mL", "GRAV", 1e-3),         # ng/mL -> µg/mL
]


def _num(x: str) -> Optional[float]:
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _status(v: float, lo: Optional[float], hi: Optional[float]) -> str:
    """Within the lab's normal range -> nominal; just outside (<10% of range width) -> watch; further -> alert.
    Research-assay markers without a clinical range are reported as nominal (trend only)."""
    if lo is None or hi is None:
        return "nominal"
    if lo <= v <= hi:
        return "nominal"
    margin = 0.1 * (hi - lo)
    return "watch" if (lo - margin) <= v <= (hi + margin) else "alert"


@lru_cache(maxsize=1)
def _rows() -> dict[str, list[dict]]:
    out = {}
    for panel, (fname, _) in FILES.items():
        with open(config.LABS_DIR / fname, encoding="utf-8-sig") as fh:
            out[panel] = list(csv.DictReader(fh))
    return out


def get_labs(crew_id: str) -> list[LabMarkerSeries]:
    if crew_id not in CREW:
        raise KeyError(f"unknown crew member '{crew_id}'. Options: {', '.join(CREW)}")
    rows = _rows()
    series = []
    for panel, prefix, label, unit, hazard, scale in MARKERS:
        prow = [r for r in rows[panel] if r["Sample Name"].startswith(crew_id + "_")]
        if not prow:
            continue
        cols = prow[0].keys()
        vcol = next((c for c in cols if c.startswith(prefix + "_value") or c.startswith(prefix + "_concentration")), None)
        locol = next((c for c in cols if c.startswith(prefix + "_range_min")), None)
        hicol = next((c for c in cols if c.startswith(prefix + "_range_max") or c.startswith(prefix + "_max")), None)
        if not vcol:
            continue
        pts = []
        for r in prow:
            m = re.search(r"(L-\d+|R\+\d+)", r["Sample Name"])
            v = _num(r[vcol])
            if not m or v is None or m.group(1) not in TIMEPOINTS:
                continue
            v *= scale
            lo = _num(r[locol]) if locol else None
            hi = _num(r[hicol]) if hicol else None
            pts.append(LabPoint(marker=prefix, label=label, unit=unit, timepoint=m.group(1), value=round(v, 3),
                                range_min=lo, range_max=hi, status=_status(v, lo, hi), source=FILES[panel][1]))
        pts.sort(key=lambda p: TIMEPOINTS.index(p.timepoint))
        by_tp = {p.timepoint: p.value for p in pts}
        change = None
        if by_tp.get("L-3") and "R+1" in by_tp:
            change = round(100 * (by_tp["R+1"] - by_tp["L-3"]) / by_tp["L-3"], 1)
        series.append(LabMarkerSeries(marker=prefix, label=label, unit=unit, panel=panel, hazard=hazard,
                                      points=pts, change_r1_vs_l3_pct=change))
    return series
