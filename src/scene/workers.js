import * as THREE from 'three';

const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a6a55, roughness: 0.82, metalness: 0.02 });
const vestMat = new THREE.MeshStandardMaterial({ color: 0xd09b2e, roughness: 0.62, metalness: 0.08 });
const helmetMat = new THREE.MeshStandardMaterial({ color: 0xd86527, roughness: 0.5, metalness: 0.25 });
const reflectiveMat = new THREE.MeshStandardMaterial({ color: 0xc9d6cd, roughness: 0.36, metalness: 0.35, emissive: 0x39413c, emissiveIntensity: 0.4 });
const legMat = new THREE.MeshStandardMaterial({ color: 0x1b292e, roughness: 0.88, metalness: 0.04 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x070b0c, roughness: 0.8, metalness: 0.2 });

function addBox(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createWorker(x, z, floorY, rotation = 0, options = {}) {
  const worker = new THREE.Group();
  worker.position.set(x, floorY, z);
  worker.rotation.y = rotation;
  worker.scale.setScalar(options.scale || 1);
  const vest = options.vest || vestMat;
  const leftLeg = addBox(worker, 0.15, 0.74, 0.16, legMat, -0.12, 0.4, 0);
  const rightLeg = addBox(worker, 0.15, 0.74, 0.16, legMat, 0.12, 0.4, 0);
  addBox(worker, 0.18, 0.1, 0.28, blackMat, -0.12, 0.06, 0.04);
  addBox(worker, 0.18, 0.1, 0.28, blackMat, 0.12, 0.06, 0.04);
  addBox(worker, 0.42, 0.62, 0.25, vest, 0, 1.07, 0);
  addBox(worker, 0.44, 0.06, 0.27, reflectiveMat, 0, 1.13, 0);
  addBox(worker, 0.44, 0.04, 0.27, reflectiveMat, 0, 1.26, 0);
  const leftArm = addBox(worker, 0.1, 0.54, 0.12, vest, -0.27, 1.07, 0);
  const rightArm = addBox(worker, 0.1, 0.54, 0.12, vest, 0.27, 1.07, 0);
  worker.userData.leftLeg = leftLeg;
  worker.userData.rightLeg = rightLeg;
  worker.userData.leftArm = leftArm;
  worker.userData.rightArm = rightArm;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.18, 8), skinMat);
  head.position.set(0, 1.53, 0);
  head.castShadow = true;
  worker.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat);
  helmet.position.set(0, 1.58, 0);
  helmet.castShadow = true;
  worker.add(helmet);
  addBox(worker, 0.3, 0.045, 0.35, helmetMat, 0, 1.58, -0.02);
  return worker;
}

export function createWorkers(scene, factory) {
  const root = new THREE.Group();
  root.name = 'WORKERS';
  scene.add(root);
  const floorY = factory.floorY ?? 0;
  const workers = [];
  const positions = [
    ['AOD-01', -10, 8, 0xe3a72f],
    ['MELT-01', 14, 7, 0xe3a72f],
    ['POUR-01', -8, 10, 0xdf7b32],
    ['MOLD-01', 13, 12, 0xe3a72f],
    ['SHAKE-01', -12, 7, 0xe3a72f],
    ['SAND-01', 10, -5, 0xdf7b32],
    ['WATER-01', 8, 6, 0xe3a72f],
  ];
  for (const [id, dx, dz, color] of positions) {
    const eq = factory.equipment.get(id);
    if (!eq) continue;
    const box = new THREE.Box3().setFromObject(eq.group);
    const center = box.getCenter(new THREE.Vector3());
    const vest = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08 });
    const worker = createWorker(center.x + dx, center.z + dz, floorY, Math.random() * Math.PI * 2, { vest, scale: 0.96 });
    root.add(worker);
    workers.push({ group: worker, baseX: worker.position.x, baseZ: worker.position.z, phase: Math.random() * 8 });
  }

  // A few figures on the main pedestrian aisle keep the scene readable from
  // the overview camera.
  const mb = factory.modelBox;
  const mc = mb.getCenter(new THREE.Vector3());
  for (const [dx, dz, color] of [[-22, 12, 0xe3a72f], [2, 13, 0xdf7b32], [24, 11, 0xe3a72f]]) {
    const vest = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08 });
    const worker = createWorker(mc.x + dx, mc.z + dz, floorY, Math.PI, { vest, scale: 0.98 });
    root.add(worker);
    workers.push({ group: worker, baseX: worker.position.x, baseZ: worker.position.z, phase: Math.random() * 8 });
  }

  return {
    root,
    update(dt, time) {
      for (const worker of workers) {
        worker.group.position.x = worker.baseX + Math.sin(time * 0.18 + worker.phase) * 1.4;
        worker.group.position.z = worker.baseZ + Math.cos(time * 0.12 + worker.phase) * 0.45;
        worker.group.rotation.y = Math.atan2(
          Math.cos(time * 0.18 + worker.phase),
          -Math.sin(time * 0.12 + worker.phase),
        );
        const swing = Math.sin(time * 4.2 + worker.phase) * 0.42;
        const { leftLeg, rightLeg, leftArm, rightArm } = worker.group.userData;
        if (leftLeg) leftLeg.rotation.x = swing;
        if (rightLeg) rightLeg.rotation.x = -swing;
        if (leftArm) leftArm.rotation.x = -swing * 0.75;
        if (rightArm) rightArm.rotation.x = swing * 0.75;
      }
    },
    dispose() {
      scene.remove(root);
      root.traverse((object) => {
        object.geometry?.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) mat?.dispose?.();
      });
    },
  };
}
