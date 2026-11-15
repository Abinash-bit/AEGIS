"""Mission environments. Comms delay is computed from distance (one-way light time)."""
from __future__ import annotations

from ..models import Environment

C_KM_S = 299_792.458

# Daily effective dose rates used by the simulated dose meter (mSv/day), from published in-situ measurements:
#   ISS  ~0.6  (typical ISS crew dosimetry range ~0.4-0.9)
#   Moon surface 1.37 (Chang'e-4 LND, Zhang et al. 2020)
#   Mars cruise 1.84 (MSL/RAD, Zeitlin et al. 2013)
#   Mars surface 0.64 (MSL/RAD, Hassler et al. 2014)
DOSE_RATE_MSV_DAY = {"iss": 0.6, "lunar_base": 1.37, "mars_transit": 1.84, "mars_base": 0.64}

_ENVS = {
    "iss": dict(name="International Space Station (low Earth orbit)", distance_km=420, gravity_g=0.0,
                evacuation="Return to Earth possible within hours", mission_day=142, mission_length_days=180),
    "lunar_base": dict(name="Lunar surface base", distance_km=384_400, gravity_g=0.166,
                       evacuation="Return to Earth takes about 3-5 days", mission_day=21, mission_length_days=30),
    "mars_transit": dict(name="Deep-space transit to Mars", distance_km=210_000_000, gravity_g=0.0,
                         evacuation="Not possible: return takes months", mission_day=142, mission_length_days=210),
    "mars_base": dict(name="Mars surface base", distance_km=360_000_000, gravity_g=0.38,
                      evacuation="Not possible until the next transfer window", mission_day=260, mission_length_days=500),
}


def get_environment(env_id: str) -> Environment:
    if env_id not in _ENVS:
        raise KeyError(f"unknown environment '{env_id}'. Options: {', '.join(_ENVS)}")
    e = _ENVS[env_id]
    return Environment(id=env_id, comms_delay_s=round(e["distance_km"] / C_KM_S, 1), **e)


def list_environments() -> list[Environment]:
    return [get_environment(k) for k in _ENVS]
