import { createEnergyChart, drawSparkline, drawEquipmentTrend } from './ui/charts.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const STATUS_LABEL = {
  running: '运行',
  idle: '待机',
  warning: '预警',
  maintenance: '维护',
  offline: '离线',
};

const LEVEL_LABEL = {
  info: '信息',
  warn: '预警',
  error: '报警',
  action: '操作',
  ok: '正常',
};

const ENERGY_META = {
  electricity: { title: '24 小时有功负荷曲线', unit: 'kW', color: '#61efbd', tableUnit: '当前功率', todayUnit: '今日电量', totalUnit: 'kWh' },
  gas: { title: '24 小时天然气负荷曲线', unit: 'Nm³/h', color: '#ffbd66', tableUnit: '瞬时流量', todayUnit: '今日用量', totalUnit: 'Nm³' },
  water: { title: '24 小时新水流量曲线', unit: 'm³/h', color: '#86b9ff', tableUnit: '瞬时流量', todayUnit: '今日用量', totalUnit: 'm³' },
  air: { title: '24 小时压缩空气流量曲线', unit: 'Nm³/min', color: '#6fe4ee', tableUnit: '瞬时流量', todayUnit: '今日用量', totalUnit: 'Nm³' },
};

const fmt = (value, digits = 0) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const clampPct = (value) => Math.max(0, Math.min(100, value));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function modalHead(kicker, title, en, extra = '') {
  return `
    <header class="modal-head">
      <div>
        <span class="modal-kicker">${kicker}</span>
        <div class="modal-title"><h2>${title}</h2><span>${en}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${extra}
        <button class="modal-close js-close-modal" aria-label="关闭"><svg class="icon"><use href="#i-x"></use></svg></button>
      </div>
    </header>
  `;
}

function statusTag(point) {
  const label = point.status === 'warning' ? '预警' : point.status === 'exceed' ? '超标' : '达标';
  return `<span class="status-tag ${point.status === 'warning' ? 'warning' : point.status === 'exceed' ? 'exceed' : ''}">${label}</span>`;
}

export class Dashboard {
  constructor({ simulation, viewer, videoWall }) {
    this.sim = simulation;
    this.viewer = viewer;
    this.videoWall = videoWall;
    this.state = null;
    this.activeModalType = null;
    this.activeModalClose = null;
    this.videoTimer = null;
    this.videoPage = 0;
    this.videoSelected = 0;
    this.modalToken = 0;
    this.energyType = 'electricity';
    this.logFilter = 'all';
    this.logSource = '';
    this.logQuery = '';
    this.drawerEquipmentId = null;
    this.equipmentHistory = new Map();
    this.lastLogCount = 0;
    this.perf = null;
    this.gpuAlertDismissed = false;
    this.softwareNotified = false;
    this.boardsCollapsed = false;

    this.emissionRows = new Map();
    this.equipmentRows = new Map();
    this.meterChips = new Map();

    this.initClock();
    this.buildStatic();
    this.bindEvents();
    this.sim.subscribe((state, type) => this.onTelemetry(state, type));
    this.updateClock();
  }

  // ==========================================================
  // Bootstrap
  // ==========================================================
  initClock() {
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
  }

  updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeEl = $('#clock-time');
    const dateEl = $('#clock-date');
    if (timeEl) timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (dateEl) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      dateEl.textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${days[now.getDay()]}`;
    }
    if (this.activeModalType === 'cctv') this.updateCctvTimestamps();
  }

  buildStatic() {
    const emissionWrap = $('#emission-rows');
    if (emissionWrap) {
      emissionWrap.innerHTML = this.stateEmissionSeeds()
        .map((point) => `
          <div class="emission-row" data-emission="${point.id}" role="button" tabindex="0">
            <div class="emission-name">
              <span class="emission-code">${point.code}</span>
              <span class="emission-copy"><b>${point.name}</b><span>${point.primaryLabel} · ${point.source.split('·')[0].trim()}</span></span>
            </div>
            <div class="emission-value"><b data-field="value">--</b><small data-field="unit">${point.primaryUnit}</small><span class="emission-bar"><i data-field="bar" style="width:0%"></i></span></div>
            <div class="emission-status"><span class="status-tag" data-field="status">达标</span></div>
          </div>
        `)
        .join('');
      emissionWrap.addEventListener('click', (event) => {
        const row = event.target.closest('[data-emission]');
        if (!row) return;
        const id = row.dataset.emission;
        this.openEmissionsModal(id);
        const stack = this.viewer.factory.stacks.get(id);
        if (stack) {
          this.viewer.focusPoint(stack.top.clone().setY(6.5), 18, 1000);
        }
      });
    }

    const equipmentWrap = $('#equipment-list');
    if (equipmentWrap) {
      equipmentWrap.innerHTML = this.stateEquipmentSeeds()
        .map((eq) => `
          <button class="equipment-row" data-equipment="${eq.id}">
            <i class="eq-led"></i>
            <span class="equipment-name"><b>${eq.name}</b><span>${eq.id} · ${eq.area}</span></span>
            <span class="equipment-power"><b data-field="power">--</b> kW</span>
            <span class="equipment-status-text" data-field="status">--</span>
          </button>
        `)
        .join('');
      $$('.equipment-row', equipmentWrap).forEach((row) => {
        const id = row.dataset.equipment;
        this.equipmentRows.set(id, row);
      });
      equipmentWrap.addEventListener('click', (event) => {
        const row = event.target.closest('[data-equipment]');
        if (!row) return;
        this.onEquipmentSelected(row.dataset.equipment);
      });
    }

    const chips = $('#meter-chips');
    if (chips) {
      chips.innerHTML = this.stateMeterSeeds()
        .map((meter) => `
          <div class="meter-chip" data-meter="${meter.id}">
            <span>${meter.name.replace('工段', '')}</span>
            <b><span data-field="value">--</span><small> kW</small></b>
          </div>
        `)
        .join('');
      $$('.meter-chip', chips).forEach((chip) => this.meterChips.set(chip.dataset.meter, chip));
    }

    if ($('#event-list')) {
      $('#event-list').addEventListener('click', () => this.openLogsModal());
    }
  }

  stateEmissionSeeds() {
    return this.sim.emissions.slice(0, 4);
  }

  stateEquipmentSeeds() {
    return this.sim.equipment;
  }

  stateMeterSeeds() {
    return this.sim.meters;
  }

  // ==========================================================
  // Bind header / toolbar / scene controls
  // ==========================================================
  bindEvents() {
    $$('.nav-item').forEach((button) => {
      button.addEventListener('click', () => {
        const nav = button.dataset.nav;
        this.setNav(nav);
        if (nav === 'energy') this.openEnergyModal();
        else if (nav === 'emission') this.openEmissionsModal();
        else if (nav === 'security') this.openVideoModal();
        else if (nav === 'production') {
          this.closeModal();
          this.viewer.setView('molding');
        } else {
          this.closeModal();
          this.viewer.setView('overview');
        }
      });
    });

    $('#view-presets')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      this.viewer.setView(button.dataset.view);
      this.toast(`视角切换 · ${button.textContent.trim()}`);
    });

    $$('.flow-node').forEach((node) => {
      node.addEventListener('click', () => this.viewer.setView(node.dataset.view));
    });

    $('#btn-toggle-labels')?.addEventListener('click', (event) => {
      const visible = this.viewer.toggleLabels();
      event.currentTarget.classList.toggle('is-off', !visible);
      this.toast(visible ? '场景标注已开启' : '场景标注已隐藏');
    });

    $('#btn-toggle-motion')?.addEventListener('click', (event) => {
      const enabled = this.viewer.toggleMotion();
      const use = $('#motion-icon use');
      if (use) use.setAttribute('href', enabled ? '#i-pause' : '#i-play');
      event.currentTarget.classList.toggle('is-off', !enabled);
      this.toast(enabled ? '动态特效继续运行' : '动态特效已暂停');
    });

    const roamButton = $('#btn-roam');
    if (roamButton && !this.viewer.roamController) roamButton.hidden = true;

    $('#btn-zoom-in')?.addEventListener('click', () => this.viewer.zoom(0.78));
    $('#btn-zoom-out')?.addEventListener('click', () => this.viewer.zoom(1.28));
    $('#btn-reset-view')?.addEventListener('click', () => {
      this.viewer.setView('overview');
      this.setNav('overview');
    });

    $('#btn-quality')?.addEventListener('click', () => {
      const card = $('#perf-card');
      if (card) card.hidden = !card.hidden;
    });
    $('#perf-close')?.addEventListener('click', () => {
      const card = $('#perf-card');
      if (card) card.hidden = true;
    });
    $('#btn-gpu-help')?.addEventListener('click', () => this.openGpuHelpModal());
    $('#renderer-flag')?.addEventListener('click', () => this.openGpuHelpModal());
    $('#gpu-alert-fix')?.addEventListener('click', () => this.openGpuHelpModal());
    $('#gpu-alert-close')?.addEventListener('click', () => {
      this.gpuAlertDismissed = true;
      const alert = $('#gpu-alert');
      if (alert) alert.hidden = true;
    });
    $('#quality-switch')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quality]');
      if (!button) return;
      $$('#quality-switch button').forEach((item) => item.classList.toggle('is-active', item === button));
      this.viewer.setQuality(button.dataset.quality);
      this.toast(`渲染质量已切换 · ${{ high: '高精度', balanced: '均衡', eco: '轻量' }[button.dataset.quality]}`);
    });

    $('#btn-board-toggle')?.addEventListener('click', () => this.toggleBoards());
    $('#btn-board-restore')?.addEventListener('click', () => this.toggleBoards(false));
    $('#btn-video-wall')?.addEventListener('click', () => this.openVideoModal());
    $('#btn-all-emissions')?.addEventListener('click', () => this.openEmissionsModal());
    $('#btn-energy')?.addEventListener('click', () => this.openEnergyModal());
    $('#btn-logs')?.addEventListener('click', () => this.openLogsModal());
    $('#btn-all-logs')?.addEventListener('click', () => this.openLogsModal());
    $('#btn-equipment-log')?.addEventListener('click', () => this.openLogsModal());
    $('#btn-fullscreen')?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch {
        this.toast('当前浏览器不支持全屏模式', 'warn');
      }
    });

    this.modalLayer = $('#modal-layer');
    this.modalLayer?.addEventListener('click', (event) => {
      if (event.target === this.modalLayer || event.target.classList.contains('modal-backdrop')) this.closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.modalLayer?.classList.contains('is-open')) this.closeModal();
        else if ($('#perf-card') && !$('#perf-card').hidden) $('#perf-card').hidden = true;
      }
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('#perf-card') && !event.target.closest('#btn-quality')) {
        const card = $('#perf-card');
        if (card && !card.hidden) card.hidden = true;
      }
    });
  }

  toggleBoards(force) {
    const next = typeof force === 'boolean' ? force : !this.boardsCollapsed;
    if (next === this.boardsCollapsed) return;
    this.boardsCollapsed = next;
    const app = $('#app');
    app?.classList.toggle('boards-collapsed', next);
    const button = $('#btn-board-toggle');
    if (button) {
      button.title = next ? '展开看板' : '收起看板';
      button.setAttribute('aria-label', next ? '展开看板' : '收起看板');
      button.setAttribute('aria-expanded', String(!next));
    }
    const perf = $('#perf-card');
    if (perf) perf.hidden = true;
    this.toast(next ? '看板已收起，点击右侧标签可展开' : '看板已展开');
    // The canvas itself does not resize, but this keeps projected overlays and
    // the responsive HUD in sync after the CSS transition settles.
    setTimeout(() => this.viewer.resize?.(), 380);
  }

  setNav(nav) {
    $$('.nav-item').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === nav));
  }

  setViewButton(view) {
    $$('.view-btn').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  }

  // ==========================================================
  // Telemetry fan-out
  // ==========================================================
  onTelemetry(state, type) {
    this.state = state;
    this.viewer.setTelemetry(state);
    this.updateProduction();
    this.updateFlow();
    this.updateEmissionsPanel();
    this.updateEquipmentPanel();
    this.updateEventList();
    this.updateDock();
    this.updateDrawer();
    if (this.activeModalType === 'energy') this.updateEnergyModal();
    if (this.activeModalType === 'emissions') this.updateEmissionsModal();
    if (this.activeModalType === 'logs') this.renderLogs();
    if (this.activeModalType === 'cctv') this.updateCctvInfo();

    const logDot = $('#log-unread');
    if (logDot) {
      const newCount = state.logs.length - this.lastLogCount;
      if (this.lastLogCount && newCount > 0 && this.activeModalType !== 'logs') {
        logDot.hidden = false;
      }
      this.lastLogCount = state.logs.length;
    }
  }

  updateProduction() {
    if (!this.state) return;
    const { production, totalKwh, compliance } = this.state;
    $('#prod-today').textContent = production.today.toFixed(1);
    const pct = (production.today / production.target) * 100;
    $('#target-pct').innerHTML = `${pct.toFixed(1)}<small>%</small>`;
    $('#target-ring')?.style.setProperty('--value', clampPct(pct));
    $('#kpi-oee').innerHTML = `${production.oee.toFixed(1)}<small>%</small>`;
    const intensity = production.today ? totalKwh / production.today : 0;
    $('#kpi-energy').innerHTML = `${Math.round(intensity)}<small>kWh/t</small>`;
    $('#kpi-compliance').innerHTML = `${compliance.toFixed(1)}<small>%</small>`;
    $('#kpi-staff').innerHTML = `${production.staff}<small>人</small>`;
    $('#dock-energy-intensity').textContent = Math.round(intensity);
    const bars = $$('.production-panel .kpi-cell .spark-bar em');
    if (bars[0]) bars[0].style.width = `${clampPct(production.oee)}%`;
    if (bars[1]) bars[1].style.width = `${clampPct((intensity / 620) * 100)}%`;
    if (bars[2]) bars[2].style.width = `${clampPct(compliance)}%`;
  }

  updateFlow() {
    if (!this.state) return;
    const get = (id) => this.state.equipment.find((eq) => eq.id === id);
    const power = (...ids) => ids.reduce((sum, id) => sum + (get(id)?.power || 0), 0);
    const nodes = $$('.flow-node');
    const powerMap = {
      refining: () => power('AOD-01'),
      melting: () => power('MELT-01'),
      pouring: () => power('POUR-01', 'POUR-02', 'AGV-01'),
      molding: () => power('MOLD-01'),
      shakeout: () => power('SHAKE-01'),
      sand: () => power('MIX-01', 'MIX-02', 'SAND-01'),
      utility: () => power('WATER-01'),
    };
    const runningMap = {
      refining: () => get('AOD-01')?.status,
      melting: () => get('MELT-01')?.status,
      pouring: () => get('POUR-01')?.status,
      molding: () => get('MOLD-01')?.status,
      shakeout: () => get('SHAKE-01')?.status,
      sand: () => get('SAND-01')?.status,
      utility: () => get('WATER-01')?.status,
    };
    nodes.forEach((node) => {
      const id = node.dataset.flow;
      const valueEl = $('.flow-value b', node);
      if (valueEl && powerMap[id]) valueEl.textContent = fmt(powerMap[id]());
      const sub = $('.flow-info small', node);
      if (!sub) return;
      if (id === 'refining') sub.textContent = `AOD 精炼 · ${Math.round(get('AOD-01')?.temp || 1682)}°C`;
      if (id === 'melting') sub.textContent = `电炉熔炼 · ${Math.round(get('MELT-01')?.temp || 1528)}°C`;
      if (id === 'pouring') sub.textContent = `自动浇筑 · ${Math.round(get('POUR-01')?.temp || 1432)}°C`;
      if (id === 'molding') sub.textContent = `一条造型线 · 节拍 ${this.state.production.cycle}s`;
      if (id === 'shakeout') sub.textContent = `振动落砂 · 旧砂回送`;
      if (id === 'sand') sub.textContent = `呋喃树脂砂 · 再生混砂`;
      if (id === 'utility') sub.textContent = `循环水冷却 · ${Math.round(get('WATER-01')?.temp || 39)}°C`;
      node.classList.toggle('is-live', ['running', 'warning'].includes(runningMap[id]?.() || ''));
    });
    const live = nodes.filter((node) => node.classList.contains('is-live')).length;
    $('#flow-state').textContent = `${live} / ${nodes.length} 运行`;
  }

  updateEmissionsPanel() {
    if (!this.state) return;
    const aqi = this.state.aqi;
    const aqiText = aqi <= 50 ? '优' : aqi <= 100 ? '良' : '轻度污染';
    const airNumber = $('#air-score');
    if (airNumber) {
      airNumber.textContent = aqi;
      airNumber.style.color = aqi <= 50 ? 'var(--mint)' : aqi <= 100 ? 'var(--amber)' : 'var(--red)';
    }
    const airCopy = $('.air-copy span');
    if (airCopy) airCopy.textContent = `${aqiText} · AQI ${aqi}`;
    $('#emission-compliance').textContent = `${this.state.compliance.toFixed(1)}%`;

    this.state.emissions.slice(0, 4).forEach((point) => {
      const row = $(`[data-emission="${point.id}"]`, $('#emission-rows'));
      if (!row) return;
      const value = $('[data-field="value"]', row);
      const bar = $('[data-field="bar"]', row);
      const status = $('[data-field="status"]', row);
      if (value) value.textContent = point.value.toFixed(1);
      if (bar) bar.style.width = `${clampPct(point.ratio * 100)}%`;
      row.classList.toggle('warning', point.status === 'warning');
      row.classList.toggle('exceed', point.status === 'exceed');
      if (status) {
        status.textContent = point.status === 'warning' ? '预警' : point.status === 'exceed' ? '超标' : '达标';
        status.className = `status-tag ${point.status === 'warning' ? 'warning' : point.status === 'exceed' ? 'exceed' : ''}`;
      }
    });
  }

  updateEquipmentPanel() {
    if (!this.state) return;
    const order = { warning: 0, maintenance: 1, running: 2, idle: 3, offline: 4 };
    this.state.equipment.forEach((eq) => {
      const row = this.equipmentRows.get(eq.id);
      if (!row) return;
      $('[data-field="power"]', row).textContent = fmt(eq.power);
      $('[data-field="status"]', row).textContent = STATUS_LABEL[eq.status] || eq.status;
      row.className = `equipment-row ${eq.status}`;
      row.style.order = order[eq.status] ?? 4;
      row.title = `${eq.name} · ${STATUS_LABEL[eq.status]} · ${eq.power} kW`;
    });
    const running = this.state.equipment.filter((eq) => eq.status === 'running').length;
    const warning = this.state.equipment.filter((eq) => eq.status === 'warning').length;
    const idle = this.state.equipment.filter((eq) => eq.status === 'idle').length;
    const offline = this.state.equipment.filter((eq) => eq.status === 'offline').length;
    const maint = this.state.equipment.filter((eq) => eq.status === 'maintenance').length;
    $('#equipment-summary').textContent = `${running + warning} / ${this.state.equipment.length} 运行`;
    $('#eq-running').textContent = running;
    $('#eq-idle').textContent = idle + maint;
    $('#eq-warning').textContent = warning;
    $('#eq-offline').textContent = offline;
    const t = this.state.updatedAt;
    const pad = (n) => String(n).padStart(2, '0');
    $('#equipment-updated').textContent = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  }

  updateEventList() {
    if (!this.state) return;
    const container = $('#event-list');
    if (!container) return;
    container.innerHTML = this.state.logs
      .slice(-14)
      .reverse()
      .map((log) => `
        <div class="event-item ${log.level}">
          <span class="event-time">${log.time}</span>
          <span class="event-mark"></span>
          <span class="event-copy"><b>${escapeHtml(log.source)}</b> · ${escapeHtml(log.message)}</span>
        </div>
      `)
      .join('');
  }

  updateDock() {
    if (!this.state) return;
    $('#total-load').textContent = fmt(this.state.totalLoad);
    $('#total-kwh').textContent = fmt(this.state.totalKwh);
    this.state.meters.forEach((meter) => {
      const chip = this.meterChips.get(meter.id);
      if (chip) {
        const value = $('[data-field="value"]', chip);
        if (value) value.textContent = fmt(meter.current);
      }
    });
    const spark = $('#energy-spark');
    if (spark) {
      drawSparkline(spark, this.state.totalTrend, {
        color: '#61efbd',
        fill: 'rgba(97,239,189,.13)',
        previous: this.state.previousTrend,
        label: '实时负荷',
      });
    }
  }

  // ==========================================================
  // Toast + perf
  // ==========================================================
  toast(message, tone = 'normal') {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${tone === 'warn' ? 'warn' : ''}`;
    el.innerHTML = `<svg class="icon"><use href="#i-${tone === 'warn' ? 'alert' : 'check'}"></use></svg><span>${escapeHtml(message)}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 320);
    }, 2600);
    while (root.children.length > 3) root.firstElementChild.remove();
  }

  setPerf(stats) {
    this.perf = stats;
    $('#fps-value').textContent = stats.fps;
    $('#perf-res').textContent = `${stats.width} × ${stats.height}`;
    $('#perf-calls').textContent = stats.calls;
    $('#perf-tris').textContent = fmt(stats.triangles);
    $('#perf-objects').textContent = stats.objects;
    const gpu = stats.gpu || '无法读取 GPU 信息';
    const gpuEl = $('#perf-gpu');
    if (gpuEl) {
      gpuEl.textContent = gpu.replace(/^ANGLE \((.*)\)$/, '$1');
      gpuEl.title = gpu;
      gpuEl.style.color = stats.software ? 'var(--amber)' : '';
    }
    const flag = $('#renderer-flag');
    if (flag) {
      flag.hidden = !stats.software;
      flag.title = stats.software ? `当前正在使用软件渲染：${gpu}` : gpu;
    }
    const warning = $('#renderer-warning');
    if (warning) warning.hidden = !stats.software;
    const alert = $('#gpu-alert');
    if (alert) alert.hidden = !stats.software || Boolean(this.gpuAlertDismissed);
    document.body.classList.toggle('low-power-render', Boolean(stats.lowPower));
    $$('#quality-switch button').forEach((button) => button.classList.toggle('is-active', button.dataset.quality === stats.quality));
    if (stats.software && !this.softwareNotified) {
      this.softwareNotified = true;
      this.toast('检测到软件渲染，RTX 显卡未参与。请打开“渲染质量 → 修复方法”', 'warn');
    }
  }

  openGpuHelpModal() {
    const gpu = this.perf?.gpu || '未知（请打开渲染质量面板查看）';
    const software = this.perf?.software ?? true;
    const command = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --use-angle=vulkan --enable-gpu --ignore-gpu-blocklist --force_high_performance_gpu --disable-gpu-sandbox --user-data-dir="%LOCALAPPDATA%\\BinheTwinEdge" http://127.0.0.1:5173/';
    const html = `
      <div class="modal gpu-help-modal" role="dialog" aria-label="GPU 加速诊断">
        ${modalHead('RENDERER DIAGNOSTICS', 'GPU 加速诊断', 'WEBGL · HARDWARE ACCELERATION')}
        <div class="modal-body gpu-help-body">
          <div class="gpu-status-box">
            <span>当前 WebGL 渲染器</span>
            <code>${escapeHtml(gpu)}</code>
          </div>
          <p class="gpu-help-lead">
            ${software
              ? '当前浏览器正在使用 <b>CPU 软件渲染（SwiftShader / WARP）</b>，独立显卡没有参与绘制，因此即使模型只有 11 万三角面也会明显卡顿。完成下面的设置后重新打开页面即可恢复硬件加速。'
              : 'WebGL 已经在使用硬件 GPU。若仍感觉卡顿，请确认浏览器窗口没有运行在远程桌面中，并检查是否误选了“节能”显卡或开启了省电模式。'}
          </p>
          <div class="gpu-steps">
            <div class="gpu-step"><div><h4>开启浏览器硬件加速</h4><p>Edge 打开 <code>edge://settings/system</code>，Chrome 打开 <code>chrome://settings/system</code>，启用“使用图形加速 / 硬件加速”，然后完全退出并重启浏览器。</p></div></div>
            <div class="gpu-step"><div><h4>Windows 指定高性能显卡</h4><p>系统设置 → 系统 → 显示 → 图形 → 添加桌面应用，选择 <code>msedge.exe</code> 或 <code>chrome.exe</code> → 选项 → 图形首选项设为“高性能”，保存后重启浏览器。</p></div></div>
            <div class="gpu-step"><div><h4>NVIDIA 控制面板</h4><p>管理 3D 设置 → 程序设置 → 添加浏览器 → 首选图形处理器选择 <code>NVIDIA GeForce RTX 4050 Laptop GPU</code> → 应用。</p></div></div>
            <div class="gpu-step"><div><h4>避免远程桌面 / 节能模式</h4><p>部分远程桌面、ToDesk 和笔记本省电模式会强制浏览器走软件渲染。请在本机桌面直接打开，并接入电源使用“高性能”电源计划。</p></div></div>
          </div>
          <div class="gpu-command">
            <span>也可双击桌面的 “BinheTwinGPU” 快捷方式，或直接执行：</span>
            <code id="gpu-command-text">${escapeHtml(command)}</code>
            <button id="copy-gpu-command">复制命令</button>
          </div>
          <p class="gpu-help-foot">参考数据：同一场景在 Intel Arc（Vulkan 硬件后端）下实测约 100 FPS；CPU 软件渲染通常只有 1–3 FPS。模型侧已做静态批处理（923 个网格合并为 56 个批次），主要瓶颈在浏览器图形后端。</p>
        </div>
      </div>
    `;
    this.openModal({ html, type: 'gpu-help' });
    $('#copy-gpu-command', this.modalLayer)?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(command);
        this.toast('启动命令已复制');
      } catch {
        window.prompt('复制以下启动命令', command);
      }
    });
  }

  setCoords(x, z, zone) {
    $('#coord-x').textContent = x.toFixed(1).padStart(4, '0');
    $('#coord-z').textContent = z.toFixed(1).padStart(4, '0');
    $('#scene-zone').textContent = zone;
  }

  // ==========================================================
  // Modal system
  // ==========================================================
  openModal({ html, type, drawer = false, onClose = null }) {
    this.modalToken += 1;
    const token = this.modalToken;
    this.viewer.hideHover?.();
    this.closeModal(true);
    this.activeModalType = type;
    this.activeModalClose = onClose;
    this.modalLayer.innerHTML = `<div class="modal-backdrop"></div>${html}`;
    this.modalLayer.classList.toggle('drawer-mode', drawer);
    this.modalLayer.classList.add('is-open');
    this.modalLayer.setAttribute('aria-hidden', 'false');
    $$('.js-close-modal', this.modalLayer).forEach((button) => {
      button.addEventListener('click', () => this.closeModal());
    });
    if (drawer) {
      // Prevent accidental close while dragging inside the drawer.
      this.modalLayer.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());
    }
    this.modalToken = token;
  }

  closeModal(immediate = false) {
    if (!this.modalLayer) this.modalLayer = $('#modal-layer');
    if (!this.modalLayer) return;
    const wasOpen = this.modalLayer.classList.contains('is-open');
    if (!wasOpen) return;
    const cb = this.activeModalClose;
    this.activeModalClose = null;
    this.activeModalType = null;
    this.modalLayer.classList.remove('is-open');
    this.modalLayer.setAttribute('aria-hidden', 'true');
    if (this.videoTimer) {
      clearInterval(this.videoTimer);
      this.videoTimer = null;
    }
    this.videoWall?.close();
    try {
      cb?.();
    } catch (error) {
      console.warn('[modal cleanup]', error);
    }
    this.modalLayer.classList.remove('drawer-mode');
    const token = this.modalToken;
    if (immediate) {
      this.modalLayer.innerHTML = '';
    } else {
      setTimeout(() => {
        if (this.modalToken === token && !this.modalLayer.classList.contains('is-open')) this.modalLayer.innerHTML = '';
      }, 240);
    }
  }

  // ==========================================================
  // Equipment detail drawer
  // ==========================================================
  onEquipmentSelected(id) {
    const eq = this.sim.getEquipment(id);
    if (!eq) return;
    this.openEquipmentDrawer(id);
    this.viewer.selectEquipment(id);
    const nav = $('.nav-item[data-nav="production"]');
    this.setNav(nav?.dataset.nav || 'overview');
  }

  openEquipmentDrawer(id) {
    const eq = this.sim.getEquipment(id);
    if (!eq) return;
    this.drawerEquipmentId = id;
    const logs = this.sim.logs.filter((log) => log.source === id).slice(-5).reverse();
    const html = `
      <div class="detail-drawer" role="dialog" aria-label="${escapeHtml(eq.name)}设备详情">
        <header class="drawer-head">
          <div class="drawer-eyebrow"><span>EQUIPMENT DIGITAL TWIN</span><button class="modal-close js-close-modal" aria-label="关闭"><svg class="icon"><use href="#i-x"></use></svg></button></div>
          <div class="drawer-title">
            <div><h2>${eq.name}</h2><p>${eq.id} · ${eq.area} · 责任人 ${eq.operator}</p></div>
            <span class="drawer-status" id="drawer-status"><span class="status-dot ${eq.status}"></span>${STATUS_LABEL[eq.status]}</span>
          </div>
        </header>
        <div class="drawer-body">
          <div class="drawer-section">
            <div class="drawer-section-title"><span>实时运行参数 / LIVE SENSORS</span><span id="drawer-updated">刚刚</span></div>
            <div class="sensor-grid">
              <div class="sensor-cell"><span>有功功率</span><b id="drawer-power">--<small>kW</small></b><em>额定 ${fmt(eq.ratedPower)} kW</em></div>
              <div class="sensor-cell"><span>负载率</span><b id="drawer-load">--<small>%</small></b><em>经济负载区 65–90%</em></div>
              <div class="sensor-cell"><span>温度</span><b id="drawer-temp">--<small>°C</small></b><em>${eq.group === 'melting' ? '炉体温度' : '轴承 / 绕组'}</em></div>
              <div class="sensor-cell"><span>振动速度</span><b id="drawer-vibration">--<small>mm/s</small></b><em>注意值 6.0 mm/s</em></div>
            </div>
          </div>
          <div class="drawer-section">
            <div class="drawer-section-title"><span>24H 负荷趋势 / POWER PROFILE</span><span>kW</span></div>
            <canvas id="drawer-trend" class="eq-drawer-chart" height="100"></canvas>
          </div>
          <div class="drawer-section">
            <div class="drawer-section-title"><span>设备档案 / ASSET</span><span>ASSET TWIN</span></div>
            <div class="drawer-info-list drawer-two-col">
              <div class="drawer-info-row"><span>累计运行</span><b id="drawer-runtime">-- h</b></div>
              <div class="drawer-info-row"><span>今日耗电</span><b id="drawer-kwh">-- kWh</b></div>
              <div class="drawer-info-row"><span>综合效率</span><b id="drawer-efficiency">-- %</b></div>
              <div class="drawer-info-row"><span>上次保养</span><b>${eq.lastMaintenance}</b></div>
              <div class="drawer-info-row"><span>下次计划保养</span><b>${eq.nextMaintenance}</b></div>
              <div class="drawer-info-row"><span>数据采集</span><b>OPC-UA · 500ms</b></div>
            </div>
          </div>
          <div class="drawer-section">
            <div class="drawer-section-title"><span>近期事件 / RECENT EVENTS</span><span>${logs.length} 条</span></div>
            <div class="drawer-log-list">
              ${logs.length ? logs.map((log) => `
                <div class="drawer-log ${log.level}">
                  <span>${log.time}</span><i></i><p>${escapeHtml(log.message)}</p>
                </div>
              `).join('') : '<div class="log-empty">暂无该设备的独立事件记录</div>'}
            </div>
          </div>
          <div class="drawer-action-row">
            <button class="drawer-action" data-drawer-action="logs">查看运行日志</button>
            <button class="drawer-action" data-drawer-action="toggle">${eq.status === 'running' ? '下发待机指令' : '恢复自动运行'}</button>
            <button class="drawer-action primary" data-drawer-action="maintenance">创建维护工单</button>
          </div>
        </div>
      </div>
    `;
    this.openModal({
      html,
      type: 'drawer',
      drawer: true,
      onClose: () => {
        this.drawerEquipmentId = null;
      },
    });
    this.modalLayer.querySelector('.detail-drawer')?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-drawer-action]');
      if (!btn) return;
      const action = btn.dataset.drawerAction;
      if (action === 'logs') {
        this.closeModal();
        this.openLogsModal(eq.id);
      } else if (action === 'maintenance') {
        this.sim.startMaintenance(eq.id);
        this.toast(`已为 ${eq.name} 创建维护工单`, 'warn');
      } else if (action === 'toggle') {
        const next = eq.status === 'running' ? 'idle' : 'running';
        this.sim.setEquipmentStatus(eq.id, next);
        this.toast(`${eq.name} 已切换至${STATUS_LABEL[next]}状态`);
      }
    });
    this.updateDrawer(true);
  }

  updateDrawer(force = false) {
    if (!this.drawerEquipmentId || !this.state) return;
    const eq = this.state.equipment.find((item) => item.id === this.drawerEquipmentId);
    if (!eq) return;
    if (force && !this.equipmentHistory.has(eq.id)) {
      const history = [];
      for (let i = 0; i < 34; i += 1) {
        history.push(eq.power * (0.78 + Math.sin(i * 0.34) * 0.13 + Math.random() * 0.06));
      }
      this.equipmentHistory.set(eq.id, history);
    }
    let history = this.equipmentHistory.get(eq.id) || [];
    if (!history.length || history[history.length - 1] !== eq.power) {
      history = [...history, eq.power].slice(-40);
      this.equipmentHistory.set(eq.id, history);
    }
    const drawer = this.modalLayer?.querySelector('.detail-drawer');
    if (!drawer) return;
    const statusEl = $('#drawer-status', drawer);
    if (statusEl) statusEl.innerHTML = `<span class="status-dot ${eq.status}"></span>${STATUS_LABEL[eq.status]}`;
    $('#drawer-power', drawer).innerHTML = `${fmt(eq.power)}<small>kW</small>`;
    $('#drawer-load', drawer).innerHTML = `${eq.load}<small>%</small>`;
    $('#drawer-temp', drawer).innerHTML = `${eq.temp.toFixed(1)}<small>°C</small>`;
    $('#drawer-vibration', drawer).innerHTML = `${eq.vibration.toFixed(1)}<small>mm/s</small>`;
    $('#drawer-runtime', drawer).textContent = `${eq.runtime.toFixed(2)} h`;
    $('#drawer-kwh', drawer).textContent = `${fmt(eq.todayKwh)} kWh`;
    $('#drawer-efficiency', drawer).textContent = `${eq.efficiency.toFixed(1)} %`;
    const trend = $('#drawer-trend', drawer);
    if (trend) drawEquipmentTrend(trend, history, eq.status === 'warning' ? '#ffbd66' : '#61efbd');
    const updated = $('#drawer-updated', drawer);
    if (updated) {
      const now = new Date();
      updated.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  }

  // ==========================================================
  // Video wall
  // ==========================================================
  openVideoModal(cameraId = null) {
    const cameras = this.viewer.factory.cameraDefs;
    let selectedIndex = 0;
    if (typeof cameraId === 'number') selectedIndex = cameraId;
    else if (typeof cameraId === 'string') selectedIndex = Math.max(0, cameras.findIndex((cam) => cam.id === cameraId || cam.emissionId === cameraId));
    this.videoPage = Math.floor(selectedIndex / 4);
    this.videoSelected = selectedIndex;
    const cameraList = cameras
      .map((cam, index) => `
        <button class="cctv-camera-item" data-cam-index="${index}">
          <span class="cam-icon"><svg class="icon"><use href="#i-camera"></use></svg></span>
          <span class="cam-copy"><b>${cam.name}</b><span>${cam.id} · ${cam.zone}</span></span>
          <span class="cam-state"><i></i>LIVE</span>
        </button>
      `)
      .join('');

    const html = `
      <div class="modal cctv-modal" role="dialog" aria-label="实时视频监控">
        ${modalHead('REAL-TIME VIDEO SURVEILLANCE', '排放口实时视频监控', 'CCTV MATRIX · 8 CHANNELS', '<span class="live-pill"><span class="live-dot"></span>LIVE</span>')}
        <div class="modal-body">
          <div class="cctv-layout">
            <div class="cctv-stage">
              <div class="cctv-canvas-wrap"><canvas id="cctv-canvas"></canvas></div>
              <div class="cctv-scanlines"></div>
              <div class="cctv-vignette"></div>
              <div class="cctv-stage-bar"><span><i class="live-dot"></i> LIVE VIEW · <b id="cctv-stage-name">四画面矩阵</b></span><em id="cctv-stage-time">--</em></div>
              <div class="cctv-grid-overlay" id="cctv-grid-overlay"></div>
            </div>
            <aside class="cctv-info">
              <div class="cctv-info-head">
                <span>CAMERA CHANNELS / 8</span>
                <div class="cctv-head-tools">
                  <div class="cctv-mode-toggle cctv-page-nav">
                    <button data-cctv-page="0" class="is-active">1</button>
                    <button data-cctv-page="1">2</button>
                  </div>
                  <div class="cctv-mode-toggle">
                    <button data-cctv-mode="quad" class="is-active">四分屏</button>
                    <button data-cctv-mode="single">单画面</button>
                  </div>
                </div>
              </div>
              <div class="cctv-camera-list" id="cctv-camera-list">${cameraList}</div>
              <div class="cctv-info-foot">
                <div class="info-row"><span>码流</span><b>4.0 Mbps · H.265</b></div>
                <div class="info-row"><span>分辨率 / 帧率</span><b>1080P · 25 FPS</b></div>
                <div class="info-row"><span>存储周期</span><b>30 天 · 边缘 NVR</b></div>
                <div class="info-row"><span>CEMS 联动</span><b id="cctv-cems-value">--</b></div>
                <div class="info-note">当前为数字孪生实时渲染视频流，可替换为现场 RTSP / GB28181 摄像头；点击画面放大，四分屏按排放点位轮巡。</div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    `;

    this.openModal({
      html,
      type: 'cctv',
      onClose: () => {
        this.videoWall.close();
      },
    });

    const canvas = $('#cctv-canvas');
    // Default presentation is the 2×2 matrix; direct camera navigation opens a single feed.
    this.videoWall.selected = selectedIndex;
    this.videoWall.setPage(this.videoPage);
    this.videoWall.setMode(typeof cameraId === 'string' ? 'single' : 'quad');
    this.setCctvPageButtons();
    this.renderCctvOverlay();
    this.setCctvModeButtons(this.videoWall.mode);
    $$('#cctv-camera-list [data-cam-index]').forEach((row) => {
      row.classList.toggle('is-active', Number(row.dataset.camIndex) === this.videoSelected);
      row.addEventListener('click', () => {
        const index = Number(row.dataset.camIndex);
        this.videoSelected = index;
        this.videoPage = Math.floor(index / 4);
        this.videoWall.setPage(this.videoPage);
        this.videoWall.setSelected(index);
        this.setCctvPageButtons();
        this.renderCctvOverlay();
        this.setCctvModeButtons('single');
        this.updateCctvInfo();
      });
    });
    this.modalLayer.querySelectorAll('[data-cctv-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const mode = button.dataset.cctvMode;
        if (mode === 'quad') {
          this.videoWall.setPage(this.videoPage);
          this.videoWall.setMode('quad');
        } else {
          this.videoWall.setSelected(this.videoSelected);
        }
        this.renderCctvOverlay();
        this.setCctvModeButtons(mode);
        this.updateCctvInfo();
      });
    });
    this.modalLayer.querySelectorAll('[data-cctv-page]').forEach((button) => {
      button.addEventListener('click', () => {
        this.videoPage = Number(button.dataset.cctvPage);
        this.videoWall.setPage(this.videoPage);
        this.videoWall.setMode('quad');
        this.videoSelected = this.videoPage * 4;
        this.renderCctvOverlay();
        this.setCctvModeButtons('quad');
        this.setCctvPageButtons();
        this.updateCctvInfo();
      });
    });
    try {
      this.videoWall.open(canvas);
    } catch (error) {
      console.warn('[video wall] unavailable', error);
      this.toast('视频渲染资源不足，请降低渲染质量后重试', 'warn');
    }
    this.updateCctvInfo();
    this.updateCctvTimestamps();
    this.videoTimer = setInterval(() => this.updateCctvTimestamps(), 1000);
  }

  setCctvModeButtons(mode) {
    $$('[data-cctv-mode]', this.modalLayer).forEach((button) => button.classList.toggle('is-active', button.dataset.cctvMode === mode));
  }

  setCctvPageButtons() {
    $$('[data-cctv-page]', this.modalLayer).forEach((button) => button.classList.toggle('is-active', Number(button.dataset.cctvPage) === this.videoPage));
    $$('#cctv-camera-list [data-cam-index]', this.modalLayer).forEach((row) => {
      const index = Number(row.dataset.camIndex);
      row.classList.toggle('is-active', index === this.videoSelected && this.videoWall?.mode === 'single');
    });
  }

  renderCctvOverlay() {
    const overlay = $('#cctv-grid-overlay', this.modalLayer);
    if (!overlay) return;
    const cameras = this.viewer.factory.cameraDefs;
    if (this.videoWall.mode === 'single') {
      const cam = cameras[this.videoSelected];
      overlay.className = 'cctv-grid-overlay is-single';
      overlay.innerHTML = `
        <div class="cctv-cell is-single is-selected" data-cctv-cell="${this.videoSelected}" data-cctv-emission="${cam.emissionId || ''}">
          <span class="cctv-cell-cam">CAM-${String(this.videoSelected + 1).padStart(2, '0')} · ONLINE</span>
          <span class="cctv-cell-caption"><b>${cam.name}</b><span>${cam.zone} · 1080P 25FPS</span></span>
          <span class="cctv-cell-time" data-cctv-time>--</span>
          <span class="cctv-corner">${cam.emissionId ? 'CEMS · --' : 'AREA SECURITY'}</span>
        </div>
      `;
      const name = $('#cctv-stage-name', this.modalLayer);
      if (name) name.textContent = `${cam.id} · ${cam.name}`;
    } else {
      overlay.className = 'cctv-grid-overlay';
      const start = this.videoPage * 4;
      const visible = cameras.slice(start, start + 4);
      overlay.innerHTML = visible.map((cam, offset) => {
        const index = start + offset;
        return `
          <div class="cctv-cell is-selected" data-cctv-cell="${index}" data-cctv-emission="${cam.emissionId || ''}">
            <span class="cctv-cell-cam">CAM-${String(index + 1).padStart(2, '0')} · REC</span>
            <span class="cctv-cell-caption"><b>${cam.name}</b><span>${cam.id} · ${cam.zone}</span></span>
            <span class="cctv-cell-time" data-cctv-time>--</span>
            <span class="cctv-corner">${cam.emissionId ? 'CEMS · --' : 'AREA SECURITY'}</span>
          </div>
        `;
      }).join('');
      const name = $('#cctv-stage-name', this.modalLayer);
      if (name) name.textContent = `四画面矩阵 · 第 ${this.videoPage + 1} 页`;
    }
    $$('#cctv-grid-overlay [data-cctv-cell]', this.modalLayer).forEach((cell) => {
      cell.addEventListener('click', () => {
        const index = Number(cell.dataset.cctvCell);
        if (this.videoWall.mode === 'quad') {
          this.videoSelected = index;
          this.videoPage = Math.floor(index / 4);
          this.videoWall.setPage(this.videoPage);
          this.videoWall.setSelected(index);
          this.renderCctvOverlay();
          this.setCctvModeButtons('single');
          this.updateCctvInfo();
          this.updateCctvTimestamps();
        }
      });
    });
    $$('#cctv-camera-list [data-cam-index]', this.modalLayer).forEach((row) => {
      row.classList.toggle('is-active', Number(row.dataset.camIndex) === this.videoSelected && this.videoWall.mode === 'single');
    });
    this.updateCctvTimestamps();
  }

  updateCctvTimestamps() {
    if (this.activeModalType !== 'cctv') return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    $$('[data-cctv-time]', this.modalLayer).forEach((el) => {
      el.textContent = stamp;
    });
    const stageTime = $('#cctv-stage-time', this.modalLayer);
    if (stageTime) stageTime.textContent = `${stamp} CST`;
  }

  updateCctvInfo() {
    if (this.activeModalType !== 'cctv') return;
    const camera = this.viewer.factory.cameraDefs[this.videoSelected];
    const cems = $('#cctv-cems-value', this.modalLayer);
    if (cems && camera) {
      if (!camera.emissionId) {
        cems.textContent = '安防视频 · 未关联排放点';
      } else {
        const point = this.state?.emissions.find((e) => e.id === camera.emissionId);
        cems.textContent = point ? `${point.primaryLabel} ${point.value.toFixed(1)} ${point.primaryUnit}` : '数据同步中';
      }
    }
    $$('[data-cctv-emission]', this.modalLayer).forEach((cell) => {
      const id = cell.dataset.cctvEmission;
      if (!id) return;
      const point = this.state?.emissions.find((e) => e.id === id);
      const corner = $('.cctv-corner', cell);
      if (!corner || !point) return;
      corner.textContent = `CEMS · ${point.value.toFixed(1)} ${point.primaryUnit}`;
      corner.classList.toggle('is-warning', point.status !== 'normal');
    });
  }

  // ==========================================================
  // Energy dashboard
  // ==========================================================
  openEnergyModal() {
    const html = `
      <div class="modal energy-modal" role="dialog" aria-label="能源分表计量">
        ${modalHead('ENERGY SUB-METERING', '能源分表计量看板', 'ENERGY MANAGEMENT · 24H', '<span class="live-pill"><span class="live-dot"></span>LIVE SYNC</span>')}
        <div class="modal-body">
          <div class="energy-layout">
            <div class="energy-top">
              <div class="energy-hero">
                <span class="panel-kicker">TOTAL ACTIVE LOAD</span>
                <b><span id="energy-modal-load">--</span><small>kW</small></b>
                <span>6 个工段分表 · 需量控制上限 12,500 kW</span>
              </div>
              <div class="energy-stat"><span>今日累计用电</span><b><span id="energy-modal-kwh">--</span><small>kWh</small></b><i>较昨日同期 +3.2%</i></div>
              <div class="energy-stat"><span>吨铸件电耗</span><b><span id="energy-modal-intensity">--</span><small>kWh/t</small></b><i>行业标杆 462 kWh/t</i></div>
              <div class="energy-stat"><span>今日电费</span><b>¥ <span id="energy-modal-cost">--</span></b><i>分时电价 · 峰谷优化</i></div>
              <div class="energy-stat"><span>碳排放量</span><b><span id="energy-modal-carbon">--</span><small>kgCO₂e</small></b><i>绿电占比 12.4%</i></div>
            </div>
            <div class="energy-main">
              <div class="energy-chart-card">
                <div class="energy-card-head">
                  <h3 id="energy-chart-title">24 小时有功负荷曲线</h3>
                  <div class="energy-tabs" id="energy-tabs">
                    <button data-energy-type="electricity" class="is-active">电</button>
                    <button data-energy-type="gas">天然气</button>
                    <button data-energy-type="water">水</button>
                    <button data-energy-type="air">压缩空气</button>
                  </div>
                </div>
                <div class="chart-legend"><span><i></i>今日实测</span><span><i class="amber"></i>昨日同期</span></div>
                <div class="energy-chart-wrap">
                  <canvas id="energy-chart"></canvas>
                  <div class="chart-tooltip" id="energy-chart-tip" hidden></div>
                </div>
                <div class="energy-bottom-stats">
                  <div><span>峰值负荷</span><b><span id="energy-peak">--</span><small>kW</small></b></div>
                  <div><span>谷值负荷</span><b><span id="energy-valley">--</span><small>kW</small></b></div>
                  <div><span>负荷率</span><b><span id="energy-loadfactor">--</span><small>%</small></b></div>
                </div>
              </div>
              <div class="energy-table-card">
                <div class="energy-card-head"><h3>分表计量明细</h3><span>实时 · <b id="energy-table-time">--:--:--</b></span></div>
                <div class="energy-table-wrap">
                  <table class="energy-table">
                    <thead id="energy-table-head"></thead>
                    <tbody id="energy-table-body"></tbody>
                  </table>
                </div>
                <div class="energy-side-foot"><span>数据来源 · 智能电表 / 燃气流量计 / 涡街流量计</span><b>● 全部在线</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.openModal({ html, type: 'energy' });
    this.energyType = 'electricity';
    this.energyChart = createEnergyChart($('#energy-chart'), $('#energy-chart-tip'));
    $$('#energy-tabs [data-energy-type]').forEach((button) => {
      button.addEventListener('click', () => {
        this.energyType = button.dataset.energyType;
        $$('#energy-tabs [data-energy-type]').forEach((item) => item.classList.toggle('is-active', item === button));
        this.updateEnergyModal(true);
      });
    });
    this.updateEnergyModal(true);
    requestAnimationFrame(() => this.updateEnergyModal(true));
    this.setNav('energy');
  }

  energySeries(type) {
    if (!this.state) return { values: [], previous: [], labels: [], unit: 'kW' };
    const labels = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(Date.now() - (23 - i) * 3600 * 1000).getHours();
      return `${String(hour).padStart(2, '0')}:00`;
    });
    if (type === 'electricity') {
      return { values: this.state.totalTrend, previous: this.state.previousTrend, labels, unit: 'kW' };
    }
    const key = type === 'gas' ? 'gasHistory' : type === 'water' ? 'waterHistory' : 'airHistory';
    const values = Array.from({ length: 24 }, (_, i) => this.state.meters.reduce((sum, meter) => sum + (meter[key]?.[i] || 0), 0));
    const previous = values.map((v, i) => v * (0.91 + Math.sin(i * 0.7) * 0.06));
    return { values, previous, labels, unit: ENERGY_META[type].unit };
  }

  updateEnergyModal(force = false) {
    if (!this.state || this.activeModalType !== 'energy') return;
    const intensity = this.state.totalKwh / this.state.production.today;
    const liveLoad = this.state.meters.reduce((sum, meter) => sum + meter.current, 0);
    $('#energy-modal-load').textContent = fmt(liveLoad);
    $('#energy-modal-kwh').textContent = fmt(this.state.totalKwh);
    $('#energy-modal-intensity').textContent = fmt(intensity);
    $('#energy-modal-cost').textContent = fmt(this.state.cost);
    $('#energy-modal-carbon').textContent = fmt(this.state.carbon);
    $('#energy-chart-title').textContent = ENERGY_META[this.energyType].title;

    const series = this.energySeries(this.energyType);
    this.energyChart?.render({ ...series, color: ENERGY_META[this.energyType].color });
    const peak = Math.max(...series.values);
    const valley = Math.min(...series.values);
    const avg = series.values.reduce((a, b) => a + b, 0) / Math.max(1, series.values.length);
    $('#energy-peak').textContent = fmt(peak);
    $('#energy-valley').textContent = fmt(valley);
    $('#energy-loadfactor').textContent = fmt((avg / Math.max(1, peak)) * 100, 1);

    const type = this.energyType;
    const meta = ENERGY_META[type];
    const tableHead = $('#energy-table-head');
    const tableBody = $('#energy-table-body');
    if (tableHead) {
      tableHead.innerHTML = `<tr><th>分表</th><th>${meta.tableUnit}</th><th>${meta.todayUnit}</th><th>占比</th><th>状态</th></tr>`;
    }
    const totalValue = this.state.meters.reduce((sum, meter) => {
      const v = type === 'electricity' ? meter.current : type === 'gas' ? meter.gas : type === 'water' ? meter.water : meter.air;
      return sum + v;
    }, 0);
    if (tableBody) {
      tableBody.innerHTML = this.state.meters.map((meter) => {
        const value = type === 'electricity' ? meter.current : type === 'gas' ? meter.gas : type === 'water' ? meter.water : meter.air;
        const today = type === 'electricity' ? meter.today : type === 'gas' ? meter.gasToday : type === 'water' ? meter.waterToday : meter.airToday;
        const share = totalValue ? (value / totalValue) * 100 : 0;
        return `
          <tr><td class="name">${meter.name}<small>${meter.code} · ${meter.sub}</small></td>
          <td>${fmt(value, type === 'water' ? 1 : 0)}</td>
          <td>${fmt(today, type === 'electricity' ? 0 : 1)}</td>
          <td class="share">${share.toFixed(1)}%</td>
          <td><span class="tag-mini">${meter.online ? '在线' : '离线'}</span></td></tr>
        `;
      }).join('');
    }
    const time = $('#energy-table-time');
    if (time) time.textContent = this.updateClock && new Date().toTimeString().slice(0, 8);
  }

  // ==========================================================
  // All-emissions modal
  // ==========================================================
  openEmissionsModal(selectedId = null) {
    const html = `
      <div class="modal emissions-modal" role="dialog" aria-label="排放监测总览">
        ${modalHead('ENVIRONMENTAL MONITORING', '污染排放监测总览', 'CEMS · 6 POINTS', '<button class="action-btn" id="modal-open-cctv" style="height:28px"><svg class="icon"><use href="#i-video"></use></svg>视频监控</button>')}
        <div class="modal-body">
          <div class="emissions-layout">
            <div class="emissions-top">
              <div class="emissions-stat"><span>排口在线率</span><b>6<small>/ 6</small></b></div>
              <div class="emissions-stat"><span>排放达标率</span><b><span id="modal-compliance">--</span><small>%</small></b></div>
              <div class="emissions-stat"><span>颗粒物排放速率</span><b><span id="modal-pm-rate">--</span><small>kg/h</small></b></div>
              <div class="emissions-stat"><span>今日环境预警</span><b><span id="modal-alarm-count">--</span><small>次</small></b></div>
            </div>
            <div class="emissions-table-wrap">
              <table class="emissions-table">
                <thead><tr><th>排放口</th><th>类型</th><th>主要污染物</th><th>浓度</th><th>限值</th><th>废气流量</th><th>温度</th><th>状态</th></tr></thead>
                <tbody id="modal-emissions-body"></tbody>
              </table>
            </div>
            <div class="emissions-footer">
              <span>数据来源 · CEMS 在线监测系统 / 厂界微站 · 点击排口行可查看关联视频</span>
              <div style="display:flex;gap:7px"><span>最近更新 <b id="modal-emission-time">--:--:--</b></span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.openModal({ html, type: 'emissions' });
    this.emissionsSelectedId = selectedId;
    this.setNav('emission');
    $('#modal-open-cctv')?.addEventListener('click', () => this.openVideoModal());
    this.updateEmissionsModal(true);
  }

  updateEmissionsModal(force = false) {
    if (!this.state || this.activeModalType !== 'emissions') return;
    const body = $('#modal-emissions-body');
    if (!body) return;
    $('#modal-compliance').textContent = this.state.compliance.toFixed(1);
    const pmRate = this.state.emissions.reduce((sum, point) => {
      const pm = point.metrics.pm ?? point.metrics.pm10 ?? point.metrics.tsp ?? 0;
      const flow = point.metrics.flow ?? 0;
      return sum + (pm * flow) / 1e6;
    }, 0);
    $('#modal-pm-rate').textContent = pmRate.toFixed(2);
    $('#modal-alarm-count').textContent = this.state.alarms.filter((alarm) => !alarm.acknowledged && alarm.level !== 'info').length;
    const t = this.state.updatedAt;
    $('#modal-emission-time').textContent = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
    body.innerHTML = this.state.emissions.map((point) => {
      const status = point.status === 'warning' ? 'value-warn' : point.status === 'exceed' ? 'value-exceed' : 'value-ok';
      const flow = point.metrics.flow ? `${fmt(point.metrics.flow)} m³/h` : '无组织';
      const temp = point.metrics.temp ? `${point.metrics.temp.toFixed(1)} °C` : '--';
      return `
        <tr data-emission-id="${point.id}" class="${this.emissionsSelectedId === point.id ? 'is-selected' : ''}">
          <td class="name">${point.name}<small>${point.code} · ${point.stack}</small></td>
          <td>${point.metrics.flow ? '有组织' : '无组织'}</td>
          <td>${point.primaryLabel}</td>
          <td class="${status}">${point.value.toFixed(1)} <small>${point.primaryUnit}</small></td>
          <td class="limit">${point.limit} ${point.primaryUnit}</td>
          <td>${flow}</td>
          <td>${temp}</td>
          <td>${statusTag(point)}</td>
        </tr>
      `;
    }).join('');
    $$('#modal-emissions-body [data-emission-id]').forEach((row) => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const point = this.state.emissions.find((p) => p.id === row.dataset.emissionId);
        this.emissionsSelectedId = row.dataset.emissionId;
        if (point?.camera) this.openVideoModal(point.camera);
      });
    });
  }

  // ==========================================================
  // Operation logs
  // ==========================================================
  openLogsModal(source = '') {
    this.logFilter = 'all';
    this.logSource = source || '';
    this.logQuery = '';
    const unread = $('#log-unread');
    if (unread) unread.hidden = true;
    const html = `
      <div class="modal logs-modal" role="dialog" aria-label="设备运行日志">
        ${modalHead('OPERATION LOG', '设备运行日志', 'AUDIT TRAIL · REALTIME', '<span class="head-state good"><span class="status-dot running"></span>持续记录</span>')}
        <div class="modal-body">
          <div class="logs-layout">
            <div class="logs-toolbar">
              <div class="logs-filters" id="logs-filters">
                <button data-log-filter="all" class="is-active">全部</button>
                <button data-log-filter="info">信息</button>
                <button data-log-filter="warn">预警</button>
                <button data-log-filter="error">报警</button>
                <button data-log-filter="action">操作</button>
              </div>
              <div class="logs-actions">
                <label class="logs-search"><svg class="icon"><use href="#i-search"></use></svg><input id="logs-query" placeholder="搜索设备 / 内容…" autocomplete="off"></label>
                <button class="ghost-btn" id="logs-export"><svg class="icon"><use href="#i-download"></use></svg>导出 CSV</button>
              </div>
            </div>
            <div class="logs-table-head"><span>时间</span><span>级别</span><span>来源</span><span>事件内容</span><span>操作人</span></div>
            <div class="logs-scroll" id="logs-scroll"></div>
            <div class="logs-footer"><span>共 <b id="logs-count">0</b> 条记录 · 本地留存最近 220 条</span><span class="live-note"><i></i>日志实时追加中</span></div>
          </div>
        </div>
      </div>
    `;
    this.openModal({ html, type: 'logs' });
    $('#logs-filters')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-log-filter]');
      if (!button) return;
      this.logFilter = button.dataset.logFilter;
      $$('#logs-filters button').forEach((item) => item.classList.toggle('is-active', item === button));
      this.renderLogs();
    });
    const query = $('#logs-query');
    if (query) {
      if (source) query.value = source;
      this.logQuery = source;
      query.addEventListener('input', () => {
        this.logQuery = query.value.trim();
        this.renderLogs();
      });
    }
    $('#logs-export')?.addEventListener('click', () => {
      this.sim.exportLogsCsv();
      this.toast('运行日志已导出为 CSV');
    });
    this.setNav('production');
    this.renderLogs();
  }

  getFilteredLogs() {
    const q = this.logQuery.toLowerCase();
    return this.sim.logs
      .filter((log) => {
        if (this.logFilter !== 'all' && log.level !== this.logFilter) return false;
        if (this.logSource && log.source !== this.logSource) return false;
        if (q && !`${log.source} ${log.message} ${log.operator}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice()
      .reverse();
  }

  renderLogs() {
    if (this.activeModalType !== 'logs') return;
    const scroll = $('#logs-scroll');
    if (!scroll) return;
    const scrollTop = scroll.scrollTop;
    const logs = this.getFilteredLogs();
    if (!logs.length) {
      scroll.innerHTML = '<div class="log-empty">没有符合筛选条件的日志记录</div>';
    } else {
      scroll.innerHTML = logs.map((log) => `
        <div class="log-row">
          <span class="log-time">${log.timestamp}</span>
          <span class="log-level ${log.level}">${LEVEL_LABEL[log.level] || log.level}</span>
          <span class="log-source">${escapeHtml(log.source)}</span>
          <span class="log-message" title="${escapeHtml(log.message)}">${escapeHtml(log.message)}</span>
          <span class="log-operator">${escapeHtml(log.operator)}</span>
        </div>
      `).join('');
    }
    const count = $('#logs-count');
    if (count) count.textContent = logs.length;
    scroll.scrollTop = scrollTop;
  }
}
