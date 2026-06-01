import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPlanSupplement, buildSupplementGoal } from './supplement.mjs';

test('asset supplement updates liquid and locked assets then recomputes total assets', () => {
  const nextPlan = applyPlanSupplement(
    {
      liquidAssets: 200000,
      lockedAssets: 1000000,
      assets: 1200000,
      liabilities: 300000,
      goals: [],
    },
    {
      type: 'assets',
      liquidAssets: 350000,
      lockedAssets: 900000,
      liabilities: 250000,
    },
  );

  assert.equal(nextPlan.liquidAssets, 350000);
  assert.equal(nextPlan.lockedAssets, 900000);
  assert.equal(nextPlan.assets, 1250000);
  assert.equal(nextPlan.liabilities, 250000);
});

test('goal supplement builds a normalized one-time goal', () => {
  const goal = buildSupplementGoal({
    name: '换车',
    priority: 'want',
    kind: 'oneTime',
    amountWan: 30,
    year: 3,
  });

  assert.equal(goal.name, '换车');
  assert.equal(goal.priority, 'want');
  assert.equal(goal.kind, 'oneTime');
  assert.equal(goal.amount, 300000);
  assert.equal(goal.year, 3);
});

test('goal supplement appends recurring goal to the plan', () => {
  const nextPlan = applyPlanSupplement(
    {
      liquidAssets: 200000,
      lockedAssets: 1000000,
      assets: 1200000,
      liabilities: 300000,
      goals: [{ id: 'existing', name: '已有目标' }],
    },
    {
      type: 'goal',
      goal: {
        name: '长期旅行',
        priority: 'want',
        kind: 'recurring',
        frequency: 'yearly',
        amountWan: 8,
        startYear: 5,
        endYear: 12,
      },
    },
  );

  assert.equal(nextPlan.goals.length, 2);
  assert.equal(nextPlan.goals[1].name, '长期旅行');
  assert.equal(nextPlan.goals[1].amount, 80000);
  assert.equal(nextPlan.goals[1].startYear, 5);
  assert.equal(nextPlan.goals[1].endYear, 12);
});
