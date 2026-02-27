export interface HealthSignal {
  name: string;
  value: number;
  threshold: number;
}

export interface HealthAnomaly {
  name: string;
  value: number;
  threshold: number;
  overage: number;
}

export function detectAnomalies(signals: HealthSignal[]): HealthAnomaly[] {
  return signals
    .filter((signal) => signal.value > signal.threshold)
    .map((signal) => ({
      name: signal.name,
      value: signal.value,
      threshold: signal.threshold,
      overage: signal.value - signal.threshold
    }));
}
