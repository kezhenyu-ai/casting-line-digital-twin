import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { putModel, getModel, listModels, deleteModel, updateModelConfig } from './library.js';
import './pilot.css';

const $ = (selector) => document.querySelector(selector);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

class PilotApp {
  constructor() {
    this.projects = [];
    this.project = null;
    this.config = null;
    this.model = null;
    this.modelGroups = new Map();
    this.devicesByNode = new Map();
    this.particles = [];
    this.flow = null;
    this.flowPulse = null;
    this.selectionHelper = null;
    this.building = null;
    this.buildingVisible = false;
    this.aux = null;
    this.auxVisible = false;
    this.agv = null;
    this.agvBase = null;
    this.productionMotion = [];
    this.motionStreams = [];
    this.crane = null;
    this.craneTrolley = null;
    this.craneHook = null;
    this.activeDevice = null;
    this.activeStage = null;
    this.loadToken = 0;
    this.loadStart = 0;
    this.elapsed = 0;
    this.lastFrame = performance.now();
    this.fpsFrames = 0;
    this.fpsTime = performance.now();
    this.modelTriangles = 0;
    this.floorY = 0;
    this.cameraTween = null;
    this.pointerDown = null;
    this.hasDragged = false;
    this.importedProjects = [];
    this.localProjects = [];
    this.serverProjects = [];
    this.currentObjectUrl = null;
    this.mappingDevice = null;

    this.init();
  }

  async init() {
    this.setupRenderer();
    this.setupScene();
    this.setupControls();
    this.setupPost();
    this.bindUI();
    this.bindPointer();
    this.animate();

    try {
      const res = await fetch('/projects/projects.json', { cache: 'no-store' });
      const data = await res.json();
      this.projects = data.projects || [];
      await this.loadLocalProjects();
      this.renderProjectSelect();
      if (this.projects.length) await this.loadProject(this.projects[0]);
    } catch (error) {
      console.error(error);
      this.toast('项目清单加载失败，请检查 /projects/projects.json');
      this.hideLoading();
    }
  }

