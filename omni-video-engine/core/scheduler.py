from dataclasses import dataclass
from typing import List, Dict
from .field_state import FieldState
import math

@dataclass
class FramePlan:
    frame_index: int
    t: float
    energy: float
    coherence: float
    spatial_focus: Dict[str, float]
    tempo: float
    sharpness: float
    warmth: float

def fibonacci_sequence(n: int) -> List[int]:
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

def golden_ratio() -> float:
    return (1 + 5 ** 0.5) / 2

def build_frame_plan(
    trajectory: List[FieldState],
    law_params: Dict[str, float],
    fps: int,
) -> List[FramePlan]:
    num_frames = len(trajectory)
    fib = fibonacci_sequence(max(5, int(num_frames / 4)))
    phi = golden_ratio()

    plans: List[FramePlan] = []

    cardiac = law_params.get("cardiac_output", 1.0)
    resp = law_params.get("resp_rate", 1.0)
    vision = law_params.get("vision_clarity", 1.0)
    sleep_q = law_params.get("sleep_quality", 1.0)
    stress = law_params.get("stress_response", 0.5)
    thermo = law_params.get("thermoregulation", 1.0)

    for idx, state in enumerate(trajectory):
        is_keyframe = idx in fib

        tempo = min(2.0, 0.5 + cardiac * 0.5 + (1.0 if is_keyframe else 0.0))
        sharpness = max(0.0, min(1.0, vision * (1.0 - sleep_q * 0.2)))
        warmth = max(0.0, min(1.0, 0.5 + thermo * 0.3 - stress * 0.2))

        spatial_focus = {
            "phi_x": (idx / num_frames) * phi % 1.0,
            "phi_y": ((num_frames - idx) / num_frames) * phi % 1.0,
            "spiral_radius": math.sqrt(idx + 1) / math.sqrt(num_frames),
        }

        plans.append(
            FramePlan(
                frame_index=idx,
                t=state.t,
                energy=state.E,
                coherence=state.c,
                spatial_focus=spatial_focus,
                tempo=tempo,
                sharpness=sharpness,
                warmth=warmth,
            )
        )

    return plans
