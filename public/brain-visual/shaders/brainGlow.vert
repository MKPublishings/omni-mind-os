varying vec3 vLocalPos;
varying vec3 vNormal;

void main() {
  vLocalPos = position;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
