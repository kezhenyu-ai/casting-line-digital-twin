import * as THREE from 'three';

function canvasTexture(width, height, paint, { srgb = true, repeat = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  paint(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  texture.needsUpdate = true;
  return texture;
}

function noise(ctx, w, h, alpha = 0.1, size = 2) {
  for (let i = 0; i < (w * h) / (size * 4); i += 1) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const value = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${value},${value},${value},${Math.random() * alpha})`;
    ctx.fillRect(x, y, size, size);
  }
}

export function makeConcreteTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#45494a');
    gradient.addColorStop(0.48, '#393d3e');
    gradient.addColorStop(1, '#2e3334');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 24; i += 1) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const radius = 24 + Math.random() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(${Math.random() > 0.5 ? '14,18,18' : '105,105,98'},${Math.random() * 0.09})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    noise(ctx, w, h, 0.18, 2);

    // Hairline cracks / expansion joints.
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      ctx.strokeStyle = `rgba(15,18,18,${0.12 + Math.random() * 0.16})`;
      ctx.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.moveTo(x, y);
      const segments = 3 + Math.floor(Math.random() * 5);
      for (let s = 0; s < segments; s += 1) {
        x += (Math.random() - 0.5) * 50;
        y += Math.random() * 38;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(16,20,20,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.33, 0);
    ctx.lineTo(w * 0.33, h);
    ctx.moveTo(0, h * 0.66);
    ctx.lineTo(w, h * 0.66);
    ctx.stroke();
  }, { repeat: [8, 5] });
}

export function makeWallTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#252e31');
    base.addColorStop(0.6, '#1c2426');
    base.addColorStop(1, '#12191b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x += 16) {
      const light = 8 + Math.random() * 11;
      ctx.fillStyle = `rgba(${light + 20},${light + 27},${light + 29},.7)`;
      ctx.fillRect(x, 0, 6, h);
      ctx.fillStyle = 'rgba(3,7,8,.38)';
      ctx.fillRect(x + 10, 0, 3, h);
    }

    for (let i = 0; i < 20; i += 1) {
      const y = Math.random() * h;
      const height = 3 + Math.random() * 28;
      ctx.fillStyle = `rgba(22,18,13,${Math.random() * 0.09})`;
      ctx.fillRect(0, y, w, height);
    }

    const grime = ctx.createLinearGradient(0, h * 0.5, 0, h);
    grime.addColorStop(0, 'rgba(6,9,10,0)');
    grime.addColorStop(1, 'rgba(4,7,8,.45)');
    ctx.fillStyle = grime;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 0.08, 2);
  }, { repeat: [4, 2] });
}

export function makeHazardStripeTexture() {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#b98a2f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151819';
    for (let x = -h; x < w + h; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 23, h);
      ctx.lineTo(x + 23 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    noise(ctx, w, h, 0.17, 1);
  }, { repeat: [3, 1] });
}

export function makeSmokeTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 13; i += 1) {
      const x = w * 0.5 + (Math.random() - 0.5) * 45;
      const y = h * 0.5 + (Math.random() - 0.5) * 45;
      const radius = 16 + Math.random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(255,255,255,${0.035 + Math.random() * 0.055})`);
      g.addColorStop(0.5, `rgba(255,255,255,${0.025 + Math.random() * 0.03})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // Feather the square edge so point sprites never show a hard box.
    const fade = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.5);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

export function makeGlowTexture(color = '#7dffe9') {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.14, color);
    g.addColorStop(0.45, `${color}66`);
    g.addColorStop(1, `${color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

export function makeSparkTexture() {
  return canvasTexture(32, 32, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.25, 'rgba(255,196,100,.9)');
    g.addColorStop(1, 'rgba(255,90,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

export function makeDustTexture() {
  return canvasTexture(32, 32, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(211,223,215,.7)');
    g.addColorStop(0.4, 'rgba(190,202,195,.22)');
    g.addColorStop(1, 'rgba(160,175,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}

export function makeFloorDecal(cn, en, color = '#c9a04f') {
  return canvasTexture(768, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.globalAlpha = 0.32;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    ctx.globalAlpha = 0.78;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '600 70px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
    ctx.fillText(cn, 56, h * 0.44);
    ctx.globalAlpha = 0.46;
    ctx.font = '500 25px Bahnschrift, "Segoe UI", sans-serif';
    ctx.letterSpacing = '5px';
    ctx.fillText(en, 59, h * 0.72);

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.fillRect(w - 145, h * 0.35, 82, 3);
    ctx.fillRect(w - 104, h * 0.35, 41, 3);
    ctx.fillRect(w - 145, h * 0.45, 34, 2);
    ctx.fillRect(w - 145, h * 0.52, 61, 2);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(w - 88, h * 0.67, 34, 0, Math.PI * 1.65);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

export function makeVentTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1c2325';
    ctx.fillRect(0, 0, w, h);
    for (let y = 12; y < h; y += 18) {
      ctx.fillStyle = 'rgba(4,7,8,.76)';
      ctx.fillRect(10, y, w - 20, 7);
      ctx.fillStyle = 'rgba(100,111,110,.18)';
      ctx.fillRect(10, y + 7, w - 20, 1);
    }
    noise(ctx, w, h, 0.08, 1);
  });
}

export function makeScreenTexture() {
  return canvasTexture(512, 288, (ctx, w, h) => {
    ctx.fillStyle = '#041012';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,240,220,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(97,239,189,.85)';
    ctx.font = '500 16px Bahnschrift, monospace';
    ctx.fillText('PROCESS MONITOR', 22, 30);
    ctx.fillStyle = 'rgba(111,228,238,.55)';
    ctx.font = '11px Bahnschrift, monospace';
    ctx.fillText('FURNACE 01  ·  RUNNING', 22, 55);
    ctx.strokeStyle = 'rgba(97,239,189,.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 22; x < w - 20; x += 4) {
      const y = 135 + Math.sin(x * 0.047) * 25 + Math.sin(x * 0.12) * 8;
      if (x === 22) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,189,102,.8)';
    ctx.fillRect(22, 215, 102, 3);
    ctx.fillRect(134, 215, 48, 3);
    ctx.fillStyle = 'rgba(97,239,189,.32)';
    ctx.fillRect(22, 229, 160, 2);
  });
}
