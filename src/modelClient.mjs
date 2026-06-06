import { money, percent, toNumber } from './finance.mjs';

export const MODEL_SETTINGS_STORAGE_KEY = 'neng_tang_model_settings_v1';
export const MANAGED_AI_ENDPOINT = '/api/ai-chat';
export const MANAGED_MODEL_LABEL = 'DeepSeek / deepseek-chat';

export const MODEL_PROVIDERS = {
  qwen: {
    key: 'qwen',
    name: '通义千问',
    shortName: '通义',
    defaultEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-plus',
    keyHint: '阿里云百炼 API Key',
  },
  deepseek: {
    key: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    keyHint: 'DeepSeek API Key',
  },
  kimi: {
    key: 'kimi',
    name: 'Kimi',
    shortName: 'Kimi',
    defaultEndpoint: 'https://api.moonshot.ai/v1/chat/completions',
    defaultModel: 'kimi-k2.6',
    keyHint: 'Kimi API Key',
  },
};

export const defaultModelSettings = {
  provider: 'qwen',
  apiKeys: {},
  endpoints: {},
  models: {},
};

export function normalizeModelSettings(settings = {}) {
  const provider = MODEL_PROVIDERS[settings.provider] ? settings.provider : defaultModelSettings.provider;
  const legacyApiKey = typeof settings.apiKey === 'string' ? settings.apiKey : '';

  return {
    ...defaultModelSettings,
    ...settings,
    provider,
    apiKeys: {
      ...(settings.apiKeys || {}),
      ...(legacyApiKey && !settings.apiKeys?.[provider] ? { [provider]: legacyApiKey } : {}),
    },
    endpoints: settings.endpoints || {},
    models: settings.models || {},
  };
}

export function getProviderConfig(settings = {}) {
  const normalized = normalizeModelSettings(settings);
  const provider = MODEL_PROVIDERS[normalized.provider];

  return {
    ...provider,
    apiKey: String(normalized.apiKeys[provider.key] || '').trim(),
    endpoint: String(normalized.endpoints[provider.key] || provider.defaultEndpoint).trim(),
    model: String(normalized.models[provider.key] || provider.defaultModel).trim(),
  };
}

export function hasModelKey(settings = {}) {
  return getProviderConfig(settings).apiKey.length > 0;
}

export function maskApiKey(value = '') {
  const key = String(value).trim();
  if (!key) return '未填写';
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function compactPlanContext(plan, metrics) {
  const goals = (metrics.goals || [])
    .slice(0, 6)
    .map((goal) => {
      const timing =
        goal.kind === 'recurring'
          ? `${toNumber(goal.startYear)} 年后开始到 ${toNumber(goal.endYear)} 年后`
          : `${toNumber(goal.year)} 年后`;
      return `- ${goal.name}：${goal.priority === 'need' ? '必须要' : '想要'}，${money(goal.amount)}，${timing}，现值 ${money(goal.presentValue)}`;
    })
    .join('\n');

  return [
    `可立即动用资产：${money(metrics.liquidAssets)}`,
    `不易变现资产：${money(metrics.lockedAssets)}`,
    `总资产：${money(metrics.assets)}`,
    `负债：${money(plan.liabilities)}`,
    `年收入：${money(plan.annualIncome)}`,
    `年支出：${money(plan.annualExpense)}`,
    `年度结余：${money(metrics.annualSurplus)}`,
    `可调用覆盖率：${percent(metrics.callableCoverage)}`,
    `账面覆盖率：${percent(metrics.bookCoverage)}`,
    `长期目标总现值：${money(metrics.totalTargetPv)}`,
    `当前缺口：${metrics.gap > 0 ? money(metrics.gap) : '无缺口'}`,
    goals ? `目标列表：\n${goals}` : '目标列表：暂无',
  ].join('\n');
}

export function buildModelMessages({ question, plan, metrics, recentMessages = [] }) {
  const recent = recentMessages
    .filter((message) => message.role === 'user' || message.role === 'ai')
    .slice(-6)
    .map((message) => `${message.role === 'user' ? '用户' : 'AI'}：${message.text}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        '你是「能躺了吗」里的家庭财务规划 AI。请用中文回答，基于用户提供的当前设备规划数据做解释和下一步建议。不要编造投资收益，不要给具体证券买卖建议，不要要求用户上传身份证、银行卡或完整隐私信息。回答控制在 500 字以内，结论清楚，必要时提醒用户复核数字。',
    },
    {
      role: 'user',
      content: [
        '这是用户保存在当前设备的家庭财务地图：',
        compactPlanContext(plan, metrics),
        recent ? `最近对话：\n${recent}` : '',
        `用户这次的问题：${String(question || '').trim()}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

export async function callConfiguredModel(settings, { question, plan, metrics, recentMessages = [] }) {
  const config = getProviderConfig(settings);
  if (!config.apiKey) {
    throw new Error(`请先在模型设置中填写 ${config.name} 的 API Key。`);
  }
  if (!config.endpoint || !config.model) {
    throw new Error('请先补全模型接口地址和模型名称。');
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildModelMessages({ question, plan, metrics, recentMessages }),
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
    const message = data?.error?.message || data?.message || rawText || `${response.status} ${response.statusText}`;
    throw new Error(`模型调用失败：${message}`);
  }

  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
  if (!content.trim()) {
    throw new Error('模型没有返回可读内容，请稍后重试或检查模型名称。');
  }

  return {
    content: content.trim(),
    usage: data?.usage || null,
    provider: config.name,
    model: config.model,
  };
}

export async function callManagedModel({ question, plan, metrics, recentMessages = [] }) {
  const response = await fetch(MANAGED_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messages: buildModelMessages({ question, plan, metrics, recentMessages }),
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
    const message = data?.message || rawText || `${response.status} ${response.statusText}`;
    throw new Error(`AI 服务调用失败：${message}`);
  }

  const content = data?.content || '';
  if (!content.trim()) {
    throw new Error('AI 服务没有返回可读内容，请稍后重试。');
  }

  return {
    content: content.trim(),
    usage: data?.usage || null,
    provider: 'DeepSeek',
    model: 'deepseek-chat',
  };
}
