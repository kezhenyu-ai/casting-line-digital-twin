import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  makeConcreteTexture,
  makeWallTexture,
  makeHazardStripeTexture,
  makeSmokeTexture,
  makeGlowTexture,
  makeSparkTexture,
  makeDustTexture,
  makeFloorDecal,
  makeVentTexture,
  makeScreenTexture,
} from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

const COLORS = {
  mint: 0x61efbd,
  cyan: 0x6fe4ee,
  amber: 0xffbd66,
  orange: 0xff8a4c,
  red: 0xff6570,
  blue: 0x86b9ff,
  steel: 0x506067,
  dark: 0x141c1f,
};

function makeCanvasText(title, subtitle, options = {}) {
  const {
    width = 768,
    height = 240,
    color = '#dff8f4',
    accent = '#61efbd',
    align = 'left',
    border = false,
  } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (border) {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.strokeRect(9, 9, width - 18, height - 18);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = align;
  const x = align === 'center' ? width / 2 : 34;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x, 36, 32, 3);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.font = '600 74px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  ctx.fillText(title, x, 132);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.66;
  ctx.font = '500 22px Bahnschrift, "Segoe UI", sans-serif';
  ctx.fillText(subtitle, x + 2, 181);
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeSignTexture(code, name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12,22,25,.95)';
  ctx.fillRect(0, 0, 256, 512);
  ctx.strokeStyle = 'rgba(111,228,238,.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 492);
  ctx.fillStyle = '#61efbd';
  ctx.font = '500 68px Bahnschrift, sans-serif';
  ctx.fillText(code, 28, 172);
  ctx.fillStyle = '#d5e8e8';
  ctx.font = '500 30px "Microsoft YaHei UI", sans-serif';
  const chars = name.split('');
  chars.forEach((char, i) => ctx.fillText(char, 34, 235 + i * 40));
  ctx.fillStyle = 'rgba(111,228,238,.35)';
  ctx.fillRect(28, 448, 120, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createMaterials() {
  const concreteMap = makeConcreteTexture();
  const wallMap = makeWallTexture();
  const hazardMap = makeHazardStripeTexture();
  const ventMap = makeVentTexture();
  const screenMap = makeScreenTexture();

  const mat = {
    ground: new THREE.MeshStandardMaterial({ color: 0x0b1011, roughness: 0.97, metalness: 0.05 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x151b1c, roughness: 0.92, metalness: 0.06 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x696b63, map: concreteMap, roughness: 0.82, metalness: 0.08 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x4b4d47, map: concreteMap, roughness: 0.9, metalness: 0.06 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x5e6869, map: wallMap, roughness: 0.7, metalness: 0.48 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2d383d, roughness: 0.44, metalness: 0.86 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5e6b70, roughness: 0.38, metalness: 0.83 }),
    steelLight: new THREE.MeshStandardMaterial({ color: 0x8d9899, roughness: 0.34, metalness: 0.8 }),
    paintedBlue: new THREE.MeshStandardMaterial({ color: 0x24434d, roughness: 0.45, metalness: 0.55 }),
    paintedTeal: new THREE.MeshStandardMaterial({ color: 0x1d4c4b, roughness: 0.46, metalness: 0.58 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xb88a2f, roughness: 0.48, metalness: 0.48 }),
    yellowPaint: new THREE.MeshStandardMaterial({ color: 0xcaa53e, roughness: 0.58, metalness: 0.26 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xb65326, roughness: 0.46, metalness: 0.4 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x553126, roughness: 0.82, metalness: 0.3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0d1112, roughness: 0.9, metalness: 0.03 }),
    sand: new THREE.MeshStandardMaterial({ color: 0x504b33, roughness: 0.98, metalness: 0.02 }),
    scrap: new THREE.MeshStandardMaterial({ color: 0x3b3a33, roughness: 0.66, metalness: 0.7 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x88532e, roughness: 0.37, metalness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x8fd2d4,
      roughness: 0.12,
      metalness: 0.16,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.8,
    }),
    glassDark: new THREE.MeshPhysicalMaterial({
      color: 0x365d63,
      roughness: 0.16,
      metalness: 0.32,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xb89a48, map: hazardMap, roughness: 0.7, metalness: 0.2 }),
    vent: new THREE.MeshStandardMaterial({ color: 0x8e9694, map: ventMap, roughness: 0.6, metalness: 0.55 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x9effec, map: screenMap, transparent: true, opacity: 0.84 }),
    glowCyan: new THREE.MeshBasicMaterial({ color: 0x85fff0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowAmber: new THREE.MeshBasicMaterial({ color: 0xffb351, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowWhite: new THREE.MeshBasicMaterial({ color: 0xe0ffff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    molten: new THREE.MeshStandardMaterial({
      color: 0x2f1205,
      emissive: 0xff5a0a,
      emissiveIntensity: 4,
      roughness: 0.25,
      metalness: 0.15,
    }),
    moltenBright: new THREE.MeshBasicMaterial({ color: 0xffd08a }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222a29, emissive: 0xfff0d0, emissiveIntensity: 3.2 }),
    lampCyan: new THREE.MeshStandardMaterial({ color: 0x1a282b, emissive: 0x72f1e6, emissiveIntensity: 2.6 }),
    markCyan: new THREE.MeshBasicMaterial({ color: 0x61efbd, transparent: true, opacity: 0.58, depthWrite: false }),
    markAmber: new THREE.MeshBasicMaterial({ color: 0xd8a642, transparent: true, opacity: 0.62, depthWrite: false }),
    markWhite: new THREE.MeshBasicMaterial({ color: 0xcfe1d9, transparent: true, opacity: 0.22, depthWrite: false }),
    black: new THREE.MeshStandardMaterial({ color: 0x070b0c, roughness: 0.8, metalness: 0.2 }),
  };

  return { mat, concreteMap, hazardMap, screenMap };
}

function addBox(parent, w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, rTop, rBottom, height, segments, material, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments, opts.heightSegments || 1, opts.open || false), material);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.receive !== false;
  parent.add(mesh);
  return mesh;
}

function addTorus(parent, radius, tube, material, x, y, z, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, opts.segments || 24, opts.arc || TAU), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = opts.rx ?? Math.PI / 2;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.cast !== false;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, w, h, material, x, y, z, rx = -Math.PI / 2, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, 0);
  parent.add(mesh);
  return mesh;
}

function addPipe(parent, points, radius, material, segments = 48, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return { mesh, curve };
}

function addLadder(parent, x, y, z, height, material, face = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = face;
  const railGeo = new THREE.BoxGeometry(0.045, height, 0.045);
  const left = new THREE.Mesh(railGeo, material);
  left.position.set(-0.24, height / 2, 0);
  const right = left.clone();
  right.position.x = 0.24;
  group.add(left, right);
  const rungGeo = new THREE.BoxGeometry(0.52, 0.035, 0.035);
  const rungCount = Math.max(4, Math.floor(height / 0.45));
  const rungs = new THREE.InstancedMesh(rungGeo, material, rungCount);
  const temp = new THREE.Object3D();
  for (let i = 0; i < rungCount; i += 1) {
    temp.position.set(0, 0.25 + i * (height / rungCount), 0);
    temp.updateMatrix();
    rungs.setMatrixAt(i, temp.matrix);
  }
  rungs.castShadow = true;
  group.add(rungs);
  // Safety cage hoops, deliberately low-poly.
  for (let i = 1; i < 5; i += 1) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 4, 12, Math.PI), material);
    hoop.rotation.x = Math.PI / 2;
    hoop.rotation.z = Math.PI / 2;
    hoop.position.set(0, (height / 5) * i, 0.18);
    group.add(hoop);
  }
  parent.add(group);
  return group;
}

function addRailing(parent, x, y, z, width, depth, material) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const posts = [];
  const countX = Math.max(2, Math.round(width / 1.6));
  for (let i = 0; i <= countX; i += 1) {
    const px = -width / 2 + (i / countX) * width;
    posts.push([px, -depth / 2], [px, depth / 2]);
  }
  for (let i = 1; i < countX; i += 1) {
    const pz = -depth / 2 + (i / countX) * depth;
    posts.push([-width / 2, pz], [width / 2, pz]);
  }
  const postGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4);
  const inst = new THREE.InstancedMesh(postGeo, material, posts.length);
  const obj = new THREE.Object3D();
  posts.forEach(([px, pz], i) => {
    obj.position.set(px, 0.45, pz);
    obj.updateMatrix();
    inst.setMatrixAt(i, obj.matrix);
  });
  inst.castShadow = true;
  g.add(inst);
  const topGeo = new THREE.BoxGeometry(width, 0.035, 0.035);
  const topBack = new THREE.Mesh(topGeo, material);
  topBack.position.set(0, 0.9, -depth / 2);
  const topFront = topBack.clone();
  topFront.position.z = depth / 2;
  const topSideGeo = new THREE.BoxGeometry(0.035, 0.035, depth);
  const topLeft = new THREE.Mesh(topSideGeo, material);
  topLeft.position.set(-width / 2, 0.9, 0);
  const topRight = topLeft.clone();
  topRight.position.x = width / 2;
  g.add(topBack, topFront, topLeft, topRight);
  const mid = new THREE.Mesh(topGeo, material);
  mid.position.set(0, 0.48, -depth / 2);
  const midFront = mid.clone();
  midFront.position.z = depth / 2;
  g.add(mid, midFront);
  parent.add(g);
  return g;
}

function addStairs(parent, x, y, z, width, rise, run, steps, material, rotateY = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotateY;
  for (let i = 0; i < steps; i += 1) {
    addBox(group, width, 0.055, run, material, 0, i * (rise / steps), (i - steps / 2) * (run / steps) * 0.72, { cast: false });
  }
  const sideGeo = new THREE.BoxGeometry(0.05, Math.hypot(rise, run), Math.hypot(rise, run));
  const sideL = new THREE.Mesh(sideGeo, material);
  sideL.rotation.x = Math.atan2(rise, run);
  sideL.position.set(-width / 2, rise / 2, 0);
  const sideR = sideL.clone();
  sideR.position.x = width / 2;
  group.add(sideL, sideR);
  parent.add(group);
  return group;
}

function createPlume({ x, y, z, height = 12, spread = 4.5, color = [0.6, 0.65, 0.65], count = 320, size = 1, opacity = 0.26 }) {
  const smokeTexture = makeSmokeTexture();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const offsets = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    seeds[i] = Math.random();
    sizes[i] = (1.6 + Math.random() * 2.4) * size;
    speeds[i] = 0.3 + Math.random() * 0.68;
    offsets[i * 2] = (Math.random() - 0.5) * 2;
    offsets[i * 2 + 1] = (Math.random() - 0.5) * 2;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 2));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOrigin: { value: V(x, y, z) },
      uHeight: { value: height },
      uSpread: { value: spread },
      uColor: { value: new THREE.Color(...color) },
      uOpacity: { value: opacity },
      uMap: { value: smokeTexture },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uOrigin;
      uniform float uHeight;
      uniform float uSpread;
      uniform float uPixelRatio;
      uniform vec3 uColor;
      attribute float aSeed;
      attribute float aSize;
      attribute float aSpeed;
      attribute vec2 aOffset;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float progress = fract(aSeed + uTime * 0.018 * aSpeed);
        vec3 pos = uOrigin;
        float curl = sin(progress * 7.0 + aSeed * 22.0 + uTime * 0.17);
        pos.y += progress * uHeight;
        pos.x += aOffset.x * (0.15 + progress * uSpread) + curl * progress * 2.6 + progress * 6.8;
        pos.z += aOffset.y * (0.15 + progress * uSpread * 0.72) + cos(progress * 5.0 + aSeed * 31.0) * progress * 2.4;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = min(118.0, aSize * (1.0 + progress * 1.65) * uPixelRatio * (420.0 / max(8.0, -mvPosition.z)));
        vAlpha = smoothstep(0.0, 0.08, progress) * pow(1.0 - progress, 1.5);
        vColor = mix(vec3(0.92), vec3(1.0), progress) * uColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        float alpha = tex.a * vAlpha * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return {
    points,
    material,
    update(time) {
      material.uniforms.uTime.value = time;
    },
    setColor(rgb) {
      material.uniforms.uColor.value.setRGB(...rgb);
    },
    setOpacity(value) {
      material.uniforms.uOpacity.value = value;
    },
  };
}

function createSparks(parent, origin, count = 150) {
  const texture = makeSparkTexture();
  const positions = new Float32Array(count * 3);
  const velocities = [];
  const life = new Float32Array(count);
  const maxLife = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = origin.y;
    positions[i * 3 + 2] = origin.z;
    velocities.push(V(0, 0, 0));
    life[i] = Math.random();
    maxLife[i] = 0.6 + Math.random() * 1.7;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffb45b,
    size: 0.19,
    map: texture,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  parent.add(points);

  return {
    points,
    update(dt) {
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < count; i += 1) {
        life[i] += dt;
        if (life[i] > maxLife[i]) {
          life[i] = 0;
          maxLife[i] = 0.5 + Math.random() * 1.6;
          pos[i * 3] = origin.x + (Math.random() - 0.5) * 2.2;
          pos[i * 3 + 1] = origin.y + Math.random() * 0.5;
          pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 2.2;
          velocities[i].set((Math.random() - 0.5) * 2.6, 1.2 + Math.random() * 4.2, (Math.random() - 0.5) * 2.6);
        }
        velocities[i].y -= dt * 3.1;
        velocities[i].multiplyScalar(0.992);
        pos[i * 3] += velocities[i].x * dt;
        pos[i * 3 + 1] += velocities[i].y * dt;
        pos[i * 3 + 2] += velocities[i].z * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 0.72 + Math.sin(performance.now() * 0.007) * 0.12;
    },
  };
}

