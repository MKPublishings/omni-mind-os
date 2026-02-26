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

const hoverLabel = document.createElement("div");
hoverLabel.style.position = "absolute";
hoverLabel.style.left = "0";
hoverLabel.style.top = "0";
hoverLabel.style.transform = "translate(-50%, -140%)";
hoverLabel.style.padding = "5px 8px";
hoverLabel.style.borderRadius = "8px";
hoverLabel.style.border = "1px solid rgba(165, 198, 255, 0.42)";
hoverLabel.style.background = "rgba(5, 12, 24, 0.86)";
hoverLabel.style.color = "rgba(226, 238, 255, 0.96)";
hoverLabel.style.fontSize = "11px";
hoverLabel.style.fontWeight = "600";
hoverLabel.style.letterSpacing = "0.03em";
hoverLabel.style.backdropFilter = "blur(4px)";
hoverLabel.style.pointerEvents = "none";
hoverLabel.style.opacity = "0";
hoverLabel.style.transition = "opacity 120ms ease";
hoverLabel.style.zIndex = "5";
container.style.position = "relative";
container.appendChild(hoverLabel);

const lobeSequencePhases = [
  [
    "frontal-left",
    "parietal-left",
    "occipital-left",
    "temporal-left",
    "cerebellum-left",
    "brainstem",
    "frontal-right",
    "parietal-right",
    "occipital-right",
    "temporal-right",
    "cerebellum-right"
  ],
  [
    "frontal-right",
    "parietal-right",
    "occipital-right",
    "temporal-right",
    "cerebellum-right",
    "brainstem",
    "frontal-left",
    "parietal-left",
    "occipital-left",
    "temporal-left",
    "cerebellum-left"
  ]
];
const lobeTimingProfiles = {
  frontal: { microSpeed: 1.04, drift: 0.1 },
  parietal: { microSpeed: 0.96, drift: -0.06 },
  occipital: { microSpeed: 1.08, drift: 0.08 },
  temporal: { microSpeed: 1.12, drift: -0.09 },
  cerebellum: { microSpeed: 1.18, drift: 0.04 },
  brainstem: { microSpeed: 0.9, drift: -0.04 }
};
const lobePulseConfig = {
  slotDuration: 1.34,
  risePortion: 0.24,
  holdPortion: 0.28,
  fallPortion: 0.34,
  idleFloor: 0.04
};

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
    const frontalBulge = Math.max(0, 0.3 - Math.abs(z - 0.4)) * 0.36;
    const occipitalRound = Math.max(0, 0.44 - Math.abs(z + 0.62)) * 0.2;
    const temporalIndent = Math.max(0, 0.38 - Math.abs(y + 0.34)) * 0.14;
    const upperConvexity = Math.max(0, y + 0.18) * 0.06;
    const lateralSweep = Math.max(0, 0.6 - Math.abs(z + 0.05)) * 0.06;

    x = x * 0.84 * verticalCurve + 0.1 + frontalBulge + occipitalRound - temporalIndent + upperConvexity + lateralSweep;

    const foldPrimary = Math.sin((y * 13.8 + z * 9.8) + side * 0.5) * 0.05;
    const foldSecondary = Math.sin((z * 21.2 - y * 8.8) + x * 12.6) * 0.029;
    const foldTertiary = pseudoNoise(x * 1.1, y * 1.3, z * 1.2) * 0.034;
    const sulciBias = Math.sin((y * 30.0 + z * 27.0) + side * 0.2) * 0.018;
    const gyralRibs = Math.sin((y * 45.0 + z * 39.0) + side * 1.2) * 0.011;
    x += foldPrimary + foldSecondary + foldTertiary + sulciBias + gyralRibs;

    const midlineGroove = Math.max(0.0, 0.21 - x) * 0.92;
    x -= midlineGroove;

    const centralSulcusBias = Math.max(0, 0.18 - Math.abs(z - 0.08)) * Math.max(0, y + 0.16) * 0.12;
    const parietoOccipitalDip = Math.max(0, 0.24 - Math.abs(z + 0.18)) * Math.max(0, y + 0.2) * 0.085;
    x -= centralSulcusBias + parietoOccipitalDip;

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

