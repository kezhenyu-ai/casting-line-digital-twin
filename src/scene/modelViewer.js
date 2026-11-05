import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FoundryViewer } from './viewer.js';
import { FORMAL_RENDER_SETTINGS } from '../formalRenderSettings.js';
import { createPlantEnvironment } from './plantEnvironment.js';
import { createEquipmentMotion } from './equipmentMotion.js';
import { createStructureFrames } from './structureFrames.js';
import { RoamController } from './roamMode.js';

const MAPPING = {
  'EQ-AOD-01': { id: 'AOD-01', name: 'AOD 精炼炉', area: '熔炼工段', stage: 'melting' },
  'EQ-MELT-01': { id: 'MELT-01', name: '电炉熔炼线', area: '熔炼工段', stage: 'melting' },
  'EQ-MOLD-01': { id: 'MOLD-01', name: '造型线', area: '造型工段', stage: 'molding' },
  'EQ-POUR-01': { id: 'POUR-01', name: '自动浇注机', area: '浇注工段', stage: 'pouring' },
  'EQ-POUR-02': { id: 'POUR-02', name: '2# 自动浇注机', area: '浇注工段', stage: 'pouring' },
  'EQ-MIX-01': { id: 'MIX-01', name: '连续式混砂机', area: '砂处理工段', stage: 'sand' },
  'EQ-MIX-02': { id: 'MIX-02', name: '50t/h 混砂机', area: '砂处理工段', stage: 'sand' },
  'EQ-SAND-01': { id: 'SAND-01', name: '呋喃树脂砂再生线', area: '砂处理工段', stage: 'sand' },
  'EQ-SHAKE-01': { id: 'SHAKE-01', name: '振动落砂机', area: '清理工段', stage: 'cleaning' },
  'EQ-WATER-01': { id: 'WATER-01', name: '循环水冷却塔', area: '公用动力', stage: 'utility' },
  'EQ-AGV-01': { id: 'AGV-01', name: '铁水转运 AGV', area: '浇注工段', stage: 'pouring' },
};

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) {
        if (value && value.isTexture) value.dispose();
      }
      mat.dispose?.();
    }
  });
}

