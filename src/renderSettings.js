import * as THREE from 'three';
import { FORMAL_RENDER_SETTINGS } from './formalRenderSettings.js';

const STORAGE_KEY = 'binhe.renderSettings.v3';
const DEFAULT_KEY = 'binhe.renderSettings.default.v1';

const TONE_MAPPINGS = [
  ['ACESFilmicToneMapping', 'ACES 电影', THREE.ACESFilmicToneMapping],
  ['AgXToneMapping', 'AgX', THREE.AgXToneMapping],
  ['ReinhardToneMapping', 'Reinhard', THREE.ReinhardToneMapping],
  ['CineonToneMapping', 'Cineon', THREE.CineonToneMapping],
  ['LinearToneMapping', 'Linear', THREE.LinearToneMapping],
  ['NoToneMapping', 'None', THREE.NoToneMapping],
];

const SCHEMA = [
  {
    title: 'EXPOSURE / 曝光与色彩',
    items: [
      { key: 'exposure', label: '曝光', min: 0.25, max: 2.5, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'environment', label: '环境反射强度', min: 0, max: 2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'toneMapping', label: '色调映射', type: 'select', options: TONE_MAPPINGS.map(([v, l]) => [v, l]) },
    ],
  },
  {
    title: 'LIGHT RIG / 灯光',
    items: [
      { key: 'sun', label: '主光强度', min: 0, max: 8, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'sunAzimuth', label: '主光方位角', min: -180, max: 180, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'sunElevation', label: '主光高度角', min: 2, max: 88, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'hemi', label: '半球环境光', min: 0, max: 4, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'modelFill', label: '模型补光', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'frontFill', label: '前向柔光', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'rim', label: '轮廓光', min: 0, max: 4, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'edge', label: '暖边光', min: 0, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'spots', label: '热区聚光倍率', min: 0, max: 2, step: 0.01, format: (v) => `${v.toFixed(2)}×` },
      { key: 'ambient', label: '全局环境光', min: 0, max: 2, step: 0.01, format: (v) => v.toFixed(2) },
    ],
  },
  {
    title: 'POST / 后期',
    items: [
      { key: 'bloom', label: '泛光强度', min: 0, max: 2, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'bloomRadius', label: '泛光半径', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'bloomThreshold', label: '泛光阈值', min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'fxaa', label: 'FXAA 抗锯齿', type: 'toggle' },
      { key: 'shadows', label: '动态阴影', type: 'toggle' },
      { key: 'fog', label: '雾密度', min: 0, max: 0.008, step: 0.0001, format: (v) => v.toFixed(4) },
    ],
  },
  {
    title: 'CAMERA / 相机',
    items: [
      { key: 'fov', label: '视场角 FOV', min: 20, max: 75, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'near', label: '近裁剪面', min: 0.05, max: 2, step: 0.05, format: (v) => v.toFixed(2) },
      { key: 'far', label: '远裁剪面', min: 200, max: 3000, step: 10, format: (v) => `${Math.round(v)}` },
      { key: 'pixelRatio', label: '渲染倍率', min: 0.5, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
    ],
  },
];

const PRESETS = {
  '模型默认': null,
  '5173 原版': {
    exposure: 1.08,
    environment: 0.82,
    sun: 3.15,
    sunAzimuth: 41,
    sunElevation: 45,
    hemi: 1.25,
    modelFill: 0,
    frontFill: 0,
    rim: 1.15,
    edge: 0.5,
    spots: 1,
    ambient: 0,
    bloom: 0.46,
    bloomRadius: 0.6,
    bloomThreshold: 0.82,
    fxaa: true,
    shadows: true,
    fog: 0,
    fov: 38,
    near: 0.1,
    far: 420,
    pixelRatio: Math.min(window.devicePixelRatio || 1, FORMAL_RENDER_SETTINGS.renderer.pixelRatioCap),
    toneMapping: 'ACESFilmicToneMapping',
  },
  '清晰模型': {
    exposure: 1.35,
    environment: 1,
    sun: 3.6,
    sunAzimuth: 48,
    sunElevation: 52,
    hemi: 1.5,
    modelFill: 1.1,
    frontFill: 0.8,
    rim: 1.2,
    edge: 0.45,
    spots: 0.8,
    ambient: 0.18,
    bloom: 0.28,
    bloomRadius: 0.5,
    bloomThreshold: 0.85,
    fxaa: true,
    shadows: true,
    fog: 0,
    fov: 38,
    near: 0.1,
    far: 800,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.6),
    toneMapping: 'ACESFilmicToneMapping',
  },
  '夜景': {
    exposure: 0.9,
    environment: 0.45,
    sun: 0.8,
    sunAzimuth: 35,
    sunElevation: 36,
    hemi: 1.7,
    modelFill: 0.4,
    frontFill: 0.2,
    rim: 2.2,
    edge: 1.4,
    spots: 1.5,
    ambient: 0.08,
    bloom: 0.7,
    bloomRadius: 0.7,
    bloomThreshold: 0.55,
    fxaa: true,
    shadows: true,
    fog: 0.0018,
    fov: 40,
    near: 0.1,
    far: 900,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.6),
    toneMapping: 'ACESFilmicToneMapping',
  },
  '柔和': {
    exposure: 1.2,
    environment: 1.1,
    sun: 2.1,
    sunAzimuth: 28,
    sunElevation: 55,
    hemi: 1.9,
    modelFill: 1.3,
    frontFill: 0.9,
    rim: 0.7,
    edge: 0.25,
    spots: 0.5,
    ambient: 0.28,
    bloom: 0.2,
    bloomRadius: 0.45,
    bloomThreshold: 0.9,
    fxaa: true,
    shadows: true,
    fog: 0,
    fov: 38,
    near: 0.1,
    far: 800,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.6),
    toneMapping: 'ACESFilmicToneMapping',
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toneMappingValue(name) {
  return TONE_MAPPINGS.find(([key]) => key === name)?.[2] ?? THREE.ACESFilmicToneMapping;
}

