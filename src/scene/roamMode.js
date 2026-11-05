import * as THREE from 'three';

/**
 * First-person walk mode.
 *
 * Controls:
 *   W / S     forward / backward
 *   A / D     rotate left / right
 *   Shift     run
 *   LMB drag  look around
 *   ESC       exit
 *
 * There is deliberately no inertia: releasing the movement keys stops the
 * walker immediately.
 */
export class RoamController {
  constructor(viewer) {
    this.viewer = viewer;
    this.active = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.lastPointer = null;
    this.dragging = false;
    this.saved = null;
    this.speed = 8;
    this.turnSpeed = 1.9;
    this.lookSpeed = 0.0024;
    this.playerRadius = 0.55;
    this.colliders = [];
    this.hint = document.getElementById('roam-hint');
    this.button = document.getElementById('btn-roam');
    this.canvas = viewer.canvas;

    this.onKeyDown = (event) => {
      if (!this.active) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        this.exit();
        return;
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
      }
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);

    this.onPointerDown = (event) => {
      if (!this.active || event.button !== 0) return;
      event.preventDefault();
      this.dragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      try {
        this.canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Synthetic or non-capturable pointer events still support drag-look.
      }
    };
    this.onPointerMove = (event) => {
      if (!this.active || !this.dragging) return;
      if (!this.lastPointer) {
        this.lastPointer = { x: event.clientX, y: event.clientY };
        return;
      }
      const dx = event.clientX - this.lastPointer.x;
      const dy = event.clientY - this.lastPointer.y;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.yaw -= dx * this.lookSpeed;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * this.lookSpeed, -1.2, 1.2);
    };
    this.onPointerUp = (event) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.lastPointer = null;
      try {
        this.canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        // Ignore a capture that was never acquired.
      }
    };
    this.onContextMenu = (event) => {
      if (this.active) event.preventDefault();
    };
    this.onButtonClick = () => this.toggle();

    this.button?.addEventListener('click', this.onButtonClick);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('contextmenu', this.onContextMenu);
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  buildColliders() {
    this.colliders = [];
    const equipment = this.viewer.factory?.equipment;
    if (!equipment) return;
    for (const eq of equipment.values()) {
      // The AGV moves every frame; its old bounds would create phantom walls.
      if (eq.id === 'AGV-01' || !eq.group) continue;
      const box = new THREE.Box3().setFromObject(eq.group);
      const size = box.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.x) || !Number.isFinite(size.z)) continue;
      // A parent group can occasionally include a far-away ground/utility
      // helper. Use a compact fallback around its center instead of turning
      // half the plant into one collider.
      if (size.x > 70 || size.z > 70) {
        const c = box.getCenter(new THREE.Vector3());
        box.min.set(c.x - 9, 0, c.z - 9);
        box.max.set(c.x + 9, 4, c.z + 9);
      }
      if (box.max.y < 0.2 || box.min.y > 2.5) continue;
      this.colliders.push(box);
    }
    if (Array.isArray(this.viewer.factory.roamColliders)) {
      this.colliders.push(...this.viewer.factory.roamColliders);
    }
  }

  isBlocked(x, z) {
    const r = this.playerRadius;
    return this.colliders.some((box) => (
      x > box.min.x - r &&
      x < box.max.x + r &&
      z > box.min.z - r &&
      z < box.max.z + r
    ));
  }

  enter() {
    if (this.active || !this.viewer.factory) return;
    const factory = this.viewer.factory;
    const box = factory.modelBox;
    const center = box.getCenter(new THREE.Vector3());
    this.buildColliders();
    const start = new THREE.Vector3(center.x, 1.75, box.max.z + 9);
    if (this.isBlocked(start.x, start.z)) start.z = box.max.z + 16;
    this.saved = {
      position: this.viewer.camera.position.clone(),
      target: this.viewer.controls.target.clone(),
      fov: this.viewer.camera.fov,
    };
    this.viewer.controls.enabled = false;
    this.viewer.camera.position.copy(start);
    this.yaw = 0;
    this.pitch = -0.03;
    this.viewer.camera.rotation.order = 'YXZ';
    this.viewer.camera.rotation.set(this.pitch, this.yaw, 0);
    this.active = true;
    this.keys.clear();
    this.dragging = false;
    this.lastPointer = null;
    if (this.hint) this.hint.hidden = false;
    this.button?.classList.add('is-active');
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.dragging = false;
    this.lastPointer = null;
    this.keys.clear();
    if (this.saved) {
      this.viewer.camera.position.copy(this.saved.position);
      this.viewer.controls.target.copy(this.saved.target);
      this.viewer.camera.fov = this.saved.fov;
      this.viewer.camera.updateProjectionMatrix();
      this.viewer.controls.enabled = true;
      this.viewer.controls.update();
    }
    if (this.hint) this.hint.hidden = true;
    this.button?.classList.remove('is-active');
  }

  update(dt) {
    if (!this.active) return;
    const camera = this.viewer.camera;
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? this.speed * 1.9 : this.speed;

    // A / D rotate the walker; they never strafe. W / S drive forward and back.
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.yaw += this.turnSpeed * dt;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.yaw -= this.turnSpeed * dt;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let move = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move -= 1;
    if (move !== 0) {
      const distance = move * speed * dt;
      const steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.25));
      const step = distance / steps;
      for (let i = 0; i < steps; i += 1) {
        const nx = camera.position.x + forward.x * step;
        if (!this.isBlocked(nx, camera.position.z)) camera.position.x = nx;
        const nz = camera.position.z + forward.z * step;
        if (!this.isBlocked(camera.position.x, nz)) camera.position.z = nz;
      }
    }

    // No inertia or idle bob: once the keys are released, the walker is still.
    camera.position.y = 1.75;
    camera.rotation.set(this.pitch, this.yaw, 0);
  }

  dispose() {
    this.exit();
    this.button?.removeEventListener('click', this.onButtonClick);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('contextmenu', this.onContextMenu);
  }
}
