import * as THREE from 'three';

const ORANGE = new THREE.MeshStandardMaterial({ color: 0xc35b24, roughness: 0.46, metalness: 0.48 });
const ORANGE_LIGHT = new THREE.MeshStandardMaterial({ color: 0xe17a2f, roughness: 0.48, metalness: 0.4 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x9aa5a4, roughness: 0.42, metalness: 0.7 });
const STEEL_DARK = new THREE.MeshStandardMaterial({ color: 0x3d4b4f, roughness: 0.5, metalness: 0.55 });
const BLUE = new THREE.MeshStandardMaterial({ color: 0x2a9dcc, emissive: 0x092e3a, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.55 });
const YELLOW = new THREE.MeshStandardMaterial({ color: 0xd3a52e, roughness: 0.58, metalness: 0.25 });
const GREEN = new THREE.MeshStandardMaterial({ color: 0x2b714d, roughness: 0.58, metalness: 0.25 });
const RUBBER = new THREE.MeshStandardMaterial({ color: 0x111718, roughness: 0.88, metalness: 0.04 });

function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(r, h, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function equipmentBox(factory, id) {
  const eq = factory.equipment.get(id);
  if (!eq) return null;
  const box3 = new THREE.Box3().setFromObject(eq.group);
  return { eq, box: box3, center: box3.getCenter(new THREE.Vector3()), size: box3.getSize(new THREE.Vector3()) };
}

export function createStructureFrames(scene, factory) {
  const root = new THREE.Group();
  root.name = 'STRUCTURE_FRAMES';
  scene.add(root);
  const floorY = factory.floorY ?? 0;
  const modelBox = factory.modelBox;
  const size = modelBox.getSize(new THREE.Vector3());
  const center = modelBox.getCenter(new THREE.Vector3());
  const animated = [];
  const cranes = [];
  let transport = null;

  const addGantry = (z, span, label) => {
    const legH = 9.5;
    const xL = center.x - span / 2;
    const xR = center.x + span / 2;
    for (const x of [xL, xR]) {
      const leg = box(0.62, legH, 0.62, ORANGE);
      leg.position.set(x, floorY + legH / 2, z);
      const base = box(1.2, 0.18, 1.2, STEEL_DARK);
      base.position.set(x, floorY + 0.09, z);
      const foot = box(0.9, 0.3, 0.9, ORANGE_LIGHT);
      foot.position.set(x, floorY + 0.28, z);
      root.add(leg, base, foot);
    }
    const beam = box(span + 1.2, 0.7, 0.8, ORANGE);
    beam.position.set(center.x, floorY + legH, z);
    const topRail = box(span + 1.2, 0.14, 1.25, ORANGE_LIGHT);
    topRail.position.set(center.x, floorY + legH + 0.45, z);
    root.add(beam, topRail);
    for (const x of [xL + 3, xR - 3]) {
      const brace = box(0.12, 0.12, 3.8, ORANGE_LIGHT);
      brace.rotation.x = -0.55;
      brace.position.set(x, floorY + 6.4, z + 1.2);
      root.add(brace);
    }
    const trolley = box(2.3, 0.8, 1.5, ORANGE_LIGHT);
    trolley.position.set(center.x, floorY + legH - 0.75, z);
    const drum = cylinder(0.34, 1.4, STEEL_DARK, 12);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(center.x, floorY + legH - 1.25, z);
    const cable = cylinder(0.045, 4.5, STEEL_DARK, 6);
    cable.position.set(center.x, floorY + legH - 3.5, z);
    const hook = new THREE.Group();
    const hookBody = box(0.7, 0.28, 0.7, YELLOW);
    const hookTip = cylinder(0.13, 0.5, YELLOW, 8);
    hookTip.position.y = -0.32;
    hook.add(hookBody, hookTip);
    hook.position.set(center.x, floorY + legH - 5.8, z);
    root.add(trolley, drum, cable, hook);
    animated.push({
      update(time) {
        const x = center.x + Math.sin(time * 0.27 + z * 0.01) * (span / 2 - 5);
        trolley.position.x = x;
        drum.position.x = x;
        cable.position.x = x;
        hook.position.x = x;
        hook.position.y = floorY + legH - 5.8 + Math.sin(time * 0.9 + z) * 0.1;
      },
    });
    return { z };
  };

  const mold = equipmentBox(factory, 'MOLD-01');
  const pour = equipmentBox(factory, 'POUR-01');
  const shake = equipmentBox(factory, 'SHAKE-01');
  if (mold) {
    addGantry(mold.center.z, Math.min(38, size.x * 0.32), 'mold');
    addGantry(mold.center.z - 15, Math.min(32, size.x * 0.28), 'mold-2');
  }

  // Orange crane runway beams and two bridge cranes.
  const railSpan = Math.max(40, size.x * 0.46);
  const railZ = Math.max(28, size.z * 0.55);
  for (const x of [center.x - railSpan / 2, center.x + railSpan / 2]) {
    const runway = box(0.5, 0.55, railZ * 1.25, ORANGE);
    runway.position.set(x, floorY + 11.4, center.z);
    root.add(runway);
    for (let z = center.z - railZ * 0.58; z <= center.z + railZ * 0.58; z += 8) {
      const bracket = box(1.4, 0.12, 0.5, STEEL_DARK);
      bracket.position.set(x + (x < center.x ? 0.65 : -0.65), floorY + 10.9, z);
      const drop = box(0.1, 0.55, 0.1, STEEL_DARK);
      drop.position.set(x + (x < center.x ? 0.9 : -0.9), floorY + 10.6, z);
      root.add(bracket, drop);
    }
  }
  const bridgeZ = [center.z - 12, center.z + 15];
  for (const z of bridgeZ) {
    const bridge = box(railSpan + 1.0, 0.55, 0.65, ORANGE);
    bridge.position.set(center.x, floorY + 11.9, z);
    root.add(bridge);
    const trolley = box(2.1, 0.7, 1.4, ORANGE_LIGHT);
    trolley.position.set(center.x + railSpan * 0.14, floorY + 11.4, z);
    const cable = cylinder(0.05, 3.5, STEEL_DARK, 6);
    cable.position.set(trolley.position.x, floorY + 9.45, z);
    const hook = new THREE.Group();
    const mouth = box(0.55, 0.25, 0.55, YELLOW);
    const tip = cylinder(0.1, 0.4, YELLOW, 8);
    tip.position.y = -0.28;
    hook.add(mouth, tip);
    hook.position.set(trolley.position.x, floorY + 7.8, z);
    root.add(trolley, cable, hook);
    const crane = { trolley, cable, hook, z, span: railSpan * 0.34 };
    cranes.push(crane);
    animated.push({
      update(time) {
        const x = center.x + Math.sin(time * 0.2 + z * 0.03) * crane.span;
        trolley.position.x = x;
        cable.position.x = x;
        hook.position.x = x;
      },
    });
  }

  // Connected blue transport loop. The track is a closed curve, so there are
  // no disconnected rail ends when the camera walks around the plant.
  const rx = Math.min(size.x * 0.34, 62);
  const rz = Math.min(size.z * 0.3, 20);
  const trackPoints = [
    new THREE.Vector3(center.x - rx, floorY + 0.18, center.z - rz),
    new THREE.Vector3(center.x + rx, floorY + 0.18, center.z - rz),
    new THREE.Vector3(center.x + rx, floorY + 0.18, center.z + rz),
    new THREE.Vector3(center.x - rx, floorY + 0.18, center.z + rz),
  ];
  const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true, 'centripetal', 0.18);
  const leftPts = [];
  const rightPts = [];
  const trackSamples = 96;
  for (let i = 0; i < trackSamples; i += 1) {
    const t = i / trackSamples;
    const p = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    leftPts.push(p.clone().addScaledVector(normal, 0.62));
    rightPts.push(p.clone().addScaledVector(normal, -0.62));
  }
  const leftCurve = new THREE.CatmullRomCurve3(leftPts, true, 'centripetal', 0.18);
  const rightCurve = new THREE.CatmullRomCurve3(rightPts, true, 'centripetal', 0.18);
  for (const curve of [leftCurve, rightCurve]) {
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.11, 6, true), BLUE);
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);
  }
  for (let i = 0; i < 40; i += 1) {
    const t = i / 40;
    const p = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const tie = box(1.55, 0.06, 0.12, BLUE);
    tie.position.copy(p);
    tie.rotation.y = Math.atan2(tangent.x, tangent.z);
    root.add(tie);
  }
  for (let i = 0; i < 16; i += 1) {
    const p = trackCurve.getPointAt(i / 16);
    const post = box(0.12, 0.18, 0.12, STEEL_DARK);
    post.position.copy(p);
    post.position.y = floorY + 0.09;
    const saddle = box(0.42, 0.16, 0.42, BLUE);
    saddle.position.copy(p);
    saddle.position.y = floorY + 0.08;
    root.add(post, saddle);
  }

  // The rail transport carriage runs along the connected loop.
  transport = new THREE.Group();
  const base = box(3.6, 0.34, 1.95, STEEL_DARK);
  base.position.y = 0.58;
  transport.add(base);
  for (const [x, z] of [[-1.25, -0.62], [1.25, -0.62], [-1.25, 0.62], [1.25, 0.62]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), RUBBER);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    transport.add(wheel);
  }
  const turntable = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.18, 20), BLUE);
  turntable.position.y = 0.83;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.13, 8, 28), STEEL);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.08;
  const carrier = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.8, 14), GREEN);
  carrier.position.y = 1.45;
  transport.add(turntable, ring, carrier);
  root.add(transport);

  // Safety posts around the pouring area.
  if (pour) {
    const railY = floorY + 1.0;
    for (let i = -2; i <= 2; i += 1) {
      const post = box(0.1, 1.0, 0.1, YELLOW);
      post.position.set(pour.center.x + i * 3.0, floorY + 0.5, pour.center.z + 7);
      root.add(post);
    }
    const bar = box(12.2, 0.08, 0.08, YELLOW);
    bar.position.set(pour.center.x, railY, pour.center.z + 7);
    root.add(bar);
  }

  // Legs / bracing around the green sand hoppers.
  for (const id of ['MIX-01', 'SAND-01']) {
    const data = equipmentBox(factory, id);
    if (!data) continue;
    const { min, max } = data.box;
    const corner = [
      [min.x + 0.8, min.z + 0.8], [max.x - 0.8, min.z + 0.8],
      [min.x + 0.8, max.z - 0.8], [max.x - 0.8, max.z - 0.8],
    ];
    for (const [x, z] of corner) {
      const leg = box(0.22, 4.2, 0.22, STEEL);
      leg.position.set(x, floorY + 2.1, z);
      root.add(leg);
      const brace = box(0.1, 0.1, 4.8, STEEL_DARK);
      brace.rotation.y = Math.PI / 4;
      brace.position.set(x, floorY + 2.2, z);
      root.add(brace);
    }
  }

  return {
    root,
    update(dt, time) {
      for (const item of animated) item.update(time);
      if (transport) {
        const u = (time * 0.028 + 0.48) % 1;
        const p = trackCurve.getPointAt(u);
        const tangent = trackCurve.getTangentAt(u);
        transport.position.set(p.x, floorY, p.z);
        transport.rotation.y = Math.atan2(tangent.x, tangent.z);
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
