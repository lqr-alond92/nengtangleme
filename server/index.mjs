import http from 'node:http';
import { buildAiReport, buildMetrics } from '../src/finance.mjs';
import { newId, readDb, updateDb } from './storage.mjs';

const PORT = Number(process.env.API_PORT || 8787);
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const DEV_AUTH_CODE = process.env.DEV_AUTH_CODE || '123456';
const COOKIE_NAME = 'neng_tang_sid';

function now() {
  return new Date().toISOString();
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': APP_ORIGIN,
    'access-control-allow-credentials': 'true',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function noContent(res, extraHeaders = {}) {
  res.writeHead(204, {
    'access-control-allow-origin': APP_ORIGIN,
    'access-control-allow-credentials': 'true',
    ...extraHeaders,
  });
  res.end();
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...value] = item.split('=');
        return [key, decodeURIComponent(value.join('='))];
      }),
  );
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function sessionCookie(sessionId) {
  return `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    identifier: user.identifier,
    createdAt: user.createdAt,
  };
}

async function getSessionUser(req) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (!sessionId) return { user: null, session: null };
  const db = await readDb();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) return { user: null, session: null };
  const user = db.users.find((item) => item.id === session.userId && !item.deletedAt);
  return { user, session };
}

async function requireUser(req, res) {
  const { user } = await getSessionUser(req);
  if (!user) {
    json(res, 401, { error: 'UNAUTHORIZED', message: '请先登录。' });
    return null;
  }
  return user;
}

function defaultPlanForUser(userId, plan) {
  return {
    id: newId('plan'),
    userId,
    title: '我的家庭规划',
    plan,
    createdAt: now(),
    updatedAt: now(),
  };
}

function reportFor(plan) {
  const metrics = buildMetrics(plan);
  const aiReport = buildAiReport(plan, metrics);
  return { metrics, aiReport };
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    noContent(res, {
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return;
  }

  if (req.method === 'GET' && path === '/api/health') {
    json(res, 200, {
      ok: true,
      service: 'neng-tang-api',
      cloud: 'aliyun',
      ownerType: 'personal',
      time: now(),
    });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/send-code') {
    const body = await readBody(req);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    if (!identifier) {
      json(res, 400, { error: 'IDENTIFIER_REQUIRED', message: '请输入邮箱或手机号。' });
      return;
    }

    await updateDb((db) => ({
      ...db,
      authCodes: [
        ...db.authCodes.filter((item) => item.identifier !== identifier),
        {
          id: newId('code'),
          identifier,
          code: DEV_AUTH_CODE,
          createdAt: now(),
        },
      ],
    }));

    json(res, 200, {
      ok: true,
      message: '开发环境验证码已生成。',
      devCode: DEV_AUTH_CODE,
    });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(req);
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const db = await readDb();
    const codeRecord = db.authCodes.find((item) => item.identifier === identifier && item.code === code);
    if (!identifier || !codeRecord) {
      json(res, 401, { error: 'INVALID_CODE', message: '验证码不正确。开发环境默认验证码是 123456。' });
      return;
    }

    let user = db.users.find((item) => item.identifier === identifier && !item.deletedAt);
    const createdAt = now();
    if (!user) {
      user = {
        id: newId('user'),
        identifier,
        createdAt,
        updatedAt: createdAt,
      };
      db.users.push(user);
    }

    const session = {
      id: newId('session'),
      userId: user.id,
      createdAt,
    };
    db.sessions.push(session);
    db.authCodes = db.authCodes.filter((item) => item.identifier !== identifier);
    await updateDb(() => db);

    json(res, 200, { user: publicUser(user) }, { 'set-cookie': sessionCookie(session.id) });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/logout') {
    const sessionId = parseCookies(req)[COOKIE_NAME];
    await updateDb((db) => ({
      ...db,
      sessions: db.sessions.filter((session) => session.id !== sessionId),
    }));
    json(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
    return;
  }

  if (req.method === 'GET' && path === '/api/auth/me') {
    const { user } = await getSessionUser(req);
    json(res, 200, { user: publicUser(user) });
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/delete-account') {
    const user = await requireUser(req, res);
    if (!user) return;
    await updateDb((db) => ({
      ...db,
      users: db.users.map((item) => (item.id === user.id ? { ...item, deletedAt: now(), updatedAt: now() } : item)),
      sessions: db.sessions.filter((session) => session.userId !== user.id),
    }));
    json(res, 200, { ok: true }, { 'set-cookie': clearSessionCookie() });
    return;
  }

  if (req.method === 'GET' && path === '/api/plans/current') {
    const user = await requireUser(req, res);
    if (!user) return;
    const db = await readDb();
    const planRecord = db.plans.find((plan) => plan.userId === user.id);
    json(res, 200, { plan: planRecord || null, report: planRecord ? reportFor(planRecord.plan) : null });
    return;
  }

  if (req.method === 'POST' && path === '/api/plans') {
    const user = await requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    const record = defaultPlanForUser(user.id, body.plan);
    await updateDb((db) => ({
      ...db,
      plans: [...db.plans.filter((plan) => plan.userId !== user.id), record],
    }));
    json(res, 201, { plan: record, report: reportFor(record.plan) });
    return;
  }

  const planMatch = path.match(/^\/api\/plans\/([^/]+)$/);
  if (req.method === 'PUT' && planMatch) {
    const user = await requireUser(req, res);
    if (!user) return;
    const body = await readBody(req);
    let updated = null;
    await updateDb((db) => {
      const plans = db.plans.map((record) => {
        if (record.id !== planMatch[1] || record.userId !== user.id) return record;
        updated = { ...record, plan: body.plan, updatedAt: now() };
        return updated;
      });
      return { ...db, plans };
    });
    if (!updated) {
      json(res, 404, { error: 'PLAN_NOT_FOUND', message: '计划不存在。' });
      return;
    }
    json(res, 200, { plan: updated, report: reportFor(updated.plan) });
    return;
  }

  const reportMatch = path.match(/^\/api\/plans\/([^/]+)\/(?:report|calculate)$/);
  if ((req.method === 'GET' || req.method === 'POST') && reportMatch) {
    const user = await requireUser(req, res);
    if (!user) return;
    const db = await readDb();
    const planRecord = db.plans.find((plan) => plan.id === reportMatch[1] && plan.userId === user.id);
    if (!planRecord) {
      json(res, 404, { error: 'PLAN_NOT_FOUND', message: '计划不存在。' });
      return;
    }
    json(res, 200, reportFor(planRecord.plan));
    return;
  }

  json(res, 404, { error: 'NOT_FOUND', message: '接口不存在。' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    json(res, 500, { error: 'INTERNAL_ERROR', message: '服务暂时不可用。' });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`API server listening on http://127.0.0.1:${PORT}`);
});