  setupRenderer() {
    this.canvas = $('#pilot-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.info.autoReset = false;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04090c);
    this.scene.fog = new THREE.FogExp2(0x04090c, 0.0017);

    this.camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.2, 5000);
    this.camera.position.set(90, 65, 120);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envMap = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.85;
    room.dispose?.();
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0x9ed0d6, 0x0a1210, 1.2));

    const key = new THREE.DirectionalLight(0xffe2c8, 2.35);
    key.position.set(80, 120, 30);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x5fbac8, 0.85);
    fill.position.set(-90, 40, -80);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xff9550, 0.95);
    rim.position.set(-30, 35, 100);
    this.scene.add(rim);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1600;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(0, 3, 0);
  }

  setupPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.34, 0.55, 0.82);
    this.outputPass = new OutputPass();
    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.material.uniforms.resolution.value.set(
      1 / (window.innerWidth * this.renderer.getPixelRatio()),
      1 / (window.innerHeight * this.renderer.getPixelRatio()),
    );

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.fxaa);
  }

  bindUI() {
    this.projectSelect = $('#project-select');
    this.stageList = $('#stage-list');
    this.devicePanel = $('#device-panel');
    this.deviceStatus = $('#device-status');
    this.loading = $('#loading');
    this.loadingBar = $('#loading-bar');
    this.loadingText = $('#loading-text');
    this.toastEl = $('#toast');
    this.fileInput = $('#model-file');

    this.projectSelect.addEventListener('change', async () => {
      const project = this.projects.find((p) => p.id === this.projectSelect.value);
      if (project) await this.loadProject(project);
    });

    $('#import-model').addEventListener('click', () => this.fileInput.click());
    $('#library-import').addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => this.importFile());
    this.buildingButton = $('#toggle-building');
    this.buildingButton.addEventListener('click', () => this.toggleBuilding());
    this.auxButton = $('#toggle-aux');
    this.auxButton.addEventListener('click', () => this.toggleAux());
    $('#reset-view').addEventListener('click', () => this.frameAll(true));
    $('#open-library').addEventListener('click', () => this.openLibrary());
    $('#library-list').addEventListener('click', (event) => this.onLibraryClick(event));
    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => this.closeModal(button.dataset.close));
    });
    $('#mapping-form').addEventListener('submit', (event) => this.saveMapping(event));
    this.devicePanel.addEventListener('click', (event) => {
      if (event.target.closest('#edit-mapping')) this.openMapping();
    });
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) this.closeModal(event.target.id);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeModal('library-modal');
        this.closeModal('mapping-modal');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) this.frameAll(true);
    });

    window.addEventListener('resize', () => this.resize());
  }

  bindPointer() {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved > 5) return;
      this.pick(event.clientX, event.clientY);
    });
  }

  renderProjectSelect() {
    this.projectSelect.innerHTML = '';
    for (const project of this.projects) {
      const opt = document.createElement('option');
      opt.value = project.id;
      opt.textContent = `${project.name}${project.subtitle ? '  ·  ' + project.subtitle : ''}`;
      this.projectSelect.appendChild(opt);
    }
    if (this.project) this.projectSelect.value = this.project.id;
  }

  async openLibrary() {
    this.renderLibrary();
    this.openModal('library-modal');
    await this.loadServerProjects();
  }

  async loadServerProjects() {
    try {
      const res = await fetch('/api/model-library', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.serverProjects = (data.projects || []).map((project) => ({
        id: `server-${project.id}`,
        name: project.name,
        subtitle: '服务器模型 · ' + (project.activeVersion || '未发布'),
        model: `/api/model-library/${project.id}/model`,
        config: null,
        configData: null,
        isServer: true,
        serverId: project.id,
        server: project,
      }));
      for (const project of this.serverProjects) {
        if (!this.projects.some((p) => p.id === project.id)) this.projects.push(project);
      }
      this.renderProjectSelect();
      this.renderLibrary();
    } catch (error) {
      console.warn('server model library unavailable', error);
    }
  }

  async publishLocalProject(project) {
    if (!project.isLocal || !project.storeId) return;
    try {
      const create = await fetch('/api/model-library', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name.replace(/^本地导入 · /, ''), description: '由本地 GLB 发布' }),
      });
      if (!create.ok) {
        this.toast(create.status === 403 ? '当前账号没有发布权限' : '创建服务器项目失败');
        return;
      }
      const created = await create.json();
      const record = await getModel(project.storeId);
      if (!record?.blob) {
        this.toast('找不到本地模型文件');
        return;
      }
      const upload = await fetch(`/api/model-library/${created.project.id}/upload`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'model/gltf-binary' },
        body: record.blob,
      });
      if (!upload.ok) {
        this.toast('模型上传失败');
        return;
      }
      this.toast('已发布到服务器模型库');
      await this.loadServerProjects();
    } catch (error) {
      console.error(error);
      this.toast('发布失败：' + error.message);
    }
  }

  renderLibrary() {
    const list = $('#library-list');
    list.innerHTML = '';
    for (const project of this.projects) {
      const active = this.project?.id === project.id;
      const local = !!project.isLocal;
      const server = !!project.isServer;
      const card = document.createElement('div');
      card.className = 'library-item' + (active ? ' active' : '');
      card.dataset.projectId = project.id;
      const meta = server
        ? `SERVER / ${project.server?.activeVersion || 'NO VERSION'}${project.server?.versions?.length ? ' · ' + project.server.versions.length + ' versions' : ''}`
        : local
          ? `LOCAL / IndexedDB${project.size ? ' · ' + this.formatSize(project.size) : ''}`
          : 'STATIC / PROJECT REGISTRY';
      card.innerHTML = `
        <h4>${project.name}</h4>
        <p>${project.subtitle || '项目模型'}</p>
        <div class="library-meta">${meta}</div>
        <div class="library-actions">
          <button data-action="open">打开</button>
          ${local ? '<button data-action="publish">发布到服务器</button>' : ''}
          ${local || server ? '<button data-action="delete">删除</button>' : ''}
        </div>
      `;
      list.appendChild(card);
    }
  }

  async onLibraryClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const card = button.closest('.library-item');
    const project = this.projects.find((p) => p.id === card?.dataset.projectId);
    if (!project) return;
    const action = button.dataset.action;
    if (action === 'open') {
      this.closeModal('library-modal');
      this.projectSelect.value = project.id;
      await this.loadProject(project);
      return;
    }
    if (action === 'publish') {
      await this.publishLocalProject(project);
      return;
    }
    if (action === 'delete') {
      if (this.project?.id === project.id) {
        const fallback = this.projects.find((p) => !p.isLocal && !p.isServer);
        if (fallback) await this.loadProject(fallback);
      }
      if (project.isServer && project.serverId) {
        const res = await fetch(`/api/model-library/${project.serverId}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          this.toast(res.status === 403 ? '当前账号没有删除权限' : '服务器项目删除失败');
          return;
        }
        this.serverProjects = this.serverProjects.filter((p) => p.id !== project.id);
      } else if (project.storeId) {
        try { await deleteModel(project.storeId); } catch (error) { console.warn(error); }
      }
      this.projects = this.projects.filter((p) => p.id !== project.id);
      this.renderProjectSelect();
      this.renderLibrary();
      this.toast('已删除');
    }
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  openMapping() {
    const device = this.devicesByNode.get(this.activeDevice);
    if (!device) {
      this.toast('请先选择模型设备');
      return;
    }
    this.mappingDevice = this.activeDevice;
    $('#map-title').textContent = `编辑映射 · ${device.name || device.node}`;
    $('#map-node').value = device.node || '';
    $('#map-device-id').value = device.deviceId || '';
    $('#map-name').value = device.name || '';
    $('#map-status').value = device.status || 'running';
    const stageSelect = $('#map-stage');
    stageSelect.innerHTML = '';
    for (const stage of this.config?.stages || []) {
      const opt = document.createElement('option');
      opt.value = stage.id;
      opt.textContent = stage.name;
      stageSelect.appendChild(opt);
    }
    stageSelect.value = device.stage || this.config?.stages?.[0]?.id || '';
    $('#map-tags').value = Object.entries(device.tags || {}).map(([k, v]) => `${k}=${v}`).join('\n');
    $('#map-note').value = device.note || '';
    this.openModal('mapping-modal');
  }

  async saveMapping(event) {
    event.preventDefault();
    const node = this.mappingDevice;
    const device = this.devicesByNode.get(node);
    if (!device) return;
    const tags = {};
    for (const line of $('#map-tags').value.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) tags[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    device.deviceId = $('#map-device-id').value.trim() || node;
    device.name = $('#map-name').value.trim() || node;
    device.stage = $('#map-stage').value;
    device.status = $('#map-status').value;
    device.tags = tags;
    device.note = $('#map-note').value.trim();
    this.devicesByNode.set(node, device);
    this.saveBindingOverride(this.project.id, device);
    this.project.configData = this.config;
    if (this.project.isLocal && this.project.storeId) {
      try { await updateModelConfig(this.project.storeId, this.config); } catch (error) { console.warn(error); }
    }
    this.closeModal('mapping-modal');
    this.selectDevice(node, false);
    this.toast('设备映射已保存');
  }

  async loadLocalProjects() {
    try {
      const records = await listModels();
      this.localProjects = records
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .map((record) => ({
          id: `local-${record.id}`,
          name: record.name,
          subtitle: '本地模型 · ' + this.formatSize(record.size || record.blob?.size || 0),
          model: null,
          config: null,
          configData: record.configData || null,
          storeId: record.id,
          size: record.size || record.blob?.size || 0,
          isLocal: true,
        }));
      this.projects.push(...this.localProjects);
    } catch (error) {
      console.warn('IndexedDB model library unavailable', error);
      this.localProjects = [];
    }
  }

  formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  }

  async loadProject(project) {
    const token = ++this.loadToken;
    this.project = project;
    this.projectSelect.value = project.id;
    this.loadStart = performance.now();
    this.activeDevice = null;
    this.activeStage = null;
    this.clearScene();
    this.showLoading('读取项目配置…', 4);
    this.setLoadState('加载项目配置');

    let config = project.configData || null;
    if (project.isLocal && project.storeId) {
      try {
        const record = await getModel(project.storeId);
        if (!record) throw new Error('MODEL_NOT_FOUND');
        if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
        this.currentObjectUrl = URL.createObjectURL(record.blob);
        project.model = this.currentObjectUrl;
        config = config || record.configData || null;
        project.size = record.size || record.blob?.size || 0;
      } catch (error) {
        console.error(error);
        this.hideLoading();
        this.setLoadState('本地模型读取失败');
        this.toast('模型库中找不到该 GLB，请重新导入');
        return;
      }
    } else if (project.config) {
      try {
        const res = await fetch(project.config, { cache: 'no-store' });
        config = await res.json();
      } catch (error) {
        console.error(error);
        this.toast('项目配置加载失败：' + project.name);
      }
    }
    if (token !== this.loadToken) return;

    if (config) config = this.applyBindingOverrides(project.id, config);
    this.config = config;
    this.updateProjectHeader(project, config);
    this.renderStages();
    this.renderOverview();

    const url = project.model || (config && config.model);
    if (!url) {
      this.toast('项目未配置模型地址');
      this.hideLoading();
      return;
    }

    this.showLoading('下载 GLB / Draco 解码…', 12);
    this.setLoadState('下载 GLB');

    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL || '/'}draco/`);
    draco.setDecoderConfig({ type: 'js' });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      url,
      (gltf) => {
        if (token !== this.loadToken) {
          this.disposeObject(gltf.scene);
          return;
        }
        this.applyModel(gltf, project, config);
      },
      (event) => {
        if (token !== this.loadToken) return;
        if (event.total) {
          const pct = 12 + Math.round((event.loaded / event.total) * 76);
          this.showLoading('下载 GLB / Draco 解码…', pct);
        }
      },
      (error) => {
        if (token !== this.loadToken) return;
        console.error(error);
        this.hideLoading();
        this.setLoadState('模型加载失败');
        this.toast('GLB 加载失败：请检查模型路径或 Draco 解码器');
      },
    );
  }

  applyModel(gltf, project, config) {
    this.model = gltf.scene;
    this.model.name = project.id;
    this.scene.add(this.model);
    this.model.updateMatrixWorld(true);

    this.modelGroups.clear();
    this.devicesByNode.clear();
    this.modelTriangles = 0;

    this.model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = true;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.envMapIntensity = 0.95;
        const materialName = String(mat.name || '').toLowerCase();
        if (/steel|metal|iron|铝|钢|铁/.test(materialName) && 'metalness' in mat) {
          mat.metalness = 0.62;
          mat.roughness = 0.38;
        } else if (/concrete|floor|墙|混凝土/.test(materialName) && 'metalness' in mat) {
          mat.metalness = 0.04;
          mat.roughness = 0.9;
        } else {
          if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0.2, 0.7);
          if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.5, 0.35);
        }
      }
      try {
        object.geometry.computeBoundingBox();
        const index = object.geometry.index;
        this.modelTriangles += index ? index.count / 3 : object.geometry.attributes.position.count / 3;
      } catch { /* noop */ }
    });

    // Group meshes by equipmentId. The exporter writes it to glTF extras,
    // which GLTFLoader exposes on Object3D.userData. Do NOT use the name
    // fallback here: glTF splits each mesh into EQ-..._mesh / _mesh_1
    // primitives, which would otherwise become 70+ fake equipment groups.
    this.model.traverse((object) => {
      const id = object.userData?.equipmentId;
      if (!id) return;
      if (!this.modelGroups.has(String(id))) {
        this.modelGroups.set(String(id), object);
      }
    });

    if (!this.modelGroups.size) {
      // Fallback for imported GLBs without extras: use top-level named nodes.
      for (const child of this.model.children) {
        if (!child.name) continue;
        child.userData.equipmentId = child.name;
        this.modelGroups.set(child.name, child);
      }
    }

    if (!config) {
      config = this.buildImportedConfig(project, this.modelGroups);
      config = this.applyBindingOverrides(project.id, config);
      this.config = config;
      project.configData = config;
      if (project.isLocal && project.storeId) {
        updateModelConfig(project.storeId, config).catch((error) => console.warn(error));
      }
      this.updateProjectHeader(project, config);
      this.renderStages();
    }

    for (const device of config.devices || []) {
      this.devicesByNode.set(device.node, device);
    }
    this.agv = this.modelGroups.get('EQ-AGV-01') || null;
    this.agvBase = this.agv ? this.agv.position.clone() : null;

    // Keep the scene focused on the configured equipment. The building shell
    // is optional and can be toggled back on from the top bar.
    const configured = new Set((config.devices || []).map((d) => d.node));
    this.model.traverse((object) => {
      if (object.userData?.equipmentId && !configured.has(String(object.userData.equipmentId))) {
        object.visible = false;
      }
    });

    this.building = this.model.getObjectByName('EQ-BUILDING-01') || null;
    this.buildingVisible = false;
    if (this.building) {
      this.model.traverse((object) => {
        if (object.name.startsWith('EQ-BUILDING-01')) object.visible = false;
      });
      this.building.visible = false;
      this.buildingButton.disabled = false;
      this.buildingButton.textContent = '显示厂房';
    } else {
      this.buildingButton.disabled = true;
      this.buildingButton.textContent = '厂房外壳';
    }

    this.aux = this.model.getObjectByName('EQ-SANDBOX-01') || null;
    this.auxVisible = false;
    if (this.aux) {
      this.aux.visible = false;
      this.auxButton.disabled = false;
      this.auxButton.textContent = '显示砂箱';
    } else {
      this.auxButton.disabled = true;
      this.auxButton.textContent = '砂箱辅助';
    }

    this.setupFloor();
    this.buildFlow();
    this.buildParticles();
    this.buildProductionMotion();
    this.renderStages();
    this.renderOverview();
    this.frameAll(false);
    this.updateStats();
    this.hideLoading();
    this.setLoadState('场景就绪');
    this.toast(`${project.name} 已加载 · ${this.devicesByNode.size} 个设备节点`);

    const loadMs = Math.round(performance.now() - this.loadStart);
    $('#stat-load').textContent = loadMs > 1000 ? `${(loadMs / 1000).toFixed(1)}s` : `${loadMs}ms`;
    $('#stat-groups').textContent = `${this.devicesByNode.size}`;
    $('#stat-tris').textContent = this.compact(this.modelTriangles);
  }

  equipmentIdOf(object) {
    let cur = object;
    while (cur) {
      if (cur.userData && cur.userData.equipmentId) return String(cur.userData.equipmentId);
      cur = cur.parent;
    }
    return null;
  }

  buildImportedConfig(project, groups) {
    const devices = [];
    for (const [node] of groups) {
      devices.push({
        node,
        deviceId: node,
        name: node.replace(/^EQ-/, '').replace(/-/g, ' '),
        stage: 'imported',
        status: 'running',
        metrics: [['节点', node], ['模型', '本地导入']],
        tags: {},
        note: '本地导入模型，尚未配置设备映射与测点。',
      });
    }
    return {
      id: project.id,
      name: project.name,
      subtitle: project.subtitle || '本地导入模型',
      model: project.model,
      description: project.description || '本地导入 GLB，未配置项目映射。',
      flow: ['imported'],
      stages: [{ id: 'imported', name: '导入模型', en: 'IMPORTED', focus: [...groups.keys()], color: '#8be7ef' }],
      devices,
    };
  }

  bindingStore() {
    try {
      return JSON.parse(localStorage.getItem('dt-pilot-bindings-v1') || '{}') || {};
    } catch {
      return {};
    }
  }

  applyBindingOverrides(projectId, config) {
    const all = this.bindingStore();
    const overrides = all[projectId];
    if (!overrides || !config?.devices) return config;
    for (const device of config.devices) {
      const patch = overrides[device.node];
      if (patch) Object.assign(device, patch);
    }
    return config;
  }

  saveBindingOverride(projectId, device) {
    try {
      const all = this.bindingStore();
      all[projectId] = all[projectId] || {};
      all[projectId][device.node] = {
        deviceId: device.deviceId,
        name: device.name,
        stage: device.stage,
        status: device.status,
        tags: device.tags,
        note: device.note,
      };
      localStorage.setItem('dt-pilot-bindings-v1', JSON.stringify(all));
    } catch (error) {
      console.warn('binding override not saved', error);
    }
  }

  updateProjectHeader(project, config) {
    $('#project-name').textContent = (config && config.name) || project.name;
    $('#project-subtitle').textContent = (config && config.subtitle) || project.subtitle || '';
    $('#stat-groups').textContent = '—';
    $('#stat-tris').textContent = '—';
    $('#stat-load').textContent = '—';
  }

  contentBox() {
    const box = new THREE.Box3();
    let has = false;
    const configured = this.config?.devices?.map((d) => d.node).filter(Boolean) || [];
    const ids = configured.length ? configured : [...this.modelGroups.keys()];
    for (const id of ids) {
      if (id === 'EQ-BUILDING-01' || id === 'EQ-SANDBOX-01') continue;
      const object = this.modelGroups.get(id);
      if (!object) continue;
      box.expandByObject(object);
      has = true;
    }
    if (!has && this.model) box.setFromObject(this.model);
    return box;
  }

  toggleBuilding() {
    if (!this.building) {
      this.toast('当前模型没有独立厂房外壳组');
      return;
    }
    this.buildingVisible = !this.buildingVisible;
    this.model?.traverse((object) => {
      if (object.name.startsWith('EQ-BUILDING-01')) object.visible = this.buildingVisible;
    });
    this.building.visible = this.buildingVisible;
    this.buildingButton.textContent = this.buildingVisible ? '隐藏厂房' : '显示厂房';
    this.frameAll(true);
  }

  toggleAux() {
    if (!this.aux) {
      this.toast('当前模型没有砂箱辅助组');
      return;
    }
    this.auxVisible = !this.auxVisible;
    this.aux.visible = this.auxVisible;
    this.auxButton.textContent = this.auxVisible ? '隐藏砂箱' : '显示砂箱';
    this.frameAll(true);
  }

  makeFloorTexture(extent) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b2627';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i += 1) {
      const v = 20 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgba(${v},${v + 8},${v + 7},0.28)`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(Math.max(1, extent / 9), Math.max(1, extent / 9));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  setupFloor() {
    if (this.floor) this.scene.remove(this.floor);
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      this.grid.material?.dispose();
    }

    const box = this.contentBox();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // The GLB contains underground pipe/plinth geometry; the equipment
    // mounting line is the 0 m workshop floor.
    this.floorY = 0;
    const extent = Math.max(size.x, size.z, 80) * 1.35;

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1718,
      roughness: 0.84,
      metalness: 0.12,
      map: this.makeFloorTexture(extent),
    });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(extent, extent), floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(center.x, this.floorY - 0.08, center.z);
    this.floor.receiveShadow = false;
    this.scene.add(this.floor);

    this.grid = new THREE.GridHelper(extent, Math.max(40, Math.round(extent / 4)), 0x2a6d68, 0x12302f);
    this.grid.position.set(center.x, this.floorY - 0.02, center.z);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.24;
    this.scene.add(this.grid);
  }

  focusBox(box, animate = true, pad = 1.6) {
    if (!box || box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 2);
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    if (direction.lengthSq() < 0.01) direction.set(1, 0.72, 1).normalize();
    const distance = clamp(radius * 2.1 + 3, 5, 1200);
    const toPos = center.clone().add(direction.multiplyScalar(distance));
    this.moveCamera(toPos, center, animate ? 680 : 0);
  }

  frameAll(animate = true) {
    if (!this.model) return;
    const box = this.contentBox();
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 5);
    this.controls.maxDistance = Math.max(radius * 4.2, 300);
    const direction = new THREE.Vector3(1, 0.58, 1).normalize();
    const toPos = center.clone().add(direction.multiplyScalar(radius * 1.62 + 8));
    this.moveCamera(toPos, center, animate ? 760 : 0);
  }

  moveCamera(position, target, duration = 600) {
    this.cameraTween = {
      fromPos: this.camera.position.clone(),
      toPos: position.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      start: performance.now(),
      duration: Math.max(1, duration),
    };
    if (!duration) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      this.controls.update();
      this.cameraTween = null;
    }
  }

  buildFlow() {
    if (this.flow) {
      this.scene.remove(this.flow);
      this.flow.geometry?.dispose();
      this.flow.material?.dispose();
      this.flow = null;
    }
    if (this.flowPulse) {
      this.scene.remove(this.flowPulse);
      this.flowPulse.geometry?.dispose();
      this.flowPulse.material?.dispose();
      this.flowPulse = null;
    }
    if (!this.config || !this.config.flow || !this.config.stages) return;

    const points = [];
    for (const stageId of this.config.flow) {
      const stage = this.config.stages.find((s) => s.id === stageId);
      if (!stage || !stage.focus) continue;
      const node = stage.focus.find((id) => this.modelGroups.has(id));
      if (!node) continue;
      const box = new THREE.Box3().setFromObject(this.modelGroups.get(node));
      const center = box.getCenter(new THREE.Vector3());
      points.push(new THREE.Vector3(center.x, this.floorY + 0.26, center.z));
    }
    if (points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3);
    this.flowCurve = curve;
    const geometry = new THREE.TubeGeometry(curve, 120, 0.18, 5, false);
    const material = new THREE.MeshBasicMaterial({
      color: 0x61efbd,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flow = new THREE.Mesh(geometry, material);
    this.flow.renderOrder = 4;
    this.scene.add(this.flow);

    const pulseGeo = new THREE.SphereGeometry(0.45, 14, 14);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xd7fff3,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.flowPulse = new THREE.Mesh(pulseGeo, pulseMat);
    this.flowPulse.renderOrder = 6;
    this.scene.add(this.flowPulse);
  }

  buildParticles() {
    for (const item of this.particles) {
      this.scene.remove(item.points);
      item.points.geometry?.dispose();
      item.points.material?.dispose();
    }
    this.particles = [];

    const addCloud = (nodeId, color, count, height, radius, speed, size) => {
      if (!this.modelGroups.has(nodeId)) return;
      const box = new THREE.Box3().setFromObject(this.modelGroups.get(nodeId));
      const center = box.getCenter(new THREE.Vector3());
      const positions = new Float32Array(count * 3);
      const seeds = [];
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius;
        const x = center.x + Math.cos(angle) * r;
        const z = center.z + Math.sin(angle) * r;
        const y = this.floorY + 0.3 + Math.random() * height;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        seeds.push({ x, z, base: y, phase: Math.random() * 10, speed: speed * (0.55 + Math.random() * 0.9) });
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      points.renderOrder = 3;
      points.frustumCulled = false;
      this.scene.add(points);
      this.particles.push({ points, seeds, height: height + 2, baseY: this.floorY, positions });
    };

    addCloud('EQ-AOD-01', 0xff8a3a, 120, 3.5, 3.0, 0.65, 0.24);
    addCloud('EQ-POUR-01', 0xffb75e, 70, 2.4, 2.0, 0.55, 0.18);
    addCloud('EQ-POUR-02', 0xffb75e, 60, 2.2, 2.4, 0.5, 0.18);
    addCloud('EQ-SHAKE-01', 0x9ccac3, 70, 4.0, 5.0, 0.35, 0.34);
    addCloud('EQ-SAND-01', 0xb8d8d2, 50, 3.0, 3.0, 0.28, 0.30);
  }

  buildProductionMotion() {
    this.clearProductionMotion();
    if (!this.modelGroups.size) return;

    // Molten-metal streams at the pouring machines. The source model is a
    // single joined mesh per machine, so the stream is a lightweight overlay
    // that reads correctly at plant scale without splitting the GLB.
    for (const node of ['EQ-POUR-01', 'EQ-POUR-02']) {
      const group = this.modelGroups.get(node);
      if (!group) continue;
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const height = clamp(box.max.y - this.floorY + 1.5, 3, 18);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff8a32,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, height, 8, 1, true), material);
      stream.position.set(center.x, this.floorY + height / 2, center.z);
      stream.renderOrder = 5;
      this.scene.add(stream);
      this.motionStreams.push(stream);
    }

    // A simple moving conveyor between the molding line and shakeout. This is
    // intentionally a process overlay, not a replacement for the CAD geometry.
    const mold = this.modelGroups.get('EQ-MOLD-01');
    const shake = this.modelGroups.get('EQ-SHAKE-01');
    if (mold && shake) {
      const a = new THREE.Box3().setFromObject(mold).getCenter(new THREE.Vector3());
      const b = new THREE.Box3().setFromObject(shake).getCenter(new THREE.Vector3());
      const y = this.floorY + 1.1;
      const points = [
        new THREE.Vector3(a.x, y, a.z),
        new THREE.Vector3((a.x + b.x) / 2, y, Math.min(a.z, b.z) - 2),
        new THREE.Vector3(b.x, y, b.z),
      ];
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
      for (let i = 0; i < 12; i += 1) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.42, 1.1),
          new THREE.MeshStandardMaterial({ color: 0xc7b58d, roughness: 0.72, metalness: 0.18 }),
        );
        mesh.renderOrder = 4;
        this.scene.add(mesh);
        this.productionMotion.push({ mesh, curve, offset: i / 12, speed: 0.045 });
      }
    }

    // Procedural overhead crane above the molding line: rails + beam + trolley.
    if (mold) {
      const box = new THREE.Box3().setFromObject(mold);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const crane = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0x9aa9aa, roughness: 0.42, metalness: 0.7 });
      const yellow = new THREE.MeshStandardMaterial({ color: 0xffb52e, roughness: 0.5, metalness: 0.3 });
      const span = clamp(Math.max(size.x, size.z) * 0.55, 8, 22);
      const y = box.max.y + 4.5;
      const railA = new THREE.Mesh(new THREE.BoxGeometry(span, 0.24, 0.24), steel);
      railA.position.set(center.x, y, center.z - span / 2);
      const railB = railA.clone();
      railB.position.z = center.z + span / 2;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.3, 0.3), steel);
      beam.position.set(center.x, y, center.z);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.1), yellow);
      trolley.position.set(center.x, y - 0.55, center.z);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), steel);
      cable.position.set(center.x, y - 2.8, center.z);
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), yellow);
      hook.position.set(center.x, y - 4.8, center.z);
      crane.add(railA, railB, beam, trolley, cable, hook);
      crane.renderOrder = 3;
      this.scene.add(crane);
      this.crane = crane;
      this.craneTrolley = { mesh: trolley, cable, hook, baseX: center.x, span: span / 2 - 2 };
      this.craneHook = hook;
    }
  }

  clearProductionMotion() {
    for (const item of this.productionMotion) {
      this.scene.remove(item.mesh);
      item.mesh.geometry?.dispose();
      item.mesh.material?.dispose();
    }
    this.productionMotion = [];
    for (const stream of this.motionStreams) {
      this.scene.remove(stream);
      stream.geometry?.dispose();
      stream.material?.dispose();
    }
    this.motionStreams = [];
    if (this.crane) {
      this.scene.remove(this.crane);
      this.crane.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose?.());
        else object.material?.dispose?.();
      });
      this.crane = null;
      this.craneTrolley = null;
      this.craneHook = null;
    }
  }

  updateProductionMotion() {
    for (const item of this.productionMotion) {
      const u = (this.elapsed * item.speed + item.offset) % 1;
      const point = item.curve.getPointAt(u);
      item.mesh.position.copy(point);
      item.mesh.rotation.y = this.elapsed * 0.4 + item.offset * 2;
    }
    for (const stream of this.motionStreams) {
      stream.material.opacity = 0.42 + Math.sin(this.elapsed * 3.2 + stream.position.x) * 0.16;
      stream.scale.x = 0.85 + Math.sin(this.elapsed * 2.1) * 0.12;
      stream.scale.z = stream.scale.x;
    }
    if (this.craneTrolley) {
      const { mesh, cable, hook, baseX, span } = this.craneTrolley;
      const x = baseX + Math.sin(this.elapsed * 0.45) * span;
      mesh.position.x = x;
      cable.position.x = x;
      hook.position.x = x;
      hook.position.y += Math.sin(this.elapsed * 1.2) * 0.003;
    }
  }

  renderStages() {
    if (!this.config) return;
    const stages = this.config.stages || [];
    this.stageList.innerHTML = '';
    stages.forEach((stage, index) => {
      const devices = (this.config.devices || []).filter((d) => stage.focus?.includes(d.node));
      const warn = devices.some((d) => d.status === 'warning');
      const row = document.createElement('div');
      row.className = 'stage-row' + (stage.id === this.activeStage ? ' active' : '');
      row.dataset.id = stage.id;
      row.innerHTML = `
        <span class="idx">${String(index + 1).padStart(2, '0')}</span>
        <div><div class="nm">${stage.name}</div><div class="en">${stage.en || ''}</div></div>
        <span class="st${warn ? ' warn' : ''}"></span>
      `;
      row.addEventListener('click', () => this.selectStage(stage.id));
      this.stageList.appendChild(row);
    });
  }

  renderOverview() {
    if (!this.config) return;
    this.activeStage = null;
    this.activeDevice = null;
    this.deviceStatus.textContent = 'READY';
    this.deviceStatus.className = 'status-pill';
    this.devicePanel.innerHTML = `
      <div class="device-title">
        <div><h3>${this.config.name}</h3><div class="device-code">${this.config.id || this.project.id}</div></div>
        <span class="device-badge">${this.config.devices?.length || 0} DEVICES</span>
      </div>
      <p class="device-note">${this.config.description || '点击模型设备或左侧工艺节点查看数据。'}</p>
      <div class="mapping-box">
        <label>PROCESS / 工艺节点</label>
        <div class="tag-list">${(this.config.stages || []).map((s) => `<span>${s.name}</span>`).join('')}</div>
      </div>
      <div class="mapping-box">
        <label>MODEL / 模型</label>
        <code>${this.config.model || this.project.model}</code>
      </div>
    `;
  }

  selectStage(stageId) {
    const stage = this.config?.stages?.find((s) => s.id === stageId);
    if (!stage) return;
    this.activeStage = stageId;
    this.renderStages();

    const device = (this.config.devices || []).find((d) => stage.focus?.includes(d.node));
    if (device) {
      this.selectDevice(device.node, true);
      return;
    }

    const boxes = [];
    for (const id of stage.focus || []) {
      if (!this.modelGroups.has(id)) continue;
      boxes.push(new THREE.Box3().setFromObject(this.modelGroups.get(id)));
    }
    if (boxes.length) {
      const union = boxes[0].clone();
      for (const b of boxes.slice(1)) union.union(b);
      this.showSelection(union);
      this.focusBox(union, true, 1.4);
    }
  }

  selectDevice(node, focus = true) {
    const device = this.devicesByNode.get(node);
    if (!device) {
      this.toast('该节点尚未配置设备映射');
      return;
    }
    this.activeDevice = node;
    this.activeStage = device.stage;
    this.renderStages();
    const group = this.modelGroups.get(node);
    if (!group) {
      this.toast(`模型中未找到节点 ${node}`);
      return;
    }
    const box = new THREE.Box3().setFromObject(group);
    this.showSelection(box);
    if (focus) this.focusBox(box, true, 1.4);

    this.deviceStatus.textContent = (device.status || 'RUNNING').toUpperCase();
    this.deviceStatus.className = 'status-pill' + (device.status === 'warning' ? ' warn' : '');
    const metrics = (device.metrics || []).map(([label, value]) => `
      <div class="metric-cell"><span>${label}</span><b>${value}</b></div>
    `).join('');
    const tags = Object.entries(device.tags || {}).map(([key, value]) => `<span>${key}: ${value}</span>`).join('');
    this.devicePanel.innerHTML = `
      <div class="device-title">
        <div><h3>${device.name || node}</h3><div class="device-code">${device.deviceId || node}</div></div>
        <span class="device-badge">${device.stage || '—'}</span>
      </div>
      <p class="device-note">${device.note || '设备已与 GLB 节点建立映射。'}</p>
      <div class="metric-grid">${metrics || '<div class="metric-cell"><span>状态</span><b>正常</b></div>'}</div>
      <div class="mapping-box">
        <label>MODEL NODE / 模型节点</label>
        <code>${node}</code>
      </div>
      <div class="mapping-box">
        <label>TELEMETRY TAGS / 测点</label>
        <div class="tag-list">${tags || '<span>未配置测点</span>'}</div>
      </div>
      <button id="edit-mapping" class="btn btn-outline btn-small">编辑映射</button>
    `;
  }

  showSelection(box) {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry?.dispose();
      this.selectionHelper.material?.dispose();
      this.selectionHelper = null;
    }
    if (!box || box.isEmpty()) return;
    this.selectionHelper = new THREE.Box3Helper(box, 0x61efbd);
    this.selectionHelper.material.depthTest = false;
    this.selectionHelper.material.transparent = true;
    this.selectionHelper.material.opacity = 0.9;
    this.selectionHelper.renderOrder = 10;
    this.scene.add(this.selectionHelper);
  }

  pick(clientX, clientY) {
    if (!this.model) return;
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hits = raycaster.intersectObjects(this.model.children, true);
    for (const hit of hits) {
      const id = this.equipmentIdOf(hit.object);
      if (id && this.devicesByNode.has(id)) {
        this.selectDevice(id, true);
        return;
      }
    }
    this.clearSelection();
  }

  clearSelection() {
    if (this.selectionHelper) {
      this.scene.remove(this.selectionHelper);
      this.selectionHelper.geometry?.dispose();
      this.selectionHelper.material?.dispose();
      this.selectionHelper = null;
    }
  }

  clearScene() {
    this.clearSelection();
    if (this.flow) {
      this.scene.remove(this.flow);
      this.flow.geometry?.dispose();
      this.flow.material?.dispose();
      this.flow = null;
    }
    if (this.flowPulse) {
      this.scene.remove(this.flowPulse);
      this.flowPulse.geometry?.dispose();
      this.flowPulse.material?.dispose();
      this.flowPulse = null;
    }
    for (const item of this.particles) {
      this.scene.remove(item.points);
      item.points.geometry?.dispose();
      item.points.material?.dispose();
    }
    this.particles = [];
    this.clearProductionMotion();
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject(this.model);
      this.model = null;
    }
    if (this.floor) {
      this.scene.remove(this.floor);
      this.floor.geometry?.dispose();
      this.floor.material?.dispose();
      this.floor = null;
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      this.grid.material?.dispose();
      this.grid = null;
    }
    this.modelGroups.clear();
    this.devicesByNode.clear();
    this.modelTriangles = 0;
    this.building = null;
    this.buildingVisible = false;
    this.aux = null;
    this.auxVisible = false;
    this.agv = null;
    this.agvBase = null;
    if (this.buildingButton) {
      this.buildingButton.disabled = true;
      this.buildingButton.textContent = '厂房外壳';
    }
    if (this.auxButton) {
      this.auxButton.disabled = true;
      this.auxButton.textContent = '砂箱辅助';
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  disposeObject(root) {
    root.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
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

  async importFile() {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      this.toast('当前试点支持 .glb / .gltf；Revit/Blender 请先导出 GLB');
      this.fileInput.value = '';
      return;
    }
    const storeId = `model-${Date.now()}`;
    const project = {
      id: `local-${storeId}`,
      name: '本地导入 · ' + file.name.replace(/\.(glb|gltf)$/i, ''),
      subtitle: '本地 GLB · ' + this.formatSize(file.size),
      model: null,
      config: null,
      configData: null,
      storeId,
      size: file.size,
      isLocal: true,
    };
    try {
      await putModel({
        id: storeId,
        name: project.name,
        fileName: file.name,
        size: file.size,
        blob: file,
        configData: null,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.warn('model persistence failed; using session URL', error);
      project.model = URL.createObjectURL(file);
      project.storeId = null;
      project.subtitle = '本地 GLB · 临时会话';
    }
    this.importedProjects.push(project);
    this.projects.push(project);
    this.renderProjectSelect();
    this.projectSelect.value = project.id;
    this.closeModal('library-modal');
    await this.loadProject(project);
    this.fileInput.value = '';
  }

  updateStats() {
    $('#tri-count').textContent = `${this.compact(this.modelTriangles)} tris`;
  }

  compact(value) {
    if (!Number.isFinite(value)) return '—';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(1) + 'k';
    return String(Math.round(value));
  }

  showLoading(text = '加载中…', pct = 0) {
    this.loading.classList.remove('hidden');
    this.loadingText.textContent = text;
    this.loadingBar.style.width = `${pct}%`;
  }

  hideLoading() {
    this.loadingBar.style.width = '100%';
    setTimeout(() => this.loading.classList.add('hidden'), 180);
  }

  setLoadState(text) {
    $('#load-state').textContent = text;
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 3200);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.fxaa.material.uniforms.resolution.value.set(
      1 / (width * this.renderer.getPixelRatio()),
      1 / (height * this.renderer.getPixelRatio()),
    );
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.elapsed += dt;

    this.controls.update();

    if (this.cameraTween) {
      const t = (now - this.cameraTween.start) / this.cameraTween.duration;
      const k = ease(t);
      this.camera.position.lerpVectors(this.cameraTween.fromPos, this.cameraTween.toPos, k);
      this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, k);
      this.camera.lookAt(this.controls.target);
      if (t >= 1) this.cameraTween = null;
    }

    if (this.flowPulse && this.flowCurve) {
      const u = (this.elapsed * 0.055) % 1;
      const p = this.flowCurve.getPointAt(u);
      this.flowPulse.position.copy(p);
      this.flowPulse.position.y += 0.26;
      const s = 0.75 + Math.sin(this.elapsed * 4) * 0.18;
      this.flowPulse.scale.setScalar(s);
    }

    if (this.agv && this.agv.visible && this.agvBase) {
      this.agv.position.x = this.agvBase.x + Math.sin(this.elapsed * 0.34) * 1.4;
      this.agv.position.z = this.agvBase.z + Math.cos(this.elapsed * 0.27) * 0.8;
    }
    this.updateProductionMotion();

    for (const item of this.particles) {
      const attr = item.points.geometry.attributes.position;
      for (let i = 0; i < item.seeds.length; i += 1) {
        const s = item.seeds[i];
        const y = item.baseY + 0.3 + ((this.elapsed * s.speed + s.phase) % item.height);
        attr.array[i * 3 + 1] = y;
        attr.array[i * 3] = s.x + Math.sin(this.elapsed * 0.9 + s.phase) * 0.08;
        attr.array[i * 3 + 2] = s.z + Math.cos(this.elapsed * 0.7 + s.phase) * 0.08;
      }
      attr.needsUpdate = true;
    }

    this.renderer.info.reset();
    this.composer.render();

    this.fpsFrames += 1;
    if (now - this.fpsTime > 600) {
      const fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsTime));
      $('#fps').textContent = `${fps} FPS`;
      $('#drawcalls').textContent = `${this.renderer.info.render.calls} calls`;
      $('#tri-count').textContent = `${this.compact(this.renderer.info.render.triangles)} tris`;
      this.fpsFrames = 0;
      this.fpsTime = now;
    }
  }
}

window.__PILOT__ = new PilotApp();
