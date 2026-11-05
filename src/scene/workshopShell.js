import * as THREE from 'three';

function makeMetalPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#354346';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, 0, 3, 128);
  }
  for (let i = 0; i < 250; i += 1) {
    const v = 35 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgba(${v},${v + 9},${v + 10},0.22)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeConcreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#626d6c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i += 1) {
    const v = 70 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 2},0.2)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSignTexture(title, subtitle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = 'rgba(3, 15, 17, 0.9)';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = 'rgba(97, 239, 189, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 1012, 244);
  ctx.fillStyle = '#61efbd';
  ctx.fillRect(22, 22, 7, 212);
  ctx.fillStyle = '#effcf8';
  ctx.font = '700 76px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 54, 116);
  ctx.fillStyle = 'rgba(175, 216, 207, 0.82)';
  ctx.font = '500 26px "Bahnschrift", "Microsoft YaHei", sans-serif';
  ctx.fillText(subtitle, 56, 184);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

export function createWorkshopShell(scene, factory) {
  const root = new THREE.Group();
  root.name = 'WORKSHOP_SHELL';
  scene.add(root);

  const modelBox = factory.modelBox;
  const size = modelBox.getSize(new THREE.Vector3());
  const center = modelBox.getCenter(new THREE.Vector3());
  const floorY = factory.floorY ?? 0;
  const margin = 4;
  const x0 = modelBox.min.x - margin;
  const x1 = modelBox.max.x + margin;
  const z0 = modelBox.min.z - margin;
  const z1 = modelBox.max.z + margin;
  const width = x1 - x0;
  const depth = z1 - z0;
  const height = Math.max(16, Math.min(26, size.y + 5));
  const roofY = floorY + height;

  const metalTexture = makeMetalPanelTexture();
  metalTexture.repeat.set(Math.max(2, width / 8), Math.max(2, height / 7));
  const concreteTexture = makeConcreteTexture();
  concreteTexture.repeat.set(Math.max(2, width / 6), 2);
  const textures = [metalTexture, concreteTexture];

  const steel = new THREE.MeshStandardMaterial({ color: 0x697a7d, roughness: 0.52, metalness: 0.4 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x435459, roughness: 0.56, metalness: 0.38 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x7a8580, map: concreteTexture, roughness: 0.92, metalness: 0.04 });
  const cladding = new THREE.MeshStandardMaterial({ color: 0x64777a, map: metalTexture, roughness: 0.68, metalness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2e555c,
    transparent: true,
    opacity: 0.075,
    roughness: 0.5,
    metalness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const roofGlass = new THREE.MeshStandardMaterial({
    color: 0x1d3438,
    transparent: true,
    opacity: 0.05,
    roughness: 0.62,
    metalness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Foundation / apron around the workshop.
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 12, depth + 12),
    new THREE.MeshStandardMaterial({ color: 0x303c3e, roughness: 0.9, metalness: 0.08 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(center.x, floorY - 0.05, center.z);
  root.add(apron);

  const slab = box(width + 2, 0.06, depth + 2, concrete);
  slab.position.set(center.x, floorY - 0.03, center.z);
  root.add(slab);

  // Structural grid: columns and roof beams.
  const columnSpacing = Math.max(12, Math.min(18, width / 7));
  const zSpacing = Math.max(12, Math.min(18, depth / 6));
  const columnGeo = new THREE.BoxGeometry(0.5, height, 0.5);
  const addColumn = (x, z) => {
    const column = new THREE.Mesh(columnGeo, steel);
    column.position.set(x, floorY + height / 2, z);
    root.add(column);
  };
  for (let x = x0; x <= x1 + 0.01; x += columnSpacing) {
    addColumn(x, z0);
    addColumn(x, z1);
  }
  for (let z = z0; z <= z1 + 0.01; z += zSpacing) {
    addColumn(x0, z);
    addColumn(x1, z);
  }

  // Side walls: concrete plinth + metal/glass clerestory. The +z front is open
  // as a cutaway so the equipment remains visible from the default camera.
  const wallHeight = height * 0.88;
  const plinthHeight = 2.1;
  const addLowWalls = (x, z, w, d, rot = 0) => {
    const plinth = box(w, plinthHeight, d, concrete);
    plinth.position.set(x, floorY + plinthHeight / 2, z);
    plinth.rotation.y = rot;
    root.add(plinth);
  };
  addLowWalls(center.x, z0, width, 0.35);
  addLowWalls(x0, center.z, 0.35, depth, Math.PI / 2);

  const backWall = box(width, wallHeight, 0.34, cladding);
  backWall.position.set(center.x, floorY + plinthHeight + wallHeight / 2, z0);
  root.add(backWall);
  const leftWall = box(0.34, wallHeight, depth, cladding);
  leftWall.position.set(x0, floorY + plinthHeight + wallHeight / 2, center.z);
  root.add(leftWall);

  // Right side is glazed so the default +x camera can see the process.
  const rightPlinth = box(0.34, plinthHeight, depth, concrete);
  rightPlinth.position.set(x1, floorY + plinthHeight / 2, center.z);
  root.add(rightPlinth);
  const rightSolid = box(0.3, 3.1, depth, cladding);
  rightSolid.position.set(x1, floorY + plinthHeight + 1.55, center.z);
  rightSolid.visible = false;
  root.add(rightSolid);
  const rightGlassHeight = Math.max(4, height - plinthHeight - 4.8);
  // Camera-side wall is kept as a low parapet only: this is the deliberate
  // cutaway that lets the process equipment remain readable.
  const rightTop = box(0.32, 1.2, depth, cladding);
  rightTop.position.set(x1, floorY + height - 0.6, center.z);
  rightTop.visible = false;
  root.add(rightTop);

  // Front facade beam / upper fascia: keeps the workshop reading as a
  // building while the lower central bay stays open for the digital twin.
  const frontFascia = box(width, 2.6, 0.35, cladding);
  frontFascia.position.set(center.x, floorY + height - 1.3, z1);
  root.add(frontFascia);
  const frontGlass = box(width * 0.82, 2.2, 0.12, glass);
  frontGlass.position.set(center.x, floorY + height - 4.1, z1);
  root.add(frontGlass);

  // Two solid facade wings frame the open central bay.
  const wingWidth = Math.max(12, width * 0.18);
  for (const x of [x0 + wingWidth / 2 + 1, x1 - wingWidth / 2 - 1]) {
    const wing = box(wingWidth, plinthHeight + 3.4, 0.34, cladding);
    wing.position.set(x, floorY + (plinthHeight + 3.4) / 2, z1);
    root.add(wing);
    const wingGlass = box(wingWidth - 2, rightGlassHeight, 0.16, glass);
    wingGlass.position.set(x, floorY + plinthHeight + 3.1 + rightGlassHeight / 2, z1);
    root.add(wingGlass);
    const wingTop = box(wingWidth, 1.2, 0.32, cladding);
    wingTop.position.set(x, floorY + height - 0.6, z1);
    root.add(wingTop);
    for (let i = -1; i <= 1; i += 1) {
      const mullion = box(0.18, rightGlassHeight, 0.16, darkSteel);
      mullion.position.set(x + i * (wingWidth / 3), floorY + plinthHeight + 3.1 + rightGlassHeight / 2, z1 + 0.1);
      root.add(mullion);
    }
  }
  const frontDoor = box(5.4, 5.2, 0.26, darkSteel);
  frontDoor.position.set(x0 + wingWidth / 2 + 1, floorY + 2.6, z1 + 0.24);
  root.add(frontDoor);
  for (let i = 0; i < 4; i += 1) {
    const slat = box(5.0, 0.08, 0.05, cladding);
    slat.position.set(x0 + wingWidth / 2 + 1, floorY + 0.9 + i * 1.05, z1 + 0.38);
    root.add(slat);
  }

  // Windows on the solid back wall.
  for (let x = x0 + 4; x <= x1 - 4; x += 9) {
    const windowPanel = box(4.8, 2.2, 0.12, glass);
    windowPanel.position.set(x, floorY + plinthHeight + 4.1, z0 + 0.2);
    root.add(windowPanel);
    const frame = box(5.1, 2.5, 0.16, darkSteel);
    frame.position.set(x, floorY + plinthHeight + 4.1, z0 + 0.11);
    root.add(frame);
  }

  // Main roll-up door on the back wall and a personnel door on the left.
  const doorFrame = box(10.4, 7.2, 0.4, darkSteel);
  doorFrame.position.set(center.x - width * 0.22, floorY + 3.6, z0 + 0.28);
  root.add(doorFrame);
  const door = box(9.4, 6.2, 0.18, cladding);
  door.position.set(center.x - width * 0.22, floorY + 3.1, z0 + 0.48);
  root.add(door);
  for (let i = 0; i < 5; i += 1) {
    const slat = box(9.4, 0.08, 0.05, darkSteel);
    slat.position.set(center.x - width * 0.22, floorY + 1.1 + i * 1.1, z0 + 0.59);
    root.add(slat);
  }
  const sideDoor = box(2.4, 3.6, 0.3, darkSteel);
  sideDoor.position.set(x0 - 0.05, floorY + 1.8, center.z + depth * 0.18);
  sideDoor.rotation.y = Math.PI / 2;
  root.add(sideDoor);

  // Roof: a light translucent deck with solid edge fascia and steel trusses.
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), roofGlass);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(center.x, roofY, center.z);
  roof.renderOrder = 2;
  root.add(roof);

  const edgeNorth = box(width + 1, 1.1, 0.35, darkSteel);
  edgeNorth.position.set(center.x, roofY + 0.35, z0);
  const edgeSouth = edgeNorth.clone();
  edgeSouth.position.z = z1;
  const edgeWest = box(0.35, 1.1, depth + 1, darkSteel);
  edgeWest.position.set(x0, roofY + 0.35, center.z);
  const edgeEast = edgeWest.clone();
  edgeEast.position.x = x1;
  root.add(edgeNorth, edgeSouth, edgeWest, edgeEast);

  for (let z = z0 + 2; z <= z1; z += 16) {
    const truss = box(width, 0.32, 0.32, steel);
    truss.position.set(center.x, roofY - 0.35, z);
    root.add(truss);
  }
  for (let x = x0 + 2; x <= x1; x += 16) {
    const purlin = box(0.26, 0.26, depth, darkSteel);
    purlin.position.set(x, roofY - 0.7, center.z);
    root.add(purlin);
  }
  for (let i = 1; i < 5; i += 1) {
    const skylight = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, 0.8), glass);
    skylight.rotation.x = -Math.PI / 2;
    skylight.position.set(center.x, roofY - 0.05, z0 + (depth / 5) * i);
    root.add(skylight);
  }

  // Front canopy over the open bay.
  const canopy = box(width * 0.62, 0.35, 7, darkSteel);
  canopy.position.set(center.x + width * 0.16, floorY + 7.2, z1 + 2.6);
  root.add(canopy);
  for (const offset of [-0.26, 0.26]) {
    const post = box(0.28, 7.2, 0.28, steel);
    post.position.set(center.x + width * offset, floorY + 3.6, z1 + 5.6);
    root.add(post);
  }
  const canopyEdge = box(width * 0.62, 0.6, 0.18, steel);
  canopyEdge.position.set(center.x + width * 0.16, floorY + 7.0, z1 + 6.1);
  root.add(canopyEdge);

  // Facade sign.
  const signTexture = makeSignTexture('智慧铸造车间示范区', 'SMART CASTING DEMONSTRATION ZONE');
  textures.push(signTexture);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 4),
    new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  sign.position.set(center.x, floorY + height - 2.4, z1 + 0.5);
  root.add(sign);

  // Downpipes and a simple gutter line.
  for (const x of [x0 + 2, x1 - 2]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, height, 6), darkSteel);
    pipe.position.set(x, floorY + height / 2, z0 + 0.5);
    root.add(pipe);
  }

  return {
    root,
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
      for (const texture of textures) texture.dispose();
    },
  };
}
