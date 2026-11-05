import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MODEL_EXTENSIONS = ['glb', 'fbx'];
const TEXTURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const DB_NAME = 'binhe-casting-model-import';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

const extOf = (name) => name.split('.').pop().toLowerCase();
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const dateLabel = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveProjectRecord(project) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(project);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readLatestProject() {
  const db = await openDb();
  const project = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get('latest');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return project;
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return data;
}

async function parseModelFiles(files, onProgress = () => {}) {
  const modelFile = files.find((file) => MODEL_EXTENSIONS.includes(extOf(file.name)));
  if (!modelFile) throw new Error('没有找到 GLB 或 FBX 模型文件。');
  const textureFiles = files.filter((file) => TEXTURE_EXTENSIONS.includes(extOf(file.name)));
  onProgress(18, '读取模型文件…');
  const buffer = toArrayBuffer(modelFile.data);
  if (!buffer) throw new Error('模型文件读取失败。');

  if (extOf(modelFile.name) === 'glb') {
    onProgress(42, '解析 GLB / 解压 Draco…');
    const draco = new DRACOLoader();
    draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    draco.setDecoderConfig({ type: 'js' });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.parseAsync(buffer, '');
    onProgress(82, '建立场景对象…');
    return { scene: gltf.scene, animations: gltf.animations || [], format: 'GLB', textureCount: 0 };
  }

  onProgress(42, '解析 FBX 与贴图引用…');
  const manager = new THREE.LoadingManager();
  const objectUrls = [];
  const textureMap = new Map();
  for (const file of textureFiles) {
    const blob = new Blob([toArrayBuffer(file.data)], { type: file.type || 'image/png' });
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    textureMap.set(file.name.split(/[\\/]/).pop().toLowerCase(), url);
  }
  manager.setURLModifier((url) => {
    const clean = decodeURIComponent(url).split(/[\\/]/).pop().toLowerCase();
    return textureMap.get(clean) || url;
  });
  const loader = new FBXLoader(manager);
  const object = loader.parse(buffer, '');
  onProgress(82, '建立场景对象…');
  // Keep object URLs alive long enough for deferred bitmap decoding.
  window.setTimeout(() => objectUrls.forEach((url) => URL.revokeObjectURL(url)), 60000);
  return { scene: object, animations: object.animations || [], format: 'FBX', textureCount: textureFiles.length };
}

