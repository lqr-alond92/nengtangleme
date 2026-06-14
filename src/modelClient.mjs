import { money, percent, toNumber } from './finance.mjs';

export const MODEL_SETTINGS_STORAGE_KEY = 'neng_tang_model_settings_v1';
export const MANAGED_AI_ENDPOINT =
  'https://nengtang-alpha-d8g6yxni2141b54ca-1440747224.ap-shanghai.app.tcloudbase.com/api/ai-chat';
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

function presentValueSeries(baseValue, years, growthRate, discountRate) {
  const safeYears = Math.max(0, Math.floor(toNumber(years)));
  const growth = toNumber(growthRate) / 100;
  const discount = toNumber(discountRate) / 100;

  return Array.from({ length: safeYears }, (_, index) => {
    const year = index + 1;
    const value = toNumber(baseValue) * Math.pow(1 + growth, year - 1);
    return value / Math.pow(1 + discount, year);
  }).reduce((sum, value) => sum + value, 0);
}

function normalizeGoalForAnalysis(goal) {
  if (goal.kind === 'recurring') {
    return {
      type: 'recurring',
      name: goal.name || '持续目标',
      amount: toNumber(goal.amount),
      frequency: goal.frequency || 'annual',
      startYear: toNumber(goal.startYear),
      endYear: toNumber(goal.endYear),
      priority: goal.priority === 'need' ? 'need' : 'want',
      presentValue: toNumber(goal.presentValue),
    };
  }

  return {
    type: 'oneTime',
    name: goal.name || '一次性目标',
    amount: toNumber(goal.amount),
    targetYear: toNumber(goal.year),
    priority: goal.priority === 'need' ? 'need' : 'want',
    presentValue: toNumber(goal.presentValue),
  };
}

export function buildAnalysisInput(plan, metrics) {
  const futureIncomePv = presentValueSeries(
    plan.annualIncome,
    plan.workYears,
    plan.incomeGrowthRate,
    plan.discountRate,
  );
  const futureExpensePv = presentValueSeries(
    plan.annualExpense,
    plan.workYears,
    plan.expenseGrowthRate,
    plan.discountRate,
  );
  const futureSurplusPv = futureIncomePv - futureExpensePv;
  const reconstructedAvailableAssetsPv = toNumber(metrics.liquidAssets) + futureSurplusPv;
  const debtAdjustedAvailableAssetsPv = reconstructedAvailableAssetsPv - toNumber(plan.liabilities);

  return {
    profile: {
      planningScope: plan.planningScope || 'unknown',
      familyResponsibilities: Array.isArray(plan.familyResponsibilities) ? plan.familyResponsibilities : [],
      cityTier: plan.cityTier || 'unknown',
    },
    assets: {
      liquidAssets: toNumber(metrics.liquidAssets),
      fixedAssets: toNumber(metrics.lockedAssets),
      totalAssets: toNumber(metrics.assets),
    },
    liabilities: {
      totalLiabilities: toNumber(plan.liabilities),
    },
    cashflow: {
      annualIncome: toNumber(plan.annualIncome),
      annualExpense: toNumber(plan.annualExpense),
      annualSurplus: toNumber(metrics.annualSurplus),
      expectedWorkYears: toNumber(plan.workYears),
    },
    assumptions: {
      discountRate: toNumber(plan.discountRate) / 100,
      incomeGrowthRate: toNumber(plan.incomeGrowthRate) / 100,
      expenseGrowthRate: toNumber(plan.expenseGrowthRate) / 100,
      inflationRate: toNumber(plan.inflationRate) / 100,
      returnRate: toNumber(plan.returnRate) / 100,
    },
    goals: (metrics.goals || []).map(normalizeGoalForAnalysis),
    computed: {
      netWorth: toNumber(metrics.netWorth),
      annualSurplus: toNumber(metrics.annualSurplus),
      liquidAssetRatio: toNumber(metrics.liquidAssetRatio),
      debtRatio: metrics.assets > 0 ? toNumber(plan.liabilities) / toNumber(metrics.assets) : 0,
      annualSurplusRate: toNumber(metrics.surplusRate),
      futureIncomePv,
      futureExpensePv,
      futureSurplusPv,
      goalNeedPv: toNumber(metrics.needTargetPv),
      goalWantPv: toNumber(metrics.wantTargetPv),
      totalGoalPv: toNumber(metrics.totalTargetPv),
      planningPoolPv: reconstructedAvailableAssetsPv,
      reconstructedAvailableAssetsPv,
      debtAdjustedAvailableAssetsPv,
      gapOrSurplusPv: debtAdjustedAvailableAssetsPv - toNumber(metrics.totalTargetPv),
    },
  };
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
        [
          '你是「能躺了吗」里的家庭财务规划 AI，负责回答用户在结果页后的继续追问。',
          '请基于用户当前设备里的家庭财务地图回答，不要编造投资收益，不要给具体证券买卖建议，不要要求用户上传身份证、银行卡或完整隐私信息。',
          '',
          '输出要求：只返回合法 JSON，不要 Markdown，不要代码块，不要 **加粗**，不要编号长列表。',
          'JSON 结构必须是：',
          '{',
          '  "headline": "一句话回答用户这次问题，18 个中文以内",',
          '  "summary": "用 1-2 句话解释判断，必须引用关键数字，80 个中文以内",',
          '  "cards": [',
          '    { "title": "短标题", "body": "具体判断或建议，60 个中文以内" }',
          '  ],',
          '  "nextQuestions": ["用户可能会继续这样问，必须是第一人称用户口吻"]',
          '}',
          '',
          '字段约束：',
          '- cards 最多 3 张。',
          '- nextQuestions 最多 3 个。',
          '- nextQuestions 必须像用户自己在提问，优先使用“我/我的/如果我/我应该/我能不能”，不要写成“你是否/你希望/请补充/是否考虑”等系统询问用户的口吻。',
          '- 每张卡片只讲一个点。',
          '- 如果用户问“怎么做”，卡片要落到月度或周度动作。',
          '- 如果用户问“能不能覆盖”，卡片要说明差额、余量或优先级。',
          '- 如果数据不足，就说明还缺哪一个关键数字，不要硬算。',
          '- 用普通人能听懂的话，不要使用“净现值”“折现法”，统一说“未来收入的今天价值”。',
        ].join('\n'),
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

export function parseAnalysisContent(content) {
  const text = String(content || '').trim();
  if (!text) return null;

  const jsonFence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = jsonFence ? jsonFence[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
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

export async function callManagedAnalysis({ plan, metrics }) {
  const response = await fetch(MANAGED_AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type: 'analysis',
      analysisInput: buildAnalysisInput(plan, metrics),
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
    throw new Error(`AI 分析调用失败：${message}`);
  }

  const analysis = data?.analysis || parseAnalysisContent(data?.content);
  if (!analysis || typeof analysis !== 'object') {
    throw new Error('AI 分析没有返回可展示的结构化内容。');
  }

  return {
    analysis,
    rawContent: data?.content || '',
    usage: data?.usage || null,
    provider: 'DeepSeek',
    model: 'deepseek-chat',
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
