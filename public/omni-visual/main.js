import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

const canvas = document.getElementById("hero-omni-canvas");
if (!canvas) {
  throw new Error("Missing #hero-omni-canvas for omni visual");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const container = canvas.parentElement;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06061a, 0.1);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0.15, 6.6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const ambient = new THREE.AmbientLight(0x5e73ff, 0.6);
scene.add(ambient);

const keyLight = new THREE.PointLight(0x74b9ff, 1.9, 24, 2);
keyLight.position.set(3.1, 2.4, 4.4);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xa46bff, 1.45, 20, 2);
fillLight.position.set(-2.8, -1.8, 2.6);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x3f88ff, 1.3, 18, 2);
rimLight.position.set(0.6, 1.9, -3.8);
scene.add(rimLight);

const root = new THREE.Group();
root.position.y = 0.35;
scene.add(root);

const coreGeometry = new THREE.IcosahedronGeometry(1.02, 5);
const coreMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x16203f,
  emissive: 0x4a7dff,
  emissiveIntensity: 0.8,
  roughness: 0.18,
  metalness: 0.86,
  clearcoat: 1,
  clearcoatRoughness: 0.16,
  reflectivity: 1
});
const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
root.add(coreMesh);

const shellGeometry = new THREE.SphereGeometry(1.2, 72, 64);
const shellMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x4a61ff,
  transparent: true,
  opacity: 0.24,
  emissive: 0x6f74ff,
  emissiveIntensity: 0.72,
  roughness: 0.1,
  metalness: 0.68,
  clearcoat: 0.9,
  clearcoatRoughness: 0.2,
  side: THREE.DoubleSide
});
const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
root.add(shellMesh);

const arcGroup = new THREE.Group();
root.add(arcGroup);

function createArc(radius, tube, colorA, colorB, tilt) {
  const geo = new THREE.TorusGeometry(radius, tube, 32, 180);
  const mat = new THREE.MeshPhysicalMaterial({
    color: colorA,
    emissive: colorB,
    emissiveIntensity: 0.84,
    roughness: 0.12,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.18,
    transparent: true,
    opacity: 0.96
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.set(tilt.x, tilt.y, tilt.z);
  return mesh;
}

arcGroup.add(createArc(1.75, 0.045, 0x4ba6ff, 0x725eff, { x: 0.32, y: 0.1, z: 0.62 }));
arcGroup.add(createArc(1.95, 0.036, 0x5a88ff, 0xa04bff, { x: 1.1, y: 0.52, z: 0.2 }));
arcGroup.add(createArc(1.56, 0.04, 0x3e9eff, 0x6f8dff, { x: 0.84, y: 0.12, z: 1.28 }));
arcGroup.add(createArc(2.1, 0.032, 0x6787ff, 0xaf63ff, { x: 0.22, y: -0.4, z: 0.96 }));

const networkGroup = new THREE.Group();
root.add(networkGroup);

function createNetworkLines() {
  const lineCount = 38;
  const material = new THREE.LineBasicMaterial({
    color: 0x8a8dff,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending
  });

  for (let i = 0; i < lineCount; i += 1) {
    const from = new THREE.Vector3(
      (Math.random() - 0.5) * 1.7,
      (Math.random() - 0.45) * 1.55,
      (Math.random() - 0.5) * 1.3
    );
    const to = new THREE.Vector3(
      (Math.random() - 0.5) * 2.8,
      (Math.random() - 0.48) * 2.3,
      (Math.random() - 0.5) * 2.2
    );
    const mid = from.clone().lerp(to, 0.5);
    mid.x += (Math.random() - 0.5) * 0.42;
    mid.y += (Math.random() - 0.5) * 0.42;

    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(36));
    const line = new THREE.Line(geometry, material);
    networkGroup.add(line);
  }
}

createNetworkLines();

const backdrop = new THREE.Group();
backdrop.position.z = -2.2;
scene.add(backdrop);

function createCircuitBackdrop() {
  const circuitCount = 85;
  const positions = new Float32Array(circuitCount * 2 * 3);

  for (let i = 0; i < circuitCount; i += 1) {
    const x = (Math.random() - 0.5) * 11;
    const y = (Math.random() - 0.5) * 5.4;
    const segment = 0.55 + Math.random() * 0.9;
    const horizontal = Math.random() > 0.5;

    const i3 = i * 6;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = 0;
    positions[i3 + 3] = x + (horizontal ? segment : 0);
    positions[i3 + 4] = y + (horizontal ? 0 : segment * 0.56);
    positions[i3 + 5] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0x5e73ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending
  });

  const lines = new THREE.LineSegments(geometry, material);
  backdrop.add(lines);

  const nodeCount = 240;
  const nodePositions = new Float32Array(nodeCount * 3);
  for (let i = 0; i < nodeCount; i += 1) {
    nodePositions[i * 3] = (Math.random() - 0.5) * 12;
    nodePositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
    nodePositions[i * 3 + 2] = Math.random() * 0.35;
  }

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));

  const nodeMaterial = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x8ea4ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  backdrop.add(nodes);

  return { lines, nodes };
}

