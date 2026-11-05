/**
 * Demo telemetry engine for the Binhe casting digital twin.
 *
 * The prototype ships without a plant historian, so every value below is
 * generated locally with realistic ranges and time-series behaviour. The
 * public shape mirrors what a real OPC-UA / IoT gateway would deliver, which
 * keeps the rendering and UI layers integration-ready.
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function pad(n) {
  return String(n).padStart(2, '0');
}

function timeLabel(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fullTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${timeLabel(date)}`;
}

function walk(value, min, max, step) {
  return clamp(value + rand(-step, step), min, max);
}

const EMISSION_SEED = [
  {
    id: 'E1',
    code: 'DA-01',
    name: 'AOD / 电炉熔炼烟气',
    short: '熔炼烟气',
    source: 'AOD 精炼炉 / 电炉集烟罩 · 布袋除尘',
    stack: 'STACK-01',
    camera: 'CAM-01',
    primaryKey: 'pm',
    primaryLabel: '颗粒物',
    primaryUnit: 'mg/m³',
    value: 8.6,
    baseline: 8.4,
    limit: 20,
    metrics: { pm: 8.6, so2: 18.2, nox: 62.4, co: 41.2, flow: 68420, temp: 78.4, humidity: 4.8 },
    plume: [0.58, 0.65, 0.66],
  },
  {
    id: 'E2',
    code: 'DA-02',
    name: '树脂砂处理除尘排口',
    short: '砂处理除尘',
    source: '呋喃树脂砂再生 / 混砂 · 脉冲布袋除尘',
    stack: 'STACK-02',
    camera: 'CAM-02',
    primaryKey: 'pm',
    primaryLabel: '颗粒物',
    primaryUnit: 'mg/m³',
    value: 16.8,
    baseline: 13.1,
    limit: 20,
    metrics: { pm: 16.8, so2: 4.2, nox: 12.8, co: 10.4, flow: 42600, temp: 42.1, humidity: 6.2 },
    plume: [0.7, 0.64, 0.49],
  },
  {
    id: 'E3',
    code: 'DA-03',
    name: '落砂 / 清理排口',
    short: '落砂除尘',
    source: '振动落砂机 / 砂箱清理 · 滤筒除尘',
    stack: 'STACK-03',
    camera: 'CAM-03',
    primaryKey: 'pm',
    primaryLabel: '颗粒物',
    primaryUnit: 'mg/m³',
    value: 7.2,
    baseline: 7.9,
    limit: 20,
    metrics: { pm: 7.2, so2: 2.8, nox: 9.6, co: 8.2, flow: 31800, temp: 38.6, humidity: 7.4 },
    plume: [0.56, 0.61, 0.62],
  },
  {
    id: 'E4',
    code: 'DA-04',
    name: '浇注 / 造型废气排口',
    short: '浇注 VOCs',
    source: '浇注机 / 造型线 · 集气罩 + RTO',
    stack: 'STACK-04',
    camera: 'CAM-04',
    primaryKey: 'voc',
    primaryLabel: '非甲烷总烃',
    primaryUnit: 'mg/m³',
    value: 33.8,
    baseline: 31.4,
    limit: 60,
    metrics: { voc: 33.8, pm: 3.6, so2: 1.4, nox: 24.8, flow: 28600, temp: 84.2, humidity: 3.6 },
    plume: [0.65, 0.71, 0.72],
  },
  {
    id: 'E5',
    code: 'MF-01',
    name: '浇注区无组织排放',
    short: '浇注区',
    source: '浇注工位 · 移动集烟罩',
    stack: 'AREA-01',
    camera: 'CAM-05',
    primaryKey: 'pm10',
    primaryLabel: 'PM10',
    primaryUnit: 'mg/m³',
    value: 0.42,
    baseline: 0.38,
    limit: 1,
    metrics: { pm10: 0.42, voc: 0.18, temp: 32.4, humidity: 48.6 },
    plume: null,
  },
  {
    id: 'E6',
    code: 'MF-02',
    name: '原料堆场无组织扬尘',
    short: '原料堆场',
    source: '废钢 / 回炉料堆场 · 雾炮抑尘',
    stack: 'AREA-02',
    camera: 'CAM-06',
    primaryKey: 'tsp',
    primaryLabel: 'TSP',
    primaryUnit: 'mg/m³',
    value: 0.28,
    baseline: 0.31,
    limit: 1,
    metrics: { tsp: 0.28, pm10: 0.19, wind: 2.4, humidity: 51.2 },
    plume: null,
  },
];

const EQUIPMENT_SEED = [
  ['FUR-01', '1# 中频感应炉', '熔炼工段', 'melting', 'running', 720, 900, 1486, 2.4, 36, 0.89, '张伟'],
  ['FUR-02', '2# 中频感应炉', '熔炼工段', 'melting', 'running', 564, 800, 1478, 2.1, 31, 0.87, '张伟'],
  ['MIX-01', '连续式混砂机', '砂处理工段', 'sand', 'running', 118, 160, 46, 3.2, 22, 0.82, '李敏'],
  ['MOLD-01', '垂直分型造型线', '造型工段', 'molding', 'running', 186, 240, 44, 2.8, 19, 0.91, '王海'],
  ['POUR-01', '自动浇注机', '浇注工段', 'pouring', 'running', 64, 90, 62, 1.6, 17, 0.84, '王海'],
  ['SHAKE-01', '振动落砂机', '清理工段', 'cleaning', 'running', 96, 130, 58, 4.1, 14, 0.76, '陈昊'],
  ['SHOT-01', '抛丸清理线', '清理工段', 'cleaning', 'running', 142, 200, 42, 3.6, 20, 0.88, '陈昊'],
  ['PAINT-01', '涂装烘干线', '涂装工段', 'painting', 'running', 156, 220, 74, 1.8, 23, 0.86, '赵宁'],
  ['DC-01', '熔炼布袋除尘器', '环保设施', 'utility', 'running', 75, 110, 54, 1.2, 27, 0.93, '系统'],
  ['DC-02', '砂处理脉冲除尘器', '环保设施', 'utility', 'running', 62, 90, 49, 1.5, 25, 0.9, '系统'],
  ['VOC-01', 'RTO 蓄热焚烧炉', '环保设施', 'utility', 'running', 88, 130, 782, 0.9, 26, 0.94, '系统'],
  ['CRANE-01', '32t 桥式起重机', '清理工段', 'cleaning', 'idle', 3, 45, 36, 0.2, 9, 0.72, '刘凯'],
  ['COMP-01', '螺杆式空压机', '公用动力', 'utility', 'running', 132, 160, 68, 2.4, 18, 0.85, '系统'],
  ['WATER-01', '循环水冷却塔', '公用动力', 'utility', 'warning', 56, 75, 39, 6.8, 29, 0.79, '系统'],
  ['AOD-01', 'AOD 精炼炉', '熔炼工段', 'melting', 'running', 680, 900, 1682, 2.4, 33, 0.9, '张伟'],
  ['MELT-01', '电炉熔炼线', '熔炼工段', 'melting', 'running', 520, 720, 1528, 2.1, 28, 0.88, '张伟'],
  ['POUR-02', '2# 自动浇注机', '浇注工段', 'pouring', 'warning', 58, 90, 1432, 1.8, 16, 0.82, '王海'],
  ['MIX-02', '50t/h 混砂机', '砂处理工段', 'sand', 'running', 126, 180, 48, 3.0, 21, 0.84, '李敏'],
  ['SAND-01', '呋喃树脂砂再生线', '砂处理工段', 'sand', 'running', 74, 100, 44, 2.2, 18, 0.8, '李敏'],
  ['AGV-01', '铁水转运 AGV', '浇注工段', 'pouring', 'running', 18, 30, 62, 1.1, 22, 0.86, '王海'],
];

const METER_SEED = [
  {
    id: 'MELT',
    code: 'EM-01',
    name: '精炼熔炼',
    sub: 'AOD 精炼 / 电炉熔炼 / 保温',
    current: 1284,
    today: 64000,
    gas: 286,
    gasToday: 1880,
    water: 18.6,
    waterToday: 124,
    air: 26.4,
    airToday: 1820,
    pf: 0.96,
    voltage: 10.5,
  },
  {
    id: 'MOLD',
    code: 'EM-02',
    name: '造型浇注',
    sub: '一条造型线 / 浇注机 / AGV',
    current: 326,
    today: 17400,
    gas: 42,
    gasToday: 296,
    water: 4.2,
    waterToday: 31,
    air: 18.2,
    airToday: 1190,
    pf: 0.94,
    voltage: 0.4,
  },
  {
    id: 'CLEAN',
    code: 'EM-03',
    name: '落砂砂处理',
    sub: '振动落砂 / 树脂砂再生 / 混砂',
    current: 238,
    today: 14200,
    gas: 0,
    gasToday: 0,
    water: 2.8,
    waterToday: 22,
    air: 32.6,
    airToday: 2320,
    pf: 0.92,
    voltage: 0.4,
  },
  {
    id: 'PAINT',
    code: 'EM-04',
    name: '砂再生辅助',
    sub: '树脂砂再生 / 混砂 / 除尘',
    current: 196,
    today: 11000,
    gas: 218,
    gasToday: 1460,
    water: 1.2,
    waterToday: 9,
    air: 12.4,
    airToday: 860,
    pf: 0.95,
    voltage: 0.4,
  },
  {
    id: 'UTIL',
    code: 'EM-05',
    name: '公用动力',
    sub: '空压机 / 循环水 / 照明',
    current: 428,
    today: 23800,
    gas: 36,
    gasToday: 244,
    water: 42.8,
    waterToday: 306,
    air: 58.2,
    airToday: 4160,
    pf: 0.93,
    voltage: 0.4,
  },
  {
    id: 'ENV',
    code: 'EM-06',
    name: '环保治理',
    sub: '除尘器 / RTO / CEMS',
    current: 162,
    today: 8350,
    gas: 12,
    gasToday: 82,
    water: 8.4,
    waterToday: 62,
    air: 4.2,
    airToday: 300,
    pf: 0.97,
    voltage: 0.4,
  },
];

const INITIAL_LOGS = [
  ['08:02:11', 'info', '数据网关', 'PLC / CEMS / 视频网关握手完成，24 个计量点上线', '系统'],
  ['08:06:42', 'info', 'AOD-01', 'AOD 精炼炉送电升温，氩氧吹炼进入脱碳阶段', '张伟'],
  ['08:14:09', 'info', 'MOLD-01', '呋喃树脂砂造型线自动模式启动，节拍 42 s', '王海'],
  ['08:21:33', 'warn', 'E2', '砂处理排口颗粒物浓度 16.8 mg/m³，达到预警阈值 84%', '系统'],
  ['08:24:18', 'action', 'DC-02', '脉冲阀喷吹周期由 18 s 调整为 12 s，压低差压', '李敏'],
  ['08:38:57', 'info', 'POUR-01', '自动浇注机完成第 126 包铁水浇注', '王海'],
  ['08:45:02', 'info', 'E4', '浇注/造型废气 RTO 燃烧室温度稳定，VOCs 去除率 98.7%', '系统'],
  ['08:52:30', 'warn', 'WATER-01', '循环水冷却塔风机振动 6.8 mm/s，超过注意值', '系统'],
  ['09:03:44', 'action', 'WATER-01', '已生成检修工单 WO-20261021-014，等待确认停机窗口', '刘凯'],
  ['09:12:16', 'info', 'SHAKE-01', '振动落砂完成铸件批次 B-20261021-07，旧砂进入再生线', '陈昊'],
  ['09:21:08', 'ok', 'E1', '熔炼烟气 CEMS 反吹校准完成，示值偏差 1.2%', '系统'],
  ['09:34:25', 'info', 'ENERGY', '熔炼工段有功负荷回落至 1,284 kW，需量控制在合同值内', '系统'],
  ['09:46:51', 'action', 'SAND-01', '树脂砂再生线调整焙烧风量，旧砂灼减量下降 14%', '李敏'],
  ['10:02:17', 'info', 'AGV-01', '铁水转运 AGV 完成第 48 包转运，返回浇注跨待命', '刘凯'],
  ['10:08:39', 'warn', 'E2', '砂处理除尘器压差 1,860 Pa，高于建议区间上限', '系统'],
  ['10:11:52', 'info', 'MELT-01', '电炉熔炼线出铁完成，铁水温度 1,528 °C', '张伟'],
];

function makeInitialLogs() {
  const now = new Date();
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return INITIAL_LOGS.map(([time, level, source, message, operator], i) => ({
    id: `seed-${i}`,
    timestamp: `${day} ${time}`,
    time,
    level,
    source,
    message,
    operator,
  }));
}

function buildTrend(base, variance, length = 24) {
  const values = [];
  for (let i = 0; i < length; i += 1) {
    const shift = Math.sin((i / length) * Math.PI * 2 - 1.4) * variance * 0.44;
    const shift2 = Math.sin((i / length) * Math.PI * 6) * variance * 0.13;
    values.push(base + shift + shift2 + rand(-variance * 0.12, variance * 0.12));
  }
  return values.map((v) => Math.max(0, v));
}

export class Simulation {
  constructor(options = {}) {
    this.modelMode = Boolean(options.modelMode);
    this.interval = 2000;
    this.energyFactor = 60;
    this.startedAt = Date.now();
    this.lastTickAt = Date.now();
    this.tickCount = 0;
    this.subscribers = new Set();
    this.lastStatusChange = 0;
    this.lastAlarmAt = 0;

    this.production = {
      today: 286.4,
      target: 320,
      yesterday: 275.9,
      shift: '白班',
      rate: 24.6,
      staff: 128,
      oee: 91.8,
      yield: 96.4,
      cycle: 42,
    };

    this.emissions = EMISSION_SEED.map((item) => ({
      ...item,
      metrics: { ...item.metrics },
      online: true,
      status: 'normal',
      updatedAt: new Date(),
    }));

    const modelEquipment = new Set([
      'AOD-01', 'MELT-01', 'MOLD-01', 'POUR-01', 'POUR-02',
      'MIX-01', 'MIX-02', 'SAND-01', 'SHAKE-01', 'WATER-01', 'AGV-01',
    ]);
    const seeds = this.modelMode
      ? EQUIPMENT_SEED.filter(([id]) => modelEquipment.has(id))
      : EQUIPMENT_SEED;
    this.equipment = seeds.map(([id, name, area, group, status, power, rated, temp, vibration, runtime, efficiency, operator]) => ({
      id,
      name,
      area,
      group,
      status,
      power,
      ratedPower: rated,
      load: Math.round((power / rated) * 100),
      temp,
      vibration,
      runtime,
      efficiency,
      operator,
      todayKwh: Math.round(rated * rand(8, 14)),
      alarm: id === 'WATER-01' ? '风机振动偏高' : '',
      lastMaintenance: id === 'WATER-01' ? '2026-08-12' : pick(['2026-08-08', '2026-08-21', '2026-09-02', '2026-09-16']),
      nextMaintenance: pick(['2026-11-04', '2026-11-12', '2026-11-20', '2026-12-03']),
    }));

    this.meters = METER_SEED.map((meter) => ({
      ...meter,
      baseCurrent: meter.current,
      baseGas: meter.gas,
      baseWater: meter.water,
      baseAir: meter.air,
      share: 0,
      online: true,
      history: buildTrend(meter.current, meter.current * 0.22),
      gasHistory: buildTrend(meter.gas, Math.max(8, meter.gas * 0.26)),
      waterHistory: buildTrend(meter.water, Math.max(1, meter.water * 0.22)),
      airHistory: buildTrend(meter.air, Math.max(3, meter.air * 0.2)),
    }));
    this.meters.forEach((meter) => {
      meter.history[meter.history.length - 1] = meter.current;
      meter.gasHistory[meter.gasHistory.length - 1] = meter.gas;
      meter.waterHistory[meter.waterHistory.length - 1] = meter.water;
      meter.airHistory[meter.airHistory.length - 1] = meter.air;
    });

    this.totalKwh = this.meters.reduce((sum, m) => sum + m.today, 0);
    this.totalGas = this.meters.reduce((sum, m) => sum + m.gasToday, 0);
    this.totalWater = this.meters.reduce((sum, m) => sum + m.waterToday, 0);
    this.totalAir = this.meters.reduce((sum, m) => sum + m.airToday, 0);
    this.totalLoad = this.meters.reduce((sum, m) => sum + m.current, 0);
    this.carbon = this.totalKwh * 0.5703;
    this.cost = this.totalKwh * 0.682;
    this.totalTrend = buildTrend(this.totalLoad, 280, 24).map((v) => Math.round(v));
    this.previousTrend = buildTrend(this.totalLoad * 0.94, 260, 24).map((v) => Math.round(v));
    this.totalTrend[this.totalTrend.length - 1] = this.totalLoad;
    this.previousTrend[this.previousTrend.length - 1] = Math.round(this.totalLoad * 0.94);

    this.logs = makeInitialLogs();
    this.loadLogs();
    this.events = this.logs.slice(-4).reverse();
    this.alarms = [
      {
        id: 'ALM-1021-01',
        time: '08:52',
        source: 'WATER-01',
        title: '冷却塔风机振动偏高',
        detail: '振动速度 6.8 mm/s，已超过 6.0 mm/s 注意值',
        level: 'warn',
        acknowledged: false,
      },
      {
        id: 'ALM-1021-02',
        time: '08:21',
        source: 'E2',
        title: '砂处理排口颗粒物预警',
        detail: '浓度达到排放限值的 84%，建议检查布袋压差',
        level: 'warn',
        acknowledged: false,
      },
    ];

    this.updateEmissionStatus(false);
    this.updateMeterShares();
    this.saveLogsThrottled = this.saveLogsThrottled.bind(this);
    this.start();
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.interval);
  }

  stop() {
    clearInterval(this.timer);
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    fn(this.snapshot());
    return () => this.subscribers.delete(fn);
  }

  emit(type = 'tick') {
    const snapshot = this.snapshot();
    this.subscribers.forEach((fn) => {
      try {
        fn(snapshot, type);
      } catch (error) {
        console.error('[simulation subscriber]', error);
      }
    });
  }

  snapshot() {
    return {
      production: this.production,
      emissions: this.emissions,
      equipment: this.equipment,
      meters: this.meters,
      totalLoad: this.totalLoad,
      totalKwh: this.totalKwh,
      totalGas: this.totalGas,
      totalWater: this.totalWater,
      totalAir: this.totalAir,
      totalTrend: this.totalTrend,
      previousTrend: this.previousTrend,
      carbon: this.carbon,
      cost: this.cost,
      logs: this.logs,
      events: this.events,
      alarms: this.alarms,
      aqi: this.computeAqi(),
      compliance: this.computeCompliance(),
      updatedAt: new Date(),
    };
  }

  tick() {
    const now = Date.now();
    const elapsed = (now - this.lastTickAt) / 1000;
    this.lastTickAt = now;
    this.tickCount += 1;

    this.production.today = Number((this.production.today + rand(0.012, 0.038)).toFixed(2));
    this.production.rate = Number(clamp(this.production.rate + rand(-0.6, 0.6), 21.8, 27.4).toFixed(1));
    this.production.oee = Number(clamp(this.production.oee + rand(-0.18, 0.16), 89.6, 93.4).toFixed(1));
    this.production.yield = Number(clamp(this.production.yield + rand(-0.05, 0.05), 95.8, 97.1).toFixed(1));

    this.tickEmissions();
    this.tickEquipment(elapsed);
    this.tickEnergy(elapsed);
    this.updateMeterShares();

    this.events = this.logs.slice(-4).reverse();
    this.saveLogsThrottled();
    this.emit('tick');
  }

  tickEmissions() {
    this.emissions.forEach((point) => {
      if (!point.online) return;
      const spread = point.limit * 0.018;
      point.value = clamp(walk(point.value, point.limit * 0.22, point.limit * 1.08, spread), 0, point.limit * 1.12);
      if (point.primaryKey in point.metrics) {
        point.metrics[point.primaryKey] = point.value;
      }
      Object.keys(point.metrics).forEach((key) => {
        if (key === point.primaryKey) return;
        const value = point.metrics[key];
        if (typeof value !== 'number') return;
        const amplitude = Math.max(0.02, Math.abs(value) * 0.016);
        let min = 0;
        let max = value * 1.8;
        if (key === 'temp') {
          min = value * 0.9;
          max = value * 1.1;
        }
        if (key === 'humidity') {
          min = 2;
          max = 9;
        }
        point.metrics[key] = Number(walk(value, min, max, amplitude).toFixed(key === 'flow' ? 0 : 1));
      });
    });

    this.updateEmissionStatus(true);
  }

  updateEmissionStatus(createAlarm) {
    this.emissions.forEach((point) => {
      const ratio = point.value / point.limit;
      const next = ratio > 1 ? 'exceed' : ratio > 0.82 ? 'warning' : 'normal';
      const changed = point.status !== next;
      point.status = next;
      point.ratio = ratio;
      if (changed && next === 'warning' && createAlarm) {
        this.addAlarm({
          source: point.id,
          title: `${point.short}排放浓度预警`,
          detail: `${point.primaryLabel} ${point.value.toFixed(1)} ${point.primaryUnit}，达到限值 ${Math.round(ratio * 100)}%`,
          level: 'warn',
        });
        this.addLog('warn', point.id, `${point.short}浓度 ${point.value.toFixed(1)} ${point.primaryUnit}，超过预警阈值`, '系统');
      }
      if (changed && next === 'exceed' && createAlarm) {
        this.addAlarm({
          source: point.id,
          title: `${point.short}排放超标`,
          detail: `${point.primaryLabel} ${point.value.toFixed(1)} ${point.primaryUnit}，超过限值 ${point.limit} ${point.primaryUnit}`,
          level: 'error',
        });
        this.addLog('error', point.id, `排放浓度超过限值，触发一级环境报警，请立即核查治理设施`, '系统');
      }
    });
  }

  tickEquipment() {
    const now = Date.now();
    this.equipment.forEach((eq) => {
      const running = eq.status === 'running' || eq.status === 'warning';
      const targetLoad = running ? (eq.id === 'CRANE-01' ? 0.34 : 0.62 + eq.efficiency * 0.28) : 0.04;
      const targetPower = eq.ratedPower * targetLoad;
      eq.power = Math.round(clamp(eq.power + (targetPower - eq.power) * 0.22 + rand(-4, 4), 0, eq.ratedPower));
      eq.load = Math.round((eq.power / eq.ratedPower) * 100);
      const tempRange = eq.id.startsWith('AOD')
        ? [1640, 1705]
        : eq.id.startsWith('MELT')
          ? [1500, 1565]
          : eq.id.startsWith('POUR')
            ? [1390, 1465]
            : eq.id.startsWith('FUR')
              ? [1445, 1512]
              : eq.id === 'VOC-01'
                ? [742, 806]
                : running ? [31, 92] : [22, 44];
      const tempMin = tempRange[0];
      const tempMax = tempRange[1];
      eq.temp = Number(walk(eq.temp, tempMin, tempMax, running ? 0.9 : 0.35).toFixed(1));
      eq.vibration = Number(clamp(walk(eq.vibration, 0.4, eq.id === 'WATER-01' ? 7.4 : 5.4, 0.15), 0.2, 8.4).toFixed(1));
      eq.runtime = Number((eq.runtime + rand(0.01, 0.05)).toFixed(2));
      eq.todayKwh += Math.round((eq.power / 3600) * this.energyFactor);

      if (running && Math.random() < 0.003 && eq.id !== 'WATER-01') {
        eq.vibration = Number(rand(4.6, 5.8).toFixed(1));
      }
    });

    if (now - this.lastStatusChange > 26000 && this.tickCount % 13 === 0) {
      this.lastStatusChange = now;
      const candidates = this.equipment.filter((eq) => !['FUR-01', 'FUR-02', 'WATER-01'].includes(eq.id));
      const eq = pick(candidates);
      if (eq.status === 'running') {
        eq.status = Math.random() < 0.78 ? 'idle' : 'maintenance';
        this.addLog(eq.status === 'maintenance' ? 'action' : 'info', eq.id, eq.status === 'maintenance' ? '计划点检开始，设备切换至维护状态' : '工位物料等待，设备进入待机', eq.operator);
      } else if (eq.status === 'idle') {
        eq.status = 'running';
        this.addLog('ok', eq.id, '重新启动并恢复自动运行', eq.operator);
      }
    }

    if (Math.random() < 0.012) {
      this.addLog('info', pick(this.equipment.filter((eq) => eq.status === 'running')).id, pick([
        '完成一个生产节拍，质量检测通过',
        '轴承温度巡检正常，振动值在基线范围内',
        '自动润滑周期完成，润滑脂压力正常',
        '扫码采集批次追溯信息成功',
      ]), pick(['系统', '系统', '王海', '陈昊']));
    }
  }

  tickEnergy(elapsed) {
    this.meters.forEach((meter, index) => {
      const loadFactor = 0.95 + Math.sin(this.tickCount * 0.055 + index * 1.3) * 0.035 + rand(-0.012, 0.012);
      const target = meter.baseCurrent * loadFactor;
      meter.current = Math.round(clamp(meter.current + (target - meter.current) * 0.42, meter.baseCurrent * 0.82, meter.baseCurrent * 1.15));
      meter.today += Math.round((meter.current / 3600) * this.energyFactor);
      const gasTarget = meter.baseGas * (0.96 + Math.sin(this.tickCount * 0.04 + index) * 0.03);
      meter.gas = Math.max(0, Math.round(meter.gas + (gasTarget - meter.gas) * 0.35));
      meter.gasToday += Math.round((meter.gas / 3600) * this.energyFactor * 0.65);
      const waterTarget = meter.baseWater * (0.96 + Math.sin(this.tickCount * 0.05 + index * 2) * 0.04);
      meter.water = Math.max(0, Number((meter.water + (waterTarget - meter.water) * 0.32).toFixed(1)));
      meter.waterToday += Number(((meter.water / 3600) * this.energyFactor * 0.3).toFixed(1));
      const airTarget = meter.baseAir * (0.96 + Math.sin(this.tickCount * 0.048 + index) * 0.035);
      meter.air = Math.max(0, Number((meter.air + (airTarget - meter.air) * 0.3).toFixed(1)));
      meter.airToday += Math.round((meter.air / 3600) * this.energyFactor * 4.2);
      meter.history.push(meter.current);
      meter.history.shift();
      meter.gasHistory.push(meter.gas);
      meter.gasHistory.shift();
      meter.waterHistory.push(meter.water);
      meter.waterHistory.shift();
      meter.airHistory.push(meter.air);
      meter.airHistory.shift();
    });

    this.totalLoad = this.meters.reduce((sum, m) => sum + m.current, 0);
    this.totalKwh = this.meters.reduce((sum, m) => sum + m.today, 0);
    this.totalGas = this.meters.reduce((sum, m) => sum + m.gasToday, 0);
    this.totalWater = Number(this.meters.reduce((sum, m) => sum + m.waterToday, 0).toFixed(1));
    this.totalAir = this.meters.reduce((sum, m) => sum + m.airToday, 0);
    this.carbon = this.totalKwh * 0.5703;
    this.cost = this.totalKwh * 0.682;
    this.totalTrend.push(Math.round(this.totalLoad));
    this.totalTrend.shift();
    this.previousTrend.push(Math.round(this.totalLoad * (0.93 + rand(-0.02, 0.02))));
    this.previousTrend.shift();
  }

  updateMeterShares() {
    const total = Math.max(1, this.totalLoad);
    this.meters.forEach((meter) => {
      meter.share = Number(((meter.current / total) * 100).toFixed(1));
    });
  }

  computeAqi() {
    const pm = this.emissions.find((e) => e.id === 'E1')?.metrics.pm ?? 10;
    const pm10 = this.emissions.find((e) => e.id === 'E5')?.metrics.pm10 ?? 0.3;
    return Math.round(clamp(26 + pm * 0.75 + pm10 * 21 + rand(-1.4, 1.4), 18, 85));
  }

  computeCompliance() {
    const online = this.emissions.filter((e) => e.online);
    if (!online.length) return 0;
    const ratios = online.map((e) => clamp(e.value / e.limit, 0, 1.2));
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return Number(clamp(101.2 - avg * 5.2, 94, 100).toFixed(1));
  }

  addAlarm({ source, title, detail, level = 'warn' }) {
    const now = new Date();
    if (Date.now() - this.lastAlarmAt < 15000) return;
    this.lastAlarmAt = Date.now();
    this.alarms.unshift({
      id: `ALM-${now.getTime().toString().slice(-7)}`,
      time: timeLabel(now),
      source,
      title,
      detail,
      level,
      acknowledged: false,
    });
    this.alarms = this.alarms.slice(0, 24);
  }

  acknowledgeAlarm(id) {
    const alarm = this.alarms.find((a) => a.id === id);
    if (!alarm) return;
    alarm.acknowledged = true;
    this.addLog('action', alarm.source, `报警 ${alarm.id} 已确认，通知值班工程师处置`, '刘凯');
  }

  addLog(level, source, message, operator = '系统') {
    const now = new Date();
    const entry = {
      id: `log-${now.getTime()}-${Math.random().toString(16).slice(2, 6)}`,
      timestamp: fullTime(now),
      time: timeLabel(now),
      level,
      source,
      message,
      operator,
    };
    this.logs.push(entry);
    if (this.logs.length > 400) this.logs = this.logs.slice(-400);
    return entry;
  }

  getEquipment(id) {
    return this.equipment.find((eq) => eq.id === id);
  }

  getEmission(id) {
    return this.emissions.find((point) => point.id === id);
  }

  setEquipmentStatus(id, status) {
    const eq = this.getEquipment(id);
    if (!eq || eq.status === status) return;
    eq.status = status;
    const labels = { running: '运行', idle: '待机', maintenance: '维护', warning: '预警', offline: '离线' };
    this.addLog(status === 'maintenance' ? 'action' : 'info', id, `人工下发控制指令：设备切换至${labels[status] || status}状态`, '中控');
    this.emit('control');
  }

  startMaintenance(id) {
    const eq = this.getEquipment(id);
    if (!eq) return;
    eq.status = 'maintenance';
    this.addLog('action', id, '已下发计划维护工单，设备进入安全维护状态', '中控');
    this.addAlarm({
      source: id,
      title: '计划维护工单已创建',
      detail: `${eq.name} 已进入维护状态，预计 45 分钟完成`,
      level: 'info',
    });
    this.emit('control');
  }

  exportLogsCsv() {
    const header = ['时间', '级别', '来源', '内容', '操作人'];
    const levelMap = { info: '信息', warn: '预警', error: '报警', action: '操作', ok: '正常' };
    const rows = this.logs.map((log) => [log.timestamp, levelMap[log.level] || log.level, log.source, log.message.replaceAll('"', '""'), log.operator]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `滨河铸铁_运行日志_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  loadLogs() {
    try {
      const raw = localStorage.getItem('binhe_logs_v1');
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored) || !stored.length) return;
      const newest = new Date(stored[stored.length - 1].timestamp.replace(' ', 'T'));
      if (Number.isNaN(newest.getTime())) return;
      if (Date.now() - newest.getTime() > 1000 * 60 * 60 * 18) return;
      const merged = [...stored, ...this.logs];
      const unique = [...new Map(merged.map((log) => [log.id, log])).values()];
      unique.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      this.logs = unique.slice(-400);
    } catch (error) {
      // A corrupted demo cache should never block the dashboard.
      console.warn('[logs] cache unavailable', error);
    }
  }

  saveLogsThrottled() {
    if (this.tickCount % 3 !== 0) return;
    try {
      localStorage.setItem('binhe_logs_v1', JSON.stringify(this.logs.slice(-220)));
    } catch (error) {
      // private mode / quota — telemetry keeps running in memory.
    }
  }
}

export { timeLabel, fullTime };