function createDustField(parent, center, count = 360) {
  const texture = makeDustTexture();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    pos[i * 3] = center.x + (Math.random() - 0.5) * 82;
    pos[i * 3 + 1] = 0.5 + Math.random() * 13;
    pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 48;
    sizes[i] = 0.5 + Math.random() * 1.6;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({
    color: 0xbfd4ce,
    size: 0.055,
    map: texture,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, material);
  parent.add(points);
  return {
    points,
    update(time) {
      points.position.y = Math.sin(time * 0.08) * 0.1;
      points.rotation.y = time * 0.004;
      material.opacity = 0.15 + Math.sin(time * 0.25) * 0.03;
    },
  };
}

function createFan(parent, x, y, z, radius, material, rotation = [Math.PI / 2, 0, 0]) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.set(...rotation);
  const hub = addCylinder(group, radius * 0.16, radius * 0.16, radius * 0.3, 10, material, 0, 0, 0, { rx: Math.PI / 2 });
  const blades = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.24, radius * 1.25, 0.035), material);
    blade.position.set(Math.cos((i / 5) * TAU) * radius * 0.38, Math.sin((i / 5) * TAU) * radius * 0.38, 0);
    blade.rotation.z = (i / 5) * TAU + 0.6;
    blade.castShadow = true;
    blades.add(blade);
  }
  blades.userData.dynamic = true;
  group.add(blades);
  parent.add(group);
  return { group, blades, hub };
}

function createStack(parent, options) {
  const {
    x,
    z,
    height,
    radius = 1.05,
    code,
    name,
    cameraName,
    accent = 0x61efbd,
    fov = 45,
  } = options;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.userData.emissionId = options.emissionId;
  parent.add(group);

  const baseY = 0.7;
  addBox(group, 4.4, 0.9, 4.4, materialConcrete, 0, 0.4, 0, { cast: false });
  addBox(group, 3.6, 0.5, 3.6, materialSteelDark, 0, 0.95, 0);

  const stackMat = new THREE.MeshStandardMaterial({ color: 0x697273, roughness: 0.6, metalness: 0.45 });
  const stackDark = new THREE.MeshStandardMaterial({ color: 0x333e41, roughness: 0.56, metalness: 0.6 });
  const body = addCylinder(group, radius * 0.8, radius, height, 22, stackMat, 0, 1.1 + height / 2, 0, { open: true });
  body.castShadow = true;
  // Flue-gas sampling ports and strengthening bands.
  [0.33, 0.55, 0.74, 0.92].forEach((fraction) => {
    addTorus(group, radius * (1 - fraction * 0.17) + 0.05, 0.055, stackDark, 0, 1.1 + height * fraction, 0, { segments: 28 });
  });
  addCylinder(group, radius * 0.84, radius * 0.84, 0.12, 22, stackDark, 0, 1.1 + height + 0.08, 0, { open: true });
  addTorus(group, radius * 0.84, 0.045, stackDark, 0, 1.1 + height + 0.14, 0, { segments: 28 });

  // CEMS platform, ladder and sampling probe.
  const platformY = 1.1 + height * 0.74;
  addCylinder(group, 2.25, 2.25, 0.1, 24, materialSteelDark, 0, platformY, 0);
  addTorus(group, 2.05, 0.028, materialYellow, 0, platformY + 1.0, 0, { segments: 40, rx: Math.PI / 2 });
  const railCount = 16;
  for (let i = 0; i < railCount; i += 1) {
    const a = (i / railCount) * TAU;
    addBox(group, 0.028, 1.0, 0.028, materialYellow, Math.cos(a) * 2.05, platformY + 0.55, Math.sin(a) * 2.05, { cast: false });
  }
  addLadder(group, radius + 0.42, 1.1, 0.15, height * 0.73, materialYellow, 0);
  addBox(group, 0.6, 0.55, 0.38, materialSteel, radius + 0.55, platformY + 0.45, -0.2);
  addBox(group, 0.18, 0.25, 0.92, materialSteelLight, -radius * 0.72, platformY + 0.95, 0, { rz: Math.PI / 2 });
  addBox(group, 0.08, 0.5, 0.08, materialSteelLight, -radius * 0.4, platformY + 0.8, 0);

  // CEMS analyser cabinet at grade.
  const cabinet = addBox(group, 1.3, 1.9, 0.75, materialSteel, -2.2, 1.75, 1.25);
  addBox(group, 0.98, 0.36, 0.02, materialsScreen, -2.2, 2.05, 1.64);
  addBox(group, 0.9, 0.18, 0.04, materialVent, -2.2, 1.55, 1.64);
  cabinet.castShadow = true;

  // Physical CCTV camera mounted on the stack platform.
  const camArm = addBox(group, 0.05, 0.05, 0.9, materialSteel, radius + 0.5, platformY + 1.3, 0.5, { ry: 0.3 });
  const camBody = addBox(group, 0.22, 0.2, 0.42, materialSteelDark, radius + 0.5, platformY + 1.22, 0.9, { ry: 0.3 });
  const lens = addCylinder(group, 0.09, 0.12, 0.1, 10, materialBlack, radius + 0.43, platformY + 1.21, 1.1, { rx: Math.PI / 2 });
  const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), materialsGlowRed);
  camLed.position.set(radius + 0.48, platformY + 1.3, 0.87);
  group.add(camLed);
  camArm.castShadow = false;
  camBody.castShadow = false;
  lens.castShadow = false;

  // Status ring + aviation obstruction light.
  const statusMat = new THREE.MeshStandardMaterial({
    color: 0x173a35,
    emissive: accent,
    emissiveIntensity: 2.4,
    roughness: 0.35,
    metalness: 0.4,
  });
  const statusRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.87, 0.065, 6, 30), statusMat);
  statusRing.position.y = 1.1 + height * 0.975;
  statusRing.rotation.x = Math.PI / 2;
  group.add(statusRing);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), materialsGlowAmber.clone());
  mastLight.position.set(0, 1.1 + height + 0.45, 0);
  group.add(mastLight);
  addCylinder(group, 0.035, 0.035, 0.5, 5, materialSteelDark, 0, 1.1 + height + 0.27, 0);

  // Signage.
  const signTexture = makeSignTexture(code, name.slice(0, 6));
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.9), signMat);
  sign.position.set(radius + 0.1, 5.2, 0.1);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  const top = V(x, 1.1 + height + 0.5, z);
  const plume = createPlume({
    x,
    y: 1.1 + height + 0.2,
    z,
    height: height * 0.57,
    spread: 7.4,
    color: [0.43, 0.46, 0.45],
    count: 320,
    size: 1.0,
    opacity: 0.24,
  });
  parent.add(plume.points);

  return {
    group,
    statusMat,
    statusRing,
    mastLight,
    plume,
    top,
    code,
    cameraName,
    fov,
    height,
  };
}

function addExtractionHood(parent, x, y, z, width = 4, height = 2.8, depth = 4) {
  const hood = new THREE.Group();
  hood.position.set(x, y, z);
  const top = addBox(hood, width, 0.18, depth, materialSteelDark, 0, height, 0);
  const sides = [
    [width, 0.15, 0.18, 0, height - 0.25, -depth / 2],
    [width, 0.15, 0.18, 0, height - 0.25, depth / 2],
    [0.18, height, depth, -width / 2, height / 2, 0],
    [0.18, height, depth, width / 2, height / 2, 0],
  ];
  sides.forEach(([w, h, d, px, py, pz]) => addBox(hood, w, h, d, materialSteelDark, px, py, pz));
  addCylinder(hood, width * 0.38, 0.36, 1.8, 14, materialSteel, 0, height + 0.9, 0, { open: true });
  addTorus(hood, width * 0.37, 0.045, materialSteelLight, 0, height + 1.75, 0);
  // Hazard stripe lip.
  addBox(hood, width + 0.15, 0.13, depth + 0.15, materialHazard, 0, height + 0.02, 0, { cast: false });
  parent.add(hood);
  return hood;
}

let materialConcrete;
let materialSteel;
let materialSteelDark;
let materialSteelLight;
let materialYellow;
let materialHazard;
let materialBlack;
let materialVent;
let materialsScreen;
let materialsGlowRed;
let materialsGlowAmber;
let materialsGlowCyan;
let materialRubber;
let materialGlass;
let materialGlassDark;
let materialSand;
let materialScrap;
let materialOrange;
let materialPaint;

function setupModuleMaterials(mat) {
  materialConcrete = mat.concrete;
  materialSteel = mat.steel;
  materialSteelDark = mat.steelDark;
  materialSteelLight = mat.steelLight;
  materialYellow = mat.yellowPaint;
  materialHazard = mat.hazard;
  materialBlack = mat.black;
  materialVent = mat.vent;
  materialsScreen = mat.screen;
  materialsGlowRed = new THREE.MeshBasicMaterial({ color: 0xff555f });
  materialsGlowAmber = mat.glowAmber;
  materialsGlowCyan = mat.glowCyan;
  materialRubber = mat.rubber;
  materialGlass = mat.glass;
  materialGlassDark = mat.glassDark;
  materialSand = mat.sand;
  materialScrap = mat.scrap;
  materialOrange = mat.orange;
  materialPaint = mat.paintedBlue;
}

