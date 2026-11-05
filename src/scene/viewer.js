import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { buildFoundry } from './foundry.js';

const VIEW_PRESETS = {
  overview: {
    label: '全厂总览',
    position: new THREE.Vector3(52, 38, 59),
    target: new THREE.Vector3(0, 4.6, 0),
    fov: 38,
  },
  melting: {
    label: '熔炼工段',
    position: new THREE.Vector3(-4.5, 15.5, 13.5),
    target: new THREE.Vector3(-24.5, 5.0, -7.0),
    fov: 42,
  },
  molding: {
    label: '造型浇注',
    position: new THREE.Vector3(8.5, 12.5, 25.5),
    target: new THREE.Vector3(0.5, 3.8, 5.2),
    fov: 42,
  },
  cleaning: {
    label: '清理工段',
    position: new THREE.Vector3(33, 13.5, 15.5),
    target: new THREE.Vector3(16.5, 3.4, -4.3),
    fov: 42,
  },
  painting: {
    label: '涂装工段',
    position: new THREE.Vector3(43, 13.5, 17.5),
    target: new THREE.Vector3(28.5, 3.4, 1.0),
    fov: 40,
  },
  emissions: {
    label: '排放口',
    position: new THREE.Vector3(43, 31, 25),
    target: new THREE.Vector3(5, 12.5, -17),
    fov: 43,
  },
};

