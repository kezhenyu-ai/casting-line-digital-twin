import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  makeConcreteTexture,
  makeWallTexture,
  makeHazardStripeTexture,
  makeFloorDecal,
} from './textures.js';

const ZONE_DECALS = {
  'AOD-01': ['AOD 精炼区', 'AOD REFINING', '#d6ad58'],
  'MELT-01': ['电炉熔炼区', 'MELTING BAY', '#d6ad58'],
  'POUR-01': ['浇注区', 'POURING BAY', '#d6ad58'],
  'POUR-02': ['浇注区', 'POURING BAY', '#d6ad58'],
  'MOLD-01': ['造型区', 'MOLDING LINE', '#729f9c'],
  'SHAKE-01': ['落砂区', 'SHAKEOUT', '#d6ad58'],
  'MIX-01': ['砂处理区', 'SAND PREPARATION', '#729f9c'],
  'MIX-02': ['砂处理区', 'SAND PREPARATION', '#729f9c'],
  'SAND-01': ['砂再生区', 'SAND RECLAMATION', '#729f9c'],
  'WATER-01': ['公用动力区', 'UTILITY', '#729f9c'],
  'AGV-01': ['转运通道', 'AGV TRANSFER', '#729f9c'],
};

function makeWallSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 220);
  ctx.fillStyle = 'rgba(3, 12, 13, 0.48)';
  ctx.fillRect(0, 16, 1024, 188);
  ctx.strokeStyle = 'rgba(97, 239, 189, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 24, 1008, 172);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e1f7ef';
  ctx.font = '700 66px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.fillText('绿色铸造 · 智造未来', 512, 108);
  ctx.fillStyle = 'rgba(97, 239, 189, 0.82)';
  ctx.font = '500 22px "Bahnschrift", "Microsoft YaHei", sans-serif';
  ctx.fillText('BINHE CASTING WORKS  /  ZERO-EMISSION FOUNDRY', 512, 158);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function makeAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#151b1c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i += 1) {
    const v = 18 + Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgba(${v},${v + 5},${v + 6},0.3)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addBox(parent, w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, w, h, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createPlantEnvironment(scene, factory, { floorOnly = false } = {}) {
  const root = new THREE.Group();
  root.name = 'PLANT_ENVIRONMENT';
  scene.add(root);

  const modelBox = factory.modelBox;
  const size = modelBox.getSize(new THREE.Vector3());
  const center = modelBox.getCenter(new THREE.Vector3());
  const floorY = factory.floorY ?? 0;
  const width = Math.max(92, size.x + 20);
  const depth = Math.max(58, size.z + 20);
  const cx = center.x;
  const cz = center.z;
  const concrete = makeConcreteTexture();
  const wall = makeWallTexture();
  const hazard = makeHazardStripeTexture();
  const asphalt = makeAsphaltTexture();
  const wallSignTexture = makeWallSignTexture();
  concrete.repeat.set(Math.max(2, width / 18), Math.max(2, depth / 18));
  wall.repeat.set(Math.max(2, width / 14), 2);

  const mat = {
    ground: new THREE.MeshStandardMaterial({ color: 0x0b1011, roughness: 0.97, metalness: 0.05 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x151b1c, map: asphalt, roughness: 0.92, metalness: 0.06 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x696b63, map: concrete, roughness: 0.82, metalness: 0.08 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x4b4d47, map: concrete, roughness: 0.9, metalness: 0.06 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x5e6869, map: wall, roughness: 0.7, metalness: 0.48 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2d383d, roughness: 0.44, metalness: 0.86 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5e6b70, roughness: 0.38, metalness: 0.83 }),
    markAmber: new THREE.MeshBasicMaterial({ color: 0xd8a642, transparent: true, opacity: 0.62, depthWrite: false }),
    markWhite: new THREE.MeshBasicMaterial({ color: 0xcfe1d9, transparent: true, opacity: 0.34, depthWrite: false }),
    markCyan: new THREE.MeshBasicMaterial({ color: 0x61efbd, transparent: true, opacity: 0.5, depthWrite: false }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xb89a48, map: hazard, roughness: 0.7, metalness: 0.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0x102227, emissive: 0x4f9a9e, emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x222a29, emissive: 0xfff0d0, emissiveIntensity: 2.6 }),
    lampCyan: new THREE.MeshStandardMaterial({ color: 0x1a282b, emissive: 0x72f1e6, emissiveIntensity: 2.2 }),
    lampWhite: new THREE.MeshBasicMaterial({ color: 0xe0ffff, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false }),
  };

  // 5173-style layered ground: yard, asphalt apron, concrete slab.
  addPlane(root, 300, 220, mat.ground, cx, floorY - 0.46, cz);
  addPlane(root, width * 1.35, depth * 1.45, mat.asphalt, cx, floorY - 0.32, cz);
  addBox(root, width, 0.62, depth, mat.concrete, cx, floorY - 0.31, cz, false);
  addBox(root, width + 0.6, 0.18, depth + 0.6, mat.concreteDark, cx, floorY - 0.45, cz, false);

  // Cyan survey grid, mirrored from the formal dashboard.
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float gridLine(vec2 uv, vec2 scale){ vec2 c=uv*scale; vec2 d=fwidth(c); vec2 g=abs(fract(c-0.5)-0.5)/max(d,vec2(0.001)); return 1.0-min(min(g.x,g.y),1.0); }
      void main(){
        float g1=gridLine(vUv,vec2(80.0,50.0));
        float g2=gridLine(vUv,vec2(16.0,10.0));
        float edge=smoothstep(0.0,0.08,vUv.x)*smoothstep(1.0,0.92,vUv.x)*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.9,vUv.y);
        float scan=sin((vUv.y+uTime*0.012)*160.0)*0.5+0.5;
        float alpha=(g1*0.055+g2*0.075)*edge + scan*0.007*edge;
        gl_FragColor=vec4(vec3(0.23,0.8,0.76),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const grid = addPlane(root, width, depth, gridMat, cx, floorY + 0.012, cz);

  // Long travel lanes and pedestrian route on the slab.
  const laneZ = [cz - depth * 0.22, cz + depth * 0.22];
  const dashGeo = new THREE.PlaneGeometry(1.8, 0.12);
  const dashCount = Math.floor(width / 3.1) * laneZ.length;
  const dashes = new THREE.InstancedMesh(dashGeo, mat.markAmber, dashCount);
  const dummy = new THREE.Object3D();
  let di = 0;
  for (const z of laneZ) {
    for (let x = cx - width / 2 + 3; x < cx + width / 2 - 2; x += 3.1) {
      dummy.position.set(x, floorY + 0.03, z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      dashes.setMatrixAt(di++, dummy.matrix);
    }
  }
  dashes.count = di;
  root.add(dashes);

  const walkGeo = new THREE.PlaneGeometry(2.5, 0.1);
  const walkCount = Math.floor(width / 4.2);
  const walk = new THREE.InstancedMesh(walkGeo, mat.markWhite, walkCount);
  let wi = 0;
  for (let x = cx - width / 2 + 3; x < cx + width / 2 - 2; x += 4.2) {
    dummy.position.set(x, floorY + 0.031, cz + depth * 0.39);
    dummy.rotation.x = -Math.PI / 2;
    dummy.updateMatrix();
    walk.setMatrixAt(wi++, dummy.matrix);
  }
  walk.count = wi;
  root.add(walk);

  // Zone boundaries and painted floor decals.
  const marking = new THREE.Group();
  root.add(marking);
  const decalTextures = [];
  for (const [id, def] of Object.entries(ZONE_DECALS)) {
    const eq = factory.equipment.get(id);
    if (!eq) continue;
    const box = new THREE.Box3().setFromObject(eq.group);
    const bsize = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const w = Math.max(8, bsize.x + 4);
    const d = Math.max(7, bsize.z + 4);
    const points = [
      new THREE.Vector3(c.x - w / 2, floorY + 0.035, c.z - d / 2),
      new THREE.Vector3(c.x + w / 2, floorY + 0.035, c.z - d / 2),
      new THREE.Vector3(c.x + w / 2, floorY + 0.035, c.z + d / 2),
      new THREE.Vector3(c.x - w / 2, floorY + 0.035, c.z + d / 2),
    ];
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: def[2], transparent: true, opacity: 0.55 }),
    );
    marking.add(line);
    if (['AOD-01', 'MELT-01', 'POUR-01', 'MOLD-01', 'SHAKE-01', 'MIX-01', 'SAND-01', 'WATER-01'].includes(id)) {
      const texture = makeFloorDecal(def[0], def[1], def[2]);
      decalTextures.push(texture);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(10, w * 0.8), 2.4),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
      );
      label.rotation.x = -Math.PI / 2;
      label.position.set(c.x, floorY + 0.045, c.z + d / 2 + 2.0);
      marking.add(label);
    }
  }

  // Hazard thresholds at the process interfaces.
  addBox(marking, width * 0.18, 0.025, 0.35, mat.hazard, cx - width * 0.27, floorY + 0.04, cz - 3, false);
  addBox(marking, width * 0.22, 0.025, 0.35, mat.hazard, cx + width * 0.1, floorY + 0.04, cz + 4, false);

  if (floorOnly) {
    return {
      root,
      update(dt, time) {
        if (gridMat.uniforms) gridMat.uniforms.uTime.value = time;
      },
      dispose() {
        scene.remove(root);
        root.traverse((object) => {
          object.geometry?.dispose();
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of mats) {
            if (!material) continue;
            material.map?.dispose();
            material.dispose?.();
          }
        });
        concrete.dispose();
        wall.dispose();
        hazard.dispose();
        asphalt.dispose();
        wallSignTexture.dispose();
        decalTextures.forEach((texture) => texture.dispose());
      },
    };
  }

  // 5173-style cutaway hall: columns, trusses, back wall/windows, side fragments.
  const structure = new THREE.Group();
  root.add(structure);
  const hallHeight = 16;
  const columnPositions = [];
  const xStep = Math.max(10, Math.min(16, width / 12));
  const zStep = Math.max(10, Math.min(15, depth / 5));
  for (let x = cx - width / 2; x <= cx + width / 2 + 0.1; x += xStep) {
    columnPositions.push([x, cz - depth / 2], [x, cz + depth / 2]);
  }
  for (let z = cz - depth / 2 + zStep; z < cz + depth / 2; z += zStep) {
    columnPositions.push([cx - width / 2, z], [cx + width / 2, z]);
  }
  const colGeo = new THREE.BoxGeometry(0.58, hallHeight, 0.58);
  const columns = new THREE.InstancedMesh(colGeo, mat.steelDark, columnPositions.length);
  columnPositions.forEach(([x, z], i) => {
    dummy.position.set(x, floorY + hallHeight / 2, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    columns.setMatrixAt(i, dummy.matrix);
  });
  columns.castShadow = true;
  columns.receiveShadow = true;
  structure.add(columns);

  const baseGeo = new THREE.BoxGeometry(1.1, 0.24, 1.1);
  const bases = new THREE.InstancedMesh(baseGeo, mat.steel, columnPositions.length);
  columnPositions.forEach(([x, z], i) => {
    dummy.position.set(x, floorY + 0.12, z);
    dummy.updateMatrix();
    bases.setMatrixAt(i, dummy.matrix);
  });
  structure.add(bases);

  const trussGeos = [];
  for (let x = cx - width / 2; x <= cx + width / 2 + 0.1; x += xStep) {
    const top = new THREE.BoxGeometry(0.24, 0.34, depth).translate(x, floorY + 15, cz);
    const bottom = new THREE.BoxGeometry(0.2, 0.26, depth).translate(x, floorY + 13.3, cz);
    trussGeos.push(top, bottom);
    for (let z = cz - depth / 2 + 2; z <= cz + depth / 2 - 2; z += 4.4) {
      trussGeos.push(new THREE.BoxGeometry(0.12, 0.14, 2.1).translate(x, floorY + 14.15, z));
    }
  }
  trussGeos.push(new THREE.BoxGeometry(width, 0.32, 0.28).translate(cx, floorY + 15.2, cz - depth / 2));
  trussGeos.push(new THREE.BoxGeometry(width, 0.32, 0.28).translate(cx, floorY + 15.2, cz + depth / 2));
  const trusses = new THREE.Mesh(mergeGeometries(trussGeos), mat.steelDark);
  trusses.castShadow = true;
  structure.add(trusses);

  const backZ = cz - depth / 2 - 0.2;
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(width, 14), mat.wall);
  backWall.position.set(cx, floorY + 7.2, backZ);
  backWall.receiveShadow = true;
  structure.add(backWall);
  for (let x = cx - width / 2 + 4; x <= cx + width / 2 - 4; x += Math.max(7, xStep * 0.8)) {
    addBox(structure, 4.2, 1.25, 0.12, mat.window, x, floorY + 11.9, backZ + 0.05, false);
    addBox(structure, 4.2, 0.1, 0.18, mat.steelDark, x, floorY + 12.56, backZ + 0.1, false);
    addBox(structure, 4.2, 0.1, 0.18, mat.steelDark, x, floorY + 11.24, backZ + 0.1, false);
  }
  addBox(structure, width, 0.45, 0.3, mat.steel, cx, floorY + 13.8, backZ + 0.2, false);

  const wallSign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(28, width * 0.34), 6),
    new THREE.MeshBasicMaterial({ map: wallSignTexture, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  wallSign.position.set(cx - width * 0.2, floorY + 8.1, backZ + 0.04);
  structure.add(wallSign);

  const westWall = new THREE.Mesh(new THREE.PlaneGeometry(depth * 0.42, 13), mat.wall);
  westWall.position.set(cx - width / 2 - 0.25, floorY + 6.9, cz - depth * 0.2);
  westWall.rotation.y = Math.PI / 2;
  westWall.receiveShadow = true;
  structure.add(westWall);
  const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(depth * 0.24, 13), mat.wall);
  eastWall.position.set(cx + width / 2 + 0.25, floorY + 6.9, cz - depth * 0.3);
  eastWall.rotation.y = -Math.PI / 2;
  eastWall.receiveShadow = true;
  structure.add(eastWall);

  // Open cutaway roof: light lines and hanging luminaires, no glass ceiling.
  addBox(structure, width * 0.92, 0.045, 0.045, mat.lampCyan, cx, floorY + 15.34, cz - depth * 0.35, false);
  addBox(structure, width * 0.92, 0.045, 0.045, mat.lampCyan, cx, floorY + 15.34, cz + depth * 0.35, false);
  for (let i = 0; i < 5; i += 1) {
    const x = cx - width * 0.36 + i * width * 0.18;
    addBox(structure, 0.1, 0.7, 0.1, mat.steelDark, x, floorY + 12.8, cz, false);
    addBox(structure, 4.8, 0.12, 0.28, mat.lamp, x, floorY + 12.4, cz, false);
  }

  // External service road, lane markings and pedestrian crossing.
  const roadZ = cz + depth / 2 + 10;
  const roadW = width * 1.2;
  addPlane(root, roadW, 12, mat.asphalt, cx, floorY - 0.04, roadZ);
  for (let x = cx - roadW / 2 + 4; x < cx + roadW / 2 - 3; x += 8) {
    addPlane(root, 4, 0.12, mat.markAmber, x, floorY - 0.028, roadZ);
  }
  addPlane(root, roadW, 0.12, mat.markWhite, cx, floorY - 0.027, roadZ - 4.8);
  addPlane(root, roadW, 0.12, mat.markWhite, cx, floorY - 0.027, roadZ + 4.8);
  for (let i = 0; i < 8; i += 1) {
    const stripe = addPlane(root, 0.5, 4.2, mat.markWhite, cx - 3.2 + i, floorY - 0.025, roadZ + 0.2);
    stripe.material = mat.markWhite;
  }
  addBox(root, roadW, 0.16, 0.3, mat.concrete, cx, floorY + 0.02, roadZ - 6.2, false);
  addBox(root, roadW, 0.16, 0.3, mat.concrete, cx, floorY + 0.02, roadZ + 6.2, false);

  // A compact set of physical blockers for first-person roaming. Equipment
  // boxes are added by RoamController; walls and columns are registered here.
  const roamColliders = [];
  roamColliders.push(new THREE.Box3(
    new THREE.Vector3(cx - width / 2, floorY, backZ - 0.3),
    new THREE.Vector3(cx + width / 2, floorY + 14, backZ + 0.3),
  ));
  roamColliders.push(new THREE.Box3(
    new THREE.Vector3(cx - width / 2 - 0.35, floorY, cz - depth * 0.41),
    new THREE.Vector3(cx - width / 2 + 0.35, floorY + 13, cz + depth * 0.01),
  ));
  roamColliders.push(new THREE.Box3(
    new THREE.Vector3(cx + width / 2 - 0.35, floorY, cz - depth * 0.42),
    new THREE.Vector3(cx + width / 2 + 0.35, floorY + 13, cz - depth * 0.18),
  ));
  for (const [x, z] of columnPositions) {
    roamColliders.push(new THREE.Box3(
      new THREE.Vector3(x - 0.45, floorY, z - 0.45),
      new THREE.Vector3(x + 0.45, floorY + hallHeight, z + 0.45),
    ));
  }
  factory.roamColliders = roamColliders;

  const lerp = (a, b, t) => a + (b - a) * t;
  return {
    root,
    update(dt, time) {
      if (gridMat.uniforms) gridMat.uniforms.uTime.value = time;
    },
    dispose() {
      scene.remove(root);
      root.traverse((object) => {
        object.geometry?.dispose();
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of mats) {
          if (!material) continue;
          material.map?.dispose();
          material.dispose?.();
        }
      });
      concrete.dispose();
      wall.dispose();
      hazard.dispose();
      asphalt.dispose();
      wallSignTexture.dispose();
      decalTextures.forEach((texture) => texture.dispose());
    },
  };
}
