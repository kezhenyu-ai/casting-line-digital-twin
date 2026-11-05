import * as THREE from 'three';

const ZONE_COLORS = {
  refining: 0xff9a52,
  melting: 0xffc857,
  pouring: 0xff7a5c,
  molding: 0x61efbd,
  shakeout: 0x8be7ef,
  sand: 0xd8c48a,
  utility: 0x67a9ff,
};

const ZONE_NAMES = {
  refining: 'AOD 精炼区',
  melting: '电炉熔炼区',
  pouring: '浇注 / 转运区',
  molding: '造型区',
  shakeout: '落砂区',
  sand: '砂再生 / 混砂区',
  utility: '公用动力区',
};

function makeTextTexture({
  title,
  subtitle = '',
  footer = '',
  width = 1024,
  height = 256,
  accent = '#61efbd',
  titleSize = 72,
  transparent = false,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (transparent) {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = 'rgba(3, 16, 18, 0.94)';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.strokeStyle = 'rgba(116, 226, 211, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.fillStyle = accent;
  ctx.fillRect(28, 28, 8, height - 56);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f1fbf7';
  ctx.font = `700 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", sans-serif`;
  ctx.fillText(title, 62, subtitle ? height * 0.4 : height * 0.5);
  if (subtitle) {
    ctx.fillStyle = 'rgba(197, 228, 220, 0.82)';
    ctx.font = '400 28px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.fillText(subtitle, 64, height * 0.7);
  }
  if (footer) {
    ctx.fillStyle = 'rgba(97, 239, 189, 0.85)';
    ctx.font = '600 22px "Bahnschrift", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(footer, width - 34, height - 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function makeFloorTexture(title, subtitle, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 220);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 7;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 1008, 204);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2fff9';
  ctx.font = '700 82px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.fillText(title, 48, 96);
  ctx.fillStyle = accent;
  ctx.font = '600 24px "Bahnschrift", "Microsoft YaHei", sans-serif';
  ctx.fillText(subtitle, 50, 168);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function signPlane(texture, width, height) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
}

function box(w, h, d, color, roughness = 0.75, metalness = 0.18) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness, metalness }),
  );
}

function lineLoop(points, color, opacity = 0.7) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}

function makeAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#182226';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i += 1) {
    const v = 20 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgba(${v},${v + 5},${v + 7},0.28)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  ctx.strokeStyle = 'rgba(8, 12, 14, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, 0);
    ctx.lineTo(Math.random() * 256, 256);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addRoad(scene, objects, x, z, width, depth, y, asphalt) {
  const map = asphalt.clone();
  map.needsUpdate = true;
  map.repeat.set(Math.max(1, width / 12), Math.max(1, depth / 12));
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0xb4bec0, map, roughness: 0.86, metalness: 0.06 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, y, z);
  scene.add(road);
  objects.push(road);

  const laneMaterial = new THREE.MeshBasicMaterial({ color: 0xe5dfb4, transparent: true, opacity: 0.72 });
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xd7d0a2, transparent: true, opacity: 0.5 });
  const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x929d96, roughness: 0.82, metalness: 0.08 });
  const walkMaterial = new THREE.MeshStandardMaterial({ color: 0x5d6a66, roughness: 0.9, metalness: 0.03 });
  const alongX = width >= depth;
  const count = Math.floor((alongX ? width : depth) / 9);
  for (let i = 0; i < count; i += 1) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 4.5 : 0.18, alongX ? 0.18 : 4.5), laneMaterial);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(
      alongX ? x - width / 2 + 4 + i * 9 : x,
      y + 0.012,
      alongX ? z : z - depth / 2 + 4 + i * 9,
    );
    scene.add(dash);
    objects.push(dash);
  }

  const edges = alongX
    ? [{ dx: 0, dz: -depth / 2 + 0.35 }, { dx: 0, dz: depth / 2 - 0.35 }]
    : [{ dx: -width / 2 + 0.35, dz: 0 }, { dx: width / 2 - 0.35, dz: 0 }];
  for (const edge of edges) {
    const line = alongX
      ? new THREE.Mesh(new THREE.PlaneGeometry(width, 0.12), lineMaterial)
      : new THREE.Mesh(new THREE.PlaneGeometry(0.12, depth), lineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x + edge.dx, y + 0.014, z + edge.dz);
    scene.add(line);
    objects.push(line);

    const curb = alongX
      ? new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.32), curbMaterial)
      : new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, depth), curbMaterial);
    curb.position.set(
      x + edge.dx * 1.9,
      y + 0.11,
      z + edge.dz * 1.9,
    );
    scene.add(curb);
    objects.push(curb);

    const walk = alongX
      ? new THREE.Mesh(new THREE.PlaneGeometry(width, 1.5), walkMaterial)
      : new THREE.Mesh(new THREE.PlaneGeometry(1.5, depth), walkMaterial);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(
      x + edge.dx * 2.1,
      y + 0.008,
      z + edge.dz * 2.1,
    );
    scene.add(walk);
    objects.push(walk);
  }
}