export function buildFoundry(scene) {
  const { mat } = createMaterials();
  setupModuleMaterials(mat);

  const root = new THREE.Group();
  root.name = 'BinheFoundryTwin';
  scene.add(root);

  const interactive = [];
  const equipment = new Map();
  const anchors = [];
  const cameraDefs = [];
  const stacks = new Map();
  const plumes = [];
  const updaters = [];
  const statusMaterials = [];
  const flowBeads = [];
  const sparkSystems = [];
  const lightShafts = [];
  let motionEnabled = true;
  let lowPowerMode = false;

  // ------------------------------------------------------------
  // Environment, ground and atmospheric depth
  // ------------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(280, 32, 18);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x03090c) },
      uHorizon: { value: new THREE.Color(0x0c2328) },
      uWarm: { value: new THREE.Color(0x2e291f) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uWarm;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld);
        float h = smoothstep(-0.1, 0.65, dir.y);
        vec3 col = mix(uHorizon, uTop, h);
        float warm = pow(max(0.0, dot(dir, normalize(vec3(0.62, 0.08, -0.78)))), 5.0) * (1.0 - h);
        col += uWarm * warm * 0.7;
        float horizonLine = pow(1.0 - abs(dir.y), 42.0) * 0.012;
        col += vec3(0.18, 0.55, 0.52) * horizonLine;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.fog = new THREE.FogExp2(0x071115, 0.0058);

  const ground = addPlane(root, 300, 220, mat.ground, 0, -0.46, -10);
  ground.receiveShadow = true;

  const apron = addPlane(root, 150, 104, mat.asphalt, 0, -0.32, 0);
  apron.receiveShadow = true;

  const slab = addBox(root, 81, 0.62, 51, mat.concrete, 0, 0.0, 0, { cast: false });
  slab.receiveShadow = true;
  addBox(root, 81.6, 0.18, 51.6, mat.concreteDark, 0, -0.26, 0, { cast: false });

  // Cyan survey grid shader on the slab.
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      float gridLine(vec2 uv, vec2 scale) {
        vec2 coord = uv * scale;
        vec2 derivative = fwidth(coord);
        vec2 grid = abs(fract(coord - 0.5) - 0.5) / max(derivative, vec2(0.001));
        return 1.0 - min(min(grid.x, grid.y), 1.0);
      }
      void main() {
        float g1 = gridLine(vUv, vec2(80.0, 50.0));
        float g2 = gridLine(vUv, vec2(16.0, 10.0));
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        float pulse = smoothstep(0.465, 0.5, vUv.y) * smoothstep(0.535, 0.5, vUv.y);
        float scan = sin((vUv.y + uTime * 0.012) * 160.0) * 0.5 + 0.5;
        vec3 color = vec3(0.23, 0.8, 0.76);
        float alpha = (g1 * 0.055 + g2 * 0.075 + pulse * 0.035) * edge;
        alpha += scan * 0.007 * edge;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const surveyGrid = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), gridMat);
  surveyGrid.rotation.x = -Math.PI / 2;
  surveyGrid.position.y = 0.316;
  root.add(surveyGrid);

  // Floor safety markings and painted walkways.
  const markingGroup = new THREE.Group();
  root.add(markingGroup);
  const lanePositions = [10.5, 17.6];
  lanePositions.forEach((z) => {
    for (let x = -37; x < 38; x += 3.1) {
      addPlane(markingGroup, 1.8, 0.12, mat.markAmber, x, 0.325, z, -Math.PI / 2);
    }
  });
  for (let x = -37; x < 38; x += 4.2) {
    addPlane(markingGroup, 2.5, 0.1, mat.markWhite, x, 0.324, 13.9, -Math.PI / 2);
  }
  // Hazard threshold strips.
  addBox(markingGroup, 15, 0.03, 0.35, mat.hazard, -24.5, 0.33, -2.4, { cast: false });
  addBox(markingGroup, 22, 0.03, 0.32, mat.hazard, 2, 0.33, 9.8, { cast: false });
  addBox(markingGroup, 18, 0.03, 0.32, mat.hazard, 20, 0.33, -1.2, { cast: false });

  const decals = [
    ['熔炼区', 'MELTING BAY', -27.5, -4.4, 8.2, 2.6, '#d6ad58'],
    ['砂处理', 'SAND PREPARATION', -9, -11.9, 7.2, 2.3, '#729f9c'],
    ['造型浇注', 'MOLDING & POURING', 1.5, 8.8, 9.2, 2.6, '#d6ad58'],
    ['清理区', 'CLEANING BAY', 20, 0.9, 7.4, 2.4, '#d6ad58'],
    ['涂装区', 'PAINT SHOP', 29, 7.8, 6.4, 2.1, '#729f9c'],
  ];
  decals.forEach(([cn, en, x, z, w, h, color]) => {
    const texture = makeFloorDecal(cn, en, color);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.74, depthWrite: false, side: THREE.DoubleSide });
    addPlane(markingGroup, w, h, material, x, 0.332, z, -Math.PI / 2);
  });

  // ------------------------------------------------------------
  // Hall shell — an engineered "cutaway" with readable structure.
  // ------------------------------------------------------------
  const structure = new THREE.Group();
  root.add(structure);

  const columnGeo = new THREE.BoxGeometry(0.58, 15.4, 0.58);
  const columnPositions = [];
  for (let x = -38; x <= 38; x += 9.5) {
    columnPositions.push([x, 7.7, -24], [x, 7.7, 24]);
  }
  [-28.5, -19, -9.5, 0, 9.5, 19, 28.5].forEach((x) => columnPositions.push([x, 7.7, -14], [x, 7.7, 14]));
  const columnInstances = new THREE.InstancedMesh(columnGeo, mat.steelDark, columnPositions.length);
  const dummy = new THREE.Object3D();
  columnPositions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    columnInstances.setMatrixAt(i, dummy.matrix);
  });
  columnInstances.castShadow = true;
  columnInstances.receiveShadow = true;
  structure.add(columnInstances);

  // Column base plates.
  const baseGeo = new THREE.BoxGeometry(1.1, 0.24, 1.1);
  const baseInstances = new THREE.InstancedMesh(baseGeo, mat.steel, columnPositions.length);
  columnPositions.forEach(([x, , z], i) => {
    dummy.position.set(x, 0.24, z);
    dummy.updateMatrix();
    baseInstances.setMatrixAt(i, dummy.matrix);
  });
  structure.add(baseInstances);

  // Roof trusses merged into a single draw call.
  const trussGeometries = [];
  const trussXs = [-38, -28.5, -19, -9.5, 0, 9.5, 19, 28.5, 38];
  trussXs.forEach((x) => {
    const addBar = (w, h, d, px, py, pz, rz = 0) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1));
      geo.applyMatrix4(m);
      trussGeometries.push(geo);
    };
    addBar(0.24, 0.34, 49.5, x, 15.0, 0);
    addBar(0.2, 0.26, 49.5, x, 13.3, 0);
    for (let z = -22; z <= 22; z += 4.4) {
      addBar(0.12, 0.14, 2.1, x, 14.15, z, 0.66);
      addBar(0.12, 0.14, 2.1, x, 14.15, z + 2.0, -0.66);
    }
    for (let z = -23.5; z <= 23.5; z += 3.92) {
      addBar(0.14, 0.85, 0.14, x, 14.2, z);
    }
  });
  // Longitudinal beams / crane runway.
  trussGeometries.push(new THREE.BoxGeometry(77, 0.32, 0.28).translate(0, 15.2, -24));
  trussGeometries.push(new THREE.BoxGeometry(77, 0.32, 0.28).translate(0, 15.2, 24));
  const trussMerged = mergeGeometries(trussGeometries);
  const trusses = new THREE.Mesh(trussMerged, mat.steelDark);
  trusses.castShadow = true;
  structure.add(trusses);

  // Back wall and high windows.
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(80, 14), mat.wall);
  backWall.position.set(0, 7.2, -24.6);
  backWall.receiveShadow = true;
  structure.add(backWall);

  const windowMat = new THREE.MeshStandardMaterial({ color: 0x102227, emissive: 0x4f9a9e, emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.3 });
  for (let x = -35; x <= 35; x += 6.8) {
    addBox(structure, 4.2, 1.25, 0.12, windowMat, x, 11.9, -24.55, { cast: false });
    addBox(structure, 4.2, 0.1, 0.18, mat.steelDark, x, 12.56, -24.5, { cast: false });
    addBox(structure, 4.2, 0.1, 0.18, mat.steelDark, x, 11.24, -24.5, { cast: false });
  }
  addBox(structure, 80, 0.45, 0.3, mat.steel, 0, 13.8, -24.4, { cast: false });

  // Side wall fragments frame the cutaway.
  const westWall = new THREE.Mesh(new THREE.PlaneGeometry(30, 13), mat.wall);
  westWall.position.set(-39.8, 6.9, -8);
  westWall.rotation.y = Math.PI / 2;
  westWall.receiveShadow = true;
  structure.add(westWall);
  const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 13), mat.wall);
  eastWall.position.set(39.8, 6.9, -16);
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.receiveShadow = true;
  structure.add(eastWall);

  // The roof is intentionally left as an open digital-twin cutaway. Two
  // narrow high-level light lines keep the truss silhouette readable without
  // covering the plant with a tinted glass plane.
  addBox(structure, 73, 0.045, 0.045, mat.lampCyan, 0, 15.34, -18.5, { cast: false });
  addBox(structure, 73, 0.045, 0.045, mat.lampCyan, 0, 15.34, 18.5, { cast: false });

  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0x8cc5c1,
    transparent: true,
    opacity: 0.014,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  [[-24, 0], [-6, 0], [14, 0], [30, 0]].forEach(([x, z]) => {
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(5.6, 15.5, 24, 1, true), shaftMat);
    shaft.position.set(x, 7.75, z);
    root.add(shaft);
    lightShafts.push(shaft);
  });

  // Industrial signage on the back wall.
  const wallSignTexture = makeCanvasText('绿色铸造 · 智造未来', 'BINHE CASTING WORKS  /  ZERO-EMISSION FOUNDRY', {
    width: 1024,
    height: 220,
    color: '#d9f2ec',
    accent: '#61efbd',
    align: 'center',
    border: true,
  });
  const wallSign = new THREE.Mesh(new THREE.PlaneGeometry(26, 5.6), new THREE.MeshBasicMaterial({ map: wallSignTexture, transparent: true, opacity: 0.65, depthWrite: false }));
  wallSign.position.set(7, 8.0, -24.42);
  root.add(wallSign);

  // Hanging linear luminaires.
  const lampPositions = [
    [-30, 12.5, -11], [-16, 12.5, -4], [-2, 12.5, 1], [12, 12.5, -2], [26, 12.5, 1],
  ];
  lampPositions.forEach(([x, y, z]) => {
    addBox(root, 2.6, 0.08, 0.18, mat.lamp, x, y, z, { cast: false });
    addBox(root, 0.05, 1.8, 0.05, mat.steelDark, x - 0.8, y + 0.9, z, { cast: false });
    addBox(root, 0.05, 1.8, 0.05, mat.steelDark, x + 0.8, y + 0.9, z, { cast: false });
  });

  // Pendant status screens in the aisle.
  [[-1.5, 9.6, 10.4], [12.3, 9.6, 12.2]].forEach(([x, y, z]) => {
    addBox(root, 0.08, 0.08, 1.2, mat.steelDark, x, y + 0.8, z, { cast: false });
    const screen = addBox(root, 2.2, 1.1, 0.08, mat.screen, x, y, z, { cast: false, ry: -0.16 });
    screen.material = mat.screen;
    addBox(root, 2.32, 0.06, 0.12, mat.steel, x, y + 0.58, z, { cast: false });
  });

  // Perimeter fence around the yard.
  const fence = new THREE.Group();
  root.add(fence);
  const fencePosts = [];
  for (let x = -48; x <= 48; x += 4) {
    fencePosts.push([x, 0, 32], [x, 0, -32]);
  }
  for (let z = -28; z <= 28; z += 4) {
    fencePosts.push([-48, 0, z], [48, 0, z]);
  }
  const postGeo = new THREE.BoxGeometry(0.06, 1.75, 0.06);
  const postInst = new THREE.InstancedMesh(postGeo, mat.steelDark, fencePosts.length);
  fencePosts.forEach(([x, , z], i) => {
    dummy.position.set(x, 0.875, z);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);
  });
  fence.add(postInst);
  const fenceLineMaterial = new THREE.LineBasicMaterial({ color: 0x536d6c, transparent: true, opacity: 0.36 });
  const fenceLineGeometry = new THREE.BufferGeometry();
  const fenceVerts = [];
  for (let x = -48; x <= 48; x += 4) {
    fenceVerts.push(x, 1.7, 32, x + 4, 1.7, 32, x, 0.3, 32, x + 4, 0.3, 32);
    fenceVerts.push(x, 1.7, -32, x + 4, 1.7, -32, x, 0.3, -32, x + 4, 0.3, -32);
  }
  for (let z = -28; z <= 28; z += 4) {
    fenceVerts.push(-48, 1.7, z, -48, 1.7, z + 4, -48, 0.3, z, -48, 0.3, z + 4);
    fenceVerts.push(48, 1.7, z, 48, 1.7, z + 4, 48, 0.3, z, 48, 0.3, z + 4);
  }
  fenceLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fenceVerts, 3));
  fence.add(new THREE.LineSegments(fenceLineGeometry, fenceLineMaterial));

  // Low-poly trees / industrial landscaping on the apron.
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x10231f, roughness: 0.95, metalness: 0.02 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x241d15, roughness: 1 });
  const treePositions = [
    [-50, 37], [-43, 39], [-35, 38], [40, 38], [48, 35], [55, 25], [-55, 18], [-52, -14],
  ];
  treePositions.forEach(([x, z], i) => {
    const height = 3.8 + (i % 4) * 1.1;
    addCylinder(root, 0.11, 0.16, height * 0.4, 6, trunkMat, x, height * 0.2, z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4 + (i % 3) * 0.3, height, 7), treeMat);
    crown.position.set(x, height * 0.55, z);
    crown.castShadow = true;
    root.add(crown);
  });

  const dustField = createDustField(root, V(0, 0, 0), 460);
  updaters.push((dt, time) => dustField.update(time));

  // ------------------------------------------------------------
  // Raw material yard
  // ------------------------------------------------------------
  const yard = new THREE.Group();
  yard.position.set(-33, 0, -12);
  root.add(yard);
  addBox(yard, 13, 0.4, 10, mat.concreteDark, 0, 0.2, 0, { cast: false });
  for (let bank = 0; bank < 3; bank += 1) {
    addBox(yard, 0.35, 1.1, 7.2, mat.hazard, -5.6 + bank * 5.1, 0.72, 0, { cast: false });
    for (let i = 0; i < 24; i += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.23, 0), Math.random() > 0.55 ? mat.scrap : mat.rust);
      rock.position.set(-5.1 + bank * 5.1 + (Math.random() - 0.5) * 3.8, 0.48 + Math.random() * 0.9, (Math.random() - 0.5) * 6.4);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.castShadow = true;
      yard.add(rock);
    }
  }
  const yardCrane = new THREE.Group();
  yardCrane.userData.dynamic = true;
  yardCrane.position.set(0, 7.8, -2);
  addBox(yardCrane, 12, 0.3, 0.3, mat.steelDark, 0, 0, 0);
  addBox(yardCrane, 0.25, 7.4, 0.25, mat.steelDark, -5.8, -3.7, 0);
  addBox(yardCrane, 0.25, 7.4, 0.25, mat.steelDark, 5.8, -3.7, 0);
  addBox(yardCrane, 1.2, 0.5, 1.2, mat.steel, 0, -0.2, 0);
  yard.add(yardCrane);
  const magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.34, 16), mat.rust);
  magnet.position.set(0, -4.5, 0);
  yardCrane.add(magnet);
  const magnetCable = addCylinder(yardCrane, 0.025, 0.025, 3.8, 4, mat.steelDark, 0, -2.5, 0);
  updaters.push((dt, time) => {
    yardCrane.position.x = Math.sin(time * 0.12) * 2.8;
    magnet.position.y = -4.5 + Math.sin(time * 0.4) * 0.3;
    magnetCable.position.y = -2.5 + Math.sin(time * 0.4) * 0.15;
    magnet.rotation.y = Math.sin(time * 0.22) * 0.18;
  });

  const mist = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const nozzle = addCylinder(mist, 0.05, 0.08, 1.1, 6, mat.steel, -5.6 + i * 3.2, 2.1, 4.5, { rz: Math.PI / 2 });
    nozzle.rotation.z = Math.PI / 2.25;
  }
  addPipe(mist, [[-6, 1.3, 4.5], [-6, 2.5, 4.5], [6, 2.5, 4.5], [6, 1.3, 4.5]], 0.08, mat.steel);
  yard.add(mist);

  // ------------------------------------------------------------
  // Melting bay
  // ------------------------------------------------------------
  const melting = new THREE.Group();
  root.add(melting);
  addBox(melting, 20, 0.36, 14, mat.concreteDark, -24.2, 0.25, -7.2, { cast: false });
  addBox(melting, 18, 0.14, 0.22, mat.hazard, -24.4, 0.47, -0.35, { cast: false });

  function buildFurnace(x, z, id, number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.userData.equipmentId = id;
    root.add(g);

    addBox(g, 6.8, 0.7, 6.8, mat.concreteDark, 0, 0.35, 0, { cast: false });
    addBox(g, 5.6, 0.55, 5.6, mat.steelDark, 0, 0.95, 0);
    // Trunnion frame and hydraulic tilting arms.
    [-2.35, 2.35].forEach((sx) => {
      addBox(g, 0.55, 2.0, 0.8, mat.paintedBlue, sx, 1.8, 0);
      addCylinder(g, 0.34, 0.34, 0.9, 12, mat.copper, sx, 2.85, 0, { rz: Math.PI / 2 });
    });
    addBox(g, 4.6, 0.42, 1.2, mat.steelDark, 0, 1.1, 2.45);
    addBox(g, 0.34, 3.0, 0.34, mat.orange, 2.45, 2.4, 2.0, { rz: -0.3 });

    // Furnace shell + refractory lip.
    const shell = addCylinder(g, 2.15, 2.45, 4.55, 26, mat.steelDark, 0, 3.6, 0);
    shell.castShadow = true;
    const shellBand = addCylinder(g, 2.25, 2.25, 0.4, 26, mat.paintedTeal, 0, 4.25, 0);
    addTorus(g, 2.23, 0.07, mat.copper, 0, 3.0, 0, { segments: 30 });
    addTorus(g, 2.17, 0.06, mat.copper, 0, 4.55, 0, { segments: 30 });

    // Induction coil rings.
    for (let i = 0; i < 5; i += 1) {
      addTorus(g, 2.36 - i * 0.02, 0.055, mat.copper, 0, 2.0 + i * 0.54, 0, { segments: 30 });
    }

    // Molten bath and lip glow.
    addCylinder(g, 1.85, 1.85, 0.22, 24, mat.molten, 0, 5.92, 0, { cast: false });
    addTorus(g, 1.92, 0.09, mat.moltenBright, 0, 5.98, 0, { segments: 32, cast: false });
    const furnaceGlow = new THREE.PointLight(0xff6a1f, 24, 17, 2);
    furnaceGlow.position.set(0, 6.2, 0);
    g.add(furnaceGlow);
    const glowSpriteMat = new THREE.SpriteMaterial({ map: makeGlowTexture('#ff7a28'), color: 0xff8b3d, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowSprite = new THREE.Sprite(glowSpriteMat);
    glowSprite.scale.set(4.8, 3.2, 1);
    glowSprite.position.set(0, 6.1, 0);
    g.add(glowSprite);

    // Hood and exhaust duct.
    addExtractionHood(g, 0, 6.6, 0, 5, 2.4, 5);
    addPipe(g, [[0, 9.7, 0], [0, 11.4, 0], [0, 11.4, -7], [0, 11.4, -12]], 0.46, mat.steelLight, 24, 8);
    addCylinder(g, 0.55, 0.55, 0.2, 14, mat.steel, 0, 11.4, -4, { rx: Math.PI / 2 });

    // Equipment deck and operator cabinet.
    addBox(g, 2.1, 2.8, 1.2, mat.paintedBlue, 3.25, 2.4, 2.2);
    addBox(g, 1.65, 0.07, 0.8, mat.screen, 3.25, 3.35, 2.82, { rx: -0.08, cast: false });
    addBox(g, 0.5, 0.25, 0.5, mat.steel, 3.25, 3.9, 2.2);
    addStairs(g, 4.1, 0.4, -2.2, 1.0, 2.8, 2.2, 9, mat.steel, -Math.PI / 2);
    addRailing(g, 0, 4.2, -2.9, 4, 1.2, mat.yellow);
    addLadder(g, 2.85, 0.6, 0.4, 4.3, mat.yellow, 0);

    // Status beacon visible at a distance.
    const statusMaterial = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.32, metalness: 0.4 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), statusMaterial);
    beacon.position.set(3.25, 4.15, 2.2);
    g.add(beacon);
    const statusHalo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 6, 24), statusMaterial);
    statusHalo.position.copy(beacon.position);
    statusHalo.rotation.x = Math.PI / 2;
    g.add(statusHalo);

    const sparkOrigin = V(x, 6.4, z);
    const sparks = createSparks(root, sparkOrigin, 150);
    sparkSystems.push(sparks.points);
    updaters.push((dt) => sparks.update(dt));

    const worldAnchor = V(x, 8.1, z);
    equipment.set(id, {
      id,
      group: g,
      focus: V(x, 3.6, z),
      anchor: worldAnchor,
      statusMaterial,
      beacon,
      statusHalo,
      height: 7,
      cameraDistance: 15,
    });
    interactive.push(g);
    statusMaterials.push({ material: statusMaterial, mesh: beacon, halo: statusHalo });
    return g;
  }

  buildFurnace(-27.3, -7.6, 'FUR-01', 1);
  buildFurnace(-20.5, -7.6, 'FUR-02', 2);

  // Shared exhaust manifold toward stack 1.
  addPipe(melting, [[-20.5, 11.4, -19.6], [-20.5, 11.4, -23.5], [-27.3, 11.4, -23.5]], 0.5, mat.steelLight, 30, 8);
  addPipe(melting, [[-27.3, 11.4, -19.6], [-27.3, 11.4, -23.5], [-33.4, 11.4, -23.5]], 0.62, mat.steelLight, 26, 8);

  // Maintenance tools and material bins.
  addBox(melting, 2.4, 1.3, 1.2, mat.steel, -12.8, 0.9, -11.6);
  addBox(melting, 0.7, 0.7, 0.7, mat.yellow, -14.4, 0.65, -10.6, { ry: 0.3 });

  // ------------------------------------------------------------
  // Sand preparation / silos
  // ------------------------------------------------------------
  const sandBay = new THREE.Group();
  root.add(sandBay);
  addBox(sandBay, 17, 0.3, 12, mat.concreteDark, -5.8, 0.22, -15.2, { cast: false });

  const siloPositions = [[-13.1, -17.2], [-8.6, -17.2], [-4.1, -17.2]];
  siloPositions.forEach(([x, z], index) => {
    const silo = new THREE.Group();
    silo.position.set(x, 0, z);
    addCylinder(silo, 1.9, 1.9, 6.4, 20, index === 1 ? mat.paintedTeal : mat.steel, 0, 5.4, 0, { open: false });
    addCylinder(silo, 1.9, 0.32, 2.5, 20, mat.steelDark, 0, 0.95, 0);
    addCylinder(silo, 0.36, 0.36, 2.2, 10, mat.steel, 0, 8.8, 0);
    addTorus(silo, 1.93, 0.055, mat.steelDark, 0, 4.9, 0, { segments: 30 });
    addTorus(silo, 1.93, 0.055, mat.steelDark, 0, 7.1, 0, { segments: 30 });
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU + Math.PI / 4;
      addBox(silo, 0.12, 2.8, 0.12, mat.steelDark, Math.cos(a) * 1.4, 0.8, Math.sin(a) * 1.4);
    }
    addLadder(silo, 1.9, 1.2, 0.15, 7.4, mat.yellow, 0);
    // Silo level indicator.
    addBox(silo, 0.05, 1.2, 0.05, mat.markCyan, 1.35, 6.3, 1.1, { cast: false });
    sandBay.add(silo);
  });
  // Catwalk connecting the silos.
  addBox(sandBay, 10.2, 0.12, 1.3, mat.steelDark, -8.6, 8.15, -15.7);
  addRailing(sandBay, -8.6, 8.2, -15.7, 10.2, 1.3, mat.yellow);

  const mixerGroup = new THREE.Group();
  mixerGroup.position.set(-7.5, 0, -13.5);
  mixerGroup.userData.equipmentId = 'MIX-01';
  root.add(mixerGroup);
  addBox(mixerGroup, 6.2, 0.5, 4.2, mat.steelDark, 0, 0.35, 0, { cast: false });
  addBox(mixerGroup, 4.8, 1.4, 2.4, mat.paintedTeal, 0, 1.2, 0);
  addCylinder(mixerGroup, 1.0, 1.0, 3.6, 14, mat.steel, 1.7, 2.35, 0, { rz: Math.PI / 2 });
  addCylinder(mixerGroup, 0.38, 0.38, 1.2, 10, mat.orange, 3.4, 2.35, 0, { rz: Math.PI / 2 });
  addBox(mixerGroup, 1.8, 1.5, 1.8, mat.steel, -1.3, 3.0, 0);
  addCylinder(mixerGroup, 0.9, 0.3, 1.5, 8, mat.steelDark, -1.3, 4.2, 0);
  addPipe(mixerGroup, [[-1.3, 4.0, 0], [-1.3, 7.7, 0], [-5.6, 7.7, -2.8], [-5.6, 8.2, -3.5]], 0.33, mat.steelLight, 22, 6);
  addBox(mixerGroup, 1.1, 1.6, 0.55, mat.paintedBlue, 2.6, 1.2, 2.0);
  addBox(mixerGroup, 0.72, 0.08, 0.05, mat.screen, 2.6, 1.45, 2.29, { rx: 0, cast: false });
  const mixerStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const mixerBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), mixerStatus);
  mixerBeacon.position.set(2.6, 2.15, 2.0);
  mixerGroup.add(mixerBeacon);
  equipment.set('MIX-01', { id: 'MIX-01', group: mixerGroup, focus: V(-7.5, 2, -13.5), anchor: V(-7.5, 5, -13.5), statusMaterial: mixerStatus, beacon: mixerBeacon, statusHalo: null, height: 4, cameraDistance: 13 });
  interactive.push(mixerGroup);
  statusMaterials.push({ material: mixerStatus, mesh: mixerBeacon, halo: null });

  // Green-sand conveyor from mixer toward molding line.
  addPipe(sandBay, [[-4.8, 1.2, -12.4], [-4.8, 1.2, -9.6], [0.3, 1.2, -9.6], [0.3, 1.2, -4]], 0.3, mat.steelLight, 24, 6);

  // ------------------------------------------------------------
  // Molding line
  // ------------------------------------------------------------
  const molding = new THREE.Group();
  molding.userData.equipmentId = 'MOLD-01';
  root.add(molding);
  addBox(molding, 26, 0.28, 6, mat.concreteDark, 2.6, 0.2, 6, { cast: false });
  addBox(molding, 24.8, 0.32, 4.4, mat.steelDark, 2.6, 0.66, 6);
  // Conveyor side frames and legs.
  [-1.0, 1.0].forEach((zOff) => {
    addBox(molding, 24.8, 0.35, 0.18, mat.steel, 2.6, 0.82, 6 + zOff * 1.75);
    for (let x = -8.5; x <= 14; x += 3.2) {
      addBox(molding, 0.14, 0.65, 0.14, mat.steelDark, x, 0.45, 6 + zOff * 1.6);
    }
  });
  const rollerGeo = new THREE.CylinderGeometry(0.075, 0.075, 3.3, 6);
  const rollers = new THREE.InstancedMesh(rollerGeo, mat.steelLight, 38);
  for (let i = 0; i < 38; i += 1) {
    dummy.position.set(-9.0 + i * 0.63, 0.87, 6);
    dummy.rotation.set(0, 0, Math.PI / 2);
    dummy.updateMatrix();
    rollers.setMatrixAt(i, dummy.matrix);
  }
  rollers.castShadow = true;
  molding.add(rollers);

  const moldGeo = new THREE.BoxGeometry(0.95, 0.52, 2.2);
  const moldMat = new THREE.MeshStandardMaterial({ color: 0x3b3b30, roughness: 0.95, metalness: 0.06 });
  const molds = new THREE.InstancedMesh(moldGeo, moldMat, 18);
  molds.castShadow = true;
  molds.receiveShadow = true;
  molding.add(molds);
  const moldPositions = [];
  for (let i = 0; i < 18; i += 1) moldPositions.push(-9.4 + i * 1.25);
  const moldMatrix = new THREE.Object3D();
  const updateMolds = (time) => {
    for (let i = 0; i < 18; i += 1) {
      const span = 22.5;
      const x = ((moldPositions[i] + time * 0.46 + 9.4) % span) - 9.4;
      moldMatrix.position.set(x, 1.12, 6 + (i % 2 === 0 ? -0.1 : 0.22));
      moldMatrix.rotation.y = Math.sin(time * 0.2 + i) * 0.006;
      moldMatrix.updateMatrix();
      molds.setMatrixAt(i, moldMatrix.matrix);
    }
    molds.instanceMatrix.needsUpdate = true;
  };
  updaters.push((dt, time) => updateMolds(time));
  updateMolds(0);

  // Molding machine / sand hopper.
  addBox(molding, 4.8, 4.6, 4.4, mat.paintedTeal, 3.4, 3.0, 6);
  addBox(molding, 3.9, 0.5, 3.6, mat.steelDark, 3.4, 5.5, 6);
  addBox(molding, 2.9, 2.0, 2.8, mat.steel, 3.4, 6.8, 6);
  addCylinder(molding, 1.5, 0.45, 2.4, 10, mat.steelDark, 3.4, 9.0, 6);
  addBox(molding, 1.5, 0.35, 1.4, mat.orange, 3.4, 5.9, 6);
  addBox(molding, 0.25, 0.7, 0.25, mat.orange, 1.1, 4.8, 4.3);
  addBox(molding, 0.25, 0.7, 0.25, mat.orange, 5.7, 4.8, 4.3);
  addBox(molding, 0.85, 1.65, 0.35, mat.paintedBlue, 6.4, 1.6, 8.3);
  addBox(molding, 0.58, 0.1, 0.02, mat.screen, 6.4, 1.85, 8.49, { cast: false });
  addBox(molding, 0.6, 0.6, 0.6, mat.yellow, -8.3, 1.2, 3.7);
  const moldStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const moldBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), moldStatus);
  moldBeacon.position.set(6.4, 2.5, 8.3);
  molding.add(moldBeacon);
  equipment.set('MOLD-01', { id: 'MOLD-01', group: molding, focus: V(2.6, 2, 6), anchor: V(2.6, 10.4, 6), statusMaterial: moldStatus, beacon: moldBeacon, statusHalo: null, height: 10, cameraDistance: 18 });
  interactive.push(molding);
  statusMaterials.push({ material: moldStatus, mesh: moldBeacon, halo: null });

  // ------------------------------------------------------------
  // Pouring monorail and ladle
  // ------------------------------------------------------------
  const pouring = new THREE.Group();
  pouring.position.set(-8, 0, 6);
  pouring.userData.equipmentId = 'POUR-01';
  root.add(pouring);
  addBox(pouring, 0.45, 8.7, 0.45, mat.steelDark, -1.6, 4.35, -2.1);
  addBox(pouring, 0.45, 8.7, 0.45, mat.steelDark, 9.6, 4.35, -2.1);
  addBox(pouring, 12.2, 0.38, 0.34, mat.steelDark, 4.0, 8.6, -2.1);
  addBox(pouring, 12.2, 0.18, 0.2, mat.steel, 4.0, 8.35, -2.1);
  addBox(pouring, 0.4, 0.4, 4.2, mat.steelDark, -8.25, 8.65, 0);
  addBox(pouring, 0.4, 0.4, 4.2, mat.steelDark, 15.0, 8.65, 0);
  const trolley = new THREE.Group();
  trolley.userData.dynamic = true;
  trolley.position.set(0, 8.1, 0);
  addBox(trolley, 1.8, 0.6, 1.1, mat.paintedBlue, 0, 0, 0);
  addBox(trolley, 1.0, 0.45, 0.7, mat.steel, 0, 0.45, 0);
  addCylinder(trolley, 0.03, 0.03, 2.0, 4, mat.steelDark, 0, -1.0, 0);
  const ladleSwing = new THREE.Group();
  ladleSwing.position.set(0, -2.1, 0);
  addCylinder(ladleSwing, 1.35, 1.05, 1.25, 18, mat.steelDark, 0, 0, 0, { open: true });
  addCylinder(ladleSwing, 1.25, 1.25, 0.13, 18, mat.molten, 0, 0.43, 0, { cast: false });
  addTorus(ladleSwing, 1.31, 0.07, mat.steel, 0, 0.62, 0, { segments: 24 });
  addBox(ladleSwing, 2.8, 0.12, 0.16, mat.orange, 0, 0.4, 1.22, { ry: 0 });
  addBox(ladleSwing, 0.15, 0.3, 1.1, mat.orange, 1.2, 0.42, 1.0);
  addBox(ladleSwing, 0.15, 0.3, 1.1, mat.orange, -1.2, 0.42, 1.0);
  trolley.add(ladleSwing);
  pouring.add(trolley);
  const pourGlow = new THREE.PointLight(0xff7b2f, 26, 10, 2);
  pourGlow.position.set(0, 5.3, 0);
  pouring.add(pourGlow);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 2.2, 8, 1, true), mat.moltenBright);
  stream.position.set(0, 4.7, 0);
  stream.visible = false;
  stream.userData.noMerge = true;
  pouring.add(stream);
  const pourableGlow = new THREE.SpriteMaterial({ map: makeGlowTexture('#ff9a43'), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const pourSprite = new THREE.Sprite(pourableGlow);
  pourSprite.scale.set(3.4, 2.8, 1);
  pourSprite.position.set(0, 4.9, 0);
  pouring.add(pourSprite);
  updaters.push((dt, time) => {
    const cycle = (time * 0.11) % 1;
    const x = Math.sin(cycle * TAU) * 5.7;
    trolley.position.x = x;
    trolley.position.y = 8.1 + Math.sin(time * 0.7) * 0.035;
    ladleSwing.rotation.z = Math.sin(cycle * TAU + 0.8) * 0.08;
    ladleSwing.rotation.x = Math.sin(cycle * TAU) * 0.05;
    stream.visible = Math.abs(x + 3.2) < 1.8;
    stream.position.x = x;
    stream.position.z = 0;
    stream.scale.y = 0.75 + Math.random() * 0.16;
    pourSprite.position.x = x;
    pourSprite.material.opacity = 0.24 + Math.sin(time * 3.1) * 0.06;
    pourGlow.intensity = 22 + Math.sin(time * 2.4) * 6;
  });
  const pourStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const pourBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), pourStatus);
  pourBeacon.position.set(-1.6, 9.0, -1.6);
  pouring.add(pourBeacon);
  equipment.set('POUR-01', { id: 'POUR-01', group: pouring, focus: V(-8, 5.5, 6), anchor: V(-8, 9.5, 6), statusMaterial: pourStatus, beacon: pourBeacon, statusHalo: null, height: 8, cameraDistance: 15 });
  interactive.push(pouring);
  statusMaterials.push({ material: pourStatus, mesh: pourBeacon, halo: null });

  // ------------------------------------------------------------
  // Cleaning bay: shakeout, shot blast, gantry crane
  // ------------------------------------------------------------
  const cleaning = new THREE.Group();
  root.add(cleaning);
  addBox(cleaning, 21, 0.28, 15, mat.concreteDark, 16.6, 0.22, -5, { cast: false });
  addBox(cleaning, 19.2, 0.13, 0.22, mat.hazard, 16.4, 0.48, 1.2, { cast: false });

  const shakeout = new THREE.Group();
  shakeout.position.set(11.5, 0, -4.8);
  shakeout.userData.equipmentId = 'SHAKE-01';
  root.add(shakeout);
  addBox(shakeout, 5.2, 0.8, 4.4, mat.steelDark, 0, 0.45, 0, { cast: false });
  addBox(shakeout, 4.8, 1.6, 3.8, mat.paintedTeal, 0, 1.5, 0);
  addBox(shakeout, 3.8, 0.22, 2.9, mat.steelDark, 0, 2.4, 0);
  for (let i = 0; i < 7; i += 1) addBox(shakeout, 3.2, 0.06, 0.06, mat.steelLight, 0, 2.52, -1.2 + i * 0.4, { cast: false });
  addBox(shakeout, 1.8, 1.4, 0.8, mat.steel, 2.9, 1.0, -1.0);
  addExtractionHood(shakeout, 0, 2.6, 0, 4.2, 2.2, 3.4);
  addPipe(shakeout, [[0, 5.0, 0], [0, 7.4, 0], [-2.6, 7.4, -4.6], [-2.6, 7.4, -9.2]], 0.4, mat.steelLight, 24, 7);
  const shakeStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const shakeBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), shakeStatus);
  shakeBeacon.position.set(2.9, 2.1, -1.0);
  shakeout.add(shakeBeacon);
  const shakeRumble = new THREE.Group();
  equipment.set('SHAKE-01', { id: 'SHAKE-01', group: shakeout, focus: V(11.5, 2, -4.8), anchor: V(11.5, 5.8, -4.8), statusMaterial: shakeStatus, beacon: shakeBeacon, statusHalo: null, height: 5, cameraDistance: 12 });
  interactive.push(shakeout);
  statusMaterials.push({ material: shakeStatus, mesh: shakeBeacon, halo: null });

  const shot = new THREE.Group();
  shot.position.set(18.4, 0, -5.2);
  shot.userData.equipmentId = 'SHOT-01';
  root.add(shot);
  addBox(shot, 6.1, 5.4, 5.4, mat.steelDark, 0, 3.05, 0);
  addBox(shot, 5.4, 0.32, 4.7, mat.steel, 0, 5.9, 0);
  addBox(shot, 2.2, 3.5, 0.12, mat.paintedTeal, -1.4, 2.3, 2.73);
  addBox(shot, 2.2, 3.5, 0.12, mat.paintedTeal, 1.4, 2.3, 2.73);
  addBox(shot, 0.5, 0.5, 0.5, mat.steelLight, 0, 2.25, 2.8);
  addTorus(shot, 0.24, 0.035, mat.steel, 0, 2.25, 2.98, { rx: 0, segments: 24 });
  // Bolt lines and hopper.
  for (let i = 0; i < 10; i += 1) {
    addCylinder(shot, 0.04, 0.04, 0.06, 6, mat.steelLight, -2.8 + i * 0.62, 5.3, 2.74, { rx: Math.PI / 2, cast: false });
  }
  addCylinder(shot, 1.7, 0.55, 2.2, 8, mat.steelDark, 0, 0.75, 0);
  addPipe(shot, [[0, 5.7, 0], [0, 8.1, 0], [3.2, 8.1, 0], [3.2, 8.1, 2.6]], 0.45, mat.steelLight, 24, 7);
  addBox(shot, 1.3, 1.8, 0.8, mat.paintedBlue, 3.5, 1.3, 2.2);
  addBox(shot, 0.84, 0.08, 0.02, mat.screen, 3.5, 1.55, 2.61, { cast: false });
  addLadder(shot, 3.0, 0.3, -2.2, 5.6, mat.yellow, 0);
  const shotStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const shotBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), shotStatus);
  shotBeacon.position.set(3.5, 2.45, 2.2);
  shot.add(shotBeacon);
  equipment.set('SHOT-01', { id: 'SHOT-01', group: shot, focus: V(18.4, 3, -5.2), anchor: V(18.4, 7.6, -5.2), statusMaterial: shotStatus, beacon: shotBeacon, statusHalo: null, height: 8, cameraDistance: 13 });
  interactive.push(shot);
  statusMaterials.push({ material: shotStatus, mesh: shotBeacon, halo: null });

  // Two overhead cranes, one in the cleaning bay.
  const crane = new THREE.Group();
  crane.userData.equipmentId = 'CRANE-01';
  root.add(crane);
  // Runway rails.
  addBox(root, 71, 0.24, 0.32, mat.steel, 0, 11.25, -1.5, { cast: false });
  addBox(root, 71, 0.24, 0.32, mat.steel, 0, 11.25, 12.6, { cast: false });
  for (let x = -34; x <= 34; x += 8) {
    addBox(root, 0.2, 0.85, 0.2, mat.steelDark, x, 10.85, -1.5, { cast: false });
    addBox(root, 0.2, 0.85, 0.2, mat.steelDark, x, 10.85, 12.6, { cast: false });
  }
  const bridge = new THREE.Group();
  bridge.userData.dynamic = true;
  bridge.position.set(10, 11.85, 5.5);
  addBox(bridge, 0.48, 0.55, 15.3, mat.yellowPaint, 0, 0, 0);
  addBox(bridge, 0.7, 0.18, 15.3, mat.steelDark, 0, 0.36, 0);
  addBox(bridge, 0.8, 0.9, 1.3, mat.paintedBlue, 0, 0.7, -1.5);
  const hookTrolley = new THREE.Group();
  hookTrolley.position.set(0, -0.2, 0.8);
  addBox(hookTrolley, 0.9, 0.45, 0.9, mat.steelDark, 0, 0, 0);
  addCylinder(hookTrolley, 0.025, 0.025, 4.2, 4, mat.steelLight, 0, -2.1, 0);
  const hook = new THREE.Group();
  hook.position.set(0, -4.35, 0);
  addBox(hook, 0.62, 0.35, 0.26, mat.orange, 0, 0, 0);
  addTorus(hook, 0.2, 0.05, mat.steel, 0, -0.25, 0, { rx: 0, segments: 16 });
  hookTrolley.add(hook);
  bridge.add(hookTrolley);
  crane.add(bridge);
  const craneStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.0, roughness: 0.3, metalness: 0.4 });
  const craneBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), craneStatus);
  craneBeacon.position.set(10, 12.8, 11.8);
  crane.add(craneBeacon);
  scene.userData.crane = bridge;
  updaters.push((dt, time) => {
    bridge.position.x = 9.5 + Math.sin(time * 0.075) * 6.2;
    hookTrolley.position.z = 0.8 + Math.sin(time * 0.13 + 1.4) * 3.0;
    hook.rotation.z = Math.sin(time * 0.45) * 0.045;
  });
  equipment.set('CRANE-01', { id: 'CRANE-01', group: crane, focus: V(10, 9, 5.5), anchor: V(10, 13.2, 5.5), statusMaterial: craneStatus, beacon: craneBeacon, statusHalo: null, height: 13, cameraDistance: 20 });
  interactive.push(crane);
  statusMaterials.push({ material: craneStatus, mesh: craneBeacon, halo: null });

  // ------------------------------------------------------------
  // Paint / drying booth and RTO
  // ------------------------------------------------------------
  const paint = new THREE.Group();
  paint.position.set(28.2, 0, 1.8);
  paint.userData.equipmentId = 'PAINT-01';
  root.add(paint);
  addBox(paint, 11, 0.32, 8.2, mat.concreteDark, 0, 0.22, 0, { cast: false });
  addBox(paint, 8.2, 0.6, 6.2, mat.steelDark, 0, 0.55, 0);
  addBox(paint, 8.0, 4.8, 6.0, materialGlassDark, 0, 3.15, 0, { cast: false });
  // Booth frame.
  [[-4.1, -3.1], [4.1, -3.1], [-4.1, 3.1], [4.1, 3.1]].forEach(([x, z]) => addBox(paint, 0.16, 5.1, 0.16, mat.steelDark, x, 3.1, z));
  addBox(paint, 8.3, 0.18, 0.16, mat.steelDark, 0, 5.55, -3.1);
  addBox(paint, 8.3, 0.18, 0.16, mat.steelDark, 0, 5.55, 3.1);
  addBox(paint, 0.16, 0.18, 6.3, mat.steelDark, -4.1, 5.55, 0);
  addBox(paint, 0.16, 0.18, 6.3, mat.steelDark, 4.1, 5.55, 0);
  // Interior booth light and conveyor.
  const boothLight = new THREE.PointLight(0xd7f4ff, 22, 12, 2);
  boothLight.position.set(0, 4.6, 0);
  paint.add(boothLight);
  addBox(paint, 7.2, 0.08, 0.32, mat.lampCyan, 0, 5.36, 0, { cast: false });
  addBox(paint, 0.45, 0.58, 5.8, mat.steelDark, 0, 1.2, 0);
  for (let i = 0; i < 4; i += 1) {
    addBox(paint, 0.8, 0.7, 0.6, mat.scrap, -2.4 + i * 1.6, 1.9, 0);
    addBox(paint, 0.9, 0.08, 0.7, mat.steelDark, -2.4 + i * 1.6, 2.28, 0);
  }
  addBox(paint, 3.0, 3.1, 2.2, mat.paintedBlue, 7.2, 2.0, -1.8);
  addBox(paint, 2.1, 0.1, 0.08, mat.screen, 7.2, 2.6, -0.67, { cast: false, rx: 0 });
  addExtractionHood(paint, 0, 5.6, 0, 7.8, 1.7, 5.6);
  addPipe(paint, [[0, 7.8, 0], [0, 9.2, 0], [4.2, 9.2, -3.4], [4.2, 9.2, -9.8]], 0.5, mat.steelLight, 30, 8);
  addBox(paint, 1.8, 2.5, 0.7, mat.paintedBlue, -5.2, 1.7, 2.4);
  addBox(paint, 1.35, 0.08, 0.02, mat.screen, -5.2, 2.05, 2.78, { cast: false });
  const paintStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const paintBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), paintStatus);
  paintBeacon.position.set(-5.2, 3.1, 2.4);
  paint.add(paintBeacon);
  equipment.set('PAINT-01', { id: 'PAINT-01', group: paint, focus: V(28.2, 3, 1.8), anchor: V(28.2, 7.6, 1.8), statusMaterial: paintStatus, beacon: paintBeacon, statusHalo: null, height: 8, cameraDistance: 15 });
  interactive.push(paint);
  statusMaterials.push({ material: paintStatus, mesh: paintBeacon, halo: null });

  const rto = new THREE.Group();
  rto.position.set(32.8, 0, -3.9);
  rto.userData.equipmentId = 'VOC-01';
  root.add(rto);
  addBox(rto, 6.0, 0.4, 5.4, mat.concreteDark, 0, 0.2, 0, { cast: false });
  addBox(rto, 4.2, 4.8, 3.5, mat.steelDark, 0, 2.9, 0);
  addBox(rto, 4.6, 0.35, 3.8, mat.paintedTeal, 0, 5.5, 0);
  addCylinder(rto, 1.1, 1.1, 3.6, 16, mat.steelLight, -1.0, 2.9, 2.1, { rx: Math.PI / 2 });
  addCylinder(rto, 0.8, 0.8, 1.1, 14, mat.orange, 1.9, 3.7, 2.4, { rx: Math.PI / 2 });
  addPipe(rto, [[0, 5.5, 0], [0, 7.4, 0], [0, 7.4, -8.8], [0, 8.2, -13.7]], 0.55, mat.steelLight, 26, 8);
  addBox(rto, 1.3, 1.7, 0.65, mat.paintedBlue, 3.0, 1.2, 2.3);
  addBox(rto, 0.88, 0.07, 0.02, mat.screen, 3.0, 1.45, 2.66, { cast: false });
  addLadder(rto, 2.3, 0.6, -1.0, 4.7, mat.yellow, 0);
  const rtoStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const rtoBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), rtoStatus);
  rtoBeacon.position.set(3.0, 2.2, 2.3);
  rto.add(rtoBeacon);
  equipment.set('VOC-01', { id: 'VOC-01', group: rto, focus: V(32.8, 3, -3.9), anchor: V(32.8, 6.8, -3.9), statusMaterial: rtoStatus, beacon: rtoBeacon, statusHalo: null, height: 7, cameraDistance: 14 });
  interactive.push(rto);
  statusMaterials.push({ material: rtoStatus, mesh: rtoBeacon, halo: null });

  // ------------------------------------------------------------
  // Dust collectors and utility island
  // ------------------------------------------------------------
  function buildDustCollector(x, z, id, name, colorMat = mat.paintedTeal) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.userData.equipmentId = id;
    root.add(g);
    addBox(g, 5.4, 0.32, 4.6, mat.concreteDark, 0, 0.16, 0, { cast: false });
    // Main filter housing.
    addBox(g, 4.4, 6.0, 3.2, colorMat, 0, 4.1, 0);
    addBox(g, 4.7, 0.32, 3.5, mat.steelDark, 0, 7.3, 0);
    // Hoppers.
    addCylinder(g, 1.8, 0.45, 2.1, 4, mat.steelDark, -0.9, 0.9, 0, { ry: Math.PI / 4 });
    addCylinder(g, 1.8, 0.45, 2.1, 4, mat.steelDark, 1.4, 0.9, 0, { ry: Math.PI / 4 });
    // Support legs.
    [[-1.9, -1.3], [1.9, -1.3], [-1.9, 1.3], [1.9, 1.3]].forEach(([sx, sz]) => addBox(g, 0.18, 1.6, 0.18, mat.steelDark, sx, 0.95, sz));
    // Pulse valve manifold and access ladder.
    addCylinder(g, 0.11, 0.11, 4.5, 8, mat.steelLight, 1.0, 7.55, 1.35, { rz: Math.PI / 2 });
    for (let i = 0; i < 5; i += 1) addCylinder(g, 0.16, 0.16, 0.25, 8, mat.orange, -1.8 + i * 0.9, 7.55, 1.35);
    addLadder(g, 2.6, 0.4, -0.9, 6.9, mat.yellow, 0);
    // Fan with rotating blades.
    const housing = addCylinder(g, 1.05, 1.05, 0.9, 16, mat.steel, 3.3, 3.0, 0, { rz: Math.PI / 2 });
    const fan = createFan(g, 3.28, 3.0, 0, 0.86, mat.steelDark, [0, 0, Math.PI / 2]);
    // Inlet duct.
    addPipe(g, [[-2.2, 4.2, 0], [-3.7, 4.2, 0], [-3.7, 2.0, 0], [-2.7, 2.0, 0]], 0.45, mat.steelLight, 24, 7);
    const statusMaterial = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), statusMaterial);
    beacon.position.set(-1.9, 7.6, 1.5);
    g.add(beacon);
    updaters.push((dt, time) => {
      fan.blades.rotation.z = time * 2.8;
    });
    equipment.set(id, { id, group: g, focus: V(x, 4, z), anchor: V(x, 8.4, z), statusMaterial, beacon, statusHalo: null, height: 8, cameraDistance: 13 });
    interactive.push(g);
    statusMaterials.push({ material: statusMaterial, mesh: beacon, halo: null });
    return g;
  }
  buildDustCollector(10.4, 13.6, 'DC-01', '熔炼布袋除尘器', mat.paintedTeal);
  buildDustCollector(2.0, 14.4, 'DC-02', '砂处理脉冲除尘器', mat.paintedBlue);

  // Duct from DC-01/DC-02 to emission stacks.
  addPipe(root, [[10.4, 8.0, 13.6], [10.4, 10.6, 13.6], [10.4, 10.6, -12], [5.2, 10.6, -18.4]], 0.42, mat.steelLight, 40, 7);
  addPipe(root, [[2.0, 8.0, 14.4], [2.0, 12.0, 14.4], [2.0, 12.0, -11.6], [2.6, 12.0, -19.6]], 0.36, mat.steelLight, 40, 7);

  // Compressor room / utility block.
  const compressor = new THREE.Group();
  compressor.position.set(3.2, 0, 20.1);
  compressor.userData.equipmentId = 'COMP-01';
  root.add(compressor);
  addBox(compressor, 7.0, 4.2, 5.2, mat.paintedBlue, 0, 2.45, 0);
  addBox(compressor, 7.2, 0.32, 5.4, mat.steelDark, 0, 4.7, 0);
  addBox(compressor, 2.8, 2.2, 0.12, mat.vent, -1.5, 2.4, 2.66, { cast: false });
  addBox(compressor, 2.8, 2.2, 0.12, mat.vent, 1.5, 2.4, 2.66, { cast: false });
  addBox(compressor, 0.9, 1.7, 0.5, mat.steel, 3.3, 1.2, 2.2);
  addCylinder(compressor, 0.75, 0.75, 2.9, 14, mat.steelLight, -3.7, 1.9, 1.6);
  addPipe(compressor, [[-3.7, 3.1, 1.6], [-3.7, 5.0, 1.6], [-8.4, 5.0, 6.2], [-8.4, 5.0, 10.2]], 0.18, mat.steelLight, 24, 6);
  const compStatus = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const compBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), compStatus);
  compBeacon.position.set(3.3, 1.9, 2.45);
  compressor.add(compBeacon);
  equipment.set('COMP-01', { id: 'COMP-01', group: compressor, focus: V(3.2, 2.5, 20.1), anchor: V(3.2, 6.0, 20.1), statusMaterial: compStatus, beacon: compBeacon, statusHalo: null, height: 6, cameraDistance: 13 });
  interactive.push(compressor);
  statusMaterials.push({ material: compStatus, mesh: compBeacon, halo: null });

  // Cooling tower.
  const cooling = new THREE.Group();
  cooling.position.set(35.2, 0, 15.8);
  cooling.userData.equipmentId = 'WATER-01';
  root.add(cooling);
  addBox(cooling, 9.2, 0.35, 8.2, mat.concreteDark, 0, 0.22, 0, { cast: false });
  addBox(cooling, 8.2, 4.8, 7.2, mat.steelDark, 0, 2.7, 0);
  addBox(cooling, 8.4, 0.4, 7.4, mat.paintedBlue, 0, 5.2, 0);
  addBox(cooling, 6.6, 1.2, 5.6, mat.vent, 0, 5.6, 0);
  addCylinder(cooling, 3.0, 3.0, 0.35, 20, mat.steel, 0, 6.3, 0);
  const coolingFan = createFan(cooling, 0, 6.6, 0, 2.4, mat.steelLight, [Math.PI / 2, 0, 0]);
  updaters.push((dt, time) => {
    coolingFan.blades.rotation.z = time * 1.2;
  });
  addBox(cooling, 1.7, 2.2, 0.6, mat.paintedTeal, 2.9, 1.7, 3.8);
  addBox(cooling, 1.2, 0.08, 0.02, mat.screen, 2.9, 2.0, 4.12, { cast: false });
  addLadder(cooling, 4.2, 0.3, -2.0, 5.5, mat.yellow, 0);
  const waterStatus = new THREE.MeshStandardMaterial({ color: 0x3a2e1c, emissive: COLORS.amber, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.4 });
  const waterBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), waterStatus);
  waterBeacon.position.set(2.9, 3.0, 3.8);
  cooling.add(waterBeacon);
  const steamPlume = createPlume({ x: 35.2, y: 7.0, z: 15.8, height: 10, spread: 4.2, color: [0.72, 0.76, 0.74], count: 160, size: 0.9, opacity: 0.12 });
  root.add(steamPlume.points);
  plumes.push(steamPlume);
  equipment.set('WATER-01', { id: 'WATER-01', group: cooling, focus: V(35.2, 3.2, 15.8), anchor: V(35.2, 8.4, 15.8), statusMaterial: waterStatus, beacon: waterBeacon, statusHalo: null, height: 8, cameraDistance: 14 });
  interactive.push(cooling);
  statusMaterials.push({ material: waterStatus, mesh: waterBeacon, halo: null });

  // Finished goods storage and loading area.
  const storage = new THREE.Group();
  storage.position.set(30.5, 0, 13.4);
  root.add(storage);
  for (let rack = 0; rack < 3; rack += 1) {
    addBox(storage, 8.6, 0.18, 2.8, mat.steelDark, 0, 0.55 + rack * 1.6, 0);
    addBox(storage, 0.14, 4.6, 0.14, mat.steel, -4.1, 2.3, -1.3);
    addBox(storage, 0.14, 4.6, 0.14, mat.steel, 4.1, 2.3, -1.3);
    addBox(storage, 0.14, 4.6, 0.14, mat.steel, -4.1, 2.3, 1.3);
    addBox(storage, 0.14, 4.6, 0.14, mat.steel, 4.1, 2.3, 1.3);
    for (let i = 0; i < 5; i += 1) {
      addBox(storage, 0.8, 0.8, 0.7, i % 2 ? mat.scrap : mat.rust, -3.1 + i * 1.55, 1.0 + rack * 1.6, 0.2);
    }
  }
  addBox(storage, 0.22, 5.2, 0.22, mat.yellow, -5.4, 2.6, -1.6);
  addBox(storage, 0.22, 5.2, 0.22, mat.yellow, 5.4, 2.6, -1.6);
  addBox(storage, 11, 0.22, 0.22, mat.yellow, 0, 5.0, -1.6, { cast: false });
  // Forklift silhouette.
  const forklift = new THREE.Group();
  forklift.position.set(24.2, 0, 15.2);
  addBox(forklift, 2.0, 1.1, 1.2, mat.yellow, 0, 0.9, 0);
  addBox(forklift, 1.1, 1.0, 1.05, mat.steelDark, -0.4, 1.9, 0);
  addBox(forklift, 0.15, 0.15, 1.6, mat.steel, 1.2, 1.1, 0.8, { ry: Math.PI / 2 });
  addBox(forklift, 0.12, 1.8, 0.12, mat.steelDark, 1.2, 1.2, 0.3);
  addBox(forklift, 0.12, 1.8, 0.12, mat.steelDark, 1.2, 1.2, 1.3);
  [[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.55], [0.65, 0.55]].forEach(([x, z]) => {
    const wheel = addCylinder(forklift, 0.28, 0.28, 0.2, 10, mat.rubber, x, 0.35, z, { rz: Math.PI / 2 });
    wheel.castShadow = true;
  });
  storage.add(forklift);

  // Control room on the west side.
  const controlRoom = new THREE.Group();
  controlRoom.position.set(-33.5, 0, 18.2);
  root.add(controlRoom);
  addBox(controlRoom, 12.2, 0.7, 6.2, mat.concreteDark, 0, 0.35, 0, { cast: false });
  addBox(controlRoom, 11.2, 3.1, 5.2, mat.paintedBlue, 0, 2.3, 0);
  addBox(controlRoom, 11.0, 1.8, 5.0, mat.glassDark, 0, 4.0, 0, { cast: false });
  addBox(controlRoom, 11.3, 0.3, 5.3, mat.steelDark, 0, 5.0, 0);
  for (let i = 0; i < 4; i += 1) {
    addBox(controlRoom, 1.9, 0.05, 0.05, mat.lampCyan, -3.6 + i * 2.4, 4.78, 2.58, { cast: false });
  }
  addBox(controlRoom, 12.6, 0.5, 6.6, mat.steelDark, 0, 5.35, 0);
  addStairs(controlRoom, 6.8, 0.2, 0.6, 1.4, 3.4, 4.2, 11, mat.steel, 0);
  // Interior console silhouettes.
  addBox(controlRoom, 2.0, 0.8, 0.8, mat.steelDark, -2.0, 3.0, 0.8);
  addBox(controlRoom, 1.8, 0.08, 0.05, mat.screen, -2.0, 3.25, 1.22, { cast: false });
  addBox(controlRoom, 1.8, 1.1, 0.1, mat.screen, 1.5, 3.4, -2.45, { cast: false });
  addBox(controlRoom, 2.4, 0.35, 0.7, mat.steel, 1.5, 2.7, -2.0);
  addBox(controlRoom, 11.6, 0.4, 5.5, mat.steelDark, 0, 5.1, 0);

  // ------------------------------------------------------------
  // Human scale — deliberately low-poly workers knit the twin to reality.
  // ------------------------------------------------------------
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a6a55, roughness: 0.82, metalness: 0.02 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xd09b2e, roughness: 0.62, metalness: 0.08 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xd86527, roughness: 0.5, metalness: 0.25 });
  const reflectiveMat = new THREE.MeshStandardMaterial({ color: 0xc9d6cd, roughness: 0.36, metalness: 0.35, emissive: 0x39413c, emissiveIntensity: 0.4 });
  const workers = [];

  function createWorker(x, z, rotation = 0, options = {}) {
    const worker = new THREE.Group();
    worker.position.set(x, 0.34, z);
    worker.rotation.y = rotation;
    const scale = options.scale || 1;
    worker.scale.setScalar(scale);
    const vest = options.vest || vestMat;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1b292e, roughness: 0.88, metalness: 0.04 });
    addBox(worker, 0.15, 0.74, 0.16, legMat, -0.12, 0.4, 0);
    addBox(worker, 0.15, 0.74, 0.16, legMat, 0.12, 0.4, 0);
    addBox(worker, 0.18, 0.1, 0.28, mat.black, -0.12, 0.06, 0.04);
    addBox(worker, 0.18, 0.1, 0.28, mat.black, 0.12, 0.06, 0.04);
    addBox(worker, 0.42, 0.62, 0.25, vest, 0, 1.07, 0);
    addBox(worker, 0.44, 0.06, 0.27, reflectiveMat, 0, 1.13, 0, { cast: false });
    addBox(worker, 0.44, 0.04, 0.27, reflectiveMat, 0, 1.26, 0, { cast: false });
    addBox(worker, 0.1, 0.54, 0.12, vest, -0.27, 1.07, 0);
    addBox(worker, 0.1, 0.54, 0.12, vest, 0.27, 1.07, 0);
    addCylinder(worker, 0.11, 0.12, 0.18, 8, skinMat, 0, 1.53, 0);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, TAU, 0, Math.PI * 0.62), helmetMat);
    helmet.position.set(0, 1.58, 0);
    helmet.castShadow = true;
    worker.add(helmet);
    addBox(worker, 0.3, 0.045, 0.35, helmetMat, 0, 1.58, -0.02, { cast: false });
    root.add(worker);
    workers.push(worker);
    return worker;
  }

  createWorker(-16.8, 0.9, -0.65);
  createWorker(6.1, 9.2, 2.6, { vest: reflectiveMat });
  createWorker(-9.8, 10.3, 1.5);
  createWorker(25.8, 7.3, -0.2, { scale: 0.94 });
  createWorker(33.2, -8.4, 2.8, { vest: reflectiveMat });
  createWorker(-24.7, 14.9, 0.9, { scale: 0.96 });
  const walkingWorker = createWorker(-15, 11.2, Math.PI / 2, { scale: 0.98 });
  walkingWorker.userData.dynamic = true;
  updaters.push((dt, time) => {
    walkingWorker.position.x = -17 + ((time * 0.38 + 4) % 40);
    walkingWorker.position.z = 11.2 + Math.sin(time * 0.7) * 0.12;
    walkingWorker.position.y = 0.34 + Math.abs(Math.sin(time * 4.2)) * 0.025;
    // Subtle arm/torso motion keeps the low-poly figure from reading as a prop.
    walkingWorker.children.forEach((child, index) => {
      if (index === 7) child.rotation.x = Math.sin(time * 4.2) * 0.28;
      if (index === 8) child.rotation.x = -Math.sin(time * 4.2) * 0.28;
    });
  });

  // ------------------------------------------------------------
  // Process-energy cabinets, pipe racks, external tank farm
  // ------------------------------------------------------------
  const cabinets = new THREE.Group();
  cabinets.position.set(-11.5, 0, 21.2);
  root.add(cabinets);
  for (let i = 0; i < 7; i += 1) {
    addBox(cabinets, 1.2, 2.1, 0.8, i % 3 === 0 ? mat.paintedTeal : mat.steel, i * 1.35, 1.25, 0);
    addBox(cabinets, 0.5, 0.05, 0.02, mat.screen, i * 1.35, 1.85, 0.42, { cast: false });
    addBox(cabinets, 0.5, 0.4, 0.02, mat.vent, i * 1.35, 1.45, 0.42, { cast: false });
  }
  addBox(cabinets, 10.2, 0.3, 1.3, mat.concreteDark, 4.0, 0.16, 0, { cast: false });
  addBox(cabinets, 10.0, 0.12, 0.15, mat.hazard, 4.0, 0.35, 0.75, { cast: false });

  const pipeRack = new THREE.Group();
  pipeRack.position.set(0, 0, -17.5);
  root.add(pipeRack);
  [[-30, 0], [-16, 0], [-2, 0], [12, 0], [26, 0], [38, 0]].forEach(([x]) => {
    addBox(pipeRack, 0.22, 5.2, 0.22, mat.steelDark, x, 2.6, 0);
    addBox(pipeRack, 0.18, 0.18, 2.8, mat.steelDark, x, 5.1, 0, { cast: false });
  });
  addBox(pipeRack, 75, 0.18, 0.18, mat.steelDark, 4, 5.2, -1.2, { cast: false });
  addBox(pipeRack, 75, 0.18, 0.18, mat.steelDark, 4, 5.2, 1.2, { cast: false });
  addPipe(pipeRack, [[-36, 4.8, -1.3], [38, 4.8, -1.3]], 0.16, mat.steelLight, 2, 6);
  addPipe(pipeRack, [[-36, 4.45, -0.4], [38, 4.45, -0.4]], 0.13, mat.orange, 2, 6);
  addPipe(pipeRack, [[-36, 4.1, 0.5], [38, 4.1, 0.5]], 0.11, mat.paintedBlue, 2, 6);

  // Vertical tanks at the east yard.
  [[40, 0, 4], [40, 0, -2], [40, 0, -8]].forEach(([x, , z], i) => {
    addCylinder(root, 2.2, 2.2, 6.0, 18, mat.steelLight, x, 3.2, z);
    addCylinder(root, 2.2, 0.2, 1.2, 18, mat.steelDark, x, 0.2, z);
    addCylinder(root, 0.2, 0.2, 1.0, 8, mat.steel, x, 6.7, z);
    addTorus(root, 2.22, 0.06, mat.steelDark, x, 4.5, z, { segments: 26 });
    addBox(root, 0.6, 1.5, 0.6, mat.yellow, x + 2.5, 0.8, z);
  });

  // ------------------------------------------------------------
  // Stacks and CEMS monitoring points
  // ------------------------------------------------------------
  const stackDefs = [
    { x: -37.2, z: -21.0, height: 27, radius: 1.12, code: 'DA-01', name: '熔炼烟气', cameraName: 'CAM-01', accent: COLORS.mint },
    { x: 4.8, z: -21.4, height: 23, radius: 0.98, code: 'DA-02', name: '砂处理除尘', cameraName: 'CAM-02', accent: COLORS.mint },
    { x: 18.8, z: -21.6, height: 21, radius: 0.94, code: 'DA-03', name: '抛丸除尘', cameraName: 'CAM-03', accent: COLORS.mint },
    { x: 33.6, z: -20.2, height: 24, radius: 1.05, code: 'DA-04', name: '涂装废气', cameraName: 'CAM-04', accent: COLORS.mint },
  ];
  stackDefs.forEach((def, index) => {
    const emissionId = `E${index + 1}`;
    const stack = createStack(root, { ...def, emissionId });
    stack.group.userData.emissionId = emissionId;
    interactive.push(stack.group);
    stacks.set(emissionId, stack);
    plumes.push(stack.plume);
    anchors.push({
      id: emissionId,
      title: def.name,
      sub: `${def.code} · ${def.cameraName}`,
      value: '8.6 mg/m³',
      position: V(def.x, def.height * 0.68 + 1.2, def.z),
      kind: 'stack',
      view: 'emissions',
      icon: 'tower',
      emissionId,
    });
    // Duct connections from the stack base to the equipment areas.
  });

  // Ambient/fugitive monitoring poles.
  const fugitiveAnchors = [
    { id: 'E5', x: -5.2, z: 2.6, code: 'MF-01', name: '浇注区' },
    { id: 'E6', x: -32.5, z: -5.4, code: 'MF-02', name: '原料堆场' },
  ];
  fugitiveAnchors.forEach(({ id, x, z, code, name }) => {
    addBox(root, 0.9, 0.2, 0.9, mat.concreteDark, x, 0.2, z, { cast: false });
    addCylinder(root, 0.06, 0.07, 2.6, 8, mat.steel, x, 1.5, z);
    addBox(root, 0.4, 0.35, 0.25, mat.paintedBlue, x, 2.8, z);
    addBox(root, 0.18, 0.1, 0.02, mat.screen, x, 2.82, z + 0.14, { cast: false });
    addCylinder(root, 0.12, 0.12, 0.04, 12, mat.steelLight, x, 3.04, z, { rx: Math.PI / 2 });
    const material = new THREE.MeshStandardMaterial({ color: 0x173a35, emissive: COLORS.mint, emissiveIntensity: 2, roughness: 0.3, metalness: 0.4 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), material);
    beacon.position.set(x, 3.15, z);
    root.add(beacon);
    anchors.push({
      id,
      title: name,
      sub: code,
      value: '0.42 mg/m³',
      position: V(x, 3.5, z),
      kind: 'ambient',
      view: 'melting',
      icon: 'wind',
      emissionId: id,
    });
    statusMaterials.push({ material, mesh: beacon, halo: null, emission: id });
  });

  // Area anchors (always visible, compact context labels).
  const areaDefs = [
    { id: 'melting', title: '熔炼工段', sub: 'MELTING · 2× INDUCTION', value: '1,248 kW', position: V(-24, 10.9, -7.2), icon: 'flame', view: 'melting' },
    { id: 'sand', title: '砂处理', sub: 'SAND PREP · 3 SILOS', value: '118 kW', position: V(-9, 9.9, -15.2), icon: 'filter', view: 'melting' },
    { id: 'molding', title: '造型 / 浇注', sub: 'MOLDING & POURING', value: '326 kW', position: V(2.5, 10.7, 6), icon: 'box', view: 'molding' },
    { id: 'cleaning', title: '清理工段', sub: 'SHAKEOUT · SHOT BLAST', value: '284 kW', position: V(17, 8.2, -5.2), icon: 'grid', view: 'cleaning' },
    { id: 'painting', title: '涂装工段', sub: 'PAINT & DRY · RTO', value: '196 kW', position: V(28, 8.1, 1.8), icon: 'spray', view: 'painting' },
  ];
  areaDefs.forEach((def) => {
    anchors.push({
      id: def.id,
      title: def.title,
      sub: def.sub,
      value: def.value,
      position: def.position,
      kind: 'area',
      view: def.view,
      icon: def.icon,
    });
  });

  // ------------------------------------------------------------
  // Process route with drifting energy beads
  // ------------------------------------------------------------
  const routePoints = [
    [-33, 0.45, -12], [-27, 0.45, -6], [-20, 0.45, -1], [-12, 0.45, 3], [-6, 0.45, 6],
    [2, 0.45, 6], [10, 0.45, 5], [16, 0.45, -2], [23, 0.45, 1], [29, 0.45, 1.8], [35, 0.45, 7],
  ];
  const routeCurve = new THREE.CatmullRomCurve3(routePoints.map((p) => V(...p)), false, 'catmullrom', 0.18);
  const routeTube = new THREE.Mesh(
    new THREE.TubeGeometry(routeCurve, 140, 0.035, 4, false),
    new THREE.MeshBasicMaterial({ color: 0x5fdfd4, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  root.add(routeTube);
  const beadTexture = makeGlowTexture('#8dffe6');
  for (let i = 0; i < 9; i += 1) {
    const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: beadTexture, color: 0x7dffe8, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
    bead.scale.set(0.7, 0.7, 1);
    root.add(bead);
    flowBeads.push({ sprite: bead, offset: i / 9 });
  }
  updaters.push((dt, time) => {
    flowBeads.forEach(({ sprite, offset }) => {
      const t = (time * 0.018 + offset) % 1;
      const point = routeCurve.getPointAt(t);
      sprite.position.copy(point);
      sprite.position.y += Math.sin(time * 1.8 + offset * 10) * 0.1;
      sprite.material.opacity = 0.25 + Math.sin(t * Math.PI) * 0.48;
    });
  });

  // ------------------------------------------------------------
  // Video surveillance camera definitions
  // ------------------------------------------------------------
  cameraDefs.push(
    { id: 'CAM-01', name: '熔炼烟气排口', zone: '熔炼工段 / 1# 排口', position: V(-29.5, 22.5, 22), target: V(-37.2, 20.2, -21), fov: 41, emissionId: 'E1', status: 'online' },
    { id: 'CAM-02', name: '砂处理除尘排口', zone: '砂处理 / 2# 排口', position: V(12, 20.5, 21), target: V(4.8, 18.2, -21.4), fov: 41, emissionId: 'E2', status: 'online' },
    { id: 'CAM-03', name: '抛丸清理排口', zone: '清理工段 / 3# 排口', position: V(26, 19.5, 21), target: V(18.8, 17.2, -21.6), fov: 41, emissionId: 'E3', status: 'online' },
    { id: 'CAM-04', name: '涂装废气排口', zone: '涂装工段 / 4# 排口', position: V(40.5, 21.5, 21), target: V(33.6, 19.2, -20.2), fov: 41, emissionId: 'E4', status: 'online' },
    { id: 'CAM-05', name: '浇注区全景', zone: '造型浇注 / 无组织', position: V(1.5, 7.8, 15.5), target: V(-7.5, 4.8, 6), fov: 52, emissionId: 'E5', status: 'online' },
    { id: 'CAM-06', name: '原料堆场', zone: '废钢堆场 / 厂界', position: V(-24, 6.2, 1.5), target: V(-33, 2.4, -12), fov: 50, emissionId: 'E6', status: 'online' },
    { id: 'CAM-07', name: '造型线东侧', zone: '造型工段 / 设备', position: V(15.8, 6.4, 12.5), target: V(3.5, 4.0, 6), fov: 50, emissionId: null, status: 'online' },
    { id: 'CAM-08', name: '成品库 / 发运', zone: '成品库 / 物流', position: V(41.5, 5.2, 23.5), target: V(30.5, 2.6, 13.4), fov: 48, emissionId: null, status: 'online' },
  );

  // ------------------------------------------------------------
  // Ground-level lights and practical fixtures
  // ------------------------------------------------------------
  const lightPoles = [
    [-45, 25], [-22, 33], [10, 34], [40, 30], [48, -2],
  ];
  lightPoles.forEach(([x, z], i) => {
    addCylinder(root, 0.08, 0.12, 6.4, 6, mat.steelDark, x, 3.2, z);
    addBox(root, 1.2, 0.16, 0.4, mat.steelDark, x + 0.45, 6.35, z, { rz: -0.13 });
    addBox(root, 0.85, 0.05, 0.28, mat.lamp, x + 0.8, 6.28, z, { cast: false });
    const light = new THREE.PointLight(0xffe8c2, 12, 18, 2);
    light.position.set(x + 0.8, 6.1, z);
    root.add(light);
  });

  const furnaceLight = new THREE.PointLight(0xff7b32, 38, 28, 2);
  furnaceLight.position.set(-24, 6.5, -7);
  root.add(furnaceLight);

  const castingLight = new THREE.PointLight(0xff9b53, 20, 20, 2);
  castingLight.position.set(-6, 6, 6);
  root.add(castingLight);

  // ------------------------------------------------------------
  // Update / API
  // ------------------------------------------------------------
  const statusColorMap = {
    running: new THREE.Color(COLORS.mint),
    idle: new THREE.Color(COLORS.amber),
    warning: new THREE.Color(COLORS.orange),
    maintenance: new THREE.Color(COLORS.blue),
    offline: new THREE.Color(0x5c6f72),
  };
  const emissionColorMap = {
    normal: new THREE.Color(COLORS.mint),
    warning: new THREE.Color(COLORS.amber),
    exceed: new THREE.Color(COLORS.red),
  };

  function update(dt, time, state) {
    if (motionEnabled) {
      updaters.forEach((fn) => {
        try {
          fn(dt, time);
        } catch (err) {
          console.error('[scene updater]', err);
        }
      });
    }
    plumes.forEach((plume) => plume.update(time));

    gridMat.uniforms.uTime.value = time;

    if (!state) return;

    // Equipment beacons.
    statusMaterials.forEach(({ material, emission, mesh }) => {
      if (emission) {
        const point = state.emissions.find((e) => e.id === emission);
        const color = emissionColorMap[point?.status || 'normal'];
        material.emissive.copy(color);
        material.emissiveIntensity = 1.8;
        if (point?.status === 'warning' || point?.status === 'exceed') {
          const pulse = 0.75 + Math.sin(time * 5.4) * 0.25;
          material.emissiveIntensity = 2.8 * pulse;
          mesh.scale.setScalar(1 + Math.sin(time * 5.4) * 0.12);
        }
        return;
      }
      const eq = state.equipment.find((item) => item.id === material.userData?.equipmentId);
      if (!eq) return;
      const color = statusColorMap[eq.status] || statusColorMap.offline;
      material.emissive.copy(color);
      const isWarning = eq.status === 'warning';
      material.emissiveIntensity = isWarning ? 2.6 + Math.sin(time * 5) * 0.7 : 1.9;
      mesh.scale.setScalar(isWarning ? 1 + Math.sin(time * 5) * 0.1 : 1);
    });

    // Stacks + plumes.
    state.emissions.slice(0, 4).forEach((point, index) => {
      const stack = stacks.get(point.id);
      if (!stack) return;
      const color = emissionColorMap[point.status] || emissionColorMap.normal;
      stack.statusMat.emissive.copy(color);
      stack.statusMat.emissiveIntensity = point.status === 'normal' ? 2.2 : 3.2 + Math.sin(time * 4) * 1.2;
      stack.mastLight.material.color.copy(color);
      const ratio = point.value / point.limit;
      stack.plume.setOpacity(0.1 + Math.min(1.1, ratio) * 0.15);
      const baseColor = point.plume;
      const warningMix = point.status === 'normal' ? 0 : 0.56;
      stack.plume.setColor([
        THREE.MathUtils.lerp(baseColor[0], 0.95, warningMix),
        THREE.MathUtils.lerp(baseColor[1], 0.58, warningMix),
        THREE.MathUtils.lerp(baseColor[2], 0.37, warningMix),
      ]);
    });

    // Furnace glow reacts to FUR-01 load.
    const fur = state.equipment.find((eq) => eq.id === 'FUR-01');
    if (fur) {
      furnaceLight.intensity = 24 + (fur.load / 100) * 30 + Math.sin(time * 2.6) * 5;
      castingLight.intensity = 15 + Math.sin(time * 1.8) * 3;
    }
  }

  // Attach equipment ids to status materials for fast lookup.
  statusMaterials.forEach((entry) => {
    if (entry.emission) return;
    const match = [...equipment.values()].find((eq) => eq.statusMaterial === entry.material);
    if (match) entry.material.userData.equipmentId = match.id;
  });

  // ------------------------------------------------------------
  // Static batching / lightweight pass
  // ------------------------------------------------------------
  // Hundreds of small authoring meshes share a handful of PBR materials.
  // The plant is mostly static, so bake all eligible meshes into per-material
  // world-space batches. Animated assemblies (ladle, crane, fans, workers)
  // and interactive beacons stay independent. Invisible proxies preserve
  // pixel-accurate picking after the source meshes are batched away.
  const optimizeStaticGeometry = () => {
    root.updateMatrixWorld(true);

    equipment.forEach((eq) => {
      if (eq.beacon) eq.beacon.userData.noMerge = true;
      if (eq.statusHalo) eq.statusHalo.userData.noMerge = true;
    });

    const bounds = new Map();
    equipment.forEach((eq, id) => {
      const box = new THREE.Box3().setFromObject(eq.group);
      if (!box.isEmpty()) bounds.set(id, { box, type: 'equipment' });
    });
    stacks.forEach((stack, id) => {
      const box = new THREE.Box3().setFromObject(stack.group);
      if (!box.isEmpty()) bounds.set(id, { box, type: 'emission' });
    });

    const batches = new Map();
    root.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
      if (Array.isArray(object.material) || !object.material) return;
      if (object.material.transparent || object.material.isShaderMaterial || object.material.visible === false) return;
      if (!object.geometry?.attributes?.position) return;
      if (object.userData.noMerge) return;
      if (object.geometry.morphAttributes && Object.keys(object.geometry.morphAttributes).length) return;

      let node = object;
      while (node && node !== root) {
        if (node.userData.dynamic || node.userData.noMerge) return;
        node = node.parent;
      }

      const attrs = Object.keys(object.geometry.attributes).sort().map((key) => `${key}:${object.geometry.attributes[key].itemSize}`).join(',');
      const key = [
        object.material.uuid,
        object.castShadow ? 1 : 0,
        object.receiveShadow ? 1 : 0,
        object.renderOrder,
        object.geometry.index ? 'indexed' : 'non-indexed',
        attrs,
      ].join('|');
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    });

    const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    let batchCount = 0;
    let removedMeshes = 0;
    batches.forEach((meshes) => {
      if (meshes.length < 2) return;
      const geometries = [];
      const transform = new THREE.Matrix4();
      meshes.forEach((mesh) => {
        const geometry = mesh.geometry.clone();
        transform.multiplyMatrices(rootInverse, mesh.matrixWorld);
        geometry.applyMatrix4(transform);
        geometries.push(geometry);
      });
      const merged = mergeGeometries(geometries, false);
      if (!merged) {
        geometries.forEach((geometry) => geometry.dispose());
        return;
      }
      const source = meshes[0];
      const batchedMesh = new THREE.Mesh(merged, source.material);
      batchedMesh.castShadow = source.castShadow;
      batchedMesh.receiveShadow = source.receiveShadow;
      batchedMesh.renderOrder = source.renderOrder;
      batchedMesh.matrixAutoUpdate = false;
      batchedMesh.name = `BATCH_${batchCount}`;
      root.add(batchedMesh);
      meshes.forEach((mesh) => {
        mesh.parent?.remove(mesh);
        removedMeshes += 1;
      });
      batchCount += 1;
    });

    // Picking proxies. They are hidden from the renderer but are still
    // intersected by Raycaster, so hover / click feedback stays immediate.
    const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });
    interactive.length = 0;
    bounds.forEach(({ box, type }, id) => {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.6, size.x), Math.max(0.6, size.y), Math.max(0.6, size.z)),
        proxyMaterial,
      );
      proxy.position.copy(center);
      proxy.visible = false;
      if (type === 'equipment') proxy.userData.equipmentId = id;
      else proxy.userData.emissionId = id;
      root.add(proxy);
      interactive.push(proxy);
    });

    console.info(`[digital twin] static batch: ${batchCount} batches, ${removedMeshes} meshes merged, ${interactive.length} picking proxies`);
  };

  optimizeStaticGeometry();

  return {
    root,
    equipment,
    interactive,
    anchors,
    cameraDefs,
    stacks,
    update,
    setMotion(value) {
      motionEnabled = value;
    },
    getMotion() {
      return motionEnabled;
    },
    setLowPower(value) {
      lowPowerMode = Boolean(value);
      dustField.points.visible = !lowPowerMode;
      sparkSystems.forEach((points) => {
        points.visible = !lowPowerMode;
      });
      lightShafts.forEach((shaft) => {
        shaft.visible = !lowPowerMode;
      });
      plumes.forEach((plume) => {
        const total = plume.points.geometry.attributes.position.count;
        plume.points.geometry.setDrawRange(0, lowPowerMode ? Math.min(72, total) : total);
      });
    },
    getLowPower() {
      return lowPowerMode;
    },
    materials: mat,
  };
}
