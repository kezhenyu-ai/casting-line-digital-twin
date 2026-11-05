import crypto from 'node:crypto';

const sessions = new Map();
const attempts = new Map();

const AUTH_USER = (process.env.AUTH_USER || 'admin').toLowerCase();
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const DEFAULT_PASSWORD_HASH = 'eef7f10f1d5eee6322bee716171726bfa693c4cc0d4ef4582653fb113da19a93';
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const AUTH_PASSWORD_HASH = (
  process.env.AUTH_PASSWORD_SHA256
  || (AUTH_PASSWORD ? sha256(AUTH_PASSWORD) : DEFAULT_PASSWORD_HASH)
).toLowerCase();
const AUTH_NAME = process.env.AUTH_NAME || '值班管理员';
const AUTH_ROLE = process.env.AUTH_ROLE || 'OPERATOR · ADMIN';
const SESSION_MS = 8 * 60 * 60 * 1000;
const COOKIE = 'binhe_session';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readJson(req, maxBytes = 16_384) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function safeEqual(left, right) {
  const a = crypto.createHash('sha256').update(String(left)).digest();
  const b = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function publicUser(session) {
  return {
    username: session.username,
    name: session.name,
    role: session.role,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

export function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return publicUser(session);
}

function setSessionCookie(res, token, remember) {
  const maxAge = remember ? `; Max-Age=${Math.floor(SESSION_MS / 1000)}` : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/${maxAge}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

function allowAttempt(ip) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const bucket = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
  if (bucket.length >= 8) {
    attempts.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  attempts.set(ip, bucket);
  return true;
}

async function middleware(req, res, next) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith('/api/auth/')) {
    next();
    return;
  }

  if (url.pathname === '/api/auth/session' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      sendJson(res, 401, { authenticated: false });
      return;
    }
    sendJson(res, 200, { authenticated: true, user });
    return;
  }

  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || 'local';
    if (!allowAttempt(ip)) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '尝试次数过多，请 5 分钟后再试。' });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, error.message === 'BODY_TOO_LARGE' ? 413 : 400, {
        error: 'INVALID_REQUEST',
        message: '登录请求格式不正确。',
      });
      return;
    }

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      sendJson(res, 400, { error: 'MISSING_FIELDS', message: '请输入操作员编号和访问口令。' });
      return;
    }

    if (!safeEqual(username.toLowerCase(), AUTH_USER) || !safeEqual(sha256(password), AUTH_PASSWORD_HASH)) {
      // Keep the response generic so the client cannot enumerate accounts.
      sendJson(res, 401, { error: 'INVALID_CREDENTIALS', message: '身份校验失败，请检查操作员编号或访问口令。' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_MS;
    sessions.set(token, {
      username: AUTH_USER,
      name: AUTH_NAME,
      role: AUTH_ROLE,
      expiresAt,
    });
    attempts.delete(ip);
    setSessionCookie(res, token, Boolean(body.remember));
    sendJson(res, 200, {
      authenticated: true,
      user: publicUser({ username: AUTH_USER, name: AUTH_NAME, role: AUTH_ROLE, expiresAt }),
    });
    return;
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) sessions.delete(token);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'NOT_FOUND', message: '认证路由不存在。' });
}

export function authPlugin() {
  return {
    name: 'binhe-auth',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
