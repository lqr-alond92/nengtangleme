export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decimal(percent) {
  return toNumber(percent) / 100;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function money(value, digits = 0) {
  const amount = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(amount);
  if (abs >= 100000000) return `${(amount / 100000000).toFixed(2)}亿`;
  if (abs >= 10000) {
    const wan = amount / 10000;
    const precision = digits || (Math.abs(wan) < 10 && !Number.isInteger(wan) ? 1 : 0);
    return `${wan.toFixed(precision).replace(/\.0$/, '')}万`;
  }
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

export function percent(value, digits = 0) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${(normalized * 100).toFixed(digits)}%`;
}

export function assetBreakdown(plan) {
  const hasLiquidAssets = Object.prototype.hasOwnProperty.call(plan, 'liquidAssets');
  const hasLockedAssets = Object.prototype.hasOwnProperty.call(plan, 'lockedAssets');
  const fallbackAssets = Math.max(0, toNumber(plan.assets));
  const liquidAssets = Math.max(0, toNumber(plan.liquidAssets));
  const lockedAssets = hasLiquidAssets || hasLockedAssets ? Math.max(0, toNumber(plan.lockedAssets)) : fallbackAssets;
  const assets = hasLiquidAssets || hasLockedAssets ? liquidAssets + lockedAssets : fallbackAssets;

  return {
    assets,
    liquidAssets,
    lockedAssets,
  };
}

export function annualSurplusAtYear(plan, year) {
  const income = plan.annualIncome * Math.pow(1 + decimal(plan.incomeGrowthRate), year - 1);
  const expense = plan.annualExpense * Math.pow(1 + decimal(plan.expenseGrowthRate), year - 1);
  return income - expense;
}

export function futureSurplusPresentValue(plan) {
  const years = Math.max(0, Math.floor(toNumber(plan.workYears)));
  const discount = decimal(plan.discountRate);

  return Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    return annualSurplusAtYear(plan, year) / Math.pow(1 + discount, year);
  }).reduce((sum, value) => sum + value, 0);
}

export function oneTimeGoalPresentValue(goal, plan) {
  const year = Math.max(0, toNumber(goal.year));
  return toNumber(goal.amount) / Math.pow(1 + decimal(plan.discountRate), year);
}

export function recurringGoalPresentValue(goal, plan) {
  const start = Math.max(1, Math.floor(toNumber(goal.startYear)));
  const end = Math.max(start, Math.floor(toNumber(goal.endYear)));
  const annualAmount = goal.frequency === 'monthly' ? toNumber(goal.amount) * 12 : toNumber(goal.amount);
  const inflation = decimal(plan.inflationRate);
  const discount = decimal(plan.discountRate);

  return Array.from({ length: end - start + 1 }, (_, index) => {
    const year = start + index;
    const inflated = annualAmount * Math.pow(1 + inflation, year);
    return inflated / Math.pow(1 + discount, year);
  }).reduce((sum, value) => sum + value, 0);
}

export function goalPresentValue(goal, plan) {
  return goal.kind === 'recurring' ? recurringGoalPresentValue(goal, plan) : oneTimeGoalPresentValue(goal, plan);
}

export function yearsToCover(plan, targetPv) {
  const { assets } = assetBreakdown(plan);
  const netWorth = assets - plan.liabilities;
  const discount = decimal(plan.discountRate);
  const maxYears = 80;
  let accumulatedPv = netWorth;

  if (targetPv <= netWorth) return 0;

  for (let year = 1; year <= maxYears; year += 1) {
    accumulatedPv += annualSurplusAtYear(plan, year) / Math.pow(1 + discount, year);
    if (accumulatedPv >= targetPv) return year;
  }

  return null;
}

export function buildMetrics(plan) {
  const { assets, liquidAssets, lockedAssets } = assetBreakdown(plan);
  const netWorth = assets - plan.liabilities;
  const annualSurplus = plan.annualIncome - plan.annualExpense;
  const surplusRate = plan.annualIncome > 0 ? annualSurplus / plan.annualIncome : 0;
  const surplusPv = futureSurplusPresentValue(plan);
  const bookResourcesPv = netWorth + surplusPv;
  const callableResourcesPv = liquidAssets + surplusPv;
  const resourcesPv = callableResourcesPv;

  const goals = plan.goals.map((goal) => ({
    ...goal,
    presentValue: goalPresentValue(goal, plan),
  }));

  const totalTargetPv = goals.reduce((sum, goal) => sum + goal.presentValue, 0);
  const needTargetPv = goals
    .filter((goal) => goal.priority === 'need')
    .reduce((sum, goal) => sum + goal.presentValue, 0);
  const wantTargetPv = Math.max(0, totalTargetPv - needTargetPv);
  const coverage = totalTargetPv > 0 ? resourcesPv / totalTargetPv : 1;
  const callableCoverage = coverage;
  const bookCoverage = totalTargetPv > 0 ? bookResourcesPv / totalTargetPv : 1;
  const netWorthCoverage = totalTargetPv > 0 ? netWorth / totalTargetPv : 1;
  const gap = Math.max(0, totalTargetPv - resourcesPv);
  const surplus = Math.max(0, resourcesPv - totalTargetPv);
  const maxGoal = goals.reduce((winner, goal) => (goal.presentValue > (winner?.presentValue || 0) ? goal : winner), null);
  const maxGoalShare = maxGoal && totalTargetPv > 0 ? maxGoal.presentValue / totalTargetPv : 0;
  const latestGoalYear = goals.reduce((latest, goal) => {
    const year = goal.kind === 'recurring' ? goal.endYear : goal.year;
    return Math.max(latest, toNumber(year));
  }, 0);
  const yearsNeeded = yearsToCover(plan, totalTargetPv);

  let verdict = {
    key: 'empty',
    title: '先写下目标',
    text: '先列目标，再看覆盖。',
    tone: 'neutral',
  };

  if (totalTargetPv > 0 && netWorth >= totalTargetPv) {
    verdict = {
      key: 'free',
      title: '已经能躺',
      text: '现有净资产已覆盖目标。',
      tone: 'good',
    };
  } else if (totalTargetPv > 0 && resourcesPv >= totalTargetPv) {
    verdict = {
      key: 'workable',
      title: '继续攒可躺',
      text: '未来积累后可覆盖目标。',
      tone: 'steady',
    };
  } else if (totalTargetPv > 0 && resourcesPv >= needTargetPv) {
    verdict = {
      key: 'partial',
      title: '半躺可行',
      text: '必要目标可覆盖，想要目标需取舍。',
      tone: 'warm',
    };
  } else if (totalTargetPv > 0) {
    verdict = {
      key: 'notYet',
      title: '还不能躺',
      text: '必要目标仍有缺口。',
      tone: 'risk',
    };
  }

  return {
    netWorth,
    assets,
    liquidAssets,
    lockedAssets,
    annualSurplus,
    surplusRate,
    surplusPv,
    bookResourcesPv,
    callableResourcesPv,
    resourcesPv,
    goals,
    totalTargetPv,
    needTargetPv,
    wantTargetPv,
    coverage,
    callableCoverage,
    bookCoverage,
    netWorthCoverage,
    liquidAssetRatio: assets > 0 ? liquidAssets / assets : 0,
    lockedAssetRatio: assets > 0 ? lockedAssets / assets : 0,
    gap,
    surplus,
    maxGoal,
    maxGoalShare,
    latestGoalYear,
    yearsNeeded,
    verdict,
  };
}

export function ratioStatus(value, goodTest, warningTest) {
  if (!Number.isFinite(value)) return 'danger';
  if (goodTest(value)) return 'good';
  if (warningTest(value)) return 'warning';
  return 'danger';
}

function buildJudgement(plan, metrics, aiReport) {
  const monthlyIncome = plan.annualIncome / 12;
  const monthlyExpense = plan.annualExpense / 12;
  const monthlySurplus = Math.max(0, metrics.annualSurplus) / 12;
  const maxGoalName = metrics.maxGoal?.name || '最大目标';
  const pressure = aiReport.risks[0];

  let verdict = '先把目标写清楚，再判断能不能躺。';
  let reason = '现在目标还不完整，系统只能看资产和现金流，不能判断家庭长期计划是否成立。';

  if (metrics.totalTargetPv > 0 && metrics.callableCoverage >= 1) {
    verdict = '可以继续朝“半躺”推进，但仍要复核可调用资产。';
    reason = `可调用资源已经覆盖目标需求的 ${percent(metrics.callableCoverage)}，现在最重要的是别让资产流动性和目标节奏失真。`;
  } else if (metrics.totalTargetPv > 0 && metrics.callableCoverage >= 0.7) {
    verdict = '可以继续朝“半躺”推进，但不建议现在直接停下长期收入。';
    reason = `方向没错，但可调用覆盖只有 ${percent(metrics.callableCoverage)}，计划还需要未来收入和目标调整一起托住。`;
  } else if (metrics.totalTargetPv > 0) {
    verdict = '现在还不能直接躺，先处理目标缺口和资产流动性。';
    reason = `可调用覆盖只有 ${percent(metrics.callableCoverage)}，如果立刻停下长期收入，必要目标会先被挤压。`;
  }

  const longTermAdvice =
    metrics.totalTargetPv <= 0
      ? {
          target: '先补齐目标',
          recommendation: '先添加 1 个必须目标和 1 个想要目标，再重新生成规划。',
          impact: '没有目标时，系统只能判断资源，不能判断你真正能不能躺。',
        }
      : metrics.callableCoverage >= 1
        ? {
            target: maxGoalName,
            recommendation: `保留「${maxGoalName}」当前版本，但每月复核一次可调用资产。`,
            impact: '覆盖率已经达标，重点不是砍目标，而是确认账面资源真的能在需要时调用。',
          }
        : {
            target: maxGoalName,
            recommendation: `先给「${maxGoalName}」做一版“延后 3 年 + 降低 20% 预算”的保守方案。`,
            impact: '先动最大压力目标，通常比同时削弱教育、养老和退休目标更稳。',
          };

  return {
    leadIn: '你问的不是账上有多少钱，而是这个家庭能不能把工作强度慢慢降下来。',
    verdict,
    reason,
    keyMetrics: [
      {
        label: '可调用覆盖',
        value: percent(metrics.callableCoverage),
        note: '不动长期资产时，真正能支撑目标的比例。',
      },
      {
        label: '账面覆盖',
        value: percent(metrics.bookCoverage),
        note: '把不易变现资产也算进去后的比例。',
      },
      {
        label: '目标缺口',
        value: metrics.gap > 0 ? money(metrics.gap) : '无缺口',
        note: metrics.gap > 0 ? '当前版本还需要补足的现值。' : '当前资源已覆盖目标现值。',
      },
      {
        label: '年度结余率',
        value: percent(metrics.surplusRate),
        note: '未来目标能否持续推进的燃料。',
      },
    ],
    pressure: {
      title: pressure.title,
      level: pressure.level,
      status: pressure.status,
      evidence: pressure.evidence,
      impact: pressure.impact,
      action: pressure.action,
    },
    longTermAdvice,
    shortTermPlan: [
      {
        label: '月收入目标',
        value: `不低于 ${money(monthlyIncome)}`,
        note: '先守住长期规划的收入前提。',
      },
      {
        label: '月支出上限',
        value: `控制在 ${money(monthlyExpense)} 以内`,
        note: '支出上限决定结余能不能稳定进入长期目标。',
      },
      {
        label: '月结余目标',
        value: `至少 ${money(monthlySurplus)} 进入长期规划`,
        note: '结余不足时，先调整短期执行数字，再重算长期目标。',
      },
      {
        label: '复盘节奏',
        value: '每周一次，每月底复盘',
        note: '周复盘看偏差，月复盘看长期进度是否变形。',
      },
    ],
  };
}

export function buildAiReport(plan, metrics) {
  if (metrics.totalTargetPv <= 0) {
    const emptyReport = {
      headline: '目标还没定义，AI 只能判断资源，不能判断人生计划。',
      analyzed: ['0 个目标', '8 个比率待计算', '资产口径待补充'],
      risks: [
        {
          title: '目标缺失',
          level: '危险',
          status: 'danger',
          evidence: '没有未来目标，无法形成覆盖率。',
          impact: '现在的结论只是在看账面资源，不是在判断能不能躺。',
          action: '先添加 1 个必要目标和 1 个想要目标。',
        },
        {
          title: '可调用资产待补充',
          level: '预警',
          status: 'warning',
          evidence: '当前没有可立即动用资产字段。',
          impact: '无法判断账面资产里有多少真正能拿来支撑目标。',
          action: '补充可立即动用资产和不易变现资产后，再判断资产锁定风险。',
        },
      ],
      ratios: [],
      actions: ['先添加 1 个必要目标和 1 个想要目标。', '把每个目标拆成金额、发生年份、一次性或持续性。', '补充可立即动用资产和不易变现资产。'],
    };

    return {
      ...emptyReport,
      judgement: buildJudgement(plan, metrics, emptyReport),
    };
  }

  const netWorthRatio = metrics.assets > 0 ? metrics.netWorth / metrics.assets : 0;
  const debtRatio = metrics.assets > 0 ? plan.liabilities / metrics.assets : 1;
  const futureIncomeDependency = metrics.resourcesPv > 0 ? metrics.surplusPv / metrics.resourcesPv : Infinity;

  const ratios = [
    {
      name: '可调用覆盖率',
      formula: '可调用资源 / 目标需求现值',
      calculation: `${money(metrics.callableResourcesPv)} / ${money(metrics.totalTargetPv)}`,
      value: percent(metrics.callableCoverage),
      benchmark: '>= 100% 达标，70%-100% 预警，< 70% 危险',
      status: ratioStatus(metrics.callableCoverage, (value) => value >= 1, (value) => value >= 0.7),
      plain: `不卖长期资产，真正能调用的资源能覆盖目标的 ${percent(metrics.callableCoverage)}。`,
    },
    {
      name: '账面覆盖率',
      formula: '账面资源 / 目标需求现值',
      calculation: `${money(metrics.bookResourcesPv)} / ${money(metrics.totalTargetPv)}`,
      value: percent(metrics.bookCoverage),
      benchmark: '>= 100% 达标，70%-100% 预警，< 70% 危险',
      status: ratioStatus(metrics.bookCoverage, (value) => value >= 1, (value) => value >= 0.7),
      plain: `把不易变现资产也算上，账面资源能覆盖目标的 ${percent(metrics.bookCoverage)}。`,
    },
    {
      name: '可动用资产占比',
      formula: '可立即动用资产 / 总资产',
      calculation: `${money(metrics.liquidAssets)} / ${money(metrics.assets)}`,
      value: percent(metrics.liquidAssetRatio),
      benchmark: '>= 30% 达标，10%-30% 预警，< 10% 危险',
      status: ratioStatus(metrics.liquidAssetRatio, (value) => value >= 0.3, (value) => value >= 0.1),
      plain: `家里每 100 元资产里，约 ${Math.round(metrics.liquidAssetRatio * 100)} 元能较快拿出来用。`,
    },
    {
      name: '不易变现资产占比',
      formula: '不易变现资产 / 总资产',
      calculation: `${money(metrics.lockedAssets)} / ${money(metrics.assets)}`,
      value: percent(metrics.lockedAssetRatio),
      benchmark: '<= 50% 达标，50%-80% 预警，> 80% 危险',
      status: ratioStatus(metrics.lockedAssetRatio, (value) => value <= 0.5, (value) => value <= 0.8),
      plain: `家里有 ${percent(metrics.lockedAssetRatio)} 的资产不太能直接拿来支付目标。`,
    },
    {
      name: '净资产率',
      formula: '(总资产 - 总负债) / 总资产',
      calculation: `(${money(metrics.assets)} - ${money(plan.liabilities)}) / ${money(metrics.assets)}`,
      value: percent(netWorthRatio),
      benchmark: '>= 50% 达标，20%-50% 预警，< 20% 危险',
      status: ratioStatus(netWorthRatio, (value) => value >= 0.5, (value) => value >= 0.2),
      plain: `家里真正属于你的钱占 ${percent(netWorthRatio)}，其余部分要么是负债，要么还没沉淀下来。`,
    },
    {
      name: '资产负债率',
      formula: '总负债 / 总资产',
      calculation: `${money(plan.liabilities)} / ${money(metrics.assets)}`,
      value: percent(debtRatio),
      benchmark: '<= 40% 达标，40%-60% 预警，> 60% 危险',
      status: ratioStatus(debtRatio, (value) => value <= 0.4, (value) => value <= 0.6),
      plain: `每 100 元资产里有 ${Math.round(debtRatio * 100)} 元是债，债务越高，家庭抗波动能力越薄。`,
    },
    {
      name: '年度结余率',
      formula: '(年收入 - 年支出) / 年收入',
      calculation: `(${money(plan.annualIncome)} - ${money(plan.annualExpense)}) / ${money(plan.annualIncome)}`,
      value: percent(metrics.surplusRate),
      benchmark: '>= 30% 达标，10%-30% 预警，< 10% 危险',
      status: ratioStatus(metrics.surplusRate, (value) => value >= 0.3, (value) => value >= 0.1),
      plain: `每赚 100 元能留下 ${Math.round(metrics.surplusRate * 100)} 元，这是未来目标的燃料。`,
    },
    {
      name: '未来收入依赖度',
      formula: '未来结余现值 / 可调用资源',
      calculation: `${money(metrics.surplusPv)} / ${money(metrics.resourcesPv)}`,
      value: Number.isFinite(futureIncomeDependency) ? percent(futureIncomeDependency) : '不可算',
      benchmark: '<= 40% 达标，40%-70% 预警，> 70% 危险',
      status: ratioStatus(futureIncomeDependency, (value) => value <= 0.4, (value) => value <= 0.7),
      plain: Number.isFinite(futureIncomeDependency)
        ? `这套方案有 ${percent(futureIncomeDependency)} 靠未来继续工作来兑现，收入一断，计划会明显变形。`
        : '可规划资源为负或接近零，未来收入不是加分项，而是在补坑。',
    },
  ];

  const riskCandidates = [
    {
      title: '资产锁定风险',
      score: metrics.bookCoverage >= 1 && metrics.callableCoverage < 0.7 ? 98 : metrics.lockedAssetRatio > 0.8 ? 86 : 0,
      evidence: `账面覆盖率 ${percent(metrics.bookCoverage)}，可调用覆盖率 ${percent(metrics.callableCoverage)}`,
      impact: '账面看起来有资产，但短中期目标真正能调用的钱明显不够。',
      action: '把资产拆成“30 天内能动用”和“不能轻易动”两张清单，先用可调用口径重算必要目标。',
    },
    {
      title: '隐形破产风险',
      score: metrics.netWorth < 0 ? 100 : debtRatio > 0.6 ? 80 : 0,
      evidence: metrics.netWorth < 0 ? `当前净负债 ${money(Math.abs(metrics.netWorth))}` : `资产负债率 ${percent(debtRatio)}`,
      impact: '资产下跌或收入中断时，家庭资产负债表会先被债务拖住。',
      action: '把负债按利率、月供、剩余本金列成表，优先处理利率最高且最挤压现金流的一项。',
    },
    {
      title: '目标资金缺口',
      score: metrics.coverage < 0.7 ? 95 : metrics.coverage < 1 ? 75 : 0,
      evidence: `目标覆盖率 ${percent(metrics.coverage)}，缺口 ${money(metrics.gap)}`,
      impact: '目标不是不能做，而是当前版本不能全部同时做。',
      action: `先重算「${metrics.maxGoal?.name || '最大目标'}」：做一个降低 20% 金额或延后 3 年的版本。`,
    },
    {
      title: '单点收入依赖',
      score: futureIncomeDependency > 0.7 ? 90 : futureIncomeDependency > 0.4 ? 65 : 0,
      evidence: Number.isFinite(futureIncomeDependency) ? `未来收入依赖度 ${percent(futureIncomeDependency)}` : '可规划资源为负，未来收入在补坑',
      impact: '这套计划高度依赖未来持续工作，收入一断，目标覆盖率会快速变形。',
      action: '把年收入拆成稳定收入、波动收入、一次性收入三类，长期规划只纳入稳定收入。',
    },
    {
      title: '现金流脆弱',
      score: metrics.surplusRate < 0.1 ? 85 : metrics.surplusRate < 0.3 ? 55 : 0,
      evidence: `年度结余率 ${percent(metrics.surplusRate)}`,
      impact: '每年留下来的钱太薄，任何一次大额支出都会打乱未来目标节奏。',
      action: '单独列出未来 12 个月确定性大额支出，把它们先从年度结余里扣掉再测算。',
    },
    {
      title: '最大目标挤压',
      score: metrics.maxGoalShare > 0.45 ? 70 : 0,
      evidence: `「${metrics.maxGoal?.name || '最大目标'}」占目标需求 ${percent(metrics.maxGoalShare)}`,
      impact: '一个目标吃掉过多资源，会让其他目标失去弹性。',
      action: '给最大目标做三档版本：保底、标准、理想，只把保底版放进必要目标。',
    },
  ];

  const risks = riskCandidates
    .sort((a, b) => b.score - a.score)
    .filter((risk) => risk.score > 0)
    .slice(0, 2)
    .map((risk) => ({
      ...risk,
      level: risk.score >= 85 ? '危险' : '预警',
      status: risk.score >= 85 ? 'danger' : 'warning',
    }));

  if (risks.length < 2) {
    risks.push({
      title: '可调用资产待复核',
      level: '待补充',
      status: 'warning',
      evidence: '可立即动用资产和不易变现资产需要定期复核',
      impact: '资产结构变化后，账面覆盖率和可调用覆盖率可能快速分化。',
      action: '每月或每季度更新一次可立即动用资产。',
    });
  }

  let headline =
    metrics.gap > 0
      ? `最危险的不是还差 ${money(metrics.gap)}，而是 ${risks[0].title}。`
      : `当前目标已覆盖，但最需要复核的是 ${risks[0].title}。`;

  if (metrics.bookCoverage >= 1 && metrics.callableCoverage < 0.7) {
    headline = '你不是没资产，而是大部分资产不能直接替目标付款。';
  } else if (metrics.bookCoverage < 0.7 && metrics.callableCoverage < 0.7) {
    headline = '现在不是少一个目标的问题，而是可调用资源和未来目标之间有硬缺口。';
  } else if (metrics.bookCoverage >= 1 && metrics.callableCoverage >= 1) {
    headline = '你的资源不仅账面够，真正能调用的钱也有余量。';
  }

  const report = {
    headline,
    analyzed: [`${metrics.goals.length} 个目标`, `${ratios.length} 个比率`, '2 套资源口径'],
    risks,
    ratios,
    actions: [
      '把资产拆成“30 天内能动用”和“不能轻易动”两张清单，只用前者重算必要目标。',
      `本周先重算「${metrics.maxGoal?.name || '最大目标'}」：做一版“不动长期资产”的保守方案。`,
      '把年收入拆成稳定收入、波动收入、一次性收入三类，长期规划优先只纳入稳定收入。',
    ],
  };

  return {
    ...report,
    judgement: buildJudgement(plan, metrics, report),
  };
}
