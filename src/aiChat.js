const MODEL_LABELS = {
  'deepseek-flash': 'DeepSeek-Flash',
  'deepseek-v4-pro': 'DeepSeek-V4-Pro',
};

const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fmtTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const renderText = (text) => escapeHtml(text)
  .replace(/^#{1,3}\s+/gm, '')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/^\s*[-*]\s+/gm, '• ');

const round = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
};

function buildTelemetry(state) {
  if (!state) return null;
  const month = state.updatedAt || new Date();
  const today = state.production.today;
  return {
    schema: 'binhe-casting-twin/v1',
    generatedAt: new Date().toISOString(),
    dataNote: '演示遥测数据，不代表真实工厂实时排放',
    updatedAt: month instanceof Date ? month.toISOString() : String(month),
    plant: {
      name: '滨河铸铁件智造基地',
      shift: state.production.shift,
      productionTodayTons: round(today, 2),
      dailyTargetTons: state.production.target,
      oeePct: round(state.production.oee, 1),
      yieldPct: round(state.production.yield, 1),
      cycleSeconds: state.production.cycle,
      staff: state.production.staff,
    },
    environment: {
      aqi: state.aqi,
      compliancePct: round(state.compliance, 1),
      emissions: state.emissions.map((point) => ({
        id: point.id,
        code: point.code,
        name: point.name,
        source: point.source,
        metric: point.primaryLabel,
        value: round(point.value, 2),
        unit: point.primaryUnit,
        limit: point.limit,
        ratioPct: round((point.value / point.limit) * 100, 1),
        status: point.status,
        online: point.online,
        gasFlowM3h: point.metrics.flow ?? null,
        temperatureC: point.metrics.temp ?? null,
      })),
    },
    equipment: state.equipment.map((eq) => ({
      id: eq.id,
      name: eq.name,
      area: eq.area,
      status: eq.status,
      powerKw: round(eq.power, 0),
      loadPct: round(eq.load, 0),
      temperatureC: round(eq.temp, 1),
      vibrationMmS: round(eq.vibration, 1),
      todayKwh: round(eq.todayKwh, 0),
      alarm: eq.alarm || null,
    })),
    energy: {
      totalLoadKw: round(state.totalLoad, 0),
      todayKwh: round(state.totalKwh, 0),
      intensityKwhPerTon: round(state.totalKwh / today, 1),
      costCny: round(state.cost, 0),
      carbonKgCo2e: round(state.carbon, 0),
      meters: state.meters.map((meter) => ({
        id: meter.id,
        name: meter.name,
        currentKw: round(meter.current, 0),
        todayKwh: round(meter.today, 0),
        sharePct: round((meter.current / Math.max(1, state.totalLoad)) * 100, 1),
        powerFactor: round(meter.pf, 2),
      })),
    },
    alarms: state.alarms.slice(0, 5).map((alarm) => ({
      time: alarm.time,
      source: alarm.source,
      title: alarm.title,
      detail: alarm.detail,
      level: alarm.level,
      acknowledged: alarm.acknowledged,
    })),
    recentLogs: state.logs.slice(-8).map((log) => ({
      time: log.time,
      level: log.level,
      source: log.source,
      message: log.message,
      operator: log.operator,
    })),
  };
}

export class AIChat {
  constructor({ simulation }) {
    this.sim = simulation;
    this.panel = document.getElementById('ai-panel');
    this.trigger = document.getElementById('btn-ai');
    this.messagesEl = document.getElementById('ai-messages');
    this.suggestionsEl = document.getElementById('ai-suggestions');
    this.input = document.getElementById('ai-input');
    this.form = document.getElementById('ai-form');
    this.sendButton = document.getElementById('btn-ai-send');
    this.modelName = document.getElementById('ai-model-name');
    this.statusDot = document.getElementById('ai-status-dot');
    this.contextStatus = document.getElementById('ai-context-status');
    this.contextTime = document.getElementById('ai-context-time');

    this.state = null;
    this.history = [];
    this.open = false;
    this.busy = false;
    this.syncing = false;
    this.lastSync = 0;
    this.backendConfigured = null;
    this.unsubscribe = null;

    if (!this.panel) return;
    if (STATIC_DEMO) {
      this.modelName.textContent = 'Rule Analyst';
      this.contextStatus.textContent = '静态演示 · 本地规则分析';
      this.statusDot.className = 'status-dot idle';
      const note = document.querySelector('.ai-footnote');
      if (note) note.textContent = '静态演示：本地规则分析，未调用大模型；完整 AI 请在本地运行';
    }
    this.renderWelcome();
    this.bindEvents();
    this.unsubscribe = simulation.subscribe((state) => this.onState(state));
    this.checkStatus();
  }