function makeLobeMaterial(color, opacity = 0.36) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x08152f,
    emissive: color,
    emissiveIntensity: 0.18,
    roughness: 0.44,
    metalness: 0.08,
    clearcoat: 0.38,
    clearcoatRoughness: 0.52,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function shiftHexColor(hexColor, hShift = 0, sMul = 1, lMul = 1) {
  const color = new THREE.Color(hexColor);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const shiftedHue = (hsl.h + hShift + 1) % 1;
  const shiftedSat = THREE.MathUtils.clamp(hsl.s * sMul, 0, 1);
  const shiftedLum = THREE.MathUtils.clamp(hsl.l * lMul, 0, 1);
  color.setHSL(shiftedHue, shiftedSat, shiftedLum);
  return color.getHex();
}

function buildRegionGeometry(sourceGeometry, includeTriangle) {
  const nonIndexed = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry.clone();
  const sourcePosition = nonIndexed.attributes.position.array;
  const regionVertices = [];

  for (let index = 0; index < sourcePosition.length; index += 9) {
    const x0 = sourcePosition[index];
    const y0 = sourcePosition[index + 1];
    const z0 = sourcePosition[index + 2];
    const x1 = sourcePosition[index + 3];
    const y1 = sourcePosition[index + 4];
    const z1 = sourcePosition[index + 5];
    const x2 = sourcePosition[index + 6];
    const y2 = sourcePosition[index + 7];
    const z2 = sourcePosition[index + 8];

    const cx = (x0 + x1 + x2) / 3;
    const cy = (y0 + y1 + y2) / 3;
    const cz = (z0 + z1 + z2) / 3;

    if (!includeTriangle(cx, cy, cz)) {
      continue;
    }

    regionVertices.push(
      x0, y0, z0,
      x1, y1, z1,
      x2, y2, z2
    );
  }

  if (!regionVertices.length) {
    return null;
  }

  const regionGeometry = new THREE.BufferGeometry();
  regionGeometry.setAttribute("position", new THREE.Float32BufferAttribute(regionVertices, 3));
  regionGeometry.computeVertexNormals();
  return regionGeometry;
}

function createLobeRegions(cortexGeometry) {
  const lobeGroup = new THREE.Group();
  const controllers = [];
  const hoverTargets = [];

  const hemispheres = [
    { key: "left", include: (x) => x < -0.02 },
    { key: "right", include: (x) => x > 0.02 }
  ];

  const regionDefinitions = [
    {
      key: "frontal",
      color: 0x84b8ff,
      include: (x, y, z) => z > 0.22 && y > -0.28
    },
    {
      key: "parietal",
      color: 0x74a4ff,
      include: (x, y, z) => z > -0.05 && z <= 0.24 && y > 0.06
    },
    {
      key: "occipital",
      color: 0x5f93ff,
      include: (x, y, z) => z <= -0.14 && y > -0.26
    },
    {
      key: "temporal",
      color: 0x4f86f4,
      include: (x, y, z) => y <= 0.11 && y > -0.62 && z > -0.26 && z < 0.28 && Math.abs(x) > 0.24
    }
  ];

  regionDefinitions.forEach((definition) => {
    hemispheres.forEach((hemisphere) => {
      const regionGeometry = buildRegionGeometry(
        cortexGeometry,
        (x, y, z) => hemisphere.include(x) && definition.include(x, y, z)
      );

      if (!regionGeometry) {
        return;
      }

      const regionColor = hemisphere.key === "left"
        ? shiftHexColor(definition.color, -0.01, 1.04, 1.02)
        : shiftHexColor(definition.color, 0.01, 0.98, 0.98);
      const regionMaterial = makeLobeMaterial(regionColor, 0.3);
      const regionMesh = new THREE.Mesh(regionGeometry, regionMaterial);
      regionMesh.scale.setScalar(1.016);
      lobeGroup.add(regionMesh);

      const displayHemisphere = hemisphere.key === "left" ? "Left" : "Right";
      const displayName = `${definition.key.charAt(0).toUpperCase()}${definition.key.slice(1)} Lobe (${displayHemisphere})`;
      regionMesh.userData.label = displayName;
      hoverTargets.push(regionMesh);

      controllers.push({
        material: regionMaterial,
        key: `${definition.key}-${hemisphere.key}`,
        baseEmissive: 0.1,
        emissiveRange: 0.78,
        baseOpacity: 0.16,
        opacityRange: 0.5
      });
    });
  });

  return { lobeGroup, controllers, hoverTargets };
}

