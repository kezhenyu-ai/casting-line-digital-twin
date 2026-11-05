import * as THREE from 'three';
import { makeSparkTexture } from './textures.js';
import { createWorkers } from './workers.js';

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function centerBox(factory, id) {
  const eq = factory.equipment.get(id);
  if (!eq) return null;
  const b = new THREE.Box3().setFromObject(eq.group);
  return { eq, box: b, center: b.getCenter(new THREE.Vector3()), size: b.getSize(new THREE.Vector3()) };
}

function sparkCloud(scene, root, origin, count, color, size, height) {
  const texture = makeSparkTexture();
  const positions = new Float32Array(count * 3);
  const seeds = [];
  for (let i = 0; i < count; i += 1) {
    const x = origin.x + (Math.random() - 0.5) * 4;
    const y = origin.y + Math.random() * height;
    const z = origin.z + (Math.random() - 0.5) * 4;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds.push({ x, z, base: y, phase: Math.random() * 8, speed: 0.7 + Math.random() * 1.4 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    map: texture,
    size,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 9;
  root.add(points);
  return { points, seeds, origin, height, texture };
}

export function createEquipmentMotion(scene, factory) {
  const root = new THREE.Group();
  root.name = 'EQUIPMENT_MOTION';
  scene.add(root);
  const floorY = factory.floorY ?? 0;
  const fans = [];
  const streams = [];
  const glows = [];
  const sparks = [];
  const conveyors = [];
  const workers = createWorkers(scene, factory);

  // Cooling-tower fans.
  const water = centerBox(factory, 'WATER-01');
  if (water) {
    for (let i = 0; i < 2; i += 1) {
      const fan = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x66777a, roughness: 0.45, metalness: 0.6 }));
      fan.add(hub);
      for (let b = 0; b < 3; b += 1) {
        const blade = box(3.2, 0.06, 0.45, new THREE.MeshStandardMaterial({ color: 0x8fa0a1, roughness: 0.4, metalness: 0.55 }));
        blade.position.x = 1.55;
        blade.rotation.z = 0.12;
        const pivot = new THREE.Group();
        pivot.rotation.y = (Math.PI * 2 * b) / 3;
        pivot.add(blade);
        fan.add(pivot);
      }
      fan.position.set(water.center.x + (i ? 4 : -4), water.box.max.y + 0.35, water.center.z);
      root.add(fan);
      fans.push({ group: fan, speed: i ? -1.1 : 1.35 });
    }
  }

  // Animated AGV on the pouring aisle.
  const agv = factory.equipment.get('AGV-01')?.group;
  const agvBase = agv ? agv.position.clone() : null;

  // Pouring streams and hot glow.
  for (const id of ['POUR-01', 'POUR-02']) {
    const data = centerBox(factory, id);
    if (!data) continue;
    const height = Math.max(4, data.box.max.y - floorY + 2);
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.28, height, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    stream.position.set(data.center.x, floorY + height / 2, data.center.z);
    root.add(stream);
    streams.push(stream);
    sparks.push(sparkCloud(scene, root, new THREE.Vector3(data.center.x, data.box.max.y - 0.5, data.center.z), 34, 0xffb34a, 0.55, 5));
  }

  const aod = centerBox(factory, 'AOD-01');
  if (aod) sparks.push(sparkCloud(scene, root, new THREE.Vector3(aod.center.x, aod.box.max.y - 0.3, aod.center.z), 55, 0xff8a32, 0.5, 7));

  // Metal-flow line and travelling pulse.
  const order = ['AOD-01', 'MELT-01', 'POUR-01', 'MOLD-01', 'SHAKE-01', 'SAND-01', 'WATER-01'];
  const flowPoints = [];
  for (const id of order) {
    const data = centerBox(factory, id);
    if (data) flowPoints.push(new THREE.Vector3(data.center.x, floorY + 0.42, data.center.z));
  }
  let flowCurve = null;
  let flowPulse = null;
  if (flowPoints.length > 2) {
    flowCurve = new THREE.CatmullRomCurve3(flowPoints, false, 'catmullrom', 0.2);
    const flow = new THREE.Mesh(
      new THREE.TubeGeometry(flowCurve, 150, 0.12, 5, false),
      new THREE.MeshBasicMaterial({ color: 0x61efbd, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flow.renderOrder = 8;
    root.add(flow);
    flowPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xeafff8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flowPulse.renderOrder = 9;
    root.add(flowPulse);
  }

  // Small conveyor boxes from molding to shakeout.
  const mold = centerBox(factory, 'MOLD-01');
  const shake = centerBox(factory, 'SHAKE-01');
  if (mold && shake) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(mold.center.x, floorY + 0.55, mold.center.z),
      new THREE.Vector3((mold.center.x + shake.center.x) / 2, floorY + 0.55, Math.min(mold.center.z, shake.center.z) - 2),
      new THREE.Vector3(shake.center.x, floorY + 0.55, shake.center.z),
    ], false, 'catmullrom', 0.2);
    for (let i = 0; i < 10; i += 1) {
      const item = box(1.0, 0.38, 1.0, new THREE.MeshStandardMaterial({ color: 0xc6b48c, roughness: 0.72, metalness: 0.16 }));
      root.add(item);
      conveyors.push({ mesh: item, curve, offset: i / 10 });
    }
  }

  return {
    update(dt, time) {
      workers.update(dt, time);
      fans.forEach((fan) => { fan.group.rotation.y += dt * fan.speed; });
      for (const stream of streams) {
        stream.material.opacity = 0.42 + Math.sin(time * 3.2 + stream.position.x) * 0.16;
        stream.scale.x = 0.88 + Math.sin(time * 2.1) * 0.1;
        stream.scale.z = stream.scale.x;
      }
      for (const spark of sparks) {
        const attr = spark.points.geometry.attributes.position;
        for (let i = 0; i < spark.seeds.length; i += 1) {
          const seed = spark.seeds[i];
          attr.array[i * 3 + 1] = seed.base + ((time * seed.speed + seed.phase) % spark.height);
          attr.array[i * 3] = seed.x + Math.sin(time * 0.8 + seed.phase) * 0.18;
          attr.array[i * 3 + 2] = seed.z + Math.cos(time * 0.7 + seed.phase) * 0.18;
        }
        attr.needsUpdate = true;
      }
      for (const item of conveyors) {
        const u = (time * 0.055 + item.offset) % 1;
        item.mesh.position.copy(item.curve.getPointAt(u));
        item.mesh.rotation.y = time * 0.35 + item.offset;
      }
      if (flowCurve && flowPulse) {
        flowPulse.position.copy(flowCurve.getPointAt((time * 0.05) % 1));
        flowPulse.scale.setScalar(0.82 + Math.sin(time * 4) * 0.16);
      }
      if (agv && agvBase) {
        agv.position.x = agvBase.x + Math.sin(time * 0.3) * 1.4;
        agv.position.z = agvBase.z + Math.cos(time * 0.24) * 0.7;
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((object) => {
        object.geometry?.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) mat?.dispose?.();
      });
      workers.dispose();
      sparks.forEach((spark) => spark.texture.dispose());
    },
  };
}