const ICON_BY_KIND = { area: 'grid', stack: 'tower', ambient: 'wind' };
const STATUS_LABEL = {
  running: '运行中',
  idle: '待机',
  warning: '预警',
  maintenance: '维护',
  offline: '离线',
};

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export class FoundryViewer {
  constructor({ canvas, labelsLayer, tooltip, onSelectEquipment, onSelectEmission, onSelectAnchor, onStats, onCoords, onViewChange }) {
    this.canvas = canvas;
    this.labelsLayer = labelsLayer;
    this.tooltip = tooltip;
    this.onSelectEquipment = onSelectEquipment;
    this.onSelectEmission = onSelectEmission;
    this.onSelectAnchor = onSelectAnchor;
    this.onStats = onStats;
    this.onCoords = onCoords;
    this.onViewChange = onViewChange;
    this.labelsVisible = true;
    this.labelCluster = false;
    this.motionEnabled = true;
    this.quality = 'high';
    this.sceneTime = 0;
    this.lastFrame = performance.now();
    this.fpsFrames = 0;
    this.fpsSince = performance.now();
    this.fps = 60;
    this.telemetry = null;
    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerScreen = { x: 0, y: 0 };
    this.pointerDirty = false;
    this.pointerInside = false;
    this.isDragging = false;
    this.downPoint = { x: 0, y: 0 };
    this.hovered = null;
    this.activeView = 'overview';
    this.tween = null;
    this.labelEntries = [];
    this.lastRaycast = 0;
    this.init();
  }

  init() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.gpuInfo = this.readGpuInfo();
    this.isSoftwareRenderer = /swiftshader|llvmpipe|software rasterizer|microsoft basic render|basic render driver|d3d11-warp|\bwarp\b/i.test(this.gpuInfo);
    document.body.classList.toggle('software-render', this.isSoftwareRenderer);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040a0d);

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 420);
    this.camera.position.copy(VIEW_PRESETS.overview.position);
    this.camera.lookAt(VIEW_PRESETS.overview.target);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(VIEW_PRESETS.overview.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.72;
    this.controls.panSpeed = 0.55;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 155;
    this.controls.minPolarAngle = 0.21;
    this.controls.maxPolarAngle = Math.PI * 0.475;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => {
      this.isDragging = false;
      this.hideHover();
      this.clearViewSelection();
    });
    this.controls.addEventListener('change', () => {
      if (this.tween) return;
      this.updateCoordinates();
    });

    // IBL gives machined metal and glass that final UE-like sheen.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.82;
    room.dispose?.();
    pmrem.dispose();

    this.addLighting();
    this.factory = buildFoundry(this.scene);
    this.objectCount = 0;
    this.factory.root.traverse((object) => {
      if (object.isMesh || object.isPoints || object.isSprite) this.objectCount += 1;
    });

    // A multisampled HDR composer target removes most geometric stair-steps
    // before FXAA runs. The GLB is high-poly, so 4× MSAA is the useful setting;
    // 8× gives little visual return at this screen density.
    const composerTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: this.isSoftwareRenderer ? 0 : 4,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.composer = new EffectComposer(this.renderer, composerTarget);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.46, 0.6, 0.82);
    this.outputPass = new OutputPass();
    // FXAA is far cheaper than 4× MSAA at 2–3 MP, and with 1.6× supersampling
    // it keeps railings, ladders and stack silhouettes clean without softening
    // the HUD (DOM text stays at native resolution).
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.fxaaPass);

    this.selectionRing = this.createRing(2.1, 0x61efbd, 0.85);
    this.hoverRing = this.createRing(1.2, 0x8ff9ff, 0.55);
    this.selectionRing.visible = false;
    this.hoverRing.visible = false;
    this.scene.add(this.selectionRing, this.hoverRing);

    this.raycaster = new THREE.Raycaster();
    this.buildLabels();
    this.bindPointerEvents();
    this.resize();
    // Fidelity is the default. The quality selector remains manual; we never
    // silently trade resolution or effects for frame rate.
    this.setQuality('high');
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.lastFrame = performance.now();
      this.fpsSince = performance.now();
      this.fpsFrames = 0;
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  readGpuInfo() {
    try {
      const gl = this.renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch {
      return 'WebGL renderer unavailable';
    }
  }

  addLighting() {
    const hemi = new THREE.HemisphereLight(0x8fc9d2, 0x10130f, 1.25);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sun = new THREE.DirectionalLight(0xffe4c6, 3.15);
    sun.position.set(44, 58, 38);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -56;
    sun.shadow.camera.right = 56;
    sun.shadow.camera.top = 54;
    sun.shadow.camera.bottom = -46;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 170;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const rim = new THREE.DirectionalLight(0x72dce3, 1.15);
    rim.position.set(-52, 35, -46);
    this.scene.add(rim);
    this.rimLight = rim;

    const edge = new THREE.DirectionalLight(0xffb478, 0.5);
    edge.position.set(55, 12, -30);
    this.scene.add(edge);
    this.edgeLight = edge;

    const spots = [
      { pos: [-28, 13.2, 0], target: [-24, 0, -6], color: 0xffe7c9, intensity: 520, angle: 0.62 },
      { pos: [-3, 13.2, 8], target: [0, 0, 5], color: 0xffe7c9, intensity: 460, angle: 0.6 },
      { pos: [18, 13.2, 2], target: [17, 0, -5], color: 0xffebd3, intensity: 480, angle: 0.62 },
      { pos: [31, 13.2, 7], target: [28, 0, 1], color: 0xe0f4ff, intensity: 360, angle: 0.55 },
    ];
    this.spotLights = [];
    spots.forEach((def) => {
      const spot = new THREE.SpotLight(def.color, def.intensity, 38, def.angle, 0.85, 1.6);
      spot.position.set(...def.pos);
      spot.target.position.set(...def.target);
      spot.userData.baseIntensity = def.intensity;
      this.scene.add(spot, spot.target);
      this.spotLights.push(spot);
    });
  }

  createRing(radius, color, opacity) {
    const geometry = new THREE.RingGeometry(radius * 0.92, radius, 64, 1);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.36;
    ring.renderOrder = 4;
    return ring;
  }

  buildLabels() {
    this.labelsLayer.innerHTML = '';
    // Only process-line labels are rendered. Individual equipment/CEMS
    // labels remain available through the detail drawer, not the scene HUD.
    this.labelEntries = this.factory.anchors
      .filter((anchor) => anchor.lineLabel)
      .map((anchor) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `scene-label is-${anchor.kind}`;
      el.dataset.id = anchor.id;
      const icon = ICON_BY_KIND[anchor.kind] || 'grid';
      el.innerHTML = `
        <span class="scene-label-box">
          <span class="scene-label-icon"><svg class="icon"><use href="#i-${icon}"></use></svg></span>
          <span class="scene-label-copy"><b>${anchor.title}</b><span>${anchor.sub}</span></span>
          <span class="scene-label-value">${anchor.value || ''}</span>
        </span>
        <i class="scene-label-wire"></i>
      `;
      el.style.transform = 'translate(-50%, -100%)';
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onAnchorClick(anchor);
      });
      this.labelsLayer.appendChild(el);
      return { anchor, el, screen: new THREE.Vector3(), lastVisible: false };
    });
  }

  onAnchorClick(anchor) {
    this.selectAnchor(anchor);
    if (anchor.emissionId) {
      const stack = this.factory.stacks.get(anchor.emissionId);
      if (stack) {
        this.focusPoint(new THREE.Vector3(stack.top.x, 5.5, stack.top.z), 15, 1100);
      }
      this.onSelectEmission?.(anchor.emissionId);
    } else if (anchor.kind === 'area' && anchor.position) {
      this.focusPoint(anchor.position.clone(), anchor.cameraDistance || 28, 1000);
      this.onSelectAnchor?.(anchor);
    } else {
      this.setView(anchor.view || 'overview');
      this.onSelectAnchor?.(anchor);
    }
  }

  selectAnchor(anchor) {
    if (anchor.emissionId) {
      const emission = this.telemetry?.emissions.find((e) => e.id === anchor.emissionId);
      const stack = this.factory.stacks.get(anchor.emissionId);
      if (stack) {
        this.showSelection(new THREE.Vector3(stack.top.x, 0.4, stack.top.z), 4.2);
        this.onSelectEmission?.(emission?.id || anchor.emissionId);
      }
    } else {
      const eq = this.factory.equipment.get(anchor.id);
      this.showSelection(eq?.focus || anchor.position.clone().setY(0.4), 2.4);
    }
  }

  bindPointerEvents() {
    this.canvas.addEventListener('pointermove', (event) => {
      this.pointerScreen.x = event.clientX;
      this.pointerScreen.y = event.clientY;
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      this.pointerDirty = true;
      this.pointerInside = true;
      if (this.tooltip.hidden === false) {
        this.tooltip.style.left = `${event.clientX}px`;
        this.tooltip.style.top = `${event.clientY}px`;
      }
    });
    this.canvas.addEventListener('pointerenter', () => {
      this.pointerInside = true;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.pointerInside = false;
      this.pointerDirty = false;
      this.hideHover();
    });
    this.canvas.addEventListener('pointerdown', (event) => {
      this.downPoint = { x: event.clientX, y: event.clientY };
      this.isDragging = false;
      this.pointerScreen.x = event.clientX;
      this.pointerScreen.y = event.clientY;
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.buttons && Math.hypot(event.clientX - this.downPoint.x, event.clientY - this.downPoint.y) > 5) {
        this.isDragging = true;
      }
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (event.button !== 0) return;
      if (this.isDragging) return;
      if (Math.hypot(event.clientX - this.downPoint.x, event.clientY - this.downPoint.y) > 5) return;
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
      const label = this.pickLabel(event.clientX, event.clientY);
      if (label) {
        this.onAnchorClick(label);
        return;
      }
      this.handleSelection();
    });
  }

  handleSelection() {
    const hit = this.pickInteractive();
    if (!hit) return;
    if (hit.type === 'equipment') {
      this.selectEquipment(hit.id);
      this.onSelectEquipment?.(hit.id);
    } else if (hit.type === 'emission') {
      const stack = this.factory.stacks.get(hit.id);
      if (stack) {
        this.showSelection(new THREE.Vector3(stack.top.x, 0.4, stack.top.z), 4.2);
        this.focusPoint(new THREE.Vector3(stack.top.x, 6.4, stack.top.z), 18, 1150);
      }
      this.onSelectEmission?.(hit.id);
    } else if (hit.type === 'component') {
      this.selectComponent(hit.object);
    }
  }

  pickLabel(x, y) {
    for (const entry of this.labelEntries) {
      if (!entry.el.classList.contains('is-visible')) continue;
      const rect = entry.el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return entry.anchor;
      }
    }
    return null;
  }

  pickInteractive() {
    if (!this.pointerInside && this.pointer.x < -1) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.factory.interactive, true);
    for (const hit of intersects) {
      let node = hit.object;
      while (node) {
        if (node.userData?.equipmentId) return { type: 'equipment', id: node.userData.equipmentId, point: hit.point };
        if (node.userData?.emissionId) return { type: 'emission', id: node.userData.emissionId, point: hit.point };
        node = node.parent;
      }
      return { type: 'component', object: hit.object, point: hit.point };
    }
    return null;
  }

  selectComponent(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (!Number.isFinite(box.min.x) || box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, size.y);
    this.showSelection(center, Math.max(0.9, span * 0.35));
    this.focusPoint(center.clone(), THREE.MathUtils.clamp(span * 2.2 + 4, 6, 80), 850);
  }

  selectEquipment(id) {
    const eq = this.factory.equipment.get(id);
    if (!eq) return;
    this.showSelection(eq.focus, Math.max(1.8, (eq.height || 4) * 0.26));
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    direction.y = Math.max(0.28, direction.y);
    direction.normalize();
    const destination = eq.focus.clone().add(direction.multiplyScalar(eq.cameraDistance || 14));
    this.flyTo(destination, eq.focus.clone().setY(eq.focus.y * 0.72), 1050);
    this.activeView = null;
    this.onViewChange?.(null);
  }

  showSelection(point, radius = 2) {
    this.selectionRing.position.set(point.x, 0.365, point.z);
    const geometry = this.selectionRing.geometry;
    geometry.dispose();
    this.selectionRing.geometry = new THREE.RingGeometry(radius * 0.91, radius, 64, 1);
    this.selectionRing.material.opacity = 0.78;
    this.selectionRing.visible = true;
  }

  showHover(point, radius = 1.2) {
    this.hoverRing.position.set(point.x, 0.37, point.z);
    this.hoverRing.geometry.dispose();
    this.hoverRing.geometry = new THREE.RingGeometry(radius * 0.86, radius, 48, 1);
    this.hoverRing.visible = true;
  }

  hideHover() {
    this.hoverRing.visible = false;
    this.tooltip.hidden = true;
    this.canvas.style.cursor = '';
    this.hovered = null;
  }

  updateHover() {
    if (!this.pointerInside || this.isDragging) {
      if (!this.isDragging && !this.pointerInside) this.hideHover();
      return;
    }
    const now = performance.now();
    if (!this.pointerDirty || now - this.lastRaycast < 70) return;
    this.pointerDirty = false;
    this.lastRaycast = now;
    const hit = this.pickInteractive();
    if (!hit) {
      this.hideHover();
      return;
    }
    if (hit.type === 'equipment') {
      const eq = this.telemetry?.equipment.find((item) => item.id === hit.id);
      const def = this.factory.equipment.get(hit.id);
      this.showHover(def?.focus || hit.point, Math.max(1.2, (def?.height || 4) * 0.2));
      this.canvas.style.cursor = 'pointer';
      if (eq) {
        this.tooltip.innerHTML = `
          <span class="tooltip-type">EQUIPMENT · ${eq.area}</span>
          <b>${eq.name}</b>
          <div><span class="status-dot ${eq.status}"></span><span>${STATUS_LABEL[eq.status] || eq.status} · ${formatNumber(eq.power)} kW</span></div>
          <em>单击查看设备详情</em>
        `;
        this.tooltip.hidden = false;
        this.tooltip.style.left = `${this.pointerScreen.x}px`;
        this.tooltip.style.top = `${this.pointerScreen.y}px`;
        this.hovered = { type: 'equipment', id: hit.id };
      }
    } else if (hit.type === 'component') {
      this.showHover(hit.point, 1.1);
      this.canvas.style.cursor = 'pointer';
      this.tooltip.innerHTML = `
        <span class="tooltip-type">MODEL COMPONENT</span>
        <b>设备构件</b>
        <div>单击聚焦并显示选中光环</div>
      `;
      this.tooltip.hidden = false;
      this.tooltip.style.left = `${this.pointerScreen.x}px`;
      this.tooltip.style.top = `${this.pointerScreen.y}px`;
      this.hovered = { type: 'component', object: hit.object };
    } else {
      const point = this.telemetry?.emissions.find((e) => e.id === hit.id);
      const stack = this.factory.stacks.get(hit.id);
      if (stack) {
        this.showHover(new THREE.Vector3(stack.top.x, 0, stack.top.z), 4);
      }
      this.canvas.style.cursor = 'pointer';
      if (point) {
        this.tooltip.innerHTML = `
          <span class="tooltip-type">CEMS · ${point.code}</span>
          <b>${point.name}</b>
          <div><span class="status-dot ${point.status === 'normal' ? 'running' : point.status === 'warning' ? 'idle' : 'warning'}"></span><span>${point.primaryLabel} ${point.value.toFixed(1)} ${point.primaryUnit}</span></div>
          <em>单击查看排口与视频画面</em>
        `;
        this.tooltip.hidden = false;
        this.tooltip.style.left = `${this.pointerScreen.x}px`;
        this.tooltip.style.top = `${this.pointerScreen.y}px`;
        this.hovered = { type: 'emission', id: hit.id };
      }
    }
  }

  updateLabels() {
    if (!this.labelsVisible) {
      this.labelEntries.forEach((entry) => {
        entry.el.classList.remove('is-visible');
      });
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const leftBound = width >= 1200 ? 360 : 12;
    const rightBound = width >= 1200 ? width - 360 : width - 12;
    const halfLabelW = 110;
    const halfLabelH = 34;
    this.labelEntries.forEach((entry) => entry.el.classList.remove('is-visible'));
    // Four process-line labels only. Each label is centered exactly on the
    // average center point of its member equipment; no aggregation, no
    // collision-driven offset and no distance-based hiding.
    for (const entry of this.labelEntries) {
      const projected = entry.anchor.position.clone();
      const cameraSpace = projected.clone().applyMatrix4(this.camera.matrixWorldInverse);
      if (cameraSpace.z > -2) continue;
      projected.project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      if (projected.z >= 1 || x < 12 || x > width - 12 || y < 88 || y > height - 82) continue;
      const px = Math.max(leftBound + halfLabelW, Math.min(rightBound - halfLabelW, x));
      const py = Math.max(88 + halfLabelH, Math.min(height - 82 - halfLabelH, y));
      entry.el.style.left = `${px}px`;
      entry.el.style.top = `${py}px`;
      entry.el.classList.add('is-visible');
    }
  }

  updateLabelValues() {
    if (!this.telemetry) return;
    this.labelEntries.forEach(({ anchor, el }) => {
      const valueEl = el.querySelector('.scene-label-value');
      if (!valueEl) return;
      if (anchor.emissionId) {
        const point = this.telemetry.emissions.find((e) => e.id === anchor.emissionId);
        if (!point) return;
        valueEl.textContent = `${point.value.toFixed(1)} ${point.primaryUnit}`;
        el.classList.toggle('warning', point.status !== 'normal');
      } else if (anchor.kind === 'area') {
        let meterId = null;
        if (anchor.id === 'melting') meterId = 'MELT';
        if (anchor.id === 'sand') meterId = 'MOLD';
        if (anchor.id === 'molding') meterId = 'MOLD';
        if (anchor.id === 'cleaning') meterId = 'CLEAN';
        if (anchor.id === 'painting') meterId = 'PAINT';
        const meter = this.telemetry.meters.find((m) => m.id === meterId);
        if (meter) valueEl.textContent = `${formatNumber(meter.current)} kW`;
      }
    });
  }

  setTelemetry(state) {
    this.telemetry = state;
    this.updateLabelValues();
  }

  flyTo(position, target, duration = 1200) {
    this.tween = {
      start: performance.now(),
      duration,
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
    };
    this.controls.enabled = false;
  }

  setView(id, immediate = false) {
    const aliases = { refining: 'melting', pouring: 'molding', shakeout: 'cleaning', sand: 'cleaning', utility: 'emissions' };
    const viewId = aliases[id] || id;
    const preset = VIEW_PRESETS[viewId];
    if (!preset) return false;
    this.activeView = viewId;
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
      this.flyTo(preset.position, preset.target, 1250);
      this.tween.fromFov = fromFov;
      this.tween.toFov = preset.fov;
    }
    this.selectionRing.visible = false;
    this.hideHover();
    return true;
  }

  focusPoint(position, distance = 15, duration = 1000) {
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    direction.y = Math.max(0.3, direction.y);
    direction.normalize();
    const destination = position.clone().add(direction.multiplyScalar(distance));
    this.flyTo(destination, position, duration);
    this.activeView = null;
    this.onViewChange?.(null);
  }

  zoom(factor) {
    const direction = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(direction.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    direction.setLength(distance);
    this.flyTo(this.controls.target.clone().add(direction), this.controls.target.clone(), 420);
  }

  resetView() {
    this.setView('overview');
    this.showToast?.('视角已重置');
  }

  clearViewSelection() {
    if (this.activeView) {
      this.activeView = null;
      this.onViewChange?.(null);
    }
  }

  updateTween(now) {
    if (!this.tween) return;
    const progress = Math.min(1, (now - this.tween.start) / this.tween.duration);
    const eased = easeInOutCubic(progress);
    this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, eased);
    this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, eased);
    if (this.tween.fromFov !== undefined) {
      this.camera.fov = THREE.MathUtils.lerp(this.tween.fromFov, this.tween.toFov, eased);
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
    if (progress >= 1) {
      this.tween = null;
      this.controls.enabled = true;
      this.updateCoordinates();
    }
  }

  updateCoordinates() {
    this.onCoords?.(this.controls.target.x, this.controls.target.z, VIEW_PRESETS[this.activeView]?.label || '自由视角');
  }

  updateSelectionRings(time) {
    if (this.selectionRing.visible) {
      this.selectionRing.rotation.z = time * 0.18;
      this.selectionRing.material.opacity = 0.6 + Math.sin(time * 2.2) * 0.18;
    }
    if (this.hoverRing.visible) {
      this.hoverRing.rotation.z = -time * 0.3;
      this.hoverRing.material.opacity = 0.4 + Math.sin(time * 3.2) * 0.14;
    }
  }

  updateFps(now) {
    this.fpsFrames += 1;
    if (now - this.fpsSince < 550) return;
    this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsSince));
    this.fpsFrames = 0;
    this.fpsSince = now;
    const info = this.renderer.info;
    this.onStats?.({
      fps: this.fps,
      calls: info.render.calls,
      triangles: info.render.triangles,
      width: Math.round(window.innerWidth * this.renderer.getPixelRatio()),
      height: Math.round(window.innerHeight * this.renderer.getPixelRatio()),
      objects: this.objectCount,
      gpu: this.gpuInfo,
      software: this.isSoftwareRenderer,
      quality: this.quality,
      lowPower: this.quality === 'eco',
    });
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.motionEnabled) this.sceneTime += dt;

    this.updateTween(now);
    if (!this.roamController?.active) this.controls.update();
    this.roamController?.update(dt);
    this.factory.update(dt, this.sceneTime, this.telemetry);
    this.animationMixer?.update(this.motionEnabled ? dt : 0);
    this.updateHover();
    this.updateLabels();
    this.updateSelectionRings(now * 0.001);

    this.renderer.info.reset();
    this.composer.render();
    this.updateFps(now);
  }

  toggleLabels(force) {
    this.labelsVisible = force ?? !this.labelsVisible;
    return this.labelsVisible;
  }

  setLabelCluster(force) {
    this.labelCluster = force ?? !this.labelCluster;
    this.updateLabels();
    return this.labelCluster;
  }

  toggleMotion(force) {
    this.motionEnabled = force ?? !this.motionEnabled;
    this.factory.setMotion(this.motionEnabled);
    return this.motionEnabled;
  }

  setQuality(mode) {
    if (!['high', 'balanced', 'eco'].includes(mode)) return;
    this.quality = mode;
    const nativeDpr = window.devicePixelRatio || 1;
    const dpr = { high: Math.min(nativeDpr, 1.6), balanced: Math.min(nativeDpr, 1.3), eco: Math.min(nativeDpr, 1.0) }[mode];
    this.renderer.setPixelRatio(dpr);
    this.composer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = mode !== 'eco';
    this.sun.castShadow = mode !== 'eco';
    this.bloomPass.enabled = mode !== 'eco';
    this.bloomPass.strength = mode === 'high' ? 0.46 : 0.32;
    this.bloomPass.radius = mode === 'high' ? 0.6 : 0.45;
    this.fxaaPass.enabled = mode !== 'eco';
    this.scene.environmentIntensity = mode === 'eco' ? 0.7 : 0.82;
    this.factory?.setLowPower?.(mode === 'eco');
    document.body.classList.toggle('low-power-render', mode === 'eco');
    this.resize();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    if (this.fxaaPass) {
      const pixelRatio = this.renderer.getPixelRatio();
      this.fxaaPass.material.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    }
    this.updateCoordinates();
  }

  destroy() {
    this.controls.dispose();
    this.renderer.dispose();
    this.composer.dispose();
  }
}

export { VIEW_PRESETS };