function computeRegionActivation(time, key) {
  if (prefersReducedMotion) {
    return 0.55;
  }

  const [baseKey = key, hemisphere = "center"] = key.split("-");
  const profile = lobeTimingProfiles[baseKey] || { microSpeed: 1, drift: 0 };
  const sequenceLength = lobeSequencePhases[0].length;
  const sequenceDuration = sequenceLength * lobePulseConfig.slotDuration;
  const phaseIndex = Math.floor(time / sequenceDuration) % lobeSequencePhases.length;
  const activeSequence = lobeSequencePhases[phaseIndex];
  const regionIndex = activeSequence.indexOf(key);

  if (regionIndex < 0) {
    return lobePulseConfig.idleFloor;
  }

  const hemisphereBias = hemisphere === "left" ? -0.05 : hemisphere === "right" ? 0.05 : 0;
  const timeline = time / lobePulseConfig.slotDuration;
  const loopPosition = ((timeline + profile.drift + hemisphereBias) % sequenceLength + sequenceLength) % sequenceLength;
  const distanceToWindow = Math.abs(loopPosition - regionIndex);
  const wrappedDistance = Math.min(distanceToWindow, sequenceLength - distanceToWindow);

  if (wrappedDistance > 0.68) {
    const idleRipple = (Math.sin(time * 0.84 + regionIndex * 1.7) + 1) * 0.5;
    return lobePulseConfig.idleFloor + idleRipple * 0.04;
  }

  const localPhase = THREE.MathUtils.clamp(1 - wrappedDistance / 0.68, 0, 1);
  const riseEnd = lobePulseConfig.risePortion;
  const holdEnd = riseEnd + lobePulseConfig.holdPortion;
  const fallEnd = holdEnd + lobePulseConfig.fallPortion;

  let envelope;
  if (localPhase <= riseEnd) {
    envelope = THREE.MathUtils.smoothstep(localPhase / riseEnd, 0, 1);
  } else if (localPhase <= holdEnd) {
    envelope = 1;
  } else if (localPhase <= fallEnd) {
    const normalizedFall = (localPhase - holdEnd) / Math.max(0.0001, fallEnd - holdEnd);
    envelope = 1 - THREE.MathUtils.smoothstep(normalizedFall, 0, 1);
  } else {
    envelope = 0;
  }

  const microPulse = 0.92 + 0.08 * Math.sin(time * (4.4 * profile.microSpeed) + regionIndex * 2.1);
  return Math.max(lobePulseConfig.idleFloor, envelope * microPulse);
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

  const { lobeGroup, controllers: lobeControllers, hoverTargets } = createLobeRegions(cortexGeometry);
  brainRoot.add(lobeGroup);

  [-1, 1].forEach((side) => {
    const cerebellumColor = side < 0
      ? shiftHexColor(0x9cc2ff, -0.01, 1.02, 1.02)
      : shiftHexColor(0x9cc2ff, 0.01, 0.98, 0.98);
    const cerebellumMaterial = makeLobeMaterial(cerebellumColor, 0.34);
    const cerebellum = new THREE.Mesh(createCerebellumGeometry(side), cerebellumMaterial);
    cerebellum.position.set(side * 0.33, -0.78, -0.55);
    cerebellum.rotation.x = Math.PI * 0.14;
    cerebellum.userData.label = side < 0 ? "Cerebellum (Left)" : "Cerebellum (Right)";
    brainRoot.add(cerebellum);
    hoverTargets.push(cerebellum);

    lobeControllers.push({
      material: cerebellumMaterial,
      key: side < 0 ? "cerebellum-left" : "cerebellum-right",
      baseEmissive: 0.08,
      emissiveRange: 0.74,
      baseOpacity: 0.2,
      opacityRange: 0.44
    });
  });

  const stemGeometry = new THREE.CapsuleGeometry(0.18, 0.45, 6, 14);
  const stemMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a142c,
    emissive: 0x1d4c9f,
    emissiveIntensity: 0.16,
    roughness: 0.66,
    metalness: 0.08,
    clearcoat: 0.24,
    transparent: true,
    opacity: 0.62
  });

  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.set(0, -1.2, -0.1);
  stem.rotation.x = Math.PI * 0.1;
  stem.userData.label = "Brainstem";
  brainRoot.add(stem);
  hoverTargets.push(stem);

  lobeControllers.push({
    material: stemMaterial,
    key: "brainstem",
    baseEmissive: 0.06,
    emissiveRange: 0.52,
    baseOpacity: 0.26,
    opacityRange: 0.34
  });

  brainRoot.scale.setScalar(1.2);

  return { wireMaterial, neuralCloud, neuralArcs, lobeControllers, hoverTargets };
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
let lobeControllers = [];
let hoverTargets = [];
let rafId;
let started = false;

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const hoverPoint = new THREE.Vector3();
let isPointerInside = false;
let hoverHideTimeoutId = null;
const hoverLabelStickMs = 700;

