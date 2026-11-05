import * as THREE from 'three';

/**
 * A lightweight CCTV wall. Instead of video files (or four extra WebGL
 * contexts), a single 1280×720 canvas renders four fixed security cameras
 * from the live digital-twin scene at 10 fps. The overlay UI supplies the
 * usual CCTV chrome, timestamps and detection metadata.
 */
export class VideoWall {
  constructor(scene, cameraDefs, { lowPower = false } = {}) {
    this.scene = scene;
    this.cameraDefs = cameraDefs;
    this.lowPower = lowPower;
    this.width = lowPower ? 960 : 1280;
    this.height = lowPower ? 540 : 720;
    this.frameInterval = lowPower ? 180 : 100;
    this.page = 0;
    this.mode = 'quad';
    this.selected = 0;
    this.active = false;
    this.renderer = null;
    this.canvas = null;
    this.cameras = cameraDefs.map((def) => {
      const camera = new THREE.PerspectiveCamera(def.fov || 48, 16 / 9, 0.1, 320);
      camera.position.copy(def.position);
      camera.lookAt(def.target);
      return camera;
    });
    this.lastRender = 0;
    this.lastTime = 0;
    this.loop = this.loop.bind(this);
  }

  get pages() {
    return Math.ceil(this.cameraDefs.length / 4);
  }

  init(canvas) {
    if (this.renderer) return;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      stencil: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setClearColor(0x030708, 1);
  }

  open(canvas) {
    this.init(canvas);
    this.active = true;
    this.lastRender = 0;
    if (!this.raf) requestAnimationFrame(this.loop);
  }

  close() {
    this.active = false;
  }

  setPage(page) {
    this.page = Math.max(0, Math.min(this.pages - 1, page));
    this.lastRender = 0;
  }

  setMode(mode) {
    this.mode = mode === 'single' ? 'single' : 'quad';
    this.lastRender = 0;
  }

  setSelected(globalIndex) {
    this.selected = Math.max(0, Math.min(this.cameraDefs.length - 1, globalIndex));
    this.mode = 'single';
    this.lastRender = 0;
  }

  getVisibleCameras() {
    if (this.mode === 'single') {
      return [{ def: this.cameraDefs[this.selected], camera: this.cameras[this.selected], index: this.selected }];
    }
    const start = this.page * 4;
    return this.cameraDefs.slice(start, start + 4).map((def, i) => ({
      def,
      camera: this.cameras[start + i],
      index: start + i,
    }));
  }

  renderView(entry, x, y, width, height) {
    const { camera } = entry;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    this.renderer.setViewport(x, y, width, height);
    this.renderer.setScissor(x, y, width, height);
    this.renderer.render(this.scene, camera);
  }

  loop(now) {
    if (!this.active) {
      this.raf = null;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    if (now - this.lastRender < this.frameInterval) return;
    this.lastRender = now;
    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.autoClear = false;
    if (this.mode === 'single') {
      const camera = this.cameras[this.selected];
      this.renderer.setViewport(0, 0, this.width, this.height);
      this.renderer.render(this.scene, camera);
    } else {
      this.renderer.setScissorTest(true);
      const start = this.page * 4;
      const views = this.cameraDefs.slice(start, start + 4);
      const halfW = this.width / 2;
      const halfH = this.height / 2;
      views.forEach((def, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        // WebGL origin is bottom-left; row 0 is the top visual row.
        this.renderView({ def, camera: this.cameras[start + i] }, col * halfW, halfH - row * halfH, halfW, halfH);
      });
    }
    this.renderer.setScissorTest(false);
    this.lastTime = now;
  }

  dispose() {
    this.close();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