function toneMappingName(value) {
  return TONE_MAPPINGS.find(([, , current]) => current === value)?.[0] ?? 'ACESFilmicToneMapping';
}

export function createRenderSettings(viewer) {
  const panel = document.getElementById('render-settings');
  const body = document.getElementById('rs-body');
  const presetsRoot = document.getElementById('rs-presets');
  const status = document.getElementById('rs-status');
  const button = document.getElementById('btn-render-settings');
  if (!panel || !body || !button || !viewer) return null;

  const sun = viewer.sun;
  const spots = viewer.spotLights || [];
  const ambient = new THREE.AmbientLight(0x9fc7c2, 0);
  viewer.scene.add(ambient);

  const defaults = {
    exposure: viewer.renderer.toneMappingExposure,
    environment: viewer.scene.environmentIntensity ?? 0.82,
    toneMapping: toneMappingName(viewer.renderer.toneMapping),
    sun: sun?.intensity ?? 3.15,
    sunAzimuth: sun ? THREE.MathUtils.radToDeg(Math.atan2(sun.position.z, sun.position.x)) : 41,
    sunElevation: sun ? THREE.MathUtils.radToDeg(Math.atan2(sun.position.y, Math.hypot(sun.position.x, sun.position.z))) : 45,
    hemi: viewer.hemiLight?.intensity ?? 1.25,
    modelFill: viewer.modelFillLight?.intensity ?? 0,
    frontFill: viewer.modelFrontFill?.intensity ?? 0,
    rim: viewer.rimLight?.intensity ?? 1.15,
    edge: viewer.edgeLight?.intensity ?? 0.5,
    spots: 1,
    ambient: 0,
    bloom: viewer.bloomPass?.strength ?? 0.46,
    bloomRadius: viewer.bloomPass?.radius ?? 0.6,
    bloomThreshold: viewer.bloomPass?.threshold ?? 0.82,
    fxaa: viewer.fxaaPass?.enabled ?? true,
    shadows: viewer.renderer.shadowMap.enabled,
    fog: viewer.scene.fog?.density ?? 0,
    fov: viewer.camera.fov,
    near: viewer.camera.near,
    far: viewer.camera.far,
    pixelRatio: viewer.renderer.getPixelRatio(),
  };
  try {
    const rawDefault = localStorage.getItem(DEFAULT_KEY);
    if (rawDefault) {
      const savedDefault = JSON.parse(rawDefault);
      if (savedDefault && typeof savedDefault === 'object') Object.assign(defaults, savedDefault);
    }
  } catch { /* noop */ }
  PRESETS['模型默认'] = clone(defaults);

  let state = clone(defaults);
  let activePreset = '模型默认';
  const rows = new Map();

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function setSunPosition() {
    if (!sun) return;
    const radius = 80;
    const az = THREE.MathUtils.degToRad(state.sunAzimuth);
    const el = THREE.MathUtils.degToRad(state.sunElevation);
    sun.position.set(
      Math.cos(el) * Math.cos(az) * radius,
      Math.sin(el) * radius,
      Math.cos(el) * Math.sin(az) * radius,
    );
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }

  function apply(next = state, { persist = true } = {}) {
    state = { ...state, ...next };
    viewer.renderer.toneMappingExposure = state.exposure;
    viewer.renderer.toneMapping = toneMappingValue(state.toneMapping);
    viewer.scene.environmentIntensity = state.environment;
    if (sun) sun.intensity = state.sun;
    setSunPosition();
    if (viewer.hemiLight) viewer.hemiLight.intensity = state.hemi;
    if (viewer.modelFillLight) viewer.modelFillLight.intensity = state.modelFill;
    if (viewer.modelFrontFill) viewer.modelFrontFill.intensity = state.frontFill;
    if (viewer.rimLight) viewer.rimLight.intensity = state.rim;
    if (viewer.edgeLight) viewer.edgeLight.intensity = state.edge;
    if (viewer.spotLights) {
      for (const spot of viewer.spotLights) {
        spot.intensity = (spot.userData.baseIntensity || spot.intensity) * state.spots;
      }
    }
    ambient.intensity = state.ambient;
    if (viewer.bloomPass) {
      viewer.bloomPass.strength = state.bloom;
      viewer.bloomPass.radius = state.bloomRadius;
      viewer.bloomPass.threshold = state.bloomThreshold;
    }
    if (viewer.fxaaPass) viewer.fxaaPass.enabled = state.fxaa;
    viewer.renderer.shadowMap.enabled = state.shadows;
    if (sun) sun.castShadow = state.shadows;
    viewer.renderer.shadowMap.needsUpdate = true;
    if (state.fog > 0) {
      if (!viewer.scene.fog) viewer.scene.fog = new THREE.FogExp2(0x040a0d, state.fog);
      viewer.scene.fog.density = state.fog;
    } else {
      viewer.scene.fog = null;
    }
    viewer.camera.fov = state.fov;
    viewer.camera.near = state.near;
    viewer.camera.far = state.far;
    viewer.camera.updateProjectionMatrix();
    if (Math.abs(viewer.renderer.getPixelRatio() - state.pixelRatio) > 0.001) {
      viewer.renderer.setPixelRatio(state.pixelRatio);
      viewer.composer?.setPixelRatio(state.pixelRatio);
      viewer.resize();
    }
    for (const [key, row] of rows) {
      if (row.output) row.output.textContent = row.format(state[key]);
      if (row.input && row.type === 'range') row.input.value = state[key];
      if (row.input && row.type === 'select') row.input.value = state[key];
      if (row.input && row.type === 'toggle') {
        row.input.setAttribute('aria-pressed', String(Boolean(state[key])));
      }
    }
    for (const node of presetsRoot.querySelectorAll('.rs-preset')) {
      node.classList.toggle('is-active', node.dataset.preset === activePreset);
    }
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
    }
    setStatus(persist ? '参数已应用并保存' : '参数已应用');
  }

  function buildRow(item) {
    const row = document.createElement('div');
    row.className = 'rs-row';
    const label = document.createElement('label');
    label.innerHTML = `${item.label}${item.unit ? `<small>${item.unit}</small>` : ''}`;
    const output = document.createElement('output');
    row.append(label, output);
    let input;
    if (item.type === 'select') {
      output.textContent = '';
      output.hidden = true;
      input = document.createElement('select');
      input.className = 'rs-select';
      for (const [value, text] of item.options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        input.appendChild(option);
      }
      input.addEventListener('change', () => apply({ [item.key]: input.value }));
      row.append(input);
    } else if (item.type === 'toggle') {
      input = document.createElement('button');
      input.type = 'button';
      input.className = 'rs-toggle';
      input.setAttribute('role', 'switch');
      input.setAttribute('aria-label', item.label);
      input.addEventListener('click', () => apply({ [item.key]: !state[item.key] }));
      row.append(input);
      output.textContent = '';
      output.hidden = true;
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.className = 'rs-range';
      input.min = item.min;
      input.max = item.max;
      input.step = item.step;
      input.value = state[item.key];
      input.addEventListener('input', () => apply({ [item.key]: Number(input.value) }));
      row.append(input);
    }
    rows.set(item.key, {
      input,
      output,
      type: item.type || 'range',
      format: item.format || ((v) => String(v)),
    });
    return row;
  }

  for (const group of SCHEMA) {
    const section = document.createElement('section');
    section.className = 'rs-group';
    const title = document.createElement('div');
    title.className = 'rs-group-title';
    title.textContent = group.title;
    section.appendChild(title);
    for (const item of group.items) section.appendChild(buildRow(item));
    body.appendChild(section);
  }

  for (const name of Object.keys(PRESETS)) {
    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'rs-preset';
    buttonEl.dataset.preset = name;
    buttonEl.textContent = name;
    buttonEl.addEventListener('click', () => {
      activePreset = name;
      apply(clone(PRESETS[name]));
    });
    presetsRoot.appendChild(buttonEl);
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return false;
      apply({ ...defaults, ...saved }, { persist: false });
      setStatus('已载入上次参数');
      return true;
    } catch {
      return false;
    }
  }

  function open() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    if (!panel.dataset.loaded) {
      panel.dataset.loaded = '1';
      loadSaved();
    }
  }

  function close() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', () => (panel.classList.contains('is-open') ? close() : open()));
  document.getElementById('rs-close')?.addEventListener('click', close);
  panel.querySelector('[data-rs-close]')?.addEventListener('click', close);
  document.getElementById('rs-apply')?.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
    setStatus('参数已保存');
    close();
  });
  document.getElementById('rs-reset')?.addEventListener('click', () => {
    activePreset = '模型默认';
    apply(clone(defaults));
  });
  document.getElementById('rs-save-default')?.addEventListener('click', () => {
    try { localStorage.setItem(DEFAULT_KEY, JSON.stringify(state)); } catch { /* noop */ }
    Object.assign(defaults, clone(state));
    PRESETS['模型默认'] = clone(defaults);
    activePreset = '模型默认';
    setStatus('当前参数已保存为模型默认');
  });
  document.getElementById('rs-copy')?.addEventListener('click', async () => {
    const text = JSON.stringify(state, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('参数 JSON 已复制');
    } catch {
      setStatus('复制失败，请手动记录');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) close();
  });

  apply(defaults, { persist: false });
  if (loadSaved()) {
    // The user's latest persisted tuning becomes the reset baseline and is
    // copied into the dedicated default slot.
    Object.assign(defaults, clone(state));
    PRESETS['模型默认'] = clone(defaults);
    try { localStorage.setItem(DEFAULT_KEY, JSON.stringify(defaults)); } catch { /* noop */ }
  }
  return { open, close, apply, getState: () => clone(state), defaults: clone(defaults) };
}
