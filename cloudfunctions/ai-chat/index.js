const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

exports.main = async (event = {}) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return json(204, {});
  if (method !== 'POST') return json(405, { message: '只支持 POST 请求' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json(500, { message: '服务端未配置 DEEPSEEK_API_KEY' });
  }

  const body = parseBody(event);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return json(400, { message: '缺少 messages' });
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.45,
    }),
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    return json(response.status, {
      message: data?.error?.message || data?.message || rawText || 'DeepSeek 调用失败',
    });
  }

  return json(200, {
    content: data?.choices?.[0]?.message?.content || '',
    usage: data?.usage || null,
    provider: 'DeepSeek',
    model: DEEPSEEK_MODEL,
  });
};