function createFactory(scene) {
  const nodesById = new Map();
  scene.traverse((object) => {
    const raw = object.userData?.equipmentId;
    if (!raw) return;
    const id = String(raw).startsWith('EQ-') ? String(raw) : `EQ-${raw}`;
    if (!nodesById.has(id)) nodesById.set(id, []);
    nodesById.get(id).push(object);
  });
  const groups = new Map([...nodesById].map(([id, nodes]) => [id, nodes[0]]));

  const equipment = new Map();
  const interactive = [];
  const anchors = [];
  const cameraDefs = [];
  const modelBox = new THREE.Box3();
  let hasContent = false;
  for (const [node] of Object.entries(MAPPING)) {
    const nodes = nodesById.get(node);
    if (!nodes?.length) continue;
    for (const part of nodes) modelBox.expandByObject(part);
    hasContent = true;
  }
  if (!hasContent) modelBox.setFromObject(scene);
  const center = modelBox.getCenter(new THREE.Vector3());
  const radius = Math.max(modelBox.getSize(new THREE.Vector3()).length() * 0.5, 1);
  // Several source groups include underground pipes/plinths. The equipment
  // body sits on the 0 m floor, so the site must not use the global min Y.
  const floorY = 0;

  // No fake process beacons: if the source scene does not contain AOD,
  // induction furnace, the first pouring machine or shakeout, those IDs are
  // simply absent from the scene.

  for (const [node, meta] of Object.entries(MAPPING)) {
    const parts = nodesById.get(node);
    const group = groups.get(node);
    if (!group || !parts?.length) continue;
    for (const part of parts) {
      part.visible = true;
      part.userData.equipmentId = meta.id;
    }
    const box = new THREE.Box3();
    for (const part of parts) box.expandByObject(part);
    if (!Number.isFinite(box.min.x) || box.isEmpty()) continue;
    const c = box.getCenter(new THREE.Vector3());
    const height = Math.max(1, box.max.y - box.min.y);
    const focus = new THREE.Vector3(c.x, box.min.y + height * 0.4, c.z);
    const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, height);
    equipment.set(meta.id, {
      id: meta.id,
      group,
      focus,
      height,
      stage: meta.stage,
      cameraDistance: THREE.MathUtils.clamp(span * 2.4 + 8, 12, 130),
    });
    interactive.push(...parts);
    anchors.push({
      id: meta.id,
      kind: 'equipment',
      lineLabel: false,
      stage: meta.stage,
      title: meta.name,
      sub: meta.area,
      value: meta.stage.toUpperCase(),
      // Center-point rule: the label is anchored to the equipment body center,
      // not to its top or to a process-line aggregate.
      position: new THREE.Vector3(c.x, c.y, c.z),
      view: meta.stage === 'molding' || meta.stage === 'pouring' ? 'production' : 'overview',
    });
    const look = c.clone();
    const offset = new THREE.Vector3(radius * 0.45, radius * 0.32, radius * 0.45);
    cameraDefs.push({
      name: `${meta.name} · 近景`,
      position: look.clone().add(offset),
      target: look,
      fov: 42,
    });
  }

  // Make every visible GLB mesh raycastable. The source scene has 673 meshes,
  // but only a subset carries explicit equipment extras; untagged sub-parts
  // become component-level selections instead of dead surfaces.
  const interactiveSet = new Set(interactive);
  scene.traverse((object) => {
    if (object.isMesh && object.visible && object.geometry?.attributes?.position?.count > 0) {
      interactiveSet.add(object);
    }
  });
  interactive.length = 0;
  interactive.push(...interactiveSet);

  // Only four process-line labels remain. They are center points of their
  // member equipment groups and are always visible; there is no aggregation.
  const lineDefs = [
    { id: 'line-melt', title: '电炉熔炼线', sub: 'INDUCTION MELTING', eq: ['MELT-01'], stage: 'melting', view: 'melting' },
    { id: 'line-pour', title: '浇筑线', sub: 'POURING LINE', eq: ['POUR-01', 'POUR-02'], stage: 'pouring', view: 'pouring' },
    { id: 'line-mold', title: '造型线', sub: 'MOLDING LINE', eq: ['MOLD-01'], stage: 'molding', view: 'molding' },
    { id: 'line-sand', title: '砂处理线', sub: 'SAND PREPARATION', eq: ['MIX-01', 'MIX-02', 'SAND-01'], stage: 'sand', view: 'sand' },
  ];
  for (const line of lineDefs) {
    const members = line.eq.map((id) => equipment.get(id)).filter(Boolean);
    if (!members.length) continue;
    const center = new THREE.Vector3();
    for (const eq of members) center.add(eq.focus);
    center.multiplyScalar(1 / members.length);
    anchors.push({
      id: line.id,
      kind: 'area',
      cluster: true,
      lineLabel: true,
      targetId: members[0].id,
      stage: line.stage,
      title: line.title,
      sub: line.sub,
      value: '',
      position: center,
      cameraDistance: Math.max(...members.map((eq) => eq.cameraDistance || 24), 24),
      view: line.view,
    });
  }

  // Keep the building and sandbox from dominating the dashboard scene.
  for (const node of ['EQ-BUILDING-01', 'EQ-SANDBOX-01', 'EQ-MOLD-02']) {
    const group = groups.get(node);
    if (group) group.visible = false;
  }

  const overview = center.clone().add(new THREE.Vector3(radius * 1.28, radius * 0.85, radius * 1.28));
  const presets = {
    overview: { position: overview, target: center.clone(), fov: 38 },
    production: {
      position: center.clone().add(new THREE.Vector3(radius * 1.02, radius * 0.7, radius * 1.08)),
      target: center.clone(),
      fov: 38,
    },
    emission: {
      position: center.clone().add(new THREE.Vector3(radius * 1.2, radius * 0.7, radius * 1.3)),
      target: center.clone(),
      fov: 38,
    },
    energy: {
      position: center.clone().add(new THREE.Vector3(-radius * 1.1, radius * 0.7, radius * 1.2)),
      target: center.clone(),
      fov: 38,
    },
    security: {
      position: center.clone().add(new THREE.Vector3(radius * 1.3, radius * 0.8, -radius * 1.2)),
      target: center.clone(),
      fov: 38,
    },
  };

  // Only rescue near-black utility/piping materials; leave the original
  // material palette and lighting balance otherwise untouched.
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of mats) {
      if (!mat?.color) continue;
      const l = mat.color.r * 0.2126 + mat.color.g * 0.7152 + mat.color.b * 0.0722;
      if (l < 0.035) mat.color.setHex(0x65777a);
    }
  });

  // Push the imported equipment toward a slightly more metallic, machined
  // finish without changing its original color palette.
  for (const eq of equipment.values()) {
    eq.group.traverse((object) => {
      if (!object.isMesh) return;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of mats) {
        if (!mat || !('metalness' in mat)) continue;
        mat.metalness = Math.min(0.82, Math.max(0.35, mat.metalness ?? 0.2));
        mat.roughness = Math.min(0.58, Math.max(0.28, (mat.roughness ?? 0.5) * 0.82));
        mat.envMapIntensity = Math.max(1.0, mat.envMapIntensity ?? 1);
        mat.needsUpdate = true;
      }
    });
  }

  const stackMap = { E1: 'AOD-01', E2: 'SAND-01', E3: 'SHAKE-01', E4: 'POUR-01' };
  const stacks = new Map();
  for (const [emissionId, equipmentId] of Object.entries(stackMap)) {
    const eq = equipment.get(equipmentId);
    if (!eq) continue;
    const b = new THREE.Box3().setFromObject(eq.group);
    const c = b.getCenter(new THREE.Vector3());
    const top = new THREE.Vector3(c.x, b.max.y + 2, c.z);
    stacks.set(emissionId, { top, equipmentId });
    anchors.push({
      id: emissionId,
      kind: 'stack',
      title: emissionId === 'E2' ? '砂处理排口' : emissionId === 'E3' ? '落砂排口' : emissionId === 'E4' ? '浇注排口' : '熔炼排口',
      sub: 'CEMS · 有组织排放',
      value: emissionId,
      position: top,
      emissionId,
    });
  }

  const stageViews = {
    refining: 'AOD-01',
    melting: 'MELT-01',
    pouring: 'POUR-01',
    molding: 'MOLD-01',
    shakeout: 'SHAKE-01',
    sand: 'SAND-01',
    utility: 'WATER-01',
  };
  for (const [stage, equipmentId] of Object.entries(stageViews)) {
    const eq = equipment.get(equipmentId);
    if (!eq) continue;
    presets[stage] = {
      position: eq.focus.clone().add(new THREE.Vector3(radius * 0.8, radius * 0.56, radius * 0.8)),
      target: eq.focus.clone(),
      fov: 38,
    };
  }

  return {
    root: scene,
    equipment,
    interactive,
    anchors,
    cameraDefs,
    stacks,
    materials: {},
    presets,
    modelBox,
    radius,
    floorY,
    update() {},
    setMotion() {},
    getMotion() { return true; },
    setLowPower() {},
    getLowPower() { return false; },
  };
}

