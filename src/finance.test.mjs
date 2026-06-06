import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAiReport,
  buildMetrics,
  oneTimeGoalPresentValue,
  recurringGoalPresentValue,
} from './finance.mjs';

test('discounts one-time future goals by discount rate', () => {
  const presentValue = oneTimeGoalPresentValue(
    {
      amount: 3000000,
      year: 5,
    },
    {
      discountRate: 3,
    },
  );

  assert.equal(Math.round(presentValue), 2587826);
});

test('discounts recurring monthly goals after annualizing the spend', () => {
  const presentValue = recurringGoalPresentValue(
    {
      frequency: 'monthly',
      amount: 10000,
      startYear: 1,
      endYear: 2,
    },
    {
      inflationRate: 3,
      discountRate: 3,
    },
  );

  assert.equal(Math.round(presentValue), 240000);
});

test('builds asset-aware ratio evidence cards for the rational layer', () => {
  const plan = {
    assets: 1000000,
    liabilities: 200000,
    annualIncome: 500000,
    annualExpense: 200000,
    incomeGrowthRate: 0,
    expenseGrowthRate: 0,
    workYears: 20,
    returnRate: 4,
    inflationRate: 3,
    discountRate: 3,
    goals: [
      {
        id: 'retirement',
        name: '退休生活',
        kind: 'oneTime',
        priority: 'need',
        amount: 6000000,
        year: 20,
      },
    ],
  };

  const metrics = buildMetrics(plan);
  const report = buildAiReport(plan, metrics);

  assert.equal(report.ratios.length, 8);
  assert.deepEqual(
    report.ratios.map((ratio) => ratio.name),
    ['可调用覆盖率', '账面覆盖率', '可动用资产占比', '不易变现资产占比', '净资产率', '资产负债率', '年度结余率', '未来收入依赖度'],
  );
  assert.equal(report.ratios.at(-1).status, 'danger');
});

test('separates book resources from callable resources', () => {
  const plan = {
    liquidAssets: 300000,
    lockedAssets: 2700000,
    liabilities: 500000,
    annualIncome: 300000,
    annualExpense: 300000,
    incomeGrowthRate: 0,
    expenseGrowthRate: 0,
    workYears: 10,
    returnRate: 4,
    inflationRate: 3,
    discountRate: 3,
    goals: [
      {
        id: 'retirement',
        name: '退休生活',
        kind: 'oneTime',
        priority: 'need',
        amount: 1000000,
        year: 0,
      },
    ],
  };

  const metrics = buildMetrics(plan);

  assert.equal(metrics.assets, 3000000);
  assert.equal(metrics.netWorth, 2500000);
  assert.equal(metrics.bookResourcesPv, 2500000);
  assert.equal(metrics.callableResourcesPv, 300000);
  assert.equal(metrics.bookCoverage, 2.5);
  assert.equal(metrics.callableCoverage, 0.3);
  assert.equal(metrics.lockedAssetRatio, 0.9);
});

test('ai report flags asset lock risk when book coverage hides low callable coverage', () => {
  const plan = {
    liquidAssets: 300000,
    lockedAssets: 2700000,
    liabilities: 500000,
    annualIncome: 300000,
    annualExpense: 300000,
    incomeGrowthRate: 0,
    expenseGrowthRate: 0,
    workYears: 10,
    returnRate: 4,
    inflationRate: 3,
    discountRate: 3,
    goals: [
      {
        id: 'retirement',
        name: '退休生活',
        kind: 'oneTime',
        priority: 'need',
        amount: 1000000,
        year: 0,
      },
    ],
  };

  const metrics = buildMetrics(plan);
  const report = buildAiReport(plan, metrics);

  assert.match(report.headline, /不是没资产|不能直接/);
  assert.equal(report.risks[0].title, '资产锁定风险');
  assert.deepEqual(
    report.ratios.slice(0, 4).map((ratio) => ratio.name),
    ['可调用覆盖率', '账面覆盖率', '可动用资产占比', '不易变现资产占比'],
  );
});

test('ai report builds six-part judgement content for the planning page', () => {
  const plan = {
    liquidAssets: 220000,
    lockedAssets: 980000,
    liabilities: 350000,
    annualIncome: 420000,
    annualExpense: 240000,
    incomeGrowthRate: 0,
    expenseGrowthRate: 0,
    workYears: 20,
    returnRate: 4,
    inflationRate: 3,
    discountRate: 3,
    goals: [
      {
        id: 'education',
        name: '孩子教育',
        kind: 'oneTime',
        priority: 'need',
        amount: 800000,
        year: 12,
      },
      {
        id: 'home-upgrade',
        name: '换房',
        kind: 'oneTime',
        priority: 'want',
        amount: 1000000,
        year: 8,
      },
    ],
  };

  const metrics = buildMetrics(plan);
  const report = buildAiReport(plan, metrics);

  assert.match(report.judgement.leadIn, /工作强度/);
  assert.equal(report.judgement.keyMetrics.length, 4);
  assert.equal(report.judgement.longTermAdvice.target, metrics.maxGoal.name);
  assert.equal(report.judgement.shortTermPlan.length, 4);
  assert.deepEqual(
    report.judgement.shortTermPlan.map((item) => item.label),
    ['月收入目标', '月支出上限', '月结余目标', '复盘节奏'],
  );
});