const backdropRefs = createCircuitBackdrop();

const particleCount = 2100;
const particlePositions = new Float32Array(particleCount * 3);
const particleColors = new Float32Array(particleCount * 3);
const color = new THREE.Color();

for (let i = 0; i < particleCount; i += 1) {
  const spread = 4.8;
  particlePositions[i * 3] = (Math.random() - 0.5) * spread;
  particlePositions[i * 3 + 1] = (Math.random() - 0.45) * (spread * 0.68);
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 3.8;

  color.setHSL(0.58 + Math.random() * 0.17, 0.85, 0.62);
  particleColors[i * 3] = color.r;
  particleColors[i * 3 + 1] = color.g;
  particleColors[i * 3 + 2] = color.b;
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

const particleMaterial = new THREE.PointsMaterial({
  size: 0.018,
  vertexColors: true,
  transparent: true,
  opacity: 0.86,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

const glowTexture = new THREE.TextureLoader().load("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3CradialGradient id='g'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='1'/%3E%3Cstop offset='50%25' stop-color='%2398a6ff' stop-opacity='0.6'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0'/%3E%3C/radialGradient%3E%3Crect width='128' height='128' fill='url(%23g)'/%3E%3C/svg%3E");

const glowSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x95a8ff,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
glowSprite.scale.set(5.2, 5.2, 1);
glowSprite.position.set(0, 0.3, -0.3);
scene.add(glowSprite);

function resize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

let rafId;
let started = false;

function animate(now) {
  const time = now * 0.001;

  if (!prefersReducedMotion) {
    root.rotation.y = time * 0.22;
    root.rotation.x = Math.sin(time * 0.45) * 0.1;
    root.position.y = 0.33 + Math.sin(time * 0.9) * 0.08;

    arcGroup.rotation.x = Math.sin(time * 0.37) * 0.12;
    arcGroup.rotation.z = Math.cos(time * 0.26) * 0.1;

    networkGroup.rotation.y = -time * 0.25;
    networkGroup.rotation.z = Math.sin(time * 0.44) * 0.08;

    backdrop.rotation.z = Math.sin(time * 0.09) * 0.03;
    backdropRefs.lines.material.opacity = 0.14 + (Math.sin(time * 1.4) * 0.04 + 0.04);
    backdropRefs.nodes.material.opacity = 0.42 + (Math.cos(time * 1.7) * 0.1 + 0.1);

    particles.rotation.y = time * 0.025;
    particles.rotation.x = Math.sin(time * 0.2) * 0.05;
    particleMaterial.opacity = 0.64 + (Math.sin(time * 2.3) * 0.1 + 0.1);

    keyLight.intensity = 1.72 + Math.sin(time * 1.15) * 0.2;
    fillLight.intensity = 1.34 + Math.sin(time * 0.9 + 1.2) * 0.16;
    glowSprite.material.opacity = 0.44 + Math.sin(time * 1.6) * 0.08;
  } else {
    root.rotation.y = time * 0.08;
    arcGroup.rotation.x = 0.04;
    arcGroup.rotation.z = 0.05;
    networkGroup.rotation.y = -time * 0.08;
    backdropRefs.lines.material.opacity = 0.18;
    backdropRefs.nodes.material.opacity = 0.44;
    particleMaterial.opacity = 0.66;
    glowSprite.material.opacity = 0.42;
    keyLight.intensity = 1.72;
    fillLight.intensity = 1.2;
  }

  coreMaterial.emissiveIntensity = prefersReducedMotion
    ? 0.86
    : 0.7 + (Math.sin(time * 2) * 0.12 + 0.12);
  shellMaterial.opacity = prefersReducedMotion
    ? 0.28
    : 0.2 + (Math.sin(time * 1.7 + 1) * 0.07 + 0.07);

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
start();