export class ModelViewer extends FoundryViewer {
  constructor(options) {
    super(options);
    this.modelFactory = null;
    this.modelPresets = null;
    this.controls.maxDistance = 900;
    const formal = FORMAL_RENDER_SETTINGS;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = formal.renderer.toneMappingExposure;
    this.renderer.shadowMap.enabled = formal.renderer.shadowMap;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x040a0d);
    this.scene.environmentIntensity = formal.environmentIntensity;
    this.camera.fov = formal.camera.fov;
    this.camera.near = formal.camera.near;
    this.camera.far = formal.camera.far;
    this.camera.updateProjectionMatrix();

    if (this.hemiLight) {
      this.hemiLight.color.setHex(formal.lights.hemisphere.color);
      this.hemiLight.groundColor.setHex(formal.lights.hemisphere.groundColor);
      this.hemiLight.intensity = formal.lights.hemisphere.intensity;
    }
    if (this.sun) {
      this.sun.color.setHex(formal.lights.sun.color);
      this.sun.intensity = formal.lights.sun.intensity;
      this.sun.position.set(...formal.lights.sun.position);
      this.sun.castShadow = formal.lights.sun.castShadow;
      this.sun.shadow.mapSize.set(...formal.lights.sun.shadowMapSize);
      Object.assign(this.sun.shadow.camera, formal.lights.sun.shadowCamera);
      this.sun.shadow.bias = formal.lights.sun.shadowBias;
      this.sun.shadow.normalBias = formal.lights.sun.shadowNormalBias;
      this.sun.shadow.radius = formal.lights.sun.shadowRadius;
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    if (this.rimLight) {
      this.rimLight.color.setHex(formal.lights.rim.color);
      this.rimLight.intensity = formal.lights.rim.intensity;
      this.rimLight.position.set(...formal.lights.rim.position);
    }
    if (this.edgeLight) {
      this.edgeLight.color.setHex(formal.lights.edge.color);
      this.edgeLight.intensity = formal.lights.edge.intensity;
      this.edgeLight.position.set(...formal.lights.edge.position);
    }
    if (this.spotLights) {
      this.spotLights.forEach((spot, index) => {
        const def = formal.lights.spots[index];
        if (!def) return;
        spot.color.setHex(def.color);
        spot.intensity = def.intensity;
        spot.angle = def.angle;
        spot.penumbra = def.penumbra;
        spot.decay = def.decay;
        spot.distance = def.distance;
        spot.position.set(...def.position);
        spot.target.position.set(...def.target);
        spot.target.updateMatrixWorld();
        spot.userData.baseIntensity = def.intensity;
      });
    }
    if (this.bloomPass) {
      this.bloomPass.strength = formal.post.bloom.strength;
      this.bloomPass.radius = formal.post.bloom.radius;
      this.bloomPass.threshold = formal.post.bloom.threshold;
    }
    if (this.fxaaPass) this.fxaaPass.enabled = formal.post.fxaa;

    // No extra fill by default: these controls exist for the user to opt in
    // through the live engine settings window.
    const fill = new THREE.HemisphereLight(0xa8d2d2, 0x101b19, 0);
    const frontFill = new THREE.DirectionalLight(0xd9f2ef, 0);
    frontFill.position.set(-35, 55, 65);
    this.modelFillLight = fill;
    this.modelFrontFill = frontFill;
    this.scene.add(fill, frontFill);
    this.roamController = new RoamController(this);
  }

