from typing import Dict

def cardiac_output(H_rate: float, V_stroke: float, T_effort: float) -> float:
    return (H_rate * V_stroke) / max(T_effort, 1e-6)

def resp_rate(O2: float, L_ventilation: float, C_CO2: float) -> float:
    return (O2 * L_ventilation) / max(C_CO2, 1e-6)

def vision_clarity(L_lens: float, R_retina: float, E_light: float) -> float:
    return (L_lens * R_retina) / max(E_light, 1e-6)

def nervous_response(S_signal: float, E_nerve: float, T_reflex: float) -> float:
    return (S_signal * E_nerve) / max(T_reflex, 1e-6)

def sleep_quality(D_duration: float, E_efficiency: float, R_REM: float) -> float:
    return (D_duration * E_efficiency) / max(R_REM, 1e-6)

def stress_response(E_threat: float, A_awareness: float, T_initial: float) -> float:
    return (E_threat * A_awareness) / max(T_initial, 1e-6)

def bone_density(C_calcium: float, A_activity: float, T_mass: float) -> float:
    return (C_calcium * A_activity) / max(T_mass, 1e-6)

def muscle_strength(M_fibers: float, N_nerve: float, R_load: float) -> float:
    return (M_fibers * N_nerve) / max(R_load, 1e-6)

def thermoregulation(E_sweat: float, V_blood: float, H_heat: float) -> float:
    return (E_sweat * V_blood) / max(H_heat, 1e-6)

def normalize(x: float, scale: float = 1.0) -> float:
    return max(0.0, min(1.0, x / (x + scale)))

def compute_law_params(profile: Dict) -> Dict[str, float]:
    H_rate = profile.get("heart_rate", 70.0)
    V_stroke = profile.get("stroke_volume", 70.0)
    T_effort = profile.get("effort_time", 1.0)

    O2 = profile.get("oxygen_intake", 1.0)
    L_vent = profile.get("lung_ventilation", 1.0)
    C_CO2 = profile.get("co2_conc", 1.0)

    L_lens = profile.get("lens_function", 1.0)
    R_retina = profile.get("retinal_response", 1.0)
    E_light = profile.get("light_energy", 1.0)

    D_dur = profile.get("sleep_duration", 7.0)
    E_eff = profile.get("sleep_efficiency", 0.9)
    R_REM = profile.get("rem_sleep", 1.5)

    E_threat = profile.get("threat_energy", 0.5)
    A_aw = profile.get("awareness", 0.8)
    T_init = profile.get("time_initial", 1.0)

    C_calc = profile.get("calcium_intake", 1.0)
    A_act = profile.get("activity_level", 1.0)
    T_mass = profile.get("bone_mass", 1.0)

    M_fib = profile.get("muscle_fibers", 1.0)
    N_n = profile.get("nerve_activation", 1.0)
    R_load = profile.get("resistance_load", 1.0)

    E_sw = profile.get("sweat_production", 1.0)
    V_b = profile.get("blood_volume", 1.0)
    H_h = profile.get("heat_production", 1.0)

    params = {
        "cardiac_output": normalize(cardiac_output(H_rate, V_stroke, T_effort), 100.0),
        "resp_rate": normalize(resp_rate(O2, L_vent, C_CO2), 10.0),
        "vision_clarity": normalize(vision_clarity(L_lens, R_retina, E_light), 5.0),
        "nervous_response": normalize(nervous_response(1.0, 1.0, 0.5), 5.0),
        "sleep_quality": normalize(sleep_quality(D_dur, E_eff, R_REM), 10.0),
        "stress_response": normalize(stress_response(E_threat, A_aw, T_init), 5.0),
        "bone_density": normalize(bone_density(C_calc, A_act, T_mass), 5.0),
        "muscle_strength": normalize(muscle_strength(M_fib, N_n, R_load), 5.0),
        "thermoregulation": normalize(thermoregulation(E_sw, V_b, H_h), 5.0),
    }

    return params
