import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAnalysisInput,
  callConfiguredModel,
  callManagedAnalysis,
  callManagedModel,
  getProviderConfig,
  hasModelKey,
  MANAGED_AI_ENDPOINT,
  maskApiKey,
  parseAnalysisContent,
  normalizeModelSettings,
} from './modelClient.mjs';

const plan = {
  liquidAssets: 200000,
  lockedAssets: 800000,
  assets: 1000000,
  liabilities: 300000,
  annualIncome: 400000,
  annualExpense: 260000,
  incomeGrowthRate: 0,
  expenseGrowthRate: 0,
  workYears: 20,
  returnRate: 4,
  inflationRate: 3,
  discountRate: 3,
  goals: [],
};

const metrics = {
  liquidAssets: 200000,
  lockedAssets: 800000,
  assets: 1000000,
  annualSurplus: 140000,
  callableCoverage: 0.72,
  bookCoverage: 1.1,
  totalTargetPv: 1200000,
  needTargetPv: 800000,
  wantTargetPv: 400000,
  gap: 280000,
  netWorth: 700000,
  surplusPv: 1000000,
  liquidAssetRatio: 0.2,
  surplusRate: 0.35,
  goals: [],
};

test('model settings keep provider-specific API keys locally', () => {
  const settings = normalizeModelSettings({
    provider: 'deepseek',
    apiKeys: {
      qwen: 'sk-qwen',
      deepseek: 'sk-deepseek',
    },
  });

  assert.equal(getProviderConfig(settings).name, 'DeepSeek');
  assert.equal(getProviderConfig(settings).apiKey, 'sk-deepseek');
  assert.equal(hasModelKey(settings), true);
  assert.equal(maskApiKey('1234567890abcdef'), '1234****cdef');
});

test('callConfiguredModel sends OpenAI-compatible chat completion payload', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;

  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: '我能读取规划摘要。先复核可调用资产。' } }],
        usage: { total_tokens: 24 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const result = await callConfiguredModel(
      {
        provider: 'qwen',
        apiKeys: { qwen: 'sk-local-only' },
      },
      {
        question: '我该先看什么？',
        plan,
        metrics,
      },
    );

    const body = JSON.parse(captured.options.body);
    assert.equal(captured.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    assert.equal(captured.options.headers.authorization, 'Bearer sk-local-only');
    assert.equal(body.model, 'qwen-plus');
    assert.equal(body.messages[0].role, 'system');
    assert.match(body.messages[1].content, /我该先看什么/);
    assert.equal(result.content, '我能读取规划摘要。先复核可调用资产。');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('callManagedModel sends compact messages to the CloudBase proxy', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;

  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ content: '托管 AI 服务已连接。', provider: 'DeepSeek', model: 'deepseek-chat' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const result = await callManagedModel({
      question: '我该先看什么？',
      plan,
      metrics,
    });

    const body = JSON.parse(captured.options.body);
    assert.equal(captured.url, MANAGED_AI_ENDPOINT);
    assert.equal(captured.options.headers['content-type'], 'application/json');
    assert.equal(body.messages[0].role, 'system');
    assert.match(body.messages[1].content, /我该先看什么/);
    assert.equal(result.content, '托管 AI 服务已连接。');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildAnalysisInput reconstructs available asset present value', () => {
  const input = buildAnalysisInput(plan, metrics);

  assert.equal(input.assets.liquidAssets, 200000);
  assert.equal(input.assets.fixedAssets, 800000);
  assert.equal(input.liabilities.totalLiabilities, 300000);
  assert.equal(input.cashflow.expectedWorkYears, 20);
  assert.equal(input.computed.reconstructedAvailableAssetsPv, input.assets.liquidAssets + input.computed.futureSurplusPv);
  assert.equal(input.computed.planningPoolPv, input.computed.reconstructedAvailableAssetsPv);
  assert.equal(
    input.computed.debtAdjustedAvailableAssetsPv,
    input.computed.planningPoolPv - input.liabilities.totalLiabilities,
  );
  assert.equal(input.computed.totalGoalPv, 1200000);
  assert.equal(input.computed.gapOrSurplusPv, input.computed.debtAdjustedAvailableAssetsPv - input.computed.totalGoalPv);
});

test('parseAnalysisContent accepts fenced JSON', () => {
  const parsed = parseAnalysisContent('```json\n{"headline":"目标可支撑","followUpQuestions":["怎么调？"]}\n```');

  assert.equal(parsed.headline, '目标可支撑');
  assert.equal(parsed.followUpQuestions[0], '怎么调？');
});

test('callManagedAnalysis sends analysis input and returns structured result', async () => {
  const originalFetch = globalThis.fetch;
  let captured = null;

  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        analysis: {
          headline: '当前赚钱能力能覆盖必要目标，但长期余量偏薄。',
          coreConclusion: {
            incomeSupport: '未来结余现值可支撑必要目标。',
            longTermRisk: '长期规划依赖持续收入。',
          },
          followUpQuestions: ['如果收入下降怎么办？'],
        },
        provider: 'DeepSeek',
        model: 'deepseek-chat',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  try {
    const result = await callManagedAnalysis({ plan, metrics });

    const body = JSON.parse(captured.options.body);
    assert.equal(captured.url, MANAGED_AI_ENDPOINT);
    assert.equal(body.type, 'analysis');
    assert.equal(body.analysisInput.assets.liquidAssets, 200000);
    assert.equal(body.analysisInput.computed.totalGoalPv, 1200000);
    assert.equal(result.analysis.headline, '当前赚钱能力能覆盖必要目标，但长期余量偏薄。');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
