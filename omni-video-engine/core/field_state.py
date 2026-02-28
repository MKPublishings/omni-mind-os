from dataclasses import dataclass
from typing import Dict, List

@dataclass
class FieldState:
    t: float
    E: float          # energy
    T: float          # temporal intensity
    c: float          # structural coherence
    X: Dict[str, float]  # cognitive/physiological variables