  bindEvents() {
    this.trigger?.addEventListener('click', () => this.toggle());
    document.getElementById('btn-ai-close')?.addEventListener('click', () => this.toggle(false));
    document.getElementById('btn-ai-clear')?.addEventListener('click', () => this.clear());
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.send(this.input.value);
    });
    this.input?.addEventListener('input', () => this.resizeInput());
    this.input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.form?.requestSubmit();
      }
    });
    this.suggestionsEl?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ai-prompt]');
      if (!button || this.busy) return;
      this.input.value = button.dataset.aiPrompt || '';
      this.resizeInput();
      this.form?.requestSubmit();
    });
    document.addEventListener('keydown', (event) => {
      if (event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        this.toggle();
      } else if (event.key === 'Escape' && this.open && !document.querySelector('#modal-layer.is-open')) {
        this.toggle(false);
      }
    });
  }

  onState(state) {
    this.state = state;
    if (!this.contextTime) return;
    const t = state.updatedAt instanceof Date ? state.updatedAt : new Date();
    this.contextTime.textContent = `看板更新 ${fmtTime(t)}`;
    if (!STATIC_DEMO && this.open && Date.now() - this.lastSync > 12000) this.syncTelemetry();
  }

  async checkStatus() {
    if (STATIC_DEMO) {
      this.backendConfigured = false;
      this.contextStatus.textContent = '静态演示 · 本地规则分析';
      this.statusDot.className = 'status-dot idle';
      return;
    }
    try {
      const res = await fetch('/api/ai/status', { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      this.backendConfigured = Boolean(data.configured);
      const model = MODEL_LABELS[data.model] || data.model || 'DeepSeek-Flash';
      this.modelName.textContent = model;
      if (!data.configured) {
        this.contextStatus.textContent = 'AI 后端未配置 API Key';
        this.statusDot.className = 'status-dot warning';
      } else if (data.telemetryAgeSeconds != null && data.telemetryAgeSeconds > 45) {
        this.contextStatus.textContent = 'AI 在线 · 看板数据待同步';
        this.statusDot.className = 'status-dot idle';
      } else {
        this.contextStatus.textContent = '实时看板已接入';
        this.statusDot.className = 'status-dot running';
      }
    } catch {
      this.backendConfigured = null;
      this.contextStatus.textContent = 'AI 后端离线';
      this.statusDot.className = 'status-dot warning';
    }
  }

  async syncTelemetry(force = false) {
    if (STATIC_DEMO) {
      this.lastSync = Date.now();
      this.contextTime.textContent = `看板更新 ${fmtTime()}`;
      this.contextStatus.textContent = '静态演示 · 本地规则分析';
      return true;
    }
    if (!this.state || this.syncing) return false;
    if (!force && Date.now() - this.lastSync < 9000) return true;
    this.syncing = true;
    this.contextStatus.textContent = '正在同步实时看板…';
    try {
      const res = await fetch('/api/ai/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTelemetry(this.state)),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`telemetry ${res.status}`);
      this.lastSync = Date.now();
      this.contextTime.textContent = `看板更新 ${fmtTime()}`;
      this.contextStatus.textContent = '实时看板已接入';
      this.statusDot.className = 'status-dot running';
      return true;
    } catch {
      this.contextStatus.textContent = '看板同步失败，将重试';
      this.statusDot.className = 'status-dot warning';
      return false;
    } finally {
      this.syncing = false;
    }
  }

  toggle(force) {
    const next = typeof force === 'boolean' ? force : !this.open;
    if (next === this.open) return;
    this.open = next;
    this.panel.classList.toggle('is-open', this.open);
    this.panel.setAttribute('aria-hidden', String(!this.open));
    this.trigger.classList.toggle('is-active', this.open);
    this.trigger.setAttribute('aria-expanded', String(this.open));
    if (this.open) {
      this.checkStatus();
      this.syncTelemetry(true);
      this.scrollToBottom();
      setTimeout(() => this.input?.focus(), 120);
    }
  }

  setBusy(value) {
    this.busy = value;
    this.panel.classList.toggle('is-busy', value);
    if (this.sendButton) this.sendButton.disabled = value;
    if (this.input) this.input.disabled = value;
  }

  resizeInput() {
    if (!this.input) return;
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(92, this.input.scrollHeight)}px`;
  }

  clear() {
    if (this.busy) return;
    this.history = [];
    this.renderWelcome();
    this.input.value = '';
    this.resizeInput();
    this.input.focus();
  }

  renderWelcome() {
    const now = fmtTime();
    this.messagesEl.innerHTML = `
      <div class="ai-welcome">
        <div class="ai-message">
          <div class="ai-message-avatar"><svg class="icon"><use href="#i-spark"></use></svg></div>
          <div class="ai-message-body">
            <div class="ai-bubble">
              <div class="ai-welcome-title"><svg class="icon"><use href="#i-activity"></use></svg>实时数据已接入，可以开始提问</div>
              <p>我可以读取当前看板中的排放浓度、设备状态、能耗、告警和运行日志。试试让我做风险排序、异常归因或生成值班摘要。</p>
            </div>
            <span class="ai-time">${now}</span>
          </div>
        </div>
      </div>
    `;
    if (this.suggestionsEl) this.suggestionsEl.hidden = false;
    this.scrollToBottom();
  }

  appendMessage(role, text, { error = false, store = true } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = `ai-message ${role}${error ? ' error' : ''}`;
    const icon = role === 'user' ? 'user' : 'spark';
    wrapper.innerHTML = `
      <div class="ai-message-avatar"><svg class="icon"><use href="#i-${icon}"></use></svg></div>
      <div class="ai-message-body">
        <div class="ai-bubble">${renderText(text)}</div>
        <span class="ai-time">${fmtTime()}</span>
      </div>
    `;
    this.messagesEl.appendChild(wrapper);
    if (store) {
      this.history.push({ role, content: text });
      this.history = this.history.slice(-16);
    }
    this.scrollToBottom();
    return wrapper;
  }

  appendTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-message assistant';
    wrapper.innerHTML = `
      <div class="ai-message-avatar"><svg class="icon"><use href="#i-spark"></use></svg></div>
      <div class="ai-message-body">
        <div class="ai-typing"><i></i><i></i><i></i></div>
      </div>
    `;
    this.messagesEl.appendChild(wrapper);
    this.scrollToBottom();
    return wrapper;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  localAnswer(question) {
    const state = this.state;
    if (!state) return '静态演示：看板数据尚未就绪，请稍后再试。';
    const head = '静态演示 · 本地规则分析（未调用大模型）\n\n';
    const q = String(question || '').toLowerCase();
    const emissions = [...state.emissions]
      .filter((point) => point.limit > 0)
      .sort((a, b) => b.value / b.limit - a.value / a.limit);
    const top = emissions[0];
    const warnings = state.equipment.filter((eq) => eq.status !== 'running');
    const topMeters = [...state.meters].sort((a, b) => b.current - a.current).slice(0, 3);

    if (/排放|环保|排口|废气|浓度|cems|风险/.test(question)) {
      const rows = emissions.slice(0, 3).map((point) => `• ${point.code} ${point.name}：${point.value.toFixed(1)} ${point.primaryUnit}，限值 ${point.limit} ${point.primaryUnit}，占限值 ${(point.value / point.limit * 100).toFixed(1)}%，状态 ${point.status === 'normal' ? '正常' : '预警'}`);
      return `${head}数据事实：\n${rows.join('\n')}\n\n建议：优先核查 ${top.code} 对应治理设施的压差、滤袋和风量；若浓度持续上升，先降负荷并安排检修。`;
    }

    if (/能耗|能源|电|负荷|耗电|kwh|气耗|水耗/.test(question)) {
      const rows = topMeters.map((meter) => `• ${meter.name}：${meter.current.toFixed(0)} kW，今日 ${meter.today.toFixed(0)} kWh，占比 ${(meter.current / Math.max(1, state.totalLoad) * 100).toFixed(1)}%`);
      return `${head}当前总负荷 ${state.totalLoad.toFixed(0)} kW，今日累计 ${state.totalKwh.toFixed(0)} kWh，吨铸件电耗 ${(state.totalKwh / state.production.today).toFixed(1)} kWh/t。\n\n主要分表：\n${rows.join('\n')}\n\n建议：结合生产节拍检查熔炼保温与空压/循环水系统是否存在空转。`;
    }

    if (/设备|预警|报警|故障|维护|状态/.test(question)) {
      const rows = warnings.slice(0, 5).map((eq) => `• ${eq.id} ${eq.name}：${eq.status === 'warning' ? '预警' : eq.status}，功率 ${eq.power.toFixed(0)} kW，温度 ${eq.temp.toFixed(1)} ℃，振动 ${eq.vibration.toFixed(1)} mm/s`);
      return `${head}当前有 ${warnings.length} 台设备处于非正常运行状态。\n${rows.join('\n') || '• 无设备预警'}\n\n建议：优先处理循环水冷却塔与砂处理除尘压差报警，确认备件与检修窗口。`;
    }

    if (/交接|摘要|总结|值班|日报/.test(question)) {
      return `${head}白班运行摘要：\n• 今日铸件产量 ${state.production.today.toFixed(1)} t，OEE ${state.production.oee.toFixed(1)}%，在岗 ${state.production.staff} 人。\n• 全厂总负荷 ${state.totalLoad.toFixed(0)} kW，吨铸件电耗 ${(state.totalKwh / state.production.today).toFixed(1)} kWh/t。\n• 最高排放风险：${top.code} ${top.name}，${top.value.toFixed(1)} ${top.primaryUnit}，占限值 ${(top.value / top.limit * 100).toFixed(1)}%。\n• 设备预警 ${warnings.length} 台，未确认报警 ${state.alarms.filter((alarm) => !alarm.acknowledged).length} 条。\n\n建议下班前复核除尘压差、冷却塔振动和熔炼保温功率。`;
    }

    return `${head}当前可分析：排放风险排序、能耗负荷、设备预警、值班交接摘要。\n\n如果你需要自由问答，请在本地运行完整版并配置 DeepSeek API Key。`;
  }

  async send(rawText) {
    const text = String(rawText || '').trim();
    if (!text || this.busy) return;
    if (this.suggestionsEl) this.suggestionsEl.hidden = true;
    this.appendMessage('user', text);
    this.input.value = '';
    this.resizeInput();
    this.setBusy(true);
    const typing = this.appendTyping();

    if (STATIC_DEMO) {
      await pause(650);
      typing.remove();
      this.appendMessage('assistant', this.localAnswer(text));
      this.contextStatus.textContent = '静态演示 · 本地规则分析';
      this.setBusy(false);
      this.input.focus();
      return;
    }

    try {
      if (!this.lastSync || Date.now() - this.lastSync > 7000) await this.syncTelemetry(true);
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.history.slice(-10),
          context: buildTelemetry(this.state),
        }),
        signal: AbortSignal.timeout(85000),
      });
      const data = await response.json().catch(() => ({}));
      typing.remove();
      if (!response.ok) {
        const message = data.message || 'AI 暂时不可用，请稍后再试。';
        this.appendMessage('assistant', message, { error: true, store: false });
        return;
      }
      const reply = data.reply || 'AI 未返回内容。';
      const replyNode = this.appendMessage('assistant', reply);
      requestAnimationFrame(() => {
        const containerRect = this.messagesEl.getBoundingClientRect();
        const nodeRect = replyNode.getBoundingClientRect();
        this.messagesEl.scrollTop = Math.max(0, this.messagesEl.scrollTop + nodeRect.top - containerRect.top - 8);
      });
      if (data.contextAt) this.contextTime.textContent = `看板数据 ${fmtTime(data.contextAt)}`;
      if (data.latencyMs) this.contextStatus.textContent = `AI 已响应 · ${(data.latencyMs / 1000).toFixed(1)}s`;
    } catch (error) {
      typing.remove();
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'AI 响应超时，请稍后重试。'
        : '无法连接 AI 后端，请确认服务仍在运行。';
      this.appendMessage('assistant', message, { error: true, store: false });
      this.contextStatus.textContent = 'AI 调用失败';
      this.statusDot.className = 'status-dot warning';
    } finally {
      this.setBusy(false);
      this.input.focus();
    }
  }
}