function hideHoverLabel() {
  if (hoverHideTimeoutId) {
    window.clearTimeout(hoverHideTimeoutId);
    hoverHideTimeoutId = null;
  }
  hoverLabel.style.opacity = "0";
}

function queueHideHoverLabel(delayMs = hoverLabelStickMs) {
  if (hoverHideTimeoutId) {
    window.clearTimeout(hoverHideTimeoutId);
    hoverHideTimeoutId = null;
  }

  hoverHideTimeoutId = window.setTimeout(() => {
    hoverLabel.style.opacity = "0";
    hoverHideTimeoutId = null;
  }, delayMs);
}

function updateHoverLabel() {
  if (!isPointerInside || !hoverTargets.length) {
    queueHideHoverLabel();
    return;
  }

  raycaster.setFromCamera(pointerNdc, camera);
  const intersections = raycaster.intersectObjects(hoverTargets, false);
  const hit = intersections[0];

  if (!hit || !hit.object?.userData?.label) {
    queueHideHoverLabel();
    return;
  }

  if (hoverHideTimeoutId) {
    window.clearTimeout(hoverHideTimeoutId);
    hoverHideTimeoutId = null;
  }

  hoverPoint.copy(hit.point).project(camera);
  const x = (hoverPoint.x * 0.5 + 0.5) * container.clientWidth;
  const y = (-hoverPoint.y * 0.5 + 0.5) * container.clientHeight;

  hoverLabel.textContent = hit.object.userData.label;
  hoverLabel.style.left = `${x}px`;
  hoverLabel.style.top = `${y}px`;
  hoverLabel.style.opacity = "1";
}

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

  if (lobeControllers.length) {
    lobeControllers.forEach((controller) => {
      const activation = computeRegionActivation(time, controller.key);
      controller.material.emissiveIntensity = controller.baseEmissive + activation * controller.emissiveRange;
      controller.material.opacity = controller.baseOpacity + activation * controller.opacityRange;
    });
  }

  updateHoverLabel();

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

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  pointerNdc.x = (localX / rect.width) * 2 - 1;
  pointerNdc.y = -(localY / rect.height) * 2 + 1;
  isPointerInside = true;
});

canvas.addEventListener("pointerenter", () => {
  isPointerInside = true;
});

canvas.addEventListener("pointerleave", () => {
  isPointerInside = false;
  queueHideHoverLabel();
});

loadShaders()
  .then(({ vertexShader, fragmentShader }) => {
    const visualRefs = addBrainMeshes(vertexShader, fragmentShader);
    wireMaterial = visualRefs.wireMaterial;
    neuralCloud = visualRefs.neuralCloud;
    neuralArcs = visualRefs.neuralArcs;
    lobeControllers = visualRefs.lobeControllers;
    hoverTargets = visualRefs.hoverTargets;
    start();
  })
  .catch((error) => {
    console.error("Failed to initialize brain visual shaders", error);
  });
