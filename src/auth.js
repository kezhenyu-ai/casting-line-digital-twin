const $ = (selector, root = document) => root.querySelector(selector);

const BOOT_LINES = [
  { text: 'BOOT  digital-twin core ................ OK', tone: 'ok' },
  { text: 'LINK  CEMS / PLC / ENERGY / CCTV ...... 38 NODES', tone: 'ok' },
  { text: 'SYNC  plant telemetry ................. 24.6 Hz', tone: '' },
  { text: 'AUTH  secure enclave .................. ARMED', tone: '' },
  { text: 'WAIT  operator credentials ............ _', tone: 'warn' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';
const STATIC_SESSION_KEY = 'binhe_static_session';
const STATIC_PASSWORD_HASH = 'eef7f10f1d5eee6322bee716171726bfa693c4cc0d4ef4582653fb113da19a93';
const STATIC_USER = {
  username: 'admin',
  name: '值班管理员',
  role: 'OPERATOR · ADMIN',
};

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class LoginGate {
  constructor({ onAuthenticated }) {
    this.onAuthenticated = onAuthenticated;
    this.screen = $('#login-screen');
    this.form = $('#login-form');
    this.card = $('#login-card');
    this.username = $('#login-user');
    this.password = $('#login-password');
    this.eye = $('#login-eye');
    this.remember = $('#login-remember');
    this.submit = $('#login-submit');
    this.submitLabel = $('#login-submit-label');
    this.submitEn = $('#login-submit-en');
    this.error = $('#login-error');
    this.consoleMode = $('#login-console-mode');
    this.bootLog = $('#login-boot-log');
    this.clock = $('#login-clock');
    this.granted = $('#login-granted');
    this.userMenu = $('#user-menu');
    this.userChip = $('#btn-user');
    this.currentUser = null;
    this.state = 'checking';
    this.finished = false;
    this.bootTimer = null;
    this.clockTimer = null;
    this.particleFrame = null;
    this.particles = [];
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    if (!this.screen) return;
    this.bind();
    this.startClock();
    this.startBootLog();
    this.initParticles();
    this.prefill();
    this.setState('checking');
  }

  bind() {
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitLogin();
    });
    this.eye?.addEventListener('click', () => this.togglePassword());
    this.userChip?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleUserMenu();
    });
    document.addEventListener('click', (event) => {
      if (!this.userMenu || this.userMenu.hidden) return;
      if (!event.target.closest('.user-cluster')) this.closeUserMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.userMenu && !this.userMenu.hidden) this.closeUserMenu();
    });
    $('#btn-logout')?.addEventListener('click', () => this.logout());
    window.addEventListener('resize', () => this.resizeParticles());
  }

  async start() {
    if (!this.screen) {
      await sleep(0);
      this.onAuthenticated?.(null);
      return;
    }
    this.username?.focus();

    if (STATIC_DEMO) {
      try {
        const saved = sessionStorage.getItem(STATIC_SESSION_KEY);
        if (saved) {
          const user = JSON.parse(saved);
          this.currentUser = user;
          this.setUser(user);
          this.bootLine('REST  static session restored ........ PASS', 'ok');
          this.setConsoleMode('STATIC SESSION');
          this.setState('restored');
          await sleep(300);
          this.finish();
          return;
        }
      } catch {
        // SessionStorage may be unavailable in privacy mode.
      }
      this.setState('ready');
      this.bootLine('MODE  static demo · browser-only ...... OK', 'ok');
      this.setConsoleMode('STATIC DEMO');
      return;
    }

    try {
      const response = await fetch('/api/auth/session', { signal: AbortSignal.timeout(4500) });
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          this.currentUser = data.user;
          this.setUser(data.user);
          this.bootLine('REST  secure session restored ........ PASS', 'ok');
          this.setConsoleMode('SESSION RESTORED');
          this.setState('restored');
          await sleep(450);
          this.finish();
          return;
        }
      }
      this.setState('ready');
    } catch {
      this.setState('ready');
      this.showError('认证服务暂未连接，请确认本地服务已启动。');
    }
  }

  prefill() {
    try {
      const saved = localStorage.getItem('binhe_operator');
      if (saved && this.username) this.username.value = saved;
    } catch {
      // Storage can be unavailable in hardened browser profiles.
    }
  }

  startClock() {
    const tick = () => {
      if (this.clock) {
        const now = new Date();
        this.clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      }
    };
    tick();
    this.clockTimer = setInterval(tick, 1000);
  }

  bootLine(text, tone = '') {
    if (!this.bootLog) return;
    const line = document.createElement('div');
    line.className = `login-boot-line ${tone}`.trim();
    const marker = document.createElement('b');
    marker.textContent = tone === 'ok' ? '[ OK ]' : tone === 'warn' ? '[ WAIT ]' : '[ .. ]';
    const copy = document.createElement('span');
    copy.textContent = text;
    line.append(marker, copy);
    this.bootLog.appendChild(line);
    while (this.bootLog.children.length > 6) this.bootLog.firstElementChild?.remove();
  }

  startBootLog() {
    if (!this.bootLog || this.reducedMotion) {
      BOOT_LINES.forEach((line) => this.bootLine(line.text, line.tone));
      return;
    }
    let index = 0;
    const push = () => {
      const line = BOOT_LINES[index];
      if (line) {
        this.bootLine(line.text, line.tone);
        index += 1;
        this.bootTimer = setTimeout(push, 240);
      }
    };
    push();
  }

  setConsoleMode(text) {
    if (this.consoleMode) this.consoleMode.textContent = text;
  }

  setState(state) {
    this.state = state;
    if (!this.card) return;
    this.card.classList.toggle('is-auth', state === 'auth' || state === 'granted');
    this.card.classList.remove('is-denied');
    const locked = state === 'checking' || state === 'auth' || state === 'granted';
    [this.username, this.password, this.remember].forEach((el) => {
      if (el) el.disabled = locked;
    });
    if (this.submit) {
      this.submit.disabled = locked;
      this.submit.classList.toggle('is-loading', state === 'auth');
    }
    if (state === 'checking') {
      this.setButtonText('验证安全会话', 'VERIFYING SESSION');
      this.setConsoleMode('VERIFYING SESSION');
    } else if (state === 'auth') {
      this.setButtonText('身份校验中', 'VERIFYING CREDENTIALS');
      this.setConsoleMode('VERIFYING CREDENTIALS');
    } else if (state === 'granted') {
      this.setButtonText('访问已授权', 'ACCESS GRANTED');
      this.setConsoleMode('ACCESS GRANTED');
    } else if (state === 'restored') {
      this.setButtonText('会话已恢复', 'SESSION RESTORED');
      this.setConsoleMode('SESSION RESTORED');
    } else {
      this.setButtonText('进入数字孪生', 'ENTER DIGITAL TWIN');
      this.setConsoleMode('AWAITING AUTH');
      setTimeout(() => this.username?.focus(), 0);
    }
  }

  setButtonText(label, en) {
    if (this.submitLabel) this.submitLabel.textContent = label;
    if (this.submitEn) this.submitEn.textContent = en;
  }

  showError(message) {
    if (!this.error) return;
    this.error.textContent = message;
    this.error.hidden = false;
  }

  clearError() {
    if (!this.error) return;
    this.error.textContent = '';
    this.error.hidden = true;
  }

  togglePassword() {
    if (!this.password || !this.eye) return;
    const visible = this.password.type === 'text';
    this.password.type = visible ? 'password' : 'text';
    this.eye.setAttribute('aria-label', visible ? '显示口令' : '隐藏口令');
    this.eye.title = visible ? '显示口令' : '隐藏口令';
    const use = this.eye.querySelector('use');
    use?.setAttribute('href', visible ? '#i-eye' : '#i-eye-off');
    this.password.focus();
  }

  async submitLogin() {
    if (!this.form || ['checking', 'auth', 'granted', 'restored'].includes(this.state)) return;
    this.clearError();
    const username = this.username?.value.trim() || '';
    const password = this.password?.value || '';
    if (!username || !password) {
      this.showError('请输入操作员编号和访问口令。');
      (username ? this.password : this.username)?.focus();
      return;
    }

    this.setState('auth');
    this.bootLine('AUTH  validating operator key .......... RUN', '');
    this.setConsoleMode('VERIFYING CREDENTIALS');

    if (STATIC_DEMO) {
      await sleep(520);
      let submittedHash = '';
      try {
        submittedHash = await sha256Hex(password);
      } catch {
        submittedHash = '';
      }
      if (username.toLowerCase() !== STATIC_USER.username || submittedHash !== STATIC_PASSWORD_HASH) {
        this.setState('ready');
        this.showError('身份校验失败，请检查操作员编号或访问口令。');
        this.card?.classList.add('is-denied');
        this.bootLine('AUTH  credential rejected ............. DENY', 'warn');
        this.setConsoleMode('ACCESS DENIED');
        setTimeout(() => this.card?.classList.remove('is-denied'), 500);
        this.password?.focus();
        this.password?.select();
        return;
      }
      const user = { ...STATIC_USER, expiresAt: null };
      this.currentUser = user;
      this.setUser(user);
      try {
        sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user));
        localStorage.setItem('binhe_operator', user.username);
      } catch {
        // Session still lives for this page view.
      }
      this.setState('granted');
      this.bootLine('AUTH  identity verified ............... OK', 'ok');
      this.granted?.setAttribute('aria-hidden', 'false');
      this.screen?.classList.add('is-granted');
      await sleep(900);
      this.finish();
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          remember: Boolean(this.remember?.checked),
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.setState('ready');
        this.showError(data.message || '身份校验失败，请检查输入。');
        this.card?.classList.add('is-denied');
        this.bootLine('AUTH  credential rejected ............. DENY', 'warn');
        this.setConsoleMode('ACCESS DENIED');
        setTimeout(() => this.card?.classList.remove('is-denied'), 500);
        this.password?.focus();
        this.password?.select();
        return;
      }

      this.currentUser = data.user;
      this.setUser(data.user);
      try {
        localStorage.setItem('binhe_operator', data.user.username);
      } catch {
        // Non-fatal: the session still lives in the HttpOnly cookie.
      }
      this.setState('granted');
      this.bootLine('AUTH  identity verified ................ OK', 'ok');
      this.granted?.setAttribute('aria-hidden', 'false');
      this.screen?.classList.add('is-granted');
      await sleep(1100);
      this.finish();
    } catch {
      this.setState('ready');
      this.showError('无法连接认证服务，请确认本地服务仍在运行。');
      this.bootLine('AUTH  gateway unreachable ............. ERR', 'warn');
      this.setConsoleMode('GATEWAY OFFLINE');
    }
  }

  setUser(user) {
    if (!user) return;
    const name = user.name || user.username || '操作员';
    const initials = Array.from(name).slice(0, 1).join('') || 'OP';
    $('#user-avatar')?.replaceChildren(document.createTextNode(initials));
    $('#user-menu-avatar')?.replaceChildren(document.createTextNode(initials));
    const nameEl = $('#user-menu-name');
    const roleEl = $('#user-menu-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = user.role || 'OPERATOR';
    if (this.userChip) this.userChip.title = `账户：${name} · 安全会话`;
  }

  toggleUserMenu() {
    if (!this.userMenu) return;
    const willOpen = this.userMenu.hidden;
    this.userMenu.hidden = !willOpen;
    this.userChip?.setAttribute('aria-expanded', String(willOpen));
  }

  closeUserMenu() {
    if (!this.userMenu) return;
    this.userMenu.hidden = true;
    this.userChip?.setAttribute('aria-expanded', 'false');
  }

  async logout() {
    this.closeUserMenu();
    if (STATIC_DEMO) {
      try {
        sessionStorage.removeItem(STATIC_SESSION_KEY);
      } catch {
        // Ignore storage restrictions.
      }
      location.reload();
      return;
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        signal: AbortSignal.timeout(4000),
      });
    } finally {
      location.reload();
    }
  }

  async finish() {
    if (this.finished) return;
    this.finished = true;
    this.stopLoops();
    this.screen?.classList.add('is-leaving');
    await sleep(760);
    this.screen?.classList.add('is-hidden');
    this.screen?.setAttribute('aria-hidden', 'true');
    this.onAuthenticated?.(this.currentUser);
  }

  stopLoops() {
    clearInterval(this.clockTimer);
    clearTimeout(this.bootTimer);
    this.clockTimer = null;
    this.bootTimer = null;
    if (this.particleFrame) cancelAnimationFrame(this.particleFrame);
    this.particleFrame = null;
  }

  initParticles() {
    this.canvas = $('#login-particles');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resizeParticles();
    const count = Math.min(88, Math.max(42, Math.round(window.innerWidth / 22)));
    this.particles = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00013,
      vy: (Math.random() - 0.5) * 0.00011,
      r: 0.5 + Math.random() * 1.1,
      a: 0.14 + Math.random() * 0.45,
      amber: Math.random() > 0.86,
    }));
    if (this.reducedMotion) {
      this.drawParticles();
      return;
    }
    this.animateParticles();
  }

  resizeParticles() {
    if (!this.canvas) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.reducedMotion) this.drawParticles();
  }

  drawParticles() {
    if (!this.ctx || !this.width) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const x = p.x * this.width;
      const y = p.y * this.height;
      ctx.beginPath();
      ctx.fillStyle = p.amber ? `rgba(255, 193, 116, ${p.a})` : `rgba(96, 234, 211, ${p.a})`;
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  animateParticles() {
    const step = () => {
      if (!this.ctx) return;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      for (const p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        if (p.y < -0.02) p.y = 1.02;
        if (p.y > 1.02) p.y = -0.02;
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.particles.length; i += 1) {
        const a = this.particles[i];
        const ax = a.x * this.width;
        const ay = a.y * this.height;
        for (let j = i + 1; j < this.particles.length; j += 1) {
          const b = this.particles[j];
          const bx = b.x * this.width;
          const by = b.y * this.height;
          const dx = ax - bx;
          const dy = ay - by;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < 120 * 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(90, 212, 193, ${0.035 * (1 - Math.sqrt(dist2) / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.fillStyle = p.amber ? `rgba(255, 193, 116, ${p.a})` : `rgba(96, 234, 211, ${p.a})`;
        ctx.arc(p.x * this.width, p.y * this.height, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      this.particleFrame = requestAnimationFrame(step);
    };
    this.particleFrame = requestAnimationFrame(step);
  }
}
