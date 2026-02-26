import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

const canvas = document.getElementById("hero-brain-canvas");
if (!canvas) {
  throw new Error("Missing #hero-brain-canvas for brain visual");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const container = canvas.parentElement;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050c18, 0.13);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.08, 4.95);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const ambient = new THREE.AmbientLight(0x88aeea, 0.43);
scene.add(ambient);

const keyLight = new THREE.PointLight(0x9cc2ff, 1.5, 16, 2);
keyLight.position.set(2.4, 1.9, 3.6);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x2f78ff, 1.18, 15, 2);
rimLight.position.set(-2.7, -1.4, -3.2);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x5f9cff, 0.72, 12, 2);
fillLight.position.set(0.2, 1.6, -2.4);
scene.add(fillLight);

const brainRoot = new THREE.Group();
scene.add(brainRoot);

function pseudoNoise(x, y, z) {
  const n1 = Math.sin(x * 7.9 + y * 11.3 + z * 5.7);
  const n2 = Math.sin(x * 15.1 - y * 8.7 + z * 12.9);
  const n3 = Math.cos(x * 21.7 + y * 17.5 - z * 14.3);
  return (n1 * 0.52 + n2 * 0.32 + n3 * 0.16);
}

function createCortexGeometry() {
  const geometry = new THREE.SphereGeometry(1.22, 170, 132);
  const position = geometry.attributes.position;
  const normal = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    const srcX = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const side = srcX < 0 ? -1 : 1;
    let x = Math.abs(srcX);

    const verticalCurve = 1.0 - Math.pow(Math.min(Math.abs(y) / 1.26, 1.0), 1.55) * 0.39;
    const frontalBulge = Math.max(0, 0.28 - Math.abs(z - 0.38)) * 0.33;
    const occipitalRound = Math.max(0, 0.42 - Math.abs(z + 0.6)) * 0.14;
    const temporalIndent = Math.max(0, 0.34 - Math.abs(y + 0.36)) * 0.12;
    const upperConvexity = Math.max(0, y + 0.18) * 0.06;

    x = x * 0.82 * verticalCurve + 0.11 + frontalBulge + occipitalRound - temporalIndent + upperConvexity;

    const foldPrimary = Math.sin((y * 12.6 + z * 9.1) + side * 0.44) * 0.044;
    const foldSecondary = Math.sin((z * 19.7 - y * 8.4) + x * 12.2) * 0.022;
    const foldTertiary = pseudoNoise(x, y, z) * 0.029;
    const sulciBias = Math.sin((y * 28.0 + z * 25.0) + side * 0.18) * 0.014;
    x += foldPrimary + foldSecondary + foldTertiary + sulciBias;

    const midlineGroove = Math.max(0.0, 0.21 - x) * 0.92;
    x -= midlineGroove;

    const finalX = side * x + side * 0.05;
    const finalY = y * 0.94 + Math.sin(z * 4.8) * 0.017;
    const finalZ = z * 0.98 + Math.sin(y * 6.4) * 0.01;

    normal.set(finalX, finalY, finalZ).normalize();
    const corticalMicro = pseudoNoise(finalX * 1.8, finalY * 2.1, finalZ * 1.7) * 0.008;
    position.setXYZ(
      i,
      finalX + normal.x * corticalMicro,
      finalY + normal.y * corticalMicro,
      finalZ + normal.z * corticalMicro
    );
  }

  geometry.computeVertexNormals();
  return geometry;
}

function createCerebellumGeometry(side) {
  const geometry = new THREE.SphereGeometry(0.54, 84, 64);
  const position = geometry.attributes.position;

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const folds = Math.sin((y * 20.0 + z * 26.0) + side * 0.2) * 0.042;
    const horizontalBands = Math.sin(y * 32.0) * 0.016;
    position.setXYZ(
      i,
      x * 0.78 + side * 0.03,
      y * 0.58 - 0.08,
      z * 0.62 - 0.12 + folds + horizontalBands
    );
  }

  geometry.computeVertexNormals();
  return geometry;
}

function makeCortexMaterial(opacity = 0.84, emissiveIntensity = 0.35) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x060d1d,
    emissive: 0x15408f,
    emissiveIntensity,
    roughness: 0.56,
    metalness: 0.1,
    clearcoat: 0.36,
    clearcoatRoughness: 0.58,
    transparent: true,
    opacity
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
      glowIntensity: { value: 0.76 },
      lineColor: { value: new THREE.Color(0x1f5ec9) },
      pulseColor: { value: new THREE.Color(0x9cc2ff) }
    }
  });
}