  addModelGround(factory) {
    if (this.modelGround) {
      this.scene.remove(this.modelGround);
      this.modelGround.geometry.dispose();
      this.modelGround.material.dispose();
    }
    const box = factory.modelBox;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(size.x, size.z) * 1.6, Math.max(size.x, size.z) * 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1d3031, roughness: 0.92, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, factory.floorY ?? 0, center.z);
    ground.receiveShadow = false;
    this.scene.add(ground);
    this.modelGround = ground;
  }

  debugBounds() {
    if (!this.factory) return null;
    const rows = [];
    for (const [id, eq] of this.factory.equipment) {
      const b = new THREE.Box3().setFromObject(eq.group);
      rows.push({
        id,
        minY: Number(b.min.y.toFixed(3)),
        maxY: Number(b.max.y.toFixed(3)),
        minX: Number(b.min.x.toFixed(2)),
        maxX: Number(b.max.x.toFixed(2)),
        minZ: Number(b.min.z.toFixed(2)),
        maxZ: Number(b.max.z.toFixed(2)),
      });
    }
    return {
      modelMinY: Number(this.factory.modelBox.min.y.toFixed(3)),
      modelMaxY: Number(this.factory.modelBox.max.y.toFixed(3)),
      rows,
    };
  }

  enhanceMaterials(factory) {
    const maxAnisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
    const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
    factory.root.traverse((object) => {
      if (!object.isMesh) return;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const slot of textureSlots) {
          const texture = mat[slot];
          if (!texture) continue;
          texture.anisotropy = maxAnisotropy;
          texture.magFilter = THREE.LinearFilter;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.needsUpdate = true;
        }
        if ('envMapIntensity' in mat) mat.envMapIntensity = Math.max(1.15, mat.envMapIntensity ?? 1);
        mat.needsUpdate = true;
      }
    });
  }

  async loadModel(url = '/models/hubei-foundry-pilot.glb') {
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    draco.setDecoderConfig({ type: 'js' });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);

    const oldRoot = this.factory?.root;
    if (oldRoot) {
      this.scene.remove(oldRoot);
      disposeObject(oldRoot);
    }

    const factory = createFactory(gltf.scene);
    this.enhanceMaterials(factory);
    this.animationMixer?.stopAllAction();
    this.animationMixer = null;
    this.animationClips = gltf.animations || [];
    if (this.animationClips.length) {
      this.animationMixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of this.animationClips) {
        const action = this.animationMixer.clipAction(clip);
        action.reset();
        action.play();
      }
    }
    this.factory = factory;
    this.modelFactory = factory;
    this.modelPresets = factory.presets;
    this.scene.add(factory.root);
    const shapeLineModel = url.includes('shape-line');
    this.plant?.dispose();
    this.motion?.dispose();
    this.structures?.dispose();
    this.floor?.dispose();
    this.plant = null;
    this.motion = null;
    this.structures = null;
    this.floor = null;
    if (!shapeLineModel) {
      this.plant = createPlantEnvironment(this.scene, factory);
      this.motion = createEquipmentMotion(this.scene, factory);
      this.structures = createStructureFrames(this.scene, factory);
    } else {
      // Keep the equipment interaction framing, but pull the camera closer
      // than the full factory floor so the molding line remains readable.
      const c = factory.modelBox.getCenter(new THREE.Vector3());
      const r = factory.radius;
      factory.presets = {
        overview: { position: c.clone().add(new THREE.Vector3(r * 0.62, r * 0.42, r * 0.82)), target: c.clone(), fov: 42 },
        production: { position: c.clone().add(new THREE.Vector3(r * 0.48, r * 0.34, r * 0.68)), target: c.clone(), fov: 42 },
        emission: { position: c.clone().add(new THREE.Vector3(-r * 0.7, r * 0.42, r * 0.7)), target: c.clone(), fov: 42 },
        energy: { position: c.clone().add(new THREE.Vector3(-r * 0.75, r * 0.4, -r * 0.72)), target: c.clone(), fov: 42 },
        security: { position: c.clone().add(new THREE.Vector3(r * 0.75, r * 0.4, -r * 0.72)), target: c.clone(), fov: 42 },
      };
      this.modelPresets = factory.presets;
      // Reuse the 5173 floor material stack (concrete slab, asphalt apron,
      // survey grid, zone markings), without the cutaway hall.
      this.floor = createPlantEnvironment(this.scene, factory, { floorOnly: true });
      this.floor.root.position.y = 0.07;
    }
    const baseUpdate = factory.update?.bind(factory);
    factory.update = (dt, time) => {
      baseUpdate?.(dt, time);
      this.plant?.update(dt, time);
      this.floor?.update(dt, time);
      this.motion?.update(dt, time);
      this.structures?.update(dt, time);
    };
    this.controls.maxDistance = Math.max(260, factory.radius * 5);
    this.controls.minDistance = 2;
    this.buildLabels();
    this.objectCount = 0;
    factory.root.traverse((object) => {
      if (object.isMesh || object.isPoints || object.isSprite) this.objectCount += 1;
    });
    this.setView('overview', true);
    return factory;
  }

  async loadImportedModel(root, animations = [], project = {}) {
    const oldRoot = this.factory?.root;
    if (oldRoot) {
      this.scene.remove(oldRoot);
      disposeObject(oldRoot);
    }
    this.animationMixer?.stopAllAction();
    this.animationMixer = null;
    this.animationClips = animations || [];
    this.plant?.dispose();
    this.floor?.dispose();
    this.motion?.dispose();
    this.structures?.dispose();
    this.plant = null;
    this.floor = null;
    this.motion = null;
    this.structures = null;

    const factory = createFactory(root);
    this.enhanceMaterials(factory);
    this.factory = factory;
    this.modelFactory = factory;
    this.modelPresets = factory.presets;
    this.scene.add(factory.root);

    if (this.animationClips.length) {
      this.animationMixer = new THREE.AnimationMixer(root);
      for (const clip of this.animationClips) this.animationMixer.clipAction(clip).reset().play();
    }

    this.floor = createPlantEnvironment(this.scene, factory, { floorOnly: true });
    this.floor.root.position.y = (factory.modelBox?.min?.y ?? 0) + 0.02;
    const baseUpdate = factory.update?.bind(factory);
    factory.update = (dt, time) => {
      baseUpdate?.(dt, time);
      this.floor?.update(dt, time);
    };
    this.controls.maxDistance = Math.max(260, factory.radius * 8);
    this.controls.minDistance = 0.5;
    this.camera.far = Math.max(500, factory.radius * 20);
    this.camera.updateProjectionMatrix();
    this.buildLabels();
    this.objectCount = 0;
    let meshes = 0;
    let triangles = 0;
    let nodes = 0;
    factory.root.traverse((object) => {
      nodes += 1;
      if (!object.isMesh) return;
      meshes += 1;
      const geometry = object.geometry;
      const count = geometry?.index ? geometry.index.count / 3 : (geometry?.attributes?.position?.count || 0) / 3;
      triangles += count;
    });
    this.importedProject = { ...project, meshes, triangles: Math.round(triangles), nodes, animations: this.animationClips.length };
    this.setView('overview', true);
    return this.importedProject;
  }

  setView(id, immediate = false) {
    const viewTargets = {
      refining: ['AOD-01'],
      melting: ['MELT-01'],
      pouring: ['POUR-02', 'POUR-01'],
      molding: ['MOLD-01'],
      shakeout: ['SHAKE-01'],
      sand: ['SAND-01', 'MIX-01', 'MIX-02'],
      utility: ['WATER-01'],
    };
    const targetId = (viewTargets[id] || []).find((equipmentId) => {
      const eq = this.factory?.equipment?.get(equipmentId);
      return eq && eq.focus && Number.isFinite(eq.focus.x);
    });
    if (targetId) {
      this.selectEquipment(targetId);
      this.activeView = id;
      this.onViewChange?.(id);
      return true;
    }
    const preset = this.modelPresets?.[id] || this.modelPresets?.overview;
    if (!preset) return super.setView(id, immediate);
    this.activeView = id;
    this.onViewChange?.(id);
    if (immediate) {
      this.camera.position.copy(preset.position);
      this.controls.target.copy(preset.target);
      this.camera.fov = preset.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.updateCoordinates();
    } else {
      const fromFov = this.camera.fov;
      this.flyTo(preset.position, preset.target, 1100);
      if (this.tween) {
        this.tween.fromFov = fromFov;
        this.tween.toFov = preset.fov;
      }
    }
    this.selectionRing.visible = false;
    this.hideHover();
    return true;
  }
}
