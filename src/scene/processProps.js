import * as THREE from 'three';
import { makeSmokeTexture } from './proceduralEffects.js';

const STEEL = new THREE.MeshStandardMaterial({ color: 0x68797c, roughness: 0.5, metalness: 0.45 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x35464b, roughness: 0.58, metalness: 0.35 });
const YELLOW = new THREE.MeshStandardMaterial({ color: 0xdca92f, roughness: 0.62, metalness: 0.18 });
const ORANGE = new THREE.MeshStandardMaterial({ color: 0xc6672e, roughness: 0.62, metalness: 0.2 });
const BLUE = new THREE.MeshStandardMaterial({ color: 0x356f86, roughness: 0.52, metalness: 0.3 });
const RED = new THREE.MeshStandardMaterial({ color: 0xa74335, roughness: 0.65, metalness: 0.18 });

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cylinder(rTop, rBottom, h, mat, segments = 10) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat);
}

function worldBox(factory, id) {
  const eq = factory.equipment.get(id);
  return eq ? new THREE.Box3().setFromObject(eq.group) : null;
}

function addWorker(root, workers, x, z, floorY, color, scale = 1) {
  const group = new THREE.Group();
  const body = box(0.42 * scale, 0.95 * scale, 0.28 * scale, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05 }));
  body.position.y = 0.78 * scale;
  const legs = box(0.34 * scale, 0.5 * scale, 0.25 * scale, new THREE.MeshStandardMaterial({ color: 0x27383d, roughness: 0.85 }));
  legs.position.y = 0.27 * scale;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19 * scale, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc99570, roughness: 0.82 }),
  );
  head.position.y = 1.42 * scale;
  const helmet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21 * scale, 0.24 * scale, 0.12 * scale, 10),
    new THREE.MeshStandardMaterial({ color: 0xf0c84a, roughness: 0.55, metalness: 0.15 }),
  );
  helmet.position.y = 1.56 * scale;
  group.add(body, legs, head, helmet);
  group.position.set(x, floorY, z);
  root.add(group);
  workers.push({ group, baseX: x, baseZ: z, phase: Math.random() * 8, speed: 0.16 + Math.random() * 0.1 });
}

function addPipe(root, x, y, z, length, material, axis = 'x') {
  const pipe = cylinder(0.24, 0.24, length, material, 10);
  if (axis === 'x') pipe.rotation.z = Math.PI / 2;
  else pipe.rotation.x = Math.PI / 2;
  pipe.position.set(x, y, z);
  root.add(pipe);
}

