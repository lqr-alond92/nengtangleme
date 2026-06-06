import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callConfiguredModel,
  getProviderConfig,
  hasModelKey,
  maskApiKey,
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
  gap: 280000,
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
