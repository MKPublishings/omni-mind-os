uniform float time;
uniform float glowIntensity;
uniform vec3 lineColor;
uniform vec3 pulseColor;

varying vec3 vLocalPos;
varying vec3 vNormal;

void main() {
  float bandA = sin(vLocalPos.y * 13.2 + time * 2.1);
  float bandB = sin((vLocalPos.x + vLocalPos.z) * 11.4 - time * 2.6);
  float bandC = sin((vLocalPos.z - vLocalPos.y) * 17.0 + time * 1.2);
  float ripple = sin(vLocalPos.x * 24.6 + vLocalPos.y * 15.4 + vLocalPos.z * 18.9 + time * 1.36) * 0.5 + 0.5;
  float scanline = sin((vLocalPos.y + vLocalPos.z * 0.4) * 58.0 - time * 6.0) * 0.5 + 0.5;

  float band = max(max(bandA, bandB), bandC) * 0.5 + 0.5;
  float glow = smoothstep(0.48, 0.96, band) * glowIntensity;

  float edge = 1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));
  float edgeGlow = smoothstep(0.22, 1.0, edge);

  float signal = clamp(glow * (0.62 + ripple * 0.72) + edgeGlow * 0.33 + scanline * 0.13, 0.0, 1.0);
  vec3 color = mix(lineColor, pulseColor, signal);
  color += vec3(0.02, 0.05, 0.12) * scanline;

  float alpha = clamp(0.22 + signal * 0.76 + scanline * 0.08, 0.0, 0.97);
  gl_FragColor = vec4(color, alpha);
}
