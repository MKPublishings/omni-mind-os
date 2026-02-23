uniform float time;
uniform float glowIntensity;
uniform vec3 lineColor;
uniform vec3 pulseColor;

varying vec3 vLocalPos;
varying vec3 vNormal;

void main() {
  float bandA = sin(vLocalPos.y * 10.5 + time * 2.4);
  float bandB = sin((vLocalPos.x + vLocalPos.z) * 9.0 - time * 2.8);
  float ripple = sin(vLocalPos.x * 21.7 + vLocalPos.y * 13.1 + vLocalPos.z * 17.3 + time * 1.3) * 0.5 + 0.5;

  float band = max(bandA, bandB) * 0.5 + 0.5;
  float glow = smoothstep(0.48, 0.96, band) * glowIntensity;

  float edge = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
  float edgeGlow = smoothstep(0.22, 1.0, edge);

  float signal = clamp(glow * (0.65 + ripple * 0.7) + edgeGlow * 0.28, 0.0, 1.0);
  vec3 color = mix(lineColor, pulseColor, signal);

  float alpha = clamp(0.28 + signal * 0.72, 0.0, 0.96);
  gl_FragColor = vec4(color, alpha);
}
