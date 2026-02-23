import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

const canvas = document.getElementById("hero-brain-canvas");
if (!canvas) {
  throw new Error("Missing #hero-brain-canvas for brain visual");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const container = canvas.parentElement;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.1, 4.25);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const ambient = new THREE.AmbientLight(0x88aeea, 0.35);
scene.add(ambient);

const keyLight = new THREE.PointLight(0x7fb2ff, 1.25, 12, 2);
keyLight.position.set(2.2, 1.8, 3.4);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x2f78ff, 0.9, 10, 2);
rimLight.position.set(-2.4, -1.4, -2.8);
scene.add(rimLight);

const brainRoot = new THREE.Group();
scene.add(brainRoot);

function createHemisphereGeometry(side) {
  const geometry = new THREE.SphereGeometry(0.98, 88, 88);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    let x = Math.abs(position.getX(i));
    const y = position.getY(i);
    const z = position.getZ(i);

    const yCurve = 1.0 - Math.min(Math.abs(y) / 1.05, 1.0) * 0.3;
    x = x * 0.74 * yCurve + 0.12;

    const foldA = Math.sin((y * 9.3 + z * 6.1) + side * 0.35) * 0.045;
    const foldB = Math.sin((z * 14.6 - y * 4.8) + x * 8.2) * 0.026;
    const foldC = Math.sin((x * 11.4 + y * 5.4 + z * 3.7) * 1.3) * 0.018;

    x += foldA + foldB + foldC;

    if (x < 0.24) {
      x *= 0.74;
    }

    const midlineOffset = side * 0.08;
    position.setXYZ(i, side * x + midlineOffset, y * 0.93, z * 0.9);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function makeBaseMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x050a16,
    emissive: 0x11306d,
    emissiveIntensity: 0.28,
    roughness: 0.7,
    metalness: 0.08,
    transparent: true,
    opacity: 0.84
  });
}

async function loadShaders() {
  const [vertResponse, fragResponse] = await Promise.all([
    fetch("/brain-visual/shaders/brainGlow.vert"),
    fetch("/brain-visual/shaders/brainGlow.frag")
  ]);

  const [vertexShader, fragmentShader] = await Promise.all([
    vertResponse.text(),
    fragResponse.text()
  ]);

  return { vertexShader, fragmentShader };
}

function createWireMaterial(vertexShader, fragmentShader) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      glowIntensity: { value: 0.7 },
      lineColor: { value: new THREE.Color(0x1f5ec9) },
      pulseColor: { value: new THREE.Color(0x9cc2ff) }
    }
  });
}

function addBrainMeshes(vertexShader, fragmentShader) {
  const wireMaterial = createWireMaterial(vertexShader, fragmentShader);

  [-1, 1].forEach((side) => {
    const geometry = createHemisphereGeometry(side);

    const baseMesh = new THREE.Mesh(geometry, makeBaseMaterial());
    brainRoot.add(baseMesh);

    const wireMesh = new THREE.Mesh(geometry, wireMaterial);
    wireMesh.scale.setScalar(1.012);
    brainRoot.add(wireMesh);
  });

  const stemGeometry = new THREE.CapsuleGeometry(0.18, 0.45, 6, 14);
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x091127,
    emissive: 0x0f2d68,
    emissiveIntensity: 0.2,
    roughness: 0.74,
    metalness: 0.05,
    transparent: true,
    opacity: 0.8
  });

  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.set(0, -1.05, -0.04);
  stem.rotation.x = Math.PI * 0.08;
  brainRoot.add(stem);

  return wireMaterial;
}

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

let wireMaterial;
let rafId;
let started = false;

function animate(now) {
  const time = now * 0.001;

  if (wireMaterial) {
    const pulse = prefersReducedMotion ? 0.44 : 0.55 + 0.35 * Math.sin(time * 1.25);
    wireMaterial.uniforms.time.value = time;
    wireMaterial.uniforms.glowIntensity.value = pulse;
  }

  if (!prefersReducedMotion) {
    brainRoot.rotation.y += 0.0024;
    brainRoot.rotation.x = Math.sin(time * 0.42) * 0.04;
    brainRoot.position.y = Math.sin(time * 0.74) * 0.03;
  } else {
    brainRoot.rotation.y += 0.0005;
    brainRoot.rotation.x = 0;
    brainRoot.position.y = 0;
  }

  renderer.render(scene, camera);
  rafId = window.requestAnimationFrame(animate);
}

function start() {
  if (started) return;
  started = true;
  resize();
  rafId = window.requestAnimationFrame(animate);
}

function stop() {
  if (!started) return;
  started = false;
  window.cancelAnimationFrame(rafId);
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries[0]?.isIntersecting;
    if (visible) {
      start();
    } else {
      stop();
    }
  },
  { threshold: 0.12 }
);
observer.observe(canvas);

window.addEventListener("resize", resize, { passive: true });

loadShaders()
  .then(({ vertexShader, fragmentShader }) => {
    wireMaterial = addBrainMeshes(vertexShader, fragmentShader);
    start();
  })
  .catch((error) => {
    console.error("Failed to initialize brain visual shaders", error);
  });