export function createModelImporter({ viewer, dash }) {
  const button = document.getElementById('btn-import-model');
  if (!button) return null;

  const root = document.createElement('div');
  root.className = 'model-import';
  root.id = 'model-import';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="mi-panel" role="dialog" aria-modal="true" aria-labelledby="mi-title">
      <header class="mi-head">
        <div>
          <div class="mi-kicker">MODEL IMPORT / PROJECT</div>
          <h2 id="mi-title">导入三维模型</h2>
        </div>
        <button class="mi-close" id="mi-close" title="关闭" aria-label="关闭">×</button>
      </header>
      <div class="mi-body">
        <div class="mi-drop" id="mi-drop" role="button" tabindex="0">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
          <b>拖拽 GLB / FBX 到这里</b>
          <span>或点击选择模型文件</span>
          <small>GLB 单文件 · FBX 可同时选择外部贴图</small>
        </div>
        <input class="mi-input" id="mi-input" type="file" multiple accept=".glb,.fbx,.png,.jpg,.jpeg,.webp" />
        <div class="mi-file-list" id="mi-files"></div>
        <label class="mi-field">
          <span>项目名称 / PROJECT NAME</span>
          <input id="mi-name" type="text" placeholder="输入项目名称…" autocomplete="off" />
        </label>
        <div class="mi-hint" id="mi-hint">GLB 会把纹理、动画、层级一起加载。FBX 建议同时选择使用的 PNG/JPG/WEBP 贴图。</div>
        <div class="mi-error" id="mi-error"></div>
        <div class="mi-progress" id="mi-progress"><div class="mi-progress-bar"><i id="mi-progress-bar"></i></div><span id="mi-progress-text">准备导入</span></div>
        <div class="mi-recent" id="mi-recent" hidden>
          <div class="mi-recent-head"><span>RECENT PROJECT / 最近项目</span><span>INDEXEDDB</span></div>
          <div id="mi-recent-list"></div>
        </div>
      </div>
      <footer class="mi-foot">
        <span class="mi-status" id="mi-status">支持 .glb / .fbx</span>
        <button class="mi-btn" id="mi-cancel">取消</button>
        <button class="mi-btn primary" id="mi-start" disabled>导入并加载</button>
      </footer>
    </div>`;
  document.body.appendChild(root);

  const $ = (selector) => root.querySelector(selector);
  const input = $('#mi-input');
  const nameInput = $('#mi-name');
  const startButton = $('#mi-start');
  const errorBox = $('#mi-error');
  const progress = $('#mi-progress');
  const progressBar = $('#mi-progress-bar');
  const progressText = $('#mi-progress-text');
  let selectedFiles = [];
  let busy = false;

  function toast(message) {
    dash?.toast?.(message);
  }

  function showError(message = '') {
    errorBox.textContent = message;
    errorBox.classList.toggle('is-visible', Boolean(message));
  }

  function setProgress(value, text) {
    progress.classList.add('is-visible');
    progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    progressText.textContent = text;
  }

  function updateBadge(project) {
    const brand = document.getElementById('brand-project-name');
    if (brand) {
      brand.textContent = project ? project.name : '滨河铸造';
      brand.title = project ? `${project.format} · ${project.stats?.meshes || 0} meshes` : '';
    }
    const badge = document.getElementById('project-badge');
    const name = document.getElementById('project-badge-name');
    if (badge && name) {
      badge.hidden = !project;
      name.textContent = project ? project.name : '—';
    }
  }

  function renderFiles() {
    const list = $('#mi-files');
    list.innerHTML = selectedFiles.map((file) => `
      <div class="mi-file">
        <span class="mi-file-kind">${extOf(file.name).toUpperCase()}</span>
        <span class="mi-file-name" title="${file.name}">${file.name}</span>
        <span class="mi-file-size">${formatBytes(file.size)}</span>
      </div>
    `).join('');
    const models = selectedFiles.filter((file) => MODEL_EXTENSIONS.includes(extOf(file.name)));
    const valid = models.length === 1;
    startButton.disabled = !valid || busy;
    $('#mi-status').textContent = selectedFiles.length
      ? valid ? `${models.length} 个模型 · ${selectedFiles.length} 个文件` : '只能选择一个 GLB 或 FBX 模型'
      : '支持 .glb / .fbx';
  }

  function choose(files) {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    selectedFiles = incoming;
    const models = selectedFiles.filter((file) => MODEL_EXTENSIONS.includes(extOf(file.name)));
    if (models.length > 1) showError('一次只能导入一个模型文件，请移除多余的 GLB/FBX。');
    else showError('');
    if (models.length === 1) {
      nameInput.value = models[0].name.replace(/\.[^.]+$/, '');
    }
    renderFiles();
  }

  function reset() {
    selectedFiles = [];
    nameInput.value = '';
    showError('');
    progress.classList.remove('is-visible');
    progressBar.style.width = '0';
    renderFiles();
  }

  async function loadProject(project) {
    if (!project || busy) return;
    busy = true;
    startButton.disabled = true;
    showError('');
    setProgress(8, '读取本地项目…');
    try {
      const parsed = await parseModelFiles(project.files, setProgress);
      setProgress(90, '载入场景、材质与动画…');
      const stats = await viewer.loadImportedModel(parsed.scene, parsed.animations, project);
      project.stats = stats;
      project.format = parsed.format;
      project.textureCount = parsed.textureCount;
      project.lastOpenedAt = new Date().toISOString();
      await saveProjectRecord(project);
      updateBadge(project);
      setProgress(100, '项目已载入');
      toast(`已载入项目：${project.name}`);
      window.setTimeout(close, 350);
    } catch (error) {
      console.error(error);
      showError(error?.message || '模型载入失败。');
      setProgress(0, '导入失败');
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  }

  async function startImport() {
    if (busy) return;
    const modelFile = selectedFiles.find((file) => MODEL_EXTENSIONS.includes(extOf(file.name)));
    if (!modelFile) {
      showError('请选择一个 GLB 或 FBX 文件。');
      return;
    }
    busy = true;
    startButton.disabled = true;
    showError('');
    setProgress(4, '读取文件…');
    try {
      const files = await Promise.all(selectedFiles.map(async (file) => ({
        name: file.name,
        type: file.type,
        data: await file.arrayBuffer(),
      })));
      const project = {
        id: 'latest',
        name: (nameInput.value || modelFile.name.replace(/\.[^.]+$/, '')).trim(),
        format: extOf(modelFile.name).toUpperCase(),
        sourceName: modelFile.name,
        size: modelFile.size,
        importedAt: new Date().toISOString(),
        files,
      };
      const parsed = await parseModelFiles(files, setProgress);
      project.format = parsed.format;
      project.textureCount = parsed.textureCount;
      setProgress(90, '载入场景、材质与动画…');
      const stats = await viewer.loadImportedModel(parsed.scene, parsed.animations, project);
      project.stats = stats;
      await saveProjectRecord(project);
      updateBadge(project);
      setProgress(100, '项目已生成');
      toast(`项目已生成：${project.name}`);
      window.setTimeout(close, 450);
    } catch (error) {
      console.error(error);
      showError(error?.message || '模型导入失败，请检查文件是否完整。');
      setProgress(0, '导入失败');
    } finally {
      busy = false;
      startButton.disabled = false;
    }
  }

  async function refreshRecent() {
    try {
      const project = await readLatestProject();
      const wrap = $('#mi-recent');
      const list = $('#mi-recent-list');
      if (!project) {
        wrap.hidden = true;
        list.innerHTML = '';
        return;
      }
      wrap.hidden = false;
      list.innerHTML = `
        <div class="mi-recent-item">
          <div class="mi-recent-copy">
            <b>${project.name}</b>
            <span>${project.format} · ${formatBytes(project.size)} · ${dateLabel(project.importedAt)}</span>
          </div>
          <button class="mi-recent-open" data-open-project>打开</button>
        </div>`;
      list.querySelector('[data-open-project]')?.addEventListener('click', () => loadProject(project));
    } catch (error) {
      console.warn('recent project unavailable', error);
    }
  }

  function open() {
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    reset();
    refreshRecent();
  }

  function close() {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    showError('');
    progress.classList.remove('is-visible');
  }

  button.addEventListener('click', open);
  $('#mi-close').addEventListener('click', close);
  $('#mi-cancel').addEventListener('click', close);
  $('#mi-drop').addEventListener('click', () => input.click());
  $('#mi-drop').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') input.click();
  });
  input.addEventListener('change', () => choose(input.files));
  root.addEventListener('dragover', (event) => {
    event.preventDefault();
    $('#mi-drop').classList.add('is-over');
  });
  root.addEventListener('dragleave', (event) => {
    if (event.target === root) $('#mi-drop').classList.remove('is-over');
  });
  root.addEventListener('drop', (event) => {
    event.preventDefault();
    $('#mi-drop').classList.remove('is-over');
    if (event.dataTransfer?.files?.length) choose(event.dataTransfer.files);
  });
  startButton.addEventListener('click', startImport);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) close();
  });

  return { open, close, loadLatest: refreshRecent };
}
