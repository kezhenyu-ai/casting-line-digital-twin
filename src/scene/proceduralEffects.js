import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 22; i += 1) {
    const x = 30 + Math.random() * 68;
    const y = 30 + Math.random() * 68;
    const r = 8 + Math.random() * 28;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(196, 214, 211, ${0.08 + Math.random() * 0.1})`);
    g.addColorStop(0.55, `rgba(130, 154, 151, ${0.03 + Math.random() * 0.05})`);
    g.addColorStop(1, 'rgba(80, 96, 94, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeSparkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 247, 206, 1)');
  g.addColorStop(0.18, 'rgba(255, 190, 73, 0.95)');
  g.addColorStop(0.55, 'rgba(255, 100, 20, 0.45)');
  g.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d1718';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(82, 130, 128, 0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  for (let i = 0; i < 2400; i += 1) {
    const v = 18 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgba(${v}, ${v + 10}, ${v + 8}, 0.32)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function particleSystem({ center, height, radius, count, color, texture, size, speed, opacity = 0.5, additive = false }) {
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = center.x + Math.cos(angle) * r;
    const z = center.z + Math.sin(angle) * r;
    const y = center.y + Math.random() * height;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds.push({ x, z, base: y, phase: Math.random() * 9, speed: speed * (0.5 + Math.random()) });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    map: texture,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 8;
  return { points, seeds, positions, height: height + 6, center };
}

export function createModelEffects(scene, factory) {
  const smokeTexture = makeSmokeTexture();
  const sparkTexture = makeSparkTexture();
  const groundTexture = makeGroundTexture();
  const models = [];
  const systems = [];
  const streams = [];
  const conveyors = [];
  const glows = [];
  let flowTube = null;
  let flowPulse = null;
  let flowCurve = null;
  const group = factory.root;
  const box = factory.modelBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const floorY = factory.floorY ?? 0;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, size.z) * 1.5, Math.max(size.x, size.z) * 1.5),
    new THREE.MeshStandardMaterial({
      color: 0x102022,
      map: groundTexture,
      roughness: 0.9,
      metalness: 0.08,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, floorY - 0.12, center.z);
  scene.add(ground);
  models.push(ground);

  const addPlume = (id, color, count, sizeValue, opacity, additive) => {
    const eq = factory.equipment.get(id);
    if (!eq) return;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    const system = particleSystem({
      center: new THREE.Vector3(c.x, b.max.y + 1, c.z),
      height: Math.max(3, b.max.y - b.min.y),
      radius: Math.max(2, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.38),
      count,
      color,
      texture: smokeTexture,
      size: sizeValue,
      speed: 0.5,
      opacity,
      additive,
    });
    scene.add(system.points);
    systems.push(system);
  };

  addPlume('AOD-01', 0xb8c4c0, 60, 6.2, 0.46, false);
  addPlume('MELT-01', 0xaebbb7, 52, 5.8, 0.4, false);
  addPlume('SHAKE-01', 0xb5a68b, 36, 5.0, 0.36, false);
  addPlume('SAND-01', 0xb9b7a8, 42, 4.8, 0.34, false);

  for (const [id, color, scale] of [['AOD-01', 0xff7a24, 7.5], ['MELT-01', 0xff8d32, 6.5], ['POUR-01', 0xffb347, 4.5], ['POUR-02', 0xffb347, 4.5]]) {
    const eq = factory.equipment.get(id);
    if (!eq) continue;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sparkTexture,
      color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sprite.position.set(c.x, b.min.y + (b.max.y - b.min.y) * 0.55, c.z);
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 7;
    scene.add(sprite);
    glows.push(sprite);
  }

  for (const id of ['POUR-01', 'POUR-02']) {
    const eq = factory.equipment.get(id);
    if (!eq) continue;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    const system = particleSystem({
      center: new THREE.Vector3(c.x, b.max.y - 1, c.z),
      height: 6,
      radius: 2.4,
      count: 46,
      color: 0xffb04a,
      texture: sparkTexture,
      size: 0.8,
      speed: 1.8,
      opacity: 0.9,
      additive: true,
    });
    scene.add(system.points);
    systems.push(system);

    const height = clamp(b.max.y - floorY + 2, 4, 18);
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.32, height, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff7a24,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    stream.position.set(c.x, floorY + height / 2, c.z);
    stream.renderOrder = 9;
    scene.add(stream);
    streams.push(stream);
  }

  const mold = factory.equipment.get('MOLD-01');
  const shake = factory.equipment.get('SHAKE-01');
  if (mold && shake) {
    const a = new THREE.Box3().setFromObject(mold.group).getCenter(new THREE.Vector3());
    const b = new THREE.Box3().setFromObject(shake.group).getCenter(new THREE.Vector3());
    const y = floorY + 1.1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(a.x, y, a.z),
      new THREE.Vector3((a.x + b.x) / 2, y, Math.min(a.z, b.z) - 3),
      new THREE.Vector3(b.x, y, b.z),
    ], false, 'catmullrom', 0.2);
    for (let i = 0; i < 12; i += 1) {
      const item = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.45, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xc6b48c, roughness: 0.72, metalness: 0.16 }),
      );
      scene.add(item);
      conveyors.push({ mesh: item, curve, offset: i / 12, speed: 0.055 });
    }
  }

  const processOrder = ['AOD-01', 'MELT-01', 'POUR-01', 'MOLD-01', 'SHAKE-01', 'SAND-01', 'WATER-01'];
  const flowPoints = [];
  for (const id of processOrder) {
    const eq = factory.equipment.get(id);
    if (!eq) continue;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    flowPoints.push(new THREE.Vector3(c.x, floorY + 0.32, c.z));
  }
  if (flowPoints.length > 2) {
    flowCurve = new THREE.CatmullRomCurve3(flowPoints, false, 'catmullrom', 0.2);
    flowTube = new THREE.Mesh(
      new THREE.TubeGeometry(flowCurve, 140, 0.2, 5, false),
      new THREE.MeshBasicMaterial({
        color: 0x61efbd,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flowTube.renderOrder = 6;
    scene.add(flowTube);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xe9fff8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    flowPulse = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), pulseMaterial);
    flowPulse.renderOrder = 7;
    scene.add(flowPulse);
  }

  const agv = factory.equipment.get('AGV-01')?.group;
  const agvBase = agv ? agv.position.clone() : null;

  return {
    update(dt, time) {
      for (const system of systems) {
        const attr = system.points.geometry.attributes.position;
        for (let i = 0; i < system.seeds.length; i += 1) {
          const seed = system.seeds[i];
          const y = system.center.y + ((time * seed.speed + seed.phase) % system.height);
          attr.array[i * 3] = seed.x + Math.sin(time * 0.8 + seed.phase) * 0.15;
          attr.array[i * 3 + 1] = y;
          attr.array[i * 3 + 2] = seed.z + Math.cos(time * 0.7 + seed.phase) * 0.15;
        }
        attr.needsUpdate = true;
      }
      for (const stream of streams) {
        stream.material.opacity = 0.42 + Math.sin(time * 3.4 + stream.position.x) * 0.18;
        const s = 0.85 + Math.sin(time * 2.2) * 0.12;
        stream.scale.x = s;
        stream.scale.z = s;
      }
      for (let i = 0; i < glows.length; i += 1) {
        glows[i].material.opacity = 0.15 + Math.sin(time * 1.8 + i * 1.7) * 0.08;
        glows[i].scale.setScalar((i < 2 ? 7 : 4.5) * (0.92 + Math.sin(time * 1.3 + i) * 0.08));
      }
      if (flowCurve && flowPulse) {
        const u = (time * 0.055) % 1;
        flowPulse.position.copy(flowCurve.getPointAt(u));
        flowPulse.scale.setScalar(0.8 + Math.sin(time * 4) * 0.2);
      }
      for (const item of conveyors) {
        const u = (time * item.speed + item.offset) % 1;
        item.mesh.position.copy(item.curve.getPointAt(u));
        item.mesh.rotation.y = time * 0.35 + item.offset * 2;
      }
      if (agv && agvBase) {
        agv.position.x = agvBase.x + Math.sin(time * 0.35) * 1.2;
        agv.position.z = agvBase.z + Math.cos(time * 0.28) * 0.6;
      }
    },
    dispose() {
      for (const object of models) {
        scene.remove(object);
        object.geometry?.dispose();
        object.material?.map?.dispose();
        object.material?.dispose();
      }
      for (const system of systems) {
        scene.remove(system.points);
        system.points.geometry.dispose();
        system.points.material.dispose();
      }
      for (const stream of streams) {
        scene.remove(stream);
        stream.geometry.dispose();
        stream.material.dispose();
      }
      for (const item of conveyors) {
        scene.remove(item.mesh);
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
      }
      for (const glow of glows) {
        scene.remove(glow);
        glow.material.dispose();
      }
      if (flowTube) {
        scene.remove(flowTube);
        flowTube.geometry.dispose();
        flowTube.material.dispose();
      }
      if (flowPulse) {
        scene.remove(flowPulse);
        flowPulse.geometry.dispose();
        flowPulse.material.dispose();
      }
      smokeTexture.dispose();
      sparkTexture.dispose();
      groundTexture.dispose();
    },
  };
}
