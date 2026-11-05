import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getSessionUser } from './auth.mjs';

const ROOT = process.cwd();
const LIB = path.join(ROOT, 'data', 'model-library');
const INDEX = path.join(LIB, 'projects.json');
const MAX_UPLOAD = 300 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function readIndex() {
  try {
    const raw = await fsp.readFile(INDEX, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return { projects: [] };
    throw error;
  }
}

async function writeIndex(data) {
  await fsp.mkdir(LIB, { recursive: true });
  const tmp = `${INDEX}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, INDEX);
}

function readJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }));
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
        reject(Object.assign(new Error('INVALID_JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function isAdmin(user) {
  return Boolean(user && /ADMIN|管理员/i.test(String(user.role || '')));
}

function slugify(value) {
  const s = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'project';
}

function projectId(name) {
  return `${slugify(name)}-${crypto.randomBytes(3).toString('hex')}`;
}

function versionId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomBytes(2).toString('hex');
}

function publicProject(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description || '',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    activeVersion: project.activeVersion || null,
    versions: (project.versions || []).map((v) => ({
      version: v.version,
      size: v.size,
      uploadedAt: v.uploadedAt,
      uploadedBy: v.uploadedBy,
    })),
  };
}

async function saveUpload(req, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const tmp = `${destination}.${process.pid}.upload`;
  const stream = fs.createWriteStream(tmp);
  let size = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_UPLOAD) {
      aborted = true;
      stream.destroy();
      req.destroy();
    }
  });
  await new Promise((resolve, reject) => {
    req.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
    req.on('error', reject);
  }).catch((error) => {
    if (aborted) throw Object.assign(new Error('MODEL_TOO_LARGE'), { status: 413 });
    throw error;
  });
  if (aborted) throw Object.assign(new Error('MODEL_TOO_LARGE'), { status: 413 });
  await fsp.rename(tmp, destination);
  return size;
}

async function middleware(req, res, next) {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith('/api/model-library')) {
    next();
    return;
  }

  const user = getSessionUser(req);
  if (!user) {
    sendError(res, 401, 'AUTH_REQUIRED');
    return;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  // /api/model-library[/...]
  const rest = parts.slice(2);

  try {
    if (req.method === 'GET' && rest.length === 0) {
      const data = await readIndex();
      sendJson(res, 200, { projects: data.projects.map(publicProject) });
      return;
    }

    if (req.method === 'POST' && rest.length === 0) {
      if (!isAdmin(user)) {
        sendError(res, 403, 'ADMIN_REQUIRED');
        return;
      }
      const body = await readJson(req);
      const name = String(body.name || '').trim();
      if (!name) {
        sendError(res, 400, 'NAME_REQUIRED');
        return;
      }
      const data = await readIndex();
      const now = new Date().toISOString();
      const project = {
        id: projectId(name),
        name,
        description: String(body.description || ''),
        createdAt: now,
        updatedAt: now,
        activeVersion: null,
        versions: [],
        createdBy: user.username,
      };
      data.projects.push(project);
      await writeIndex(data);
      sendJson(res, 201, { project: publicProject(project) });
      return;
    }

    const id = rest[0];
    if (!id) {
      sendError(res, 404, 'NOT_FOUND');
      return;
    }

    const data = await readIndex();
    const project = data.projects.find((p) => p.id === id);

    if (req.method === 'GET' && rest.length === 1) {
      if (!project) {
        sendError(res, 404, 'NOT_FOUND');
        return;
      }
      sendJson(res, 200, { project: publicProject(project) });
      return;
    }

    if (req.method === 'POST' && rest[1] === 'upload') {
      if (!isAdmin(user)) {
        sendError(res, 403, 'ADMIN_REQUIRED');
        return;
      }
      if (!project) {
        sendError(res, 404, 'NOT_FOUND');
        return;
      }
      if (!/^model\//.test(String(req.headers['content-type'] || ''))) {
        sendError(res, 415, 'GLB_REQUIRED');
        return;
      }
      const version = versionId();
      const destination = path.join(LIB, 'models', id, version, 'model.glb');
      const size = await saveUpload(req, destination);
      project.versions = project.versions || [];
      project.versions.push({
        version,
        file: `models/${id}/${version}/model.glb`,
        size,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.username,
      });
      project.activeVersion = version;
      project.updatedAt = new Date().toISOString();
      await writeIndex(data);
      sendJson(res, 201, { project: publicProject(project), version });
      return;
    }

    if (req.method === 'GET' && rest[1] === 'model') {
      if (!project || !project.activeVersion) {
        sendError(res, 404, 'MODEL_NOT_FOUND');
        return;
      }
      const versionInfo = (project.versions || []).find((v) => v.version === project.activeVersion);
      if (!versionInfo) {
        sendError(res, 404, 'MODEL_NOT_FOUND');
        return;
      }
      const file = path.join(ROOT, 'data', 'model-library', versionInfo.file);
      if (!fs.existsSync(file)) {
        sendError(res, 404, 'MODEL_FILE_MISSING');
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'model/gltf-binary');
      res.setHeader('Content-Length', fs.statSync(file).size);
      res.setHeader('Cache-Control', 'no-store');
      fs.createReadStream(file).pipe(res);
      return;
    }

    if (req.method === 'DELETE' && rest.length === 1) {
      if (!isAdmin(user)) {
        sendError(res, 403, 'ADMIN_REQUIRED');
        return;
      }
      if (!project) {
        sendError(res, 404, 'NOT_FOUND');
        return;
      }
      data.projects = data.projects.filter((p) => p.id !== id);
      await writeIndex(data);
      await fsp.rm(path.join(LIB, 'models', id), { recursive: true, force: true }).catch(() => {});
      sendJson(res, 200, { ok: true });
      return;
    }

    sendError(res, 404, 'NOT_FOUND');
  } catch (error) {
    console.error('[model-library]', error);
    if (!res.headersSent) sendError(res, error.status || 500, error.message || 'SERVER_ERROR');
  }
}

export function projectsPlugin() {
  return {
    name: 'binhe-model-library',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
