import './style.css';
import { Simulation } from './data/simulation.js';
import { FoundryViewer } from './scene/viewer.js';
import { ModelViewer } from './scene/modelViewer.js';
import { VideoWall } from './videoWall.js';
import { Dashboard } from './ui.js';
import { AIChat } from './aiChat.js';
import { LoginGate } from './auth.js';
import { createRenderSettings } from './renderSettings.js';
import { createModelImporter } from './import/modelImporter.js';

const modelMode = new URLSearchParams(location.search).get('mode') !== 'demo';
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingPct = document.getElementById('loading-pct');

let dash;
let viewer;
let simulation;
let videoWall;
let aiChat;
let renderSettings;

function setLoading(progress, text) {
  if (loadingBar) loadingBar.style.width = `${progress}%`;
  if (loadingPct) loadingPct.textContent = `${Math.round(progress)}%`;
  if (text && loadingText) loadingText.textContent = text;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function boot() {
  setLoading(7, '正在建立 WebGL 渲染上下文…');
  await wait(180);

  simulation = new Simulation({ modelMode });

  try {
    const ViewerClass = modelMode ? ModelViewer : FoundryViewer;
    viewer = new ViewerClass({
      canvas: document.getElementById('scene-canvas'),
      labelsLayer: document.getElementById('labels-layer'),
      tooltip: document.getElementById('scene-tooltip'),
      onSelectEquipment: (id) => {
        // A direct scene click only selects/focuses the equipment and keeps
        // the halo visible. The detail drawer is reserved for the right-side
        // equipment list.
        if (!modelMode) {
          dash?.onEquipmentSelected(id);
        } else {
          // Selecting in the scene should not leave an older drawer open.
          dash?.closeModal(true);
        }
      },
      onSelectEmission: (id) => dash?.openEmissionsModal(id),
      onSelectAnchor: () => {},
      onStats: (stats) => dash?.setPerf(stats),
      onCoords: (x, z, zone) => dash?.setCoords(x, z, zone),
      onViewChange: (view) => dash?.setViewButton(view),
    });
    if (modelMode) {
      setLoading(24, '正在加载厂房1造型线模型与设备绑定…');
      await viewer.loadModel('/models/shape-line-20260617.glb');
      const brandProject = document.getElementById('brand-project-name');
      if (brandProject) brandProject.textContent = '铸造产线';
      renderSettings = createRenderSettings(viewer);
    } else {
      const settingsButton = document.getElementById('btn-render-settings');
      if (settingsButton) settingsButton.hidden = true;
    }
  } catch (error) {
    console.error('[digital twin] WebGL initialization failed', error);
    setLoading(100, 'WebGL 初始化失败，请检查浏览器硬件加速设置');
    return;
  }

  setLoading(48, '正在载入铸铁产线数字孪生模型…');
  await nextFrame();
  await wait(220);
  setLoading(69, '正在连接 CEMS / 能源计量 / 视频网关…');
  await wait(240);

  videoWall = new VideoWall(viewer.scene, viewer.factory.cameraDefs, { lowPower: viewer.isSoftwareRenderer });
  dash = new Dashboard({ simulation, viewer, videoWall });
  aiChat = new AIChat({ simulation });
  const modelImporter = modelMode ? createModelImporter({ viewer, dash }) : null;
  setLoading(86, '正在编译 PBR 材质与泛光后期管线…');
  await wait(280);
  setLoading(96, '正在同步全厂实时运行状态…');
  await wait(260);
  setLoading(100, '数字孪生场景就绪');

  window.__BINHE_TWIN__ = { simulation, viewer, dash, videoWall, aiChat, renderSettings, modelImporter };

  await wait(430);
  loadingScreen?.classList.add('is-done');
  setTimeout(() => {
    if (loadingScreen) loadingScreen.style.display = 'none';
  }, 800);
}

function handleBootError(error) {
  console.error('[digital twin] boot failure', error);
  if (loadingText) loadingText.textContent = '场景加载异常，请刷新页面重试';
  if (loadingPct) loadingPct.textContent = 'ERR';
  if (loadingBar) loadingBar.style.background = '#ff6570';
}

const loginGate = new LoginGate({
  onAuthenticated: (user) => {
    if (user) window.__BINHE_USER__ = user;
    boot().catch(handleBootError);
  },
});

window.__BINHE_LOGIN__ = loginGate;
loginGate.start();
