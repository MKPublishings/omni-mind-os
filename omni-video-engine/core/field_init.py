from typing import List
from .field_state import FieldState
from .operators import dE_dt

def estimate_initial_E(prompt: str) -> float:
    length_factor = min(len(prompt) / 100.0, 3.0)
    return 1.0 + length_factor

def estimate_initial_T(prompt: str) -> float:
    return 1.0

def estimate_initial_c(prompt: str) -> float:
    return 0.8

def compute_X(E: float, T: float, c: float) -> dict:
    # Simple example mappings – refine later
    return {
        "clarity": c,
        "intensity": E / (1.0 + E),
        "stability": 1.0 - abs(c - 1.0),
    }

def build_field_trajectory(
    prompt: str,
    duration: float,
    fps: int,
    alpha: float = 0.1,
    beta: float = 0.05,
) -> List[FieldState]:
    num_frames = int(duration * fps)
    dt = 1.0 / fps

    E = estimate_initial_E(prompt)
    T_val = estimate_initial_T(prompt)
    c_val = estimate_initial_c(prompt)

    trajectory: List[FieldState] = []

    for i in range(num_frames):
        t = i * dt
        X = compute_X(E, T_val, c_val)
        trajectory.append(FieldState(t=t, E=E, T=T_val, c=c_val, X=X))
        E = E + dE_dt(E, alpha, beta) * dt

    return trajectory
