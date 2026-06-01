import { toNumber } from './finance.mjs';

function makeId(prefix, name) {
  const safeName = String(name || 'goal')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '');
  return `${prefix}-${safeName || 'goal'}-${Date.now()}`;
}

export function buildSupplementGoal(input) {
  const kind = input.kind === 'recurring' ? 'recurring' : 'oneTime';
  const priority = input.priority === 'need' ? 'need' : 'want';
  const amount = toNumber(input.amountWan) * 10000;
  const base = {
    id: input.id || makeId('supplement', input.name),
    name: String(input.name || '新的目标').trim() || '新的目标',
    priority,
    kind,
    amount,
    note: String(input.note || '').trim(),
  };

  if (kind === 'recurring') {
    const startYear = Math.max(0, toNumber(input.startYear));
    const endYear = Math.max(startYear, toNumber(input.endYear));
    return {
      ...base,
      frequency: input.frequency === 'yearly' ? 'yearly' : 'monthly',
      startYear,
      endYear,
    };
  }

  return {
    ...base,
    year: Math.max(0, toNumber(input.year)),
  };
}

export function applyPlanSupplement(plan, supplement) {
  if (supplement.type === 'assets') {
    const liquidAssets =
      supplement.liquidAssets === undefined ? toNumber(plan.liquidAssets) : Math.max(0, toNumber(supplement.liquidAssets));
    const lockedAssets =
      supplement.lockedAssets === undefined ? toNumber(plan.lockedAssets) : Math.max(0, toNumber(supplement.lockedAssets));
    const liabilities =
      supplement.liabilities === undefined ? toNumber(plan.liabilities) : Math.max(0, toNumber(supplement.liabilities));

    return {
      ...plan,
      liquidAssets,
      lockedAssets,
      assets: liquidAssets + lockedAssets,
      liabilities,
    };
  }

  if (supplement.type === 'goal') {
    return {
      ...plan,
      goals: [...(Array.isArray(plan.goals) ? plan.goals : []), buildSupplementGoal(supplement.goal || {})],
    };
  }

  return plan;
}