export function createProcessProps(scene, factory) {
  const root = new THREE.Group();
  root.name = 'PROCESS_PROPS';
  scene.add(root);
  const floorY = factory.floorY ?? 0;
  const workers = [];
  const plumes = [];
  const smokeTexture = makeSmokeTexture();
  const animated = [];

  const sandBox = worldBox(factory, 'SAND-01');
  const meltBox = worldBox(factory, 'MELT-01');
  const moldBox = worldBox(factory, 'MOLD-01');
  const pourBox = worldBox(factory, 'POUR-01');
  const waterBox = worldBox(factory, 'WATER-01');

  // Three stacks give the plant a recognizable silhouette; the smoke is a
  // procedural particle plume rather than a static sprite.
  const stackBase = sandBox || meltBox;
  if (stackBase) {
    const cx = stackBase.getCenter(new THREE.Vector3()).x;
    const z = stackBase.min.z + 1;
    for (let i = 0; i < 3; i += 1) {
      const x = cx - 22 + i * 13;
      const stack = cylinder(1.15, 1.8, 28, new THREE.MeshStandardMaterial({ color: 0x8b999a, roughness: 0.76, metalness: 0.18 }), 14);
      stack.position.set(x, floorY + 14, z);
      const band = cylinder(1.32, 1.32, 1.8, RED, 14);
      band.position.set(x, floorY + 22, z);
      const top = cylinder(1.22, 1.22, 0.35, DARK, 14);
      top.position.set(x, floorY + 28.2, z);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a32 }));
      light.position.set(x, floorY + 28.7, z);
      root.add(stack, band, top, light);

      const positions = new Float32Array(70 * 3);
      const seeds = [];
      for (let p = 0; p < 70; p += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 3;
        positions[p * 3] = x + Math.cos(angle) * radius;
        positions[p * 3 + 1] = floorY + 28 + Math.random() * 10;
        positions[p * 3 + 2] = z + Math.sin(angle) * radius;
        seeds.push({ x: positions[p * 3], z: positions[p * 3 + 2], phase: Math.random() * 10, speed: 0.35 + Math.random() * 0.5 });
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: 0xaebbb7,
        map: smokeTexture,
        size: 6.5,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const plume = new THREE.Points(geometry, material);
      plume.frustumCulled = false;
      plume.renderOrder = 6;
      root.add(plume);
      plumes.push({ points: plume, seeds, x, z });
    }
  }

  // Overhead crane above the single molding line.
  if (moldBox) {
    const center = moldBox.getCenter(new THREE.Vector3());
    const size = moldBox.getSize(new THREE.Vector3());
    const span = Math.max(18, Math.min(34, size.x + 6));
    const y = moldBox.max.y + 8;
    const crane = new THREE.Group();
    const railA = box(span, 0.3, 0.3, STEEL);
    railA.position.set(center.x, y, center.z - span / 2);
    const railB = railA.clone();
    railB.position.z = center.z + span / 2;
    const beam = box(span, 0.36, 0.36, STEEL);
    beam.position.set(center.x, y, center.z);
    const trolley = box(2.2, 0.8, 1.2, YELLOW);
    trolley.position.set(center.x, y - 0.7, center.z);
    const cable = cylinder(0.06, 0.06, 5, DARK, 6);
    cable.position.set(center.x, y - 3.4, center.z);
    const hook = box(1.0, 0.35, 1.0, YELLOW);
    hook.position.set(center.x, y - 6.1, center.z);
    crane.add(railA, railB, beam, trolley, cable, hook);
    root.add(crane);
    animated.push({
      update(time) {
        const x = center.x + Math.sin(time * 0.38) * (span / 2 - 2.5);
        trolley.position.x = x;
        cable.position.x = x;
        hook.position.x = x;
        hook.position.y = y - 6.1 + Math.sin(time * 1.1) * 0.12;
      },
    });
  }

  // Ladle carriage + molten stream near the pouring / molding interface.
  if (pourBox) {
    const center = pourBox.getCenter(new THREE.Vector3());
    const x = center.x + (moldBox ? 16 : 8);
    const z = center.z + 8;
    const carriage = box(5.2, 0.6, 3.2, DARK);
    carriage.position.set(x, floorY + 0.3, z);
    const support = box(1.0, 4.5, 1.0, STEEL);
    support.position.set(x - 2, floorY + 2.25, z);
    const ladle = new THREE.Group();
    const bowl = cylinder(2.2, 1.7, 2.8, STEEL, 16);
    const molten = cylinder(1.8, 1.8, 0.12, new THREE.MeshBasicMaterial({ color: 0xff8a2c }), 16);
    molten.position.y = 1.35;
    ladle.add(bowl, molten);
    ladle.position.set(x, floorY + 5.2, z);
    const stream = cylinder(0.15, 0.32, 4.0, new THREE.MeshBasicMaterial({ color: 0xff7a24 }), 8);
    stream.position.set(x, floorY + 2.2, z);
    root.add(carriage, support, ladle, stream);
    animated.push({
      update(time) {
        ladle.rotation.z = Math.sin(time * 0.5) * 0.16;
        stream.material.opacity = 0.55 + Math.sin(time * 3) * 0.15;
        stream.scale.x = 0.9 + Math.sin(time * 2.2) * 0.1;
      },
    });
  }

  // Pipe rack along the rear service aisle.
  if (meltBox) {
    const center = meltBox.getCenter(new THREE.Vector3());
    const x = center.x;
    const z = (sandBox || meltBox).min.z + 4;
    const y = floorY + 5.5;
    const length = Math.max(30, (sandBox || meltBox).getSize(new THREE.Vector3()).x - 6);
    addPipe(root, x, y, z, length, ORANGE, 'x');
    addPipe(root, x, y + 0.7, z + 0.8, length, BLUE, 'x');
    addPipe(root, x, y + 1.4, z + 1.6, length, STEEL, 'x');
    for (let i = 0; i < 5; i += 1) {
      const post = box(0.18, y - floorY, 0.18, DARK);
      post.position.set(x - length / 2 + 4 + i * (length / 5), floorY + (y - floorY) / 2, z + 1.6);
      root.add(post);
    }
  }

  // Safety railing around the ladle zone.
  if (pourBox) {
    const center = pourBox.getCenter(new THREE.Vector3());
    const x = center.x + 16;
    const z = center.z + 8;
    const postMat = YELLOW;
    for (const [px, pz] of [[x - 4, z - 3], [x + 4, z - 3], [x - 4, z + 3], [x + 4, z + 3]]) {
      const post = box(0.12, 1.1, 0.12, postMat);
      post.position.set(px, floorY + 0.55, pz);
      root.add(post);
    }
    const bar = box(8.2, 0.1, 0.1, postMat);
    bar.position.set(x, floorY + 1.0, z + 3);
    root.add(bar);
  }

  // Workers on the aisle.
  const workerSpots = [
    [moldBox?.getCenter(new THREE.Vector3()).x - 10, moldBox?.getCenter(new THREE.Vector3()).z + 8, 0xe3a72f],
    [moldBox?.getCenter(new THREE.Vector3()).x + 9, moldBox?.getCenter(new THREE.Vector3()).z + 10, 0xe3a72f],
    [pourBox?.getCenter(new THREE.Vector3()).x - 8, pourBox?.getCenter(new THREE.Vector3()).z + 10, 0xdf7b32],
    [waterBox?.getCenter(new THREE.Vector3()).x + 5, waterBox?.getCenter(new THREE.Vector3()).z + 6, 0xe3a72f],
    [sandBox?.getCenter(new THREE.Vector3()).x + 8, sandBox?.getCenter(new THREE.Vector3()).z - 5, 0xdf7b32],
  ];
  for (const [x, z, color] of workerSpots) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    addWorker(root, workers, x, z, floorY, color);
  }
  animated.push({
    update(time) {
      for (const worker of workers) {
        worker.group.position.x = worker.baseX + Math.sin(time * worker.speed + worker.phase) * 2.2;
        worker.group.position.z = worker.baseZ + Math.cos(time * worker.speed * 0.7 + worker.phase) * 0.8;
        worker.group.rotation.y = Math.atan2(
          Math.cos(time * worker.speed + worker.phase),
          -Math.sin(time * worker.speed * 0.7 + worker.phase),
        );
      }
    },
  });

  return {
    update(dt, time) {
      for (const item of animated) item.update(time);
      for (const plume of plumes) {
        const attr = plume.points.geometry.attributes.position;
        for (let i = 0; i < plume.seeds.length; i += 1) {
          const seed = plume.seeds[i];
          attr.array[i * 3 + 1] = floorY + 28 + ((time * seed.speed + seed.phase) % 11);
          attr.array[i * 3] = seed.x + Math.sin(time * 0.4 + seed.phase) * 0.8;
          attr.array[i * 3 + 2] = seed.z + Math.cos(time * 0.35 + seed.phase) * 0.8;
        }
        attr.needsUpdate = true;
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((object) => {
        object.geometry?.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.map?.dispose();
          mat.dispose?.();
        }
      });
      smokeTexture.dispose();
    },
  };
}