function addTree(scene, objects, x, z, y, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x5b4128, roughness: 0.9 }),
  );
  trunk.position.set(x, y + 1.1 * scale, z);
  trunk.scale.setScalar(scale);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x245a45, roughness: 0.9 }),
  );
  crown.position.set(x, y + 4.0 * scale, z);
  crown.scale.setScalar(scale);
  scene.add(trunk, crown);
  objects.push(trunk, crown);
}

function addCar(scene, objects, x, z, y, color) {
  const body = box(3.2, 0.8, 1.6, color, 0.5, 0.35);
  body.position.set(x, y + 0.55, z);
  const roof = box(1.7, 0.55, 1.4, 0x1a2c2e, 0.4, 0.4);
  roof.position.set(x - 0.25, y + 1.15, z);
  scene.add(body, roof);
  objects.push(body, roof);
}

export function createSiteLayout(scene, factory) {
  const objects = [];
  const textures = [];
  const root = new THREE.Group();
  root.name = 'SITE_LAYOUT';
  scene.add(root);
  objects.push(root);

  const box3 = factory.modelBox;
  const size = box3.getSize(new THREE.Vector3());
  const center = box3.getCenter(new THREE.Vector3());
  const y = (factory.floorY ?? 0) + 0.015;
  const margin = Math.max(10, Math.max(size.x, size.z) * 0.08);
  const site = {
    minX: box3.min.x - margin * 2,
    maxX: box3.max.x + margin * 2,
    minZ: box3.min.z - margin * 2,
    maxZ: box3.max.z + margin * 2,
  };
  const width = site.maxX - site.minX;
  const depth = site.maxZ - site.minZ;
  const asphalt = makeAsphaltTexture();
  textures.push(asphalt);

  // Grass perimeter and a compact service road around the plant.
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 30, depth + 30),
    new THREE.MeshStandardMaterial({ color: 0x123b2c, roughness: 0.96 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(center.x, y - 0.16, center.z);
  scene.add(grass);
  objects.push(grass);

  const roadZ = site.maxZ - margin * 0.55;
  addRoad(scene, objects, center.x, roadZ, width, Math.max(7, margin * 0.55), y + 0.02, asphalt);
  addRoad(scene, objects, site.minX + margin * 0.5, center.z, Math.max(6, margin * 0.45), depth * 0.82, y + 0.02, asphalt);
  addRoad(scene, objects, center.x, site.minZ + margin * 0.55, width, Math.max(7, margin * 0.45), y + 0.02, asphalt);

  const crosswalkMat = new THREE.MeshBasicMaterial({ color: 0xe8e1b8, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 7; i += 1) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 5.2), crosswalkMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(center.x - 3 + i * 1, y + 0.065, roadZ);
    scene.add(stripe);
    objects.push(stripe);
  }

  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, -2.2);
  arrowShape.lineTo(-1.1, -0.1);
  arrowShape.lineTo(-0.35, -0.1);
  arrowShape.lineTo(-0.35, 2.2);
  arrowShape.lineTo(0.35, 2.2);
  arrowShape.lineTo(0.35, -0.1);
  arrowShape.lineTo(1.1, -0.1);
  arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xe8e1b8, transparent: true, opacity: 0.5 });
  for (const [ax, az] of [[center.x - width * 0.28, roadZ - 1.5], [center.x + width * 0.22, roadZ + 1.5]]) {
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = az < roadZ ? Math.PI / 2 : -Math.PI / 2;
    arrow.position.set(ax, y + 0.07, az);
    scene.add(arrow);
    objects.push(arrow);
  }

  // Perimeter fence: simple line rails plus readable posts, with a gate gap.
  const fenceColor = 0x6e8b82;
  const rail = [];
  const gateHalf = Math.max(9, margin * 0.8);
  const gateZ = site.maxZ - margin * 0.2;
  const corners = [
    [site.minX, site.minZ, site.maxX, site.minZ],
    [site.maxX, site.minZ, site.maxX, gateZ],
    [site.maxX, gateZ, site.maxX, site.maxZ],
    [site.minX, site.maxZ, site.maxX, site.maxZ],
    [site.minX, site.minZ, site.minX, site.maxZ],
  ];
  for (const [x1, z1, x2, z2] of corners) {
    const segments = Math.max(1, Math.floor(Math.hypot(x2 - x1, z2 - z1) / 7));
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const px = x1 + (x2 - x1) * t;
      const pz = z1 + (z2 - z1) * t;
      if (Math.abs(pz - gateZ) < gateHalf && Math.abs(px - center.x) < gateHalf) continue;
      const post = box(0.18, 2.4, 0.18, 0x4d625d, 0.8, 0.35);
      post.position.set(px, y + 1.2, pz);
      root.add(post);
    }
    rail.push(new THREE.Vector3(x1, y + 1.1, z1), new THREE.Vector3(x2, y + 1.1, z2));
    rail.push(new THREE.Vector3(x1, y + 2.1, z1), new THREE.Vector3(x2, y + 2.1, z2));
  }
  const fence = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(rail),
    new THREE.LineBasicMaterial({ color: fenceColor, transparent: true, opacity: 0.78 }),
  );
  root.add(fence);

  // Main gate and 3D site sign.
  const gateLeft = box(1.2, 8.5, 1.2, 0x2b3b3a, 0.65, 0.5);
  const gateRight = gateLeft.clone();
  gateLeft.position.set(center.x - gateHalf, y + 4.25, gateZ);
  gateRight.position.set(center.x + gateHalf, y + 4.25, gateZ);
  const beam = box(gateHalf * 2 + 1.4, 1.2, 1.4, 0x2b3b3a, 0.6, 0.55);
  beam.position.set(center.x, y + 8.5, gateZ);
  root.add(gateLeft, gateRight, beam);
  for (const [dx, color] of [[-gateHalf + 1.2, 0xffb52e], [gateHalf - 1.2, 0xffb52e]]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    lamp.position.set(center.x + dx, y + 8.9, gateZ + 0.3);
    root.add(lamp);
  }

  // Zone pads and floor decals, keyed by the equipment stage.
  const stageByEquipment = {
    'AOD-01': 'refining',
    'MELT-01': 'melting',
    'POUR-01': 'pouring',
    'POUR-02': 'pouring',
    'AGV-01': 'pouring',
    'MOLD-01': 'molding',
    'SHAKE-01': 'shakeout',
    'MIX-01': 'sand',
    'MIX-02': 'sand',
    'SAND-01': 'sand',
    'WATER-01': 'utility',
  };
  let zoneIndex = 0;
  for (const [equipmentId, stage] of Object.entries(stageByEquipment)) {
    const eq = factory.equipment.get(equipmentId);
    if (!eq) continue;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    const zw = Math.max(8, (b.max.x - b.min.x) + 5);
    const zd = Math.max(8, (b.max.z - b.min.z) + 5);
    const color = ZONE_COLORS[stage] || 0x61efbd;
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(zw, zd),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(c.x, y + 0.1, c.z);
    root.add(pad);
    objects.push(pad);

    const borderPoints = [
      new THREE.Vector3(c.x - zw / 2, y + 0.12, c.z - zd / 2),
      new THREE.Vector3(c.x + zw / 2, y + 0.12, c.z - zd / 2),
      new THREE.Vector3(c.x + zw / 2, y + 0.12, c.z + zd / 2),
      new THREE.Vector3(c.x - zw / 2, y + 0.12, c.z + zd / 2),
    ];
    const border = lineLoop(borderPoints, color, 0.45);
    root.add(border);
    objects.push(border);

    if (zoneIndex % 2 === 0 || equipmentId === 'AOD-01') {
      const labelTexture = makeFloorTexture(
        ZONE_NAMES[stage] || equipmentId,
        equipmentId,
        `#${color.toString(16).padStart(6, '0')}`,
      );
      textures.push(labelTexture);
      const label = signPlane(labelTexture, Math.min(15, zw * 0.9), 3);
      label.rotation.x = -Math.PI / 2;
      label.position.set(c.x, y + 0.14, c.z + zd / 2 + 2.4);
      root.add(label);
    }
    zoneIndex += 1;
  }

  // Parking and visitor area beside the gate.
  const parkingX = site.maxX - margin * 1.4;
  const parkingZ = gateZ - margin * 1.2;
  const parking = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 11),
    new THREE.MeshStandardMaterial({ color: 0x0a1214, roughness: 0.9 }),
  );
  parking.rotation.x = -Math.PI / 2;
  parking.position.set(parkingX, y + 0.025, parkingZ);
  root.add(parking);
  objects.push(parking);
  for (let i = 0; i < 4; i += 1) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 8),
      new THREE.MeshBasicMaterial({ color: 0xd5d0a8, transparent: true, opacity: 0.55 }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(parkingX - 7.5 + i * 5, y + 0.04, parkingZ);
    root.add(line);
    objects.push(line);
  }
  addCar(scene, objects, parkingX - 7.5, parkingZ, y, 0x5d7d7f);
  addCar(scene, objects, parkingX - 2.5, parkingZ, y, 0x8a6a3f);
  addCar(scene, objects, parkingX + 2.5, parkingZ, y, 0x3c5d70);

  // A few trees and yard elements give the site a believable boundary.
  const treeY = y;
  const treePositions = [
    [site.minX + margin * 0.6, site.minZ + margin * 0.5],
    [site.minX + margin * 1.2, site.minZ + margin * 0.5],
    [site.maxX - margin * 0.6, site.minZ + margin * 0.5],
    [site.maxX - margin * 1.2, site.minZ + margin * 0.5],
    [site.minX + margin * 0.5, site.maxZ - margin * 0.5],
    [site.maxX - margin * 0.5, site.maxZ - margin * 0.5],
    [site.minX + margin * 0.5, center.z],
    [site.maxX - margin * 0.5, center.z],
  ];
  treePositions.forEach(([x, z], i) => addTree(scene, objects, x, z, treeY, 0.85 + (i % 3) * 0.12));

  const lightPoleMaterial = new THREE.MeshStandardMaterial({ color: 0x81918c, roughness: 0.5, metalness: 0.5 });
  for (let i = 0; i < 4; i += 1) {
    const x = center.x - width * 0.32 + i * (width * 0.21);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 8, 6), lightPoleMaterial);
    pole.position.set(x, y + 4, gateZ - 1.5);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    );
    lamp.position.set(x, y + 8.1, gateZ - 1.5);
    root.add(pole, lamp);
    objects.push(pole, lamp);
  }

  return {
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
      for (const object of objects) {
        if (!object || object === root) continue;
        scene.remove(object);
        object.geometry?.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) {
          if (!mat) continue;
          mat.map?.dispose();
          mat.dispose?.();
        }
      }
      for (const texture of textures) texture.dispose();
    },
  };
}