function createNeuralCloud(geometry) {
  const source = geometry.attributes.position;
  const cloudCount = 4200;
  const positions = new Float32Array(cloudCount * 3);
  const color = new THREE.Color();
  const colors = new Float32Array(cloudCount * 3);

  for (let i = 0; i < cloudCount; i += 1) {
    const index = Math.floor(Math.random() * source.count);
    const x = source.getX(index);
    const y = source.getY(index);
    const z = source.getZ(index);
    const jitter = 0.017 + Math.random() * 0.03;

    positions[i * 3] = x + (Math.random() - 0.5) * jitter;
    positions[i * 3 + 1] = y + (Math.random() - 0.5) * jitter;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * jitter;

    color.setHSL(0.59 + Math.random() * 0.03, 0.65, 0.54 + Math.random() * 0.22);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const cloudGeometry = new THREE.BufferGeometry();
  cloudGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  cloudGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const cloudMaterial = new THREE.PointsMaterial({
    size: 0.012,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  const cloud = new THREE.Points(cloudGeometry, cloudMaterial);
  return cloud;
}

function createNeuralArcs() {
  const arcGroup = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: 0x8eb8ff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });

  for (let i = 0; i < 24; i += 1) {
    const left = new THREE.Vector3(-0.45 - Math.random() * 0.62, -0.24 + Math.random() * 0.84, -0.52 + Math.random() * 1.03);
    const right = new THREE.Vector3(0.45 + Math.random() * 0.62, -0.24 + Math.random() * 0.84, -0.52 + Math.random() * 1.03);
    const control = new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.06 + Math.random() * 0.62, -0.1 + Math.random() * 0.33);

    const curve = new THREE.CatmullRomCurve3([left, control, right]);
    const points = curve.getPoints(48);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const arc = new THREE.Line(geometry, material);
    arcGroup.add(arc);
  }

  return arcGroup;
}

function addBrainMeshes(vertexShader, fragmentShader) {
  const cortexGeometry = createCortexGeometry();
  const wireMaterial = createWireMaterial(vertexShader, fragmentShader);

  const cortexMesh = new THREE.Mesh(cortexGeometry, makeCortexMaterial(0.82, 0.36));
  brainRoot.add(cortexMesh);

  const subSurfaceMesh = new THREE.Mesh(cortexGeometry, makeCortexMaterial(0.34, 0.54));
  subSurfaceMesh.scale.setScalar(0.976);
  brainRoot.add(subSurfaceMesh);

  const wireMesh = new THREE.Mesh(cortexGeometry, wireMaterial);
  wireMesh.scale.setScalar(1.02);
  brainRoot.add(wireMesh);

  const neuralCloud = createNeuralCloud(cortexGeometry);
  neuralCloud.scale.setScalar(1.01);
  brainRoot.add(neuralCloud);

  const neuralArcs = createNeuralArcs();
  brainRoot.add(neuralArcs);

  [-1, 1].forEach((side) => {
    const cerebellum = new THREE.Mesh(createCerebellumGeometry(side), makeCortexMaterial(0.64, 0.28));
    cerebellum.position.set(side * 0.33, -0.78, -0.55);
    cerebellum.rotation.x = Math.PI * 0.14;
    brainRoot.add(cerebellum);
  });

  const stemGeometry = new THREE.CapsuleGeometry(0.18, 0.45, 6, 14);
  const stemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a142c,
    emissive: 0x1d4c9f,
    emissiveIntensity: 0.22,
    roughness: 0.66,
    metalness: 0.08,
    clearcoat: 0.24,
    transparent: true,
    opacity: 0.8
  });

  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.set(0, -1.2, -0.1);
  stem.rotation.x = Math.PI * 0.1;
  brainRoot.add(stem);

  brainRoot.scale.setScalar(1.2);

  return { wireMaterial, neuralCloud, neuralArcs };
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
let neuralCloud;
let neuralArcs;
let rafId;
let started = false;

function animate(now) {
  const time = now * 0.001;

  if (wireMaterial) {
    const pulse = prefersReducedMotion ? 0.5 : 0.58 + 0.32 * Math.sin(time * 1.24);
    wireMaterial.uniforms.time.value = time;
    wireMaterial.uniforms.glowIntensity.value = pulse;
  }

  if (neuralCloud?.material) {
    neuralCloud.material.opacity = prefersReducedMotion ? 0.66 : 0.54 + (Math.sin(time * 2.2) * 0.14 + 0.14);
  }

  if (neuralArcs) {
    neuralArcs.rotation.y = Math.sin(time * 0.42) * 0.07;
  }

  if (!prefersReducedMotion) {
    brainRoot.rotation.y += 0.00165;
    brainRoot.rotation.x = Math.sin(time * 0.34) * 0.03;
    brainRoot.rotation.z = Math.sin(time * 0.2) * 0.012;
    brainRoot.position.y = Math.sin(time * 0.68) * 0.035;
  } else {
    brainRoot.rotation.y += 0.0005;
    brainRoot.rotation.x = 0;
    brainRoot.rotation.z = 0;
    brainRoot.position.y = 0;
  }

  keyLight.intensity = prefersReducedMotion ? 1.3 : 1.26 + Math.sin(time * 1.15) * 0.26;
  rimLight.intensity = prefersReducedMotion ? 1.0 : 1.04 + Math.sin(time * 0.95 + 1.4) * 0.18;

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
    const visualRefs = addBrainMeshes(vertexShader, fragmentShader);
    wireMaterial = visualRefs.wireMaterial;
    neuralCloud = visualRefs.neuralCloud;
    neuralArcs = visualRefs.neuralArcs;
    start();
  })
  .catch((error) => {
    console.error("Failed to initialize brain visual shaders", error);
  });
