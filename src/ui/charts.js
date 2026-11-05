const FONT = 'Bahnschrift, "Segoe UI", "Microsoft YaHei UI", sans-serif';

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width || canvas.clientWidth || 300);
  const height = Math.max(1, rect.height || canvas.clientHeight || 120);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(width * dpr);
  const targetH = Math.round(height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height, dpr };
}

function linePath(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

export function drawSparkline(canvas, values, options = {}) {
  if (!canvas || !values?.length) return;
  const { ctx, width, height } = setupCanvas(canvas);
  const {
    color = '#61efbd',
    fill = 'rgba(97,239,189,.12)',
    previous = null,
    lineWidth = 1.3,
    padding = 3,
    dashed = false,
  } = options;

  const all = previous ? [...values, ...previous] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(1, max - min);
  const xFor = (i, length) => padding + (i / Math.max(1, length - 1)) * (width - padding * 2);
  const yFor = (v) => height - padding - ((v - min) / range) * (height - padding * 2 - 3);

  if (previous) {
    const prevPoints = previous.map((v, i) => [xFor(i, previous.length), yFor(v)]);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,189,102,.32)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    linePath(ctx, prevPoints);
    ctx.stroke();
    ctx.restore();
  }

  const points = values.map((v, i) => [xFor(i, values.length), yFor(v)]);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, fill);
  gradient.addColorStop(1, 'rgba(5,10,12,0)');
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(points[points.length - 1][0], height);
  ctx.lineTo(points[0][0], height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  if (dashed) ctx.setLineDash([4, 3]);
  linePath(ctx, points);
  ctx.stroke();
  ctx.restore();

  const last = points[points.length - 1];
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(last[0], last[1], 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Endpoint value tag.
  if (options.label) {
    ctx.fillStyle = 'rgba(195,232,229,.7)';
    ctx.font = `500 8.5px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(options.label, width - 3, 8);
  }
}

export function createEnergyChart(canvas, tooltipEl) {
  let state = {
    values: [],
    previous: [],
    unit: 'kW',
    labels: [],
    color: '#61efbd',
  };
  let hoverIndex = -1;
  let geometry = null;

  function render(next = {}) {
    state = { ...state, ...next };
    if (!canvas || !state.values.length) return;
    const { ctx, width, height } = setupCanvas(canvas);
    const padding = { left: 56, right: 20, top: 22, bottom: 32 };
    const plotW = Math.max(20, width - padding.left - padding.right);
    const plotH = Math.max(20, height - padding.top - padding.bottom);
    const all = [...state.values, ...state.previous];
    let min = Math.min(...all);
    let max = Math.max(...all);
    const pad = Math.max(10, (max - min) * 0.18);
    min = Math.max(0, min - pad);
    max += pad;
    const range = Math.max(1, max - min);
    const xFor = (i) => padding.left + (i / Math.max(1, state.values.length - 1)) * plotW;
    const yFor = (v) => padding.top + plotH - ((v - min) / range) * plotH;

    ctx.save();
    ctx.strokeStyle = 'rgba(112,171,176,.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padding.top + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const value = max - (i / 4) * range;
      ctx.fillStyle = 'rgba(104,133,137,.62)';
      ctx.font = `400 9.5px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(value).toLocaleString('zh-CN'), padding.left - 9, y + 3);
    }

    const xTicks = 6;
    for (let i = 0; i < xTicks; i += 1) {
      const idx = Math.round((i / (xTicks - 1)) * (state.values.length - 1));
      const x = xFor(idx);
      ctx.strokeStyle = 'rgba(112,171,176,.06)';
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
      ctx.fillStyle = 'rgba(101,130,134,.55)';
      ctx.font = `400 9px ${FONT}`;
      ctx.textAlign = i === 0 ? 'left' : i === xTicks - 1 ? 'right' : 'center';
      ctx.fillText(state.labels[idx] || '', x, height - 8);
    }

    // Unit note on the y-axis.
    ctx.fillStyle = 'rgba(100,132,136,.65)';
    ctx.font = `500 8.5px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(state.unit, 12, 12);

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
    gradient.addColorStop(0, 'rgba(97,239,189,.22)');
    gradient.addColorStop(0.5, 'rgba(97,239,189,.07)');
    gradient.addColorStop(1, 'rgba(97,239,189,0)');

    const valuePoints = state.values.map((v, i) => [xFor(i), yFor(v)]);
    ctx.beginPath();
    valuePoints.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xFor(state.values.length - 1), padding.top + plotH);
    ctx.lineTo(xFor(0), padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    if (state.previous?.length) {
      const prevPoints = state.previous.map((v, i) => [xFor(i), yFor(v)]);
      ctx.strokeStyle = 'rgba(255,189,102,.34)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      linePath(ctx, prevPoints);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,189,102,.42)';
      ctx.font = `400 9px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('昨日同期', padding.left + 7, padding.top + 10);
    }

    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    ctx.shadowColor = state.color;
    ctx.shadowBlur = 11;
    linePath(ctx, valuePoints);
    ctx.stroke();
    ctx.restore();

    // Horizontal current-value marker.
    const last = valuePoints[valuePoints.length - 1];
    ctx.strokeStyle = 'rgba(97,239,189,.2)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, last[1]);
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = state.color;
    ctx.shadowColor = state.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(last[0], last[1], 2.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(194,230,227,.78)';
    ctx.font = `500 8.5px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(state.values[state.values.length - 1]).toLocaleString('zh-CN')} ${state.unit}`, width - padding.right, padding.top + 1);

    if (hoverIndex >= 0 && hoverIndex < state.values.length) {
      const hx = xFor(hoverIndex);
      const hy = yFor(state.values[hoverIndex]);
      ctx.strokeStyle = 'rgba(165,248,238,.32)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e5fffb';
      ctx.beginPath();
      ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(97,239,189,.25)';
      ctx.beginPath();
      ctx.arc(hx, hy, 7.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    geometry = { padding, plotW, xFor, yFor };
  }

  if (canvas) {
    canvas.addEventListener('mousemove', (event) => {
      if (!geometry) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const index = Math.round(((x - geometry.padding.left) / geometry.plotW) * (state.values.length - 1));
      hoverIndex = Math.max(0, Math.min(state.values.length - 1, index));
      render();
      if (tooltipEl) {
        const value = state.values[hoverIndex];
        tooltipEl.innerHTML = `<span>${state.labels[hoverIndex] || ''}</span><br><b>${Math.round(value).toLocaleString('zh-CN')} ${state.unit}</b>`;
        tooltipEl.style.left = `${x}px`;
        tooltipEl.style.top = `${y}px`;
        tooltipEl.hidden = false;
      }
    });
    canvas.addEventListener('mouseleave', () => {
      hoverIndex = -1;
      if (tooltipEl) tooltipEl.hidden = true;
      render();
    });
  }

  return {
    render,
    update(next) {
      state = { ...state, ...next };
      render();
    },
  };
}

export function drawEquipmentTrend(canvas, values, color = '#61efbd') {
  if (!canvas || !values?.length) return;
  const { ctx, width, height } = setupCanvas(canvas);
  const min = Math.min(...values) * 0.97;
  const max = Math.max(...values) * 1.03;
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => [4 + (i / (values.length - 1)) * (width - 8), height - 6 - ((v - min) / range) * (height - 13)]);
  ctx.strokeStyle = 'rgba(109,167,172,.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const y = 7 + (i / 2) * (height - 15);
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(width - 4, y);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, 'rgba(97,239,189,.24)');
  g.addColorStop(1, 'rgba(97,239,189,0)');
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineTo(points[points.length - 1][0], height);
  ctx.lineTo(points[0][0], height);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  const last = points[points.length - 1];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(last[0], last[1], 2.3, 0, Math.PI * 2);
  ctx.fill();
}

