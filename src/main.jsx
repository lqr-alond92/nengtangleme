import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Calculator,
  Check,
  ChevronRight,
  Coins,
  Home,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Radar,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  annualSurplusAtYear,
  buildAiReport,
  buildMetrics,
  clamp,
  decimal,
  money,
  percent,
  toNumber,
} from './finance.mjs';
import { applyPlanSupplement } from './supplement.mjs';
import './styles.css';

const PLAN_STORAGE_KEY = 'neng_tang_plan_v1';
const ONBOARDING_STORAGE_KEY = 'neng_tang_onboarding_complete_v1';

const defaultPlan = {
  liquidAssets: 220000,
  lockedAssets: 980000,
  assets: 1200000,
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
      id: 'retirement',
      name: '基本退休生活',
      kind: 'recurring',
      priority: 'need',
      frequency: 'monthly',
      amount: 12000,
      startYear: 20,
      endYear: 50,
    },
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

const goalTemplate = {
  oneTime: {
    name: '',
    kind: 'oneTime',
    priority: 'need',
    amount: 300000,
    year: 5,
  },
  recurring: {
    name: '',
    kind: 'recurring',
    priority: 'need',
    frequency: 'monthly',
    amount: 10000,
    startYear: 20,
    endYear: 50,
  },
};

const requiredGoalPresets = [
  { id: 'basic-retirement', name: '基本退休生活', kind: 'recurring', frequency: 'monthly', amount: 12000, startYear: 20, endYear: 50 },
  { id: 'education', name: '孩子教育', kind: 'oneTime', amount: 800000, year: 12 },
  { id: 'parents', name: '父母养老', kind: 'recurring', frequency: 'yearly', amount: 60000, startYear: 5, endYear: 25 },
  { id: 'medical', name: '医疗风险', kind: 'oneTime', amount: 300000, year: 10 },
  { id: 'mortgage', name: '房贷 / 换房压力', kind: 'oneTime', amount: 1000000, year: 8 },
];

const optionalGoalPresets = [
  { id: 'early-retire', name: '提前退休', kind: 'recurring', frequency: 'monthly', amount: 18000, startYear: 15, endYear: 50 },
  { id: 'travel', name: '长期旅行', kind: 'recurring', frequency: 'yearly', amount: 80000, startYear: 5, endYear: 15 },
  { id: 'bigger-home', name: '换更大的房子', kind: 'oneTime', amount: 1500000, year: 8 },
  { id: 'car', name: '买车', kind: 'oneTime', amount: 250000, year: 3 },
  { id: 'freelance', name: '创业 / 自由职业', kind: 'oneTime', amount: 500000, year: 4 },
];

function loadPlan() {
  try {
    const stored = localStorage.getItem(PLAN_STORAGE_KEY);
    return stored ? normalizePlan(JSON.parse(stored)) : normalizePlan(defaultPlan);
  } catch {
    return normalizePlan(defaultPlan);
  }
}

function loadOnboardingState() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}

function normalizePlan(plan) {
  const hasLiquidAssets = Object.prototype.hasOwnProperty.call(plan, 'liquidAssets');
  const hasLockedAssets = Object.prototype.hasOwnProperty.call(plan, 'lockedAssets');
  const fallbackAssets = toNumber(plan.assets ?? defaultPlan.assets);
  const liquidAssets = hasLiquidAssets ? toNumber(plan.liquidAssets) : 0;
  const lockedAssets = hasLockedAssets ? toNumber(plan.lockedAssets) : Math.max(0, fallbackAssets - liquidAssets);
  const assets = liquidAssets + lockedAssets;

  return {
    ...defaultPlan,
    ...plan,
    liquidAssets,
    lockedAssets,
    assets,
    liabilities: toNumber(plan.liabilities),
    annualIncome: toNumber(plan.annualIncome),
    annualExpense: toNumber(plan.annualExpense),
    goals: Array.isArray(plan.goals) ? plan.goals.map(normalizeGoal) : defaultPlan.goals,
  };
}

function normalizeGoal(goal) {
  const fallback = goal.kind === 'recurring' ? goalTemplate.recurring : goalTemplate.oneTime;
  return {
    ...fallback,
    ...goal,
    id: goal.id || crypto.randomUUID(),
    kind: goal.kind === 'recurring' ? 'recurring' : 'oneTime',
  };
}

function freshGoal(kind) {
  return {
    ...goalTemplate[kind],
  };
}

function cleanNumericInput(value) {
  const raw = String(value).replace(/[^\d.]/g, '');
  const [integerPart = '', ...decimalParts] = raw.split('.');
  const integer = integerPart.replace(/^0+(?=\d)/, '') || '0';
  const decimal = decimalParts.join('');

  if (!raw) return '';
  if (raw.startsWith('.')) return `0.${decimal}`;
  return decimalParts.length > 0 ? `${integer}.${decimal}` : integer;
}

function formatNumberInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(4)));
}

function onboardingInputConfig(step) {
  return {
    liquidAssets: {
      title: '请填写可立即动用资产',
      helper: '先不看房子这些大件，只填短期真正能拿出来用的钱。',
      unit: '万元',
      placeholder: '例如 22',
      quickValues: ['10', '30', '80'],
      label: '可立即动用约 ',
    },
    lockedAssets: {
      title: '请填写不易变现资产',
      helper: '房子、车、长期资产等账面上有、但不太能直接花的钱。',
      unit: '万元',
      placeholder: '例如 98',
      quickValues: ['50', '150', '500'],
      label: '不易变现约 ',
    },
    liabilities: {
      title: '请填写你的总负债',
      helper: '房贷、车贷、信用贷、消费贷都算进去。',
      unit: '万元',
      placeholder: '例如 35',
      quickValues: ['0', '50', '150'],
      label: '负债约 ',
    },
    annualIncome: {
      title: '请填写家庭年收入',
      helper: '按税后口径估算，包括工资、经营收入和稳定副业。',
      unit: '万元/年',
      placeholder: '例如 42',
      quickValues: ['20', '40', '80'],
      label: '年收入约 ',
    },
    annualSurplus: {
      title: '请填写年度可规划结余',
      helper: '一年结束后，真正能放进长期规划的钱。',
      unit: '万元/年',
      placeholder: '例如 18',
      quickValues: ['10', '20', '35'],
      label: '年度结余约 ',
    },
    annualExpense: {
      title: '请填写年度总支出',
      helper: '日常生活、房贷房租、孩子、父母、保险和固定支出都算进去。',
      unit: '万元/年',
      placeholder: '例如 24',
      quickValues: ['15', '25', '40'],
      label: '年度支出约 ',
    },
  }[step];
}

function App() {
  const [plan, setPlan] = useState(loadPlan);
  const [activeTab, setActiveTab] = useState('planning');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(loadOnboardingState);
  const [isSupplementing, setIsSupplementing] = useState(false);
  const [draftKind, setDraftKind] = useState('oneTime');
  const [draftGoal, setDraftGoal] = useState(() => freshGoal('oneTime'));
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const metrics = useMemo(() => buildMetrics(plan), [plan]);

  function completeOnboarding(nextPlan) {
    const normalized = normalizePlan(nextPlan);
    setPlan(normalized);
    setHasCompletedOnboarding(true);
    setActiveTab('planning');
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }

  function startSupplement() {
    setActiveTab('planning');
    setIsSupplementing(true);
  }

  function completeSupplement(nextPlan) {
    const normalized = normalizePlan(nextPlan);
    setPlan(normalized);
    setIsSupplementing(false);
    setActiveTab('planning');
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized));
  }

  function restartOnboarding() {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(false);
  }

  function updatePlan(field, value) {
    setPlan((current) => normalizePlan({ ...current, [field]: toNumber(value) }));
  }

  function updateGoal(id, field, value) {
    setPlan((current) => ({
      ...current,
      goals: current.goals.map((goal) => (goal.id === id ? normalizeGoal({ ...goal, [field]: value }) : goal)),
    }));
  }

  function removeGoal(id) {
    const goal = plan.goals.find((item) => item.id === id);
    if (goal && !window.confirm(`确定删除「${goal.name}」吗？`)) return;
    setPlan((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== id) }));
  }

  function switchDraftKind(kind) {
    setDraftKind(kind);
    setDraftGoal(freshGoal(kind));
  }

  function submitGoal(event) {
    event.preventDefault();
    const normalized = normalizeGoal(draftGoal);
    if (!normalized.name.trim()) return;
    setPlan((current) => ({
      ...current,
      goals: [...current.goals, { ...normalized, id: crypto.randomUUID(), name: normalized.name.trim() }],
    }));
    setDraftGoal(freshGoal(draftKind));
    setIsGoalFormOpen(false);
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingExperience onComplete={completeOnboarding} />;
  }

  if (isSupplementing) {
    return <SupplementExperience onCancel={() => setIsSupplementing(false)} onComplete={completeSupplement} plan={plan} />;
  }

  return (
    <div className="app-shell">
      <main className="app-frame">
        {activeTab === 'asset' && <AssetPage metrics={metrics} plan={plan} updatePlan={updatePlan} />}
        {activeTab === 'planning' && (
          <PlanningPage
            metrics={metrics}
            plan={plan}
            restartOnboarding={restartOnboarding}
            setActiveTab={setActiveTab}
            startSupplement={startSupplement}
          />
        )}
        {activeTab === 'goal' && (
          <GoalPage
            draftGoal={draftGoal}
            draftKind={draftKind}
            isGoalFormOpen={isGoalFormOpen}
            metrics={metrics}
            plan={plan}
            removeGoal={removeGoal}
            setDraftGoal={setDraftGoal}
            setIsGoalFormOpen={setIsGoalFormOpen}
            submitGoal={submitGoal}
            switchDraftKind={switchDraftKind}
            updateGoal={updateGoal}
            updatePlan={updatePlan}
          />
        )}
        {activeTab === 'planning' && <AiDock onClick={startSupplement} />}
        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </main>
    </div>
  );
}

function OnboardingExperience({ onComplete }) {
  const [stage, setStage] = useState('landing');
  const [landingPhase, setLandingPhase] = useState(0);
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [draftPlan, setDraftPlan] = useState({ ...defaultPlan, goals: [] });
  const [selectedRequired, setSelectedRequired] = useState([]);
  const [selectedOptional, setSelectedOptional] = useState([]);
  const [goalQueue, setGoalQueue] = useState([]);
  const [goalCursor, setGoalCursor] = useState(0);
  const [goalField, setGoalField] = useState('moneyProfile');
  const [goalForm, setGoalForm] = useState({ frequency: 'once', amount: '', startYear: '', endYear: '', note: '' });
  const [collectedGoals, setCollectedGoals] = useState([]);
  const feedRef = useRef(null);

  useEffect(() => {
    if (stage !== 'landing') return undefined;
    const timers = [
      window.setTimeout(() => setLandingPhase(1), 500),
      window.setTimeout(() => setLandingPhase(2), 1250),
      window.setTimeout(() => setLandingPhase(3), 2050),
      window.setTimeout(() => setLandingPhase(4), 2850),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [stage]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  function pushMessage(role, text) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  function ask(nextStep, text) {
    pushMessage('ai', text);
    setStep(nextStep);
    setTextInput('');
  }

  function startPlanning() {
    setStage('chat');
    pushMessage('user', '我想生成一份家庭财务规划。');
    window.setTimeout(() => {
      pushMessage('ai', '我先帮你搭一张家庭财务地图。你不用一次填完，我会一个问题一个问题问，只收集会影响人生计划的数字。');
      window.setTimeout(() => ask('liquidAssets', '先不看房子这些大件。现在家里真正能拿出来用的钱，大概有多少？按万元填就行。'), 650);
    }, 380);
  }

  function answerNumber(label, field, multiplier = 10000) {
    const value = toNumber(textInput) * multiplier;
    pushMessage('user', `${label}${textInput} 万`);
    setDraftPlan((current) => normalizePlan({ ...current, [field]: value }));
    setTextInput('');

    const nextMap = {
      liquidAssets: () => ask('lockedAssets', `我先记为：可立即动用资产 ${textInput} 万。再看那些账面上有、但不太能直接花的钱，比如房子、车、长期资产，大概有多少？`),
      lockedAssets: () => {
        const totalAssets = draftPlan.liquidAssets + value;
        ask('liabilities', `收到，账面总资产约 ${money(totalAssets)}。这些资产背后，还有多少负债？比如房贷、车贷、信用贷。`);
      },
      liabilities: () => {
        const netWorth = draftPlan.assets - value;
        ask('annualIncome', `收到，当前净资产约 ${money(netWorth)}。接下来，一年税后大概能赚多少钱？`);
      },
      annualIncome: () => ask('annualSurplus', `年度收入先记为 ${textInput} 万。那一年下来，大概能剩下多少钱用于长期规划？`),
      annualSurplus: () => {
        const annualIncome = draftPlan.annualIncome;
        const annualExpense = Math.max(0, annualIncome - value);
        setDraftPlan((current) => ({ ...current, annualExpense }));
        askRequiredGoals(value);
      },
      annualExpense: () => {
        const annualIncome = draftPlan.annualIncome;
        const annualExpense = value;
        const annualSurplus = Math.max(0, annualIncome - annualExpense);
        setDraftPlan((current) => ({ ...current, annualExpense }));
        askRequiredGoals(annualSurplus);
      },
    };

    window.setTimeout(nextMap[field], 420);
  }

  function askRequiredGoals(annualSurplus) {
    pushMessage('ai', `先按年度可规划结余 ${money(annualSurplus)} 进入测算。现在看底线目标：未来哪些事情是家庭必须保障、不能轻易放弃的？可以一次选多个。`);
    setStep('requiredGoals');
  }

  function beginExpenseSplit() {
    pushMessage('user', '帮我拆开算');
    ask('annualExpense', '那我先问年度总支出。包含日常生活、房贷房租、孩子、父母、保险和其他固定支出，一年大概多少万元？');
  }

  function toggleSelection(id, setter) {
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function confirmRequiredGoals() {
    const queue = requiredGoalPresets.filter((goal) => selectedRequired.includes(goal.id)).map((goal) => ({ ...goal, priority: 'need' }));
    pushMessage('user', queue.map((goal) => goal.name).join('、'));
    setGoalQueue(queue);
    setGoalCursor(0);
    setGoalField('moneyProfile');
    setStep('goalDetail');
    window.setTimeout(() => askGoalDetail(queue[0], 'moneyProfile'), 420);
  }

  function askGoalDetail(goal, field) {
    if (!goal) return askOptionalGoals();
    if (field === 'moneyProfile') {
      setGoalForm({
        frequency: goal.kind === 'recurring' ? goal.frequency || 'monthly' : 'once',
        amount: goal.amount ? String(goal.amount / 10000) : '',
        startYear: '',
        endYear: '',
        note: '',
      });
      ask('goalDetail', `补一下「${goal.name}」：先确认它是一次性、每月还是每年支出，并填写金额。`);
      return;
    }
    setGoalForm((current) => ({
      ...current,
      startYear: goal.kind === 'oneTime' ? String(goal.year || '') : String(goal.startYear || ''),
      endYear: goal.kind === 'recurring' ? String(goal.endYear || '') : '',
      note: '',
    }));
    ask('goalDetail', `再补「${goal.name}」的使用时间。补充说明是可选的，可以写“必须保住”“可以延期”或“可以降配”。`);
  }

  function answerGoalDetail() {
    const activeGoal = goalQueue[goalCursor];
    if (!activeGoal) return;
    const nextGoal = { ...activeGoal };

    if (goalField === 'moneyProfile') {
      const amount = toNumber(goalForm.amount) * 10000;
      nextGoal.amount = amount;
      nextGoal.kind = goalForm.frequency === 'once' ? 'oneTime' : 'recurring';
      nextGoal.frequency = goalForm.frequency === 'yearly' ? 'yearly' : 'monthly';
      pushMessage(
        'user',
        `${goalForm.frequency === 'once' ? '一次性' : goalForm.frequency === 'monthly' ? '每月' : '每年'} ${goalForm.amount} 万`,
      );
      updateGoalAndContinue(nextGoal, 'timingProfile');
      return;
    }

    if (nextGoal.kind === 'oneTime') {
      nextGoal.year = toNumber(goalForm.startYear);
      nextGoal.note = goalForm.note.trim();
      pushMessage('user', `${goalForm.startYear} 年后使用${goalForm.note.trim() ? `，补充：${goalForm.note.trim()}` : ''}`);
      finishOneGoal(nextGoal);
    } else {
      nextGoal.startYear = toNumber(goalForm.startYear);
      nextGoal.endYear = toNumber(goalForm.endYear);
      nextGoal.note = goalForm.note.trim();
      pushMessage(
        'user',
        `${goalForm.startYear} 年后开始，持续到 ${goalForm.endYear} 年后${goalForm.note.trim() ? `，补充：${goalForm.note.trim()}` : ''}`,
      );
      finishOneGoal(nextGoal);
    }
  }

  function updateGoalAndContinue(nextGoal, nextField) {
    const nextQueue = goalQueue.map((goal, index) => (index === goalCursor ? nextGoal : goal));
    setGoalQueue(nextQueue);
    setGoalField(nextField);
    setTextInput('');
    window.setTimeout(() => askGoalDetail(nextGoal, nextField), 420);
  }

  function finishOneGoal(nextGoal) {
    const normalized = normalizeGoal({ ...nextGoal, id: `${nextGoal.priority}-${nextGoal.id}` });
    const nextCollected = [...collectedGoals.filter((goal) => goal.id !== normalized.id), normalized];
    setCollectedGoals(nextCollected);
    setTextInput('');
    pushMessage('ai', `已记录：${normalized.name}，${normalized.kind === 'recurring' ? `${normalized.startYear} 年后开始，持续到 ${normalized.endYear} 年后` : `${normalized.year} 年后发生`}，属于${normalized.priority === 'need' ? '必须要' : '想要'}目标。`);

    const nextCursor = goalCursor + 1;
    if (nextCursor < goalQueue.length) {
      setGoalCursor(nextCursor);
      setGoalField('moneyProfile');
      window.setTimeout(() => askGoalDetail(goalQueue[nextCursor], 'moneyProfile'), 520);
      return;
    }

    if (goalQueue[0]?.priority === 'need') {
      window.setTimeout(askOptionalGoals, 520);
    } else {
      window.setTimeout(() => askAssumptions(nextCollected), 520);
    }
  }

  function askOptionalGoals() {
    pushMessage('ai', '底线目标记录好了。接下来看看想要但可以取舍的目标，可以多选，也可以跳过。');
    setStep('optionalGoals');
  }

  function confirmOptionalGoals() {
    if (selectedOptional.length === 0) {
      pushMessage('user', '想要目标先跳过');
      askAssumptions(collectedGoals);
      return;
    }

    const queue = optionalGoalPresets.filter((goal) => selectedOptional.includes(goal.id)).map((goal) => ({ ...goal, priority: 'want' }));
    pushMessage('user', queue.map((goal) => goal.name).join('、'));
    setGoalQueue(queue);
    setGoalCursor(0);
    setGoalField('moneyProfile');
    setStep('goalDetail');
    window.setTimeout(() => askGoalDetail(queue[0], 'moneyProfile'), 420);
  }

  function askAssumptions(goals) {
    setDraftPlan((current) => ({ ...current, goals }));
    pushMessage('ai', '我先按保守默认值计算：预期收益率 4%，通胀率和折现率 3%。先按这个算可以吗？');
    setStep('assumptions');
  }

  function finishInterview() {
    pushMessage('user', '按默认先算');
    setStage('loading');
    setStep(null);
    window.setTimeout(() => onComplete({ ...draftPlan, goals: collectedGoals, returnRate: 4, inflationRate: 3, discountRate: 3 }), 3100);
  }

  function renderDock() {
    if (!step) return null;

    if (['liquidAssets', 'lockedAssets', 'liabilities', 'annualIncome', 'annualSurplus', 'annualExpense'].includes(step)) {
      const config = onboardingInputConfig(step);
      const submit =
        () => answerNumber(config.label, step);

      return (
        <div className="onboarding-input-card">
          <div className="input-card-copy">
            <strong>{config.title}</strong>
            <span>{config.helper}</span>
          </div>
          <div className="quick-row">
            {config.quickValues.map((value) => (
              <button key={value} type="button" onClick={() => setTextInput(value)}>
                {value} {config.unit}
              </button>
            ))}
            {step === 'annualSurplus' && (
              <button type="button" onClick={beginExpenseSplit}>
                帮我拆开算
              </button>
            )}
          </div>
          <label className="chat-input">
            <input
              autoFocus
              inputMode="decimal"
              placeholder={config.placeholder}
              value={textInput}
              onChange={(event) => setTextInput(cleanNumericInput(event.target.value))}
            />
            <em>{config.unit}</em>
            <button disabled={!textInput} type="button" onClick={submit}>
              <Send size={16} />
            </button>
          </label>
        </div>
      );
    }

    if (step === 'goalDetail') {
      const activeGoal = goalQueue[goalCursor];
      const isMoneyProfile = goalField === 'moneyProfile';
      const isRecurring = goalForm.frequency !== 'once';

      return (
        <div className="onboarding-input-card goal-profile-card">
          <div className="input-card-copy">
            <strong>{activeGoal?.name}</strong>
            <span>{isMoneyProfile ? '选择支出方式，并填写金额。' : '填写开始和结束时间，补充说明可选。'}</span>
          </div>

          {isMoneyProfile ? (
            <>
              <div className="frequency-segmented">
                {[
                  ['once', '一次性'],
                  ['monthly', '每月'],
                  ['yearly', '每年'],
                ].map(([value, label]) => (
                  <button
                    className={goalForm.frequency === value ? 'active' : ''}
                    key={value}
                    type="button"
                    onClick={() => setGoalForm((current) => ({ ...current, frequency: value }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="chat-input">
                <input
                  autoFocus
                  inputMode="decimal"
                  placeholder="填写金额"
                  value={goalForm.amount}
                  onChange={(event) => setGoalForm((current) => ({ ...current, amount: cleanNumericInput(event.target.value) }))}
                />
                <em>万元</em>
                <button disabled={!goalForm.amount} type="button" onClick={answerGoalDetail}>
                  <Send size={16} />
                </button>
              </label>
            </>
          ) : (
            <>
              <div className={isRecurring ? 'time-grid two' : 'time-grid'}>
                <label>
                  <span>{isRecurring ? '几年后开始' : '几年后使用'}</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={goalForm.startYear}
                    onChange={(event) => setGoalForm((current) => ({ ...current, startYear: cleanNumericInput(event.target.value) }))}
                  />
                </label>
                {isRecurring && (
                  <label>
                    <span>持续到几年后</span>
                    <input
                      inputMode="decimal"
                      value={goalForm.endYear}
                      onChange={(event) => setGoalForm((current) => ({ ...current, endYear: cleanNumericInput(event.target.value) }))}
                    />
                  </label>
                )}
              </div>
              <label className="optional-note">
                <span>补充说明（可选）</span>
                <input
                  placeholder="例如 必须保住 / 可以延期 / 可以降配"
                  value={goalForm.note}
                  onChange={(event) => setGoalForm((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
              <button
                className="onboarding-primary"
                disabled={!goalForm.startYear || (isRecurring && !goalForm.endYear)}
                type="button"
                onClick={answerGoalDetail}
              >
                记录这个目标
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      );
    }

    if (step === 'requiredGoals') {
      return (
        <ChoicePanel
          cta="继续补全必要目标"
          disabled={selectedRequired.length === 0}
          onConfirm={confirmRequiredGoals}
          options={requiredGoalPresets}
          selected={selectedRequired}
          toggle={(id) => toggleSelection(id, setSelectedRequired)}
        />
      );
    }

    if (step === 'optionalGoals') {
      return (
        <ChoicePanel
          cta={selectedOptional.length > 0 ? '继续补全想要目标' : '先跳过想要目标'}
          onConfirm={confirmOptionalGoals}
          options={optionalGoalPresets}
          selected={selectedOptional}
          toggle={(id) => toggleSelection(id, setSelectedOptional)}
        />
      );
    }

    if (step === 'assumptions') {
      return (
        <div className="onboarding-input-card">
          <div className="assumption-row">
            <span>收益率 4%</span>
            <span>通胀率 3%</span>
            <span>折现率 3%</span>
          </div>
          <button className="onboarding-primary" type="button" onClick={finishInterview}>
            开始生成规划
            <ArrowRight size={16} />
          </button>
        </div>
      );
    }

    return null;
  }

  if (stage === 'landing') {
    return (
      <div className="onboarding-shell">
        <section className="onboarding-phone">
          <div className="phone-grip" />
          <header className="onboarding-top">
            <div className="brand-mark">
              <span>躺</span>
              <b>能躺了吗？</b>
            </div>
            <div className="ai-online">
              <i />
              AI 在线
            </div>
          </header>

          <section className="onboarding-hero">
            <h1>你现在的财务焦虑，到底是不是多想？</h1>
            <p>不是安慰你，也不是吓你。我们会用你的真实数据，帮你看清哪些担心只是情绪，哪些风险已经写在数字里。</p>
          </section>

          <section className="anxiety-panel">
            {landingPhase < 4 && (
              <div className="dialogue-stack">
                {landingPhase >= 1 && <p>你可能不是想躺平。</p>}
                {landingPhase >= 2 && <p>你只是想知道，自己到底有没有退路。</p>}
                {landingPhase >= 3 && <p>先选一个最担心的问题，我来帮你算清楚。</p>}
              </div>
            )}
            {landingPhase >= 4 && (
              <div className="question-list">
                <button type="button" onClick={startPlanning}>
                  <span>生成我的家庭财务规划</span>
                  <b>1</b>
                </button>
                <button type="button" onClick={startPlanning}>
                  <span>目标都想要，最后谁先出局？</span>
                  <b>2</b>
                </button>
                <button type="button" onClick={startPlanning}>
                  <span>这笔大钱，是消费还是透支？</span>
                  <b>3</b>
                </button>
              </div>
            )}
          </section>
        </section>
      </div>
    );
  }

  if (stage === 'loading') {
    return (
      <div className="onboarding-shell">
        <section className="onboarding-phone loading-phone">
          <div className="phone-grip" />
          <div className="loading-card">
            <Sparkles size={26} />
            <h2>正在把对话整理成你的规划页</h2>
            <p>AI 正在生成家庭财务地图、折现未来目标，并检查 7 个关键指标。</p>
            <div className="loading-lines">
              <span>生成家庭财务地图</span>
              <span>折现未来目标</span>
              <span>检查 7 个关键指标</span>
              <span>判断哪些目标最挤压计划</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="onboarding-shell">
      <section className="onboarding-phone chat-phone">
        <div className="phone-grip" />
        <header className="chat-topbar">
          <div className="brand-mark">
            <span>躺</span>
            <b>家庭财务规划</b>
          </div>
          <div className="ai-online">
            <i />
            AI 在线
          </div>
        </header>
        <div className="chat-feed" ref={feedRef}>
          {messages.map((message) => (
            <div className={`chat-bubble ${message.role}`} key={message.id}>
              {message.role === 'ai' && <Bot size={16} />}
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        {renderDock()}
      </section>
    </div>
  );
}

function SupplementExperience({ onCancel, onComplete, plan }) {
  const [stage, setStage] = useState('chat');
  const [step, setStep] = useState('choose');
  const [messages, setMessages] = useState(() => [
    { id: crypto.randomUUID(), role: 'user', text: '我想让 AI 继续补充判断。' },
    {
      id: crypto.randomUUID(),
      role: 'ai',
      text: '我会基于你现在的家庭财务地图继续监测。你不用重填全部信息，只补充发生变化或刚想到的部分。',
    },
  ]);
  const [assetForm, setAssetForm] = useState(() => ({
    liquidAssets: formatNumberInput(toNumber(plan.liquidAssets) / 10000),
    lockedAssets: formatNumberInput(toNumber(plan.lockedAssets) / 10000),
    liabilities: formatNumberInput(toNumber(plan.liabilities) / 10000),
  }));
  const [goalForm, setGoalForm] = useState({
    name: '',
    priority: 'want',
    kind: 'oneTime',
    frequency: 'monthly',
    amountWan: '',
    year: '3',
    startYear: '5',
    endYear: '10',
    note: '',
  });
  const feedRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function pushMessage(role, text) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  function chooseMode(mode) {
    if (mode === 'assets') {
      pushMessage('user', '我想更新资产结构。');
      pushMessage('ai', '我会重新看三件事：可立即动用的钱、不易变现的资产、以及总负债。只改有变化的数字就行，单位按万元。');
      setStep('assets');
      return;
    }

    pushMessage('user', '我想补充一个新的目标。');
    pushMessage('ai', '我会把这个目标放进你的长期规划里，再重新计算覆盖率和压力目标。先告诉我目标名称、优先级、支出方式和金额。');
    setStep('goal');
  }

  function finishWithPlan(nextPlan) {
    setStage('loading');
    setStep(null);
    timerRef.current = window.setTimeout(() => onComplete(nextPlan), 1650);
  }

  function submitAssets(event) {
    event.preventDefault();
    const nextPlan = applyPlanSupplement(plan, {
      type: 'assets',
      liquidAssets: toNumber(assetForm.liquidAssets) * 10000,
      lockedAssets: toNumber(assetForm.lockedAssets) * 10000,
      liabilities: toNumber(assetForm.liabilities) * 10000,
    });

    pushMessage(
      'user',
      `更新为：可立即动用 ${assetForm.liquidAssets || 0} 万，不易变现 ${assetForm.lockedAssets || 0} 万，负债 ${assetForm.liabilities || 0} 万。`,
    );
    pushMessage('ai', '收到。我会用新的资产结构重新生成规划页，重点检查“账面上够不够”和“真正能调用的钱够不够”之间的差异。');
    finishWithPlan(nextPlan);
  }

  function submitGoal(event) {
    event.preventDefault();
    const nextPlan = applyPlanSupplement(plan, {
      type: 'goal',
      goal: goalForm,
    });

    const goalTiming =
      goalForm.kind === 'oneTime'
        ? `${goalForm.year || 0} 年后使用`
        : `${goalForm.startYear || 0} 年后开始，持续到 ${goalForm.endYear || 0} 年后`;
    const frequencyText =
      goalForm.kind === 'oneTime' ? '一次性' : goalForm.frequency === 'yearly' ? '每年' : '每月';

    pushMessage(
      'user',
      `新增目标：${goalForm.name || '新的目标'}，${goalForm.priority === 'need' ? '必须要' : '想要'}，${frequencyText} ${goalForm.amountWan || 0} 万，${goalTiming}。`,
    );
    pushMessage('ai', '收到。我会把它并入目标池，重新计算目标需求、覆盖率和最大压力目标。');
    finishWithPlan(nextPlan);
  }

  function updateAssetField(field, value) {
    setAssetForm((current) => ({ ...current, [field]: cleanNumericInput(value) }));
  }

  function updateGoalField(field, value) {
    setGoalForm((current) => ({ ...current, [field]: value }));
  }

  function renderSupplementDock() {
    if (step === 'choose') {
      return (
        <div className="supplement-choice-panel">
          <div className="input-card-copy">
            <strong>这次想补充什么？</strong>
            <span>AI 会只重算受影响的部分，然后刷新你的规划页。</span>
          </div>
          <div className="supplement-choice-grid">
            <button type="button" onClick={() => chooseMode('assets')}>
              <Radar size={17} />
              <span>更新资产结构</span>
              <small>现金、固定资产、负债变化</small>
            </button>
            <button type="button" onClick={() => chooseMode('goal')}>
              <Target size={17} />
              <span>新增一个目标</span>
              <small>买房、教育、养老、消费冲动</small>
            </button>
          </div>
        </div>
      );
    }

    if (step === 'assets') {
      return (
        <form className="onboarding-input-card supplement-form-card" onSubmit={submitAssets}>
          <div className="input-card-copy">
            <strong>补充资产结构</strong>
            <span>这里按万元填。固定资产会进入账面资源，但不会被当成可以随时调用的钱。</span>
          </div>
          <div className="supplement-form-grid">
            <label>
              <span>可立即动用资产</span>
              <div>
                <input
                  autoFocus
                  inputMode="decimal"
                  placeholder="例如 30"
                  value={assetForm.liquidAssets}
                  onChange={(event) => updateAssetField('liquidAssets', event.target.value)}
                />
                <em>万元</em>
              </div>
            </label>
            <label>
              <span>不易变现资产</span>
              <div>
                <input
                  inputMode="decimal"
                  placeholder="例如 150"
                  value={assetForm.lockedAssets}
                  onChange={(event) => updateAssetField('lockedAssets', event.target.value)}
                />
                <em>万元</em>
              </div>
            </label>
            <label>
              <span>总负债</span>
              <div>
                <input
                  inputMode="decimal"
                  placeholder="例如 50"
                  value={assetForm.liabilities}
                  onChange={(event) => updateAssetField('liabilities', event.target.value)}
                />
                <em>万元</em>
              </div>
            </label>
          </div>
          <button className="onboarding-primary" type="submit">
            重新生成规划页
            <ArrowRight size={16} />
          </button>
        </form>
      );
    }

    if (step === 'goal') {
      const isRecurring = goalForm.kind === 'recurring';

      return (
        <form className="onboarding-input-card supplement-form-card" onSubmit={submitGoal}>
          <div className="input-card-copy">
            <strong>补充一个新目标</strong>
            <span>先让 AI 知道它是必须要还是想要，再判断这件事会不会挤压原计划。</span>
          </div>
          <div className="supplement-form-grid">
            <label>
              <span>目标名称</span>
              <div>
                <input
                  autoFocus
                  placeholder="例如 换车 / 提前退休 / 大额旅游"
                  value={goalForm.name}
                  onChange={(event) => updateGoalField('name', event.target.value)}
                />
              </div>
            </label>
            <div className="frequency-segmented supplement-segmented">
              {[
                ['need', '必须要'],
                ['want', '想要'],
              ].map(([value, label]) => (
                <button
                  className={goalForm.priority === value ? 'active' : ''}
                  key={value}
                  type="button"
                  onClick={() => updateGoalField('priority', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="frequency-segmented supplement-segmented">
              {[
                ['oneTime', '一次性'],
                ['recurring', '持续支出'],
              ].map(([value, label]) => (
                <button
                  className={goalForm.kind === value ? 'active' : ''}
                  key={value}
                  type="button"
                  onClick={() => updateGoalField('kind', value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {isRecurring && (
              <div className="frequency-segmented supplement-segmented">
                {[
                  ['monthly', '每月'],
                  ['yearly', '每年'],
                ].map(([value, label]) => (
                  <button
                    className={goalForm.frequency === value ? 'active' : ''}
                    key={value}
                    type="button"
                    onClick={() => updateGoalField('frequency', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <label>
              <span>{isRecurring ? '每期金额' : '总金额'}</span>
              <div>
                <input
                  inputMode="decimal"
                  placeholder="例如 30"
                  value={goalForm.amountWan}
                  onChange={(event) => updateGoalField('amountWan', cleanNumericInput(event.target.value))}
                />
                <em>万元</em>
              </div>
            </label>
            <div className={isRecurring ? 'supplement-form-grid two' : 'supplement-form-grid'}>
              <label>
                <span>{isRecurring ? '几年后开始' : '几年后使用'}</span>
                <div>
                  <input
                    inputMode="decimal"
                    value={isRecurring ? goalForm.startYear : goalForm.year}
                    onChange={(event) =>
                      updateGoalField(isRecurring ? 'startYear' : 'year', cleanNumericInput(event.target.value))
                    }
                  />
                  <em>年后</em>
                </div>
              </label>
              {isRecurring && (
                <label>
                  <span>持续到几年后</span>
                  <div>
                    <input
                      inputMode="decimal"
                      value={goalForm.endYear}
                      onChange={(event) => updateGoalField('endYear', cleanNumericInput(event.target.value))}
                    />
                    <em>年后</em>
                  </div>
                </label>
              )}
            </div>
            <label>
              <span>补充说明（可选）</span>
              <div>
                <input
                  placeholder="例如 可以延期 / 必须保住 / 可降配"
                  value={goalForm.note}
                  onChange={(event) => updateGoalField('note', event.target.value)}
                />
              </div>
            </label>
          </div>
          <button className="onboarding-primary" disabled={!goalForm.amountWan} type="submit">
            重新生成规划页
            <ArrowRight size={16} />
          </button>
        </form>
      );
    }

    return null;
  }

  if (stage === 'loading') {
    return (
      <div className="onboarding-shell">
        <section className="onboarding-phone loading-phone">
          <div className="phone-grip" />
          <div className="loading-card monitor-loading">
            <Radar size={28} />
            <h2>正在重新生成规划页</h2>
            <p>AI 正在把新增信息写回家庭财务地图，并重新判断覆盖率、压力目标和行动建议。</p>
            <div className="loading-lines">
              <span>更新资产与目标数据</span>
              <span>重新折现未来需求</span>
              <span>刷新 AI 结论与行动建议</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="onboarding-shell">
      <section className="onboarding-phone chat-phone supplement-phone">
        <div className="phone-grip" />
        <header className="chat-topbar">
          <div className="brand-mark">
            <span>躺</span>
            <b>AI 持续监测</b>
          </div>
          <button className="supplement-close" type="button" onClick={onCancel}>
            回到规划页
          </button>
        </header>
        <div className="chat-feed" ref={feedRef}>
          {messages.map((message) => (
            <div className={`chat-bubble ${message.role}`} key={message.id}>
              {message.role === 'ai' && <Bot size={16} />}
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        {renderSupplementDock()}
      </section>
    </div>
  );
}

function ChoicePanel({ cta, disabled = false, onConfirm, options, selected, toggle }) {
  return (
    <div className="choice-panel">
      <div className="choice-grid">
        {options.map((option) => (
          <button
            className={selected.includes(option.id) ? 'selected' : ''}
            key={option.id}
            type="button"
            onClick={() => toggle(option.id)}
          >
            <span>{option.name}</span>
            {selected.includes(option.id) && <Check size={15} />}
          </button>
        ))}
      </div>
      <button className="onboarding-primary" disabled={disabled} type="button" onClick={onConfirm}>
        {cta}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function AssetPage({ metrics, plan, updatePlan }) {
  return (
    <Screen eyebrow="资产" title="我的资产" subtitle="维护家庭现在拥有的资源和未来还能沉淀的现金流" action={<WalletCards size={20} />}>
      <section className="summary-card resource-summary">
        <SummaryMetric label="可立即动用" value={money(metrics.liquidAssets)} tone={metrics.liquidAssets <= 0 ? 'risk' : 'good'} />
        <SummaryMetric label="不易变现" value={money(metrics.lockedAssets)} />
        <SummaryMetric label="可动用占比" value={percent(metrics.liquidAssetRatio)} tone={metrics.liquidAssetRatio < 0.1 ? 'risk' : 'good'} />
      </section>

      <Panel title="资产结构" icon={<Landmark size={18} />}>
        <MoneyField label="可立即动用资产" value={plan.liquidAssets} onChange={(value) => updatePlan('liquidAssets', value)} />
        <MoneyField label="不易变现资产" value={plan.lockedAssets} onChange={(value) => updatePlan('lockedAssets', value)} />
        <ReadOnlyRow label="总资产" value={money(metrics.assets)} />
        <MoneyField label="总负债" value={plan.liabilities} onChange={(value) => updatePlan('liabilities', value)} />
        <ReadOnlyRow label="当前净资产" value={money(metrics.netWorth)} />
      </Panel>

      <Panel title="年度现金流" icon={<BriefcaseBusiness size={18} />}>
        <MoneyField label="年收入" value={plan.annualIncome} onChange={(value) => updatePlan('annualIncome', value)} />
        <MoneyField label="年支出" value={plan.annualExpense} onChange={(value) => updatePlan('annualExpense', value)} />
        <ReadOnlyRow label="年度结余" value={money(metrics.annualSurplus)} />
      </Panel>

      <Panel title="默认假设" icon={<TrendingUp size={18} />}>
        <NumberField label="可工作年限" value={plan.workYears} suffix="年" onChange={(value) => updatePlan('workYears', value)} />
        <NumberField label="预期收益率" value={plan.returnRate} suffix="%" step="0.1" onChange={(value) => updatePlan('returnRate', value)} />
      </Panel>
    </Screen>
  );
}

function PlanningPage({ metrics, plan, restartOnboarding, setActiveTab, startSupplement }) {
  const aiReport = buildAiReport(plan, metrics);
  const coverage = clamp(metrics.callableCoverage, 0, 1.35);

  return (
    <Screen eyebrow="规划" title="家庭财务地图" subtitle="把焦虑翻译成数字，再把数字翻译成行动" action={<Calculator size={20} />}>
      <section className="ai-understands-card">
        <div className="section-kicker">
          <Sparkles size={18} />
          <span>懂你的 AI</span>
        </div>
        <h2>{aiReport.headline}</h2>
        <p>基于可动用资产、不易变现资产和目标现值生成判断。</p>
        <div className="answer-strip">
          <div>
            <span>今天的答案</span>
            <strong>{metrics.verdict.title}</strong>
          </div>
          <div>
            <span>可调用覆盖</span>
            <strong>{percent(metrics.callableCoverage)}</strong>
          </div>
          <div>
            <span>账面覆盖</span>
            <strong>{percent(metrics.bookCoverage)}</strong>
          </div>
        </div>
        <div className="resource-target-pair">
          <span>可调用资源 <b>{money(metrics.callableResourcesPv)}</b></span>
          <span>账面资源 <b>{money(metrics.bookResourcesPv)}</b></span>
          <span>目标需求 <b>{money(metrics.totalTargetPv)}</b></span>
        </div>
        <div className="ai-coverage-line">
          <div className="coverage-bar" aria-label="资源覆盖目标">
            <i style={{ width: `${Math.min(100, coverage * 100)}%` }} />
          </div>
        </div>
        <button className="restart-mini" type="button" onClick={restartOnboarding}>
          <RefreshCcw size={15} />
          重新问诊
        </button>
      </section>

      <ReportSection title="理性的我" subtitle="为什么这么判断">
        <div className="ratio-rail" aria-label="关键证据横向列表">
          {aiReport.ratios.map((ratio) => (
            <div className="ratio-card" key={ratio.name}>
              <div className="ratio-head">
                <strong>{ratio.name}</strong>
                <span className={`status-pill ${ratio.status}`}>{statusLabel(ratio.status)}</span>
              </div>
              <b>{ratio.value}</b>
              <p>{ratio.plain}</p>
              <details>
                <summary>查看精算过程</summary>
                <small>门槛：{ratio.benchmark}</small>
                <small>{ratio.formula}</small>
                <small>{ratio.calculation}</small>
              </details>
            </div>
          ))}
        </div>
        {metrics.maxGoal && (
          <div className="pressure-summary-card">
            <div>
              <span>最大压力目标</span>
              <b>{percent(metrics.maxGoalShare)} 占比</b>
            </div>
            <strong>{metrics.maxGoal.name}</strong>
            <p>
              现值 {money(metrics.maxGoal.presentValue)}，属于{priorityText(metrics.maxGoal.priority)}目标。它会直接影响其他目标的排序和取舍空间。
            </p>
          </div>
        )}
      </ReportSection>

      <ReportSection title="行动的我" subtitle="本周可执行">
        <div className="action-list">
          {aiReport.actions.map((action, index) => (
            <div className="action-row" key={action}>
              <b>{index + 1}</b>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection title="回到长期规划" subtitle="继续维护">
      <section className="workspace-grid">
        <button type="button" onClick={() => setActiveTab('asset')}>
          <PiggyBank size={18} />
          <span>我的资产</span>
          <strong>{money(metrics.netWorth)}</strong>
          <ChevronRight size={16} />
        </button>
        <button type="button" onClick={() => setActiveTab('goal')}>
          <Target size={18} />
          <span>我的目标</span>
          <strong>{money(metrics.totalTargetPv)}</strong>
          <ChevronRight size={16} />
        </button>
        <button className="ask-ai-card" type="button" onClick={startSupplement}>
          <Sparkles size={18} />
          <span>继续问 AI</span>
          <strong>补充情况、测试决定、调整目标</strong>
          <ChevronRight size={16} />
        </button>
      </section>
      </ReportSection>
    </Screen>
  );
}

function GoalPage({
  draftGoal,
  draftKind,
  isGoalFormOpen,
  metrics,
  plan,
  removeGoal,
  setDraftGoal,
  setIsGoalFormOpen,
  submitGoal,
  switchDraftKind,
  updateGoal,
  updatePlan,
}) {
  return (
    <Screen eyebrow="目标" title="我的目标" subtitle="把必须要和想要分开，资源不够时才知道谁先让路" action={<Target size={20} />}>
      <section className="summary-card goal-summary">
        <SummaryMetric label="目标总需求" value={money(metrics.totalTargetPv)} />
        <SummaryMetric label="必须要" value={money(metrics.needTargetPv)} />
        <SummaryMetric label="想要" value={money(metrics.wantTargetPv)} />
        <SummaryMetric label="最晚目标" value={`${metrics.latestGoalYear}年`} />
      </section>

      <Panel title="折现假设" icon={<TrendingUp size={18} />}>
        <NumberField label="通胀率" value={plan.inflationRate} suffix="%" step="0.1" onChange={(value) => updatePlan('inflationRate', value)} />
        <NumberField label="折现率" value={plan.discountRate} suffix="%" step="0.1" onChange={(value) => updatePlan('discountRate', value)} />
      </Panel>

      <form className={isGoalFormOpen ? 'panel goal-form open' : 'panel goal-form'} onSubmit={submitGoal}>
        <button className="goal-form-toggle" type="button" onClick={() => setIsGoalFormOpen((current) => !current)}>
          <div>
            <Plus size={18} />
            <h3>添加目标</h3>
          </div>
          <span>{isGoalFormOpen ? '收起' : '展开'}</span>
        </button>

        {isGoalFormOpen && (
          <>
            <div className="segmented">
              <button type="button" className={draftKind === 'oneTime' ? 'active' : ''} onClick={() => switchDraftKind('oneTime')}>
                一次性支出
              </button>
              <button type="button" className={draftKind === 'recurring' ? 'active' : ''} onClick={() => switchDraftKind('recurring')}>
                持续性支出
              </button>
            </div>

            <TextField
              label="目标名称"
              value={draftGoal.name}
              placeholder={draftKind === 'oneTime' ? '比如 换房' : '比如 退休生活'}
              onChange={(value) => setDraftGoal((current) => ({ ...current, name: value }))}
            />

            <SegmentedField
              label="目标优先级"
              value={draftGoal.priority}
              onChange={(value) => setDraftGoal((current) => ({ ...current, priority: value }))}
              options={[
                ['need', '必须要'],
                ['want', '想要'],
              ]}
            />

            {draftKind === 'oneTime' ? (
              <>
                <MoneyField label="目标金额" value={draftGoal.amount} onChange={(value) => setDraftGoal((current) => ({ ...current, amount: toNumber(value) }))} />
                <NumberField label="距今年数" value={draftGoal.year} suffix="年" onChange={(value) => setDraftGoal((current) => ({ ...current, year: toNumber(value) }))} />
              </>
            ) : (
              <>
                <SegmentedField
                  label="支出频率"
                  value={draftGoal.frequency}
                  onChange={(value) => setDraftGoal((current) => ({ ...current, frequency: value }))}
                  options={[
                    ['monthly', '每月'],
                    ['yearly', '每年'],
                  ]}
                />
                <MoneyField label="支出金额" value={draftGoal.amount} onChange={(value) => setDraftGoal((current) => ({ ...current, amount: toNumber(value) }))} />
                <NumberField label="开始时间" value={draftGoal.startYear} suffix="年后" onChange={(value) => setDraftGoal((current) => ({ ...current, startYear: toNumber(value) }))} />
                <NumberField label="结束时间" value={draftGoal.endYear} suffix="年后" onChange={(value) => setDraftGoal((current) => ({ ...current, endYear: toNumber(value) }))} />
              </>
            )}

            <button className="primary-button" type="submit">
              <Plus size={18} />
              添加目标
            </button>
          </>
        )}
      </form>

      <div className="goal-list">
        {metrics.goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} removeGoal={removeGoal} totalTargetPv={metrics.totalTargetPv} updateGoal={updateGoal} />
        ))}
      </div>
    </Screen>
  );
}

function GoalCard({ goal, removeGoal, totalTargetPv, updateGoal }) {
  const [isEditing, setIsEditing] = useState(false);
  const share = totalTargetPv > 0 ? goal.presentValue / totalTargetPv : 0;

  return (
    <article className={isEditing ? 'goal-card editing' : 'goal-card'}>
      <div className="goal-card-head">
        <div>
          <div className="tag-row">
            <span>{goalKindText(goal)}</span>
            <span className={goal.priority === 'need' ? 'need' : 'want'}>{priorityText(goal.priority)}</span>
          </div>
          <input className="goal-title-input" value={goal.name} aria-label="目标名称" onChange={(event) => updateGoal(goal.id, 'name', event.target.value)} />
        </div>
        <div className="goal-actions">
          <button type="button" aria-label="编辑目标" onClick={() => setIsEditing((current) => !current)}>
            <Pencil size={16} />
          </button>
          <button type="button" aria-label={`删除 ${goal.name}`} onClick={() => removeGoal(goal.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="goal-details">
        {goal.kind === 'recurring' ? (
          <>
            <span>{goal.frequency === 'monthly' ? '每月' : '每年'} {money(goal.amount)}</span>
            <span>{goal.startYear}年后 - {goal.endYear}年后</span>
          </>
        ) : (
          <>
            <span>{goal.year}年后</span>
            <span>{money(goal.amount)}</span>
          </>
        )}
      </div>

      <div className="goal-impact">
        <span>现值 {money(goal.presentValue)}</span>
        <span>占比 {percent(share)}</span>
      </div>

      {isEditing && (
        <div className="goal-editor">
          <SegmentedField
            label="目标优先级"
            value={goal.priority}
            onChange={(value) => updateGoal(goal.id, 'priority', value)}
            options={[
              ['need', '必须要'],
              ['want', '想要'],
            ]}
          />
          <MoneyField label="金额" value={goal.amount} onChange={(value) => updateGoal(goal.id, 'amount', value)} />
          {goal.kind === 'recurring' ? (
            <>
              <NumberField label="开始时间" value={goal.startYear} suffix="年后" onChange={(value) => updateGoal(goal.id, 'startYear', toNumber(value))} />
              <NumberField label="结束时间" value={goal.endYear} suffix="年后" onChange={(value) => updateGoal(goal.id, 'endYear', toNumber(value))} />
            </>
          ) : (
            <NumberField label="距今年数" value={goal.year} suffix="年" onChange={(value) => updateGoal(goal.id, 'year', toNumber(value))} />
          )}
          <button className="done-button" type="button" onClick={() => setIsEditing(false)}>
            完成
          </button>
        </div>
      )}
    </article>
  );
}

function Screen({ action, children, eyebrow, subtitle, title }) {
  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="header-icon">{action}</div>
      </header>
      {children}
    </section>
  );
}

function Panel({ aside, children, icon, title }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          {icon}
          <h3>{title}</h3>
        </div>
        {aside}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function ReportSection({ children, subtitle, title }) {
  return (
    <section className="report-section">
      <div className="report-section-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {children}
    </section>
  );
}

function SummaryMetric({ label, tone, value }) {
  return (
    <div className={tone ? `summary-metric ${tone}` : 'summary-metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MoneyField({ label, onChange, value }) {
  const wanValue = Number.isFinite(Number(value)) ? Number(value) / 10000 : 0;
  return (
    <NumberField
      label={label}
      value={Number.isInteger(wanValue) ? wanValue : Number(wanValue.toFixed(2))}
      suffix="万元"
      step="0.1"
      onChange={(nextValue) => onChange(toNumber(nextValue) * 10000)}
    />
  );
}

function NumberField({ label, onChange, step = '1', suffix, value }) {
  return (
    <label className="input-row">
      <span>{label}</span>
      <div>
        <input type="text" inputMode="decimal" data-step={step} value={formatNumberInput(value)} onChange={(event) => onChange(cleanNumericInput(event.target.value))} />
        <em>{suffix}</em>
      </div>
    </label>
  );
}

function TextField({ label, onChange, placeholder, value }) {
  return (
    <label className="input-row">
      <span>{label}</span>
      <div>
        <input type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function SegmentedField({ label, onChange, options, value }) {
  return (
    <div className="input-row segmented-row">
      <span>{label}</span>
      <div className="inline-segmented">
        {options.map(([optionValue, optionLabel]) => (
          <button type="button" className={value === optionValue ? 'active' : ''} key={optionValue} onClick={() => onChange(optionValue)}>
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <div className="readonly-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VerdictBadge({ children, tone }) {
  return <b className={`verdict-badge ${tone}`}>{children}</b>;
}

function AiDock({ onClick }) {
  return (
    <button className="ai-dock" type="button" aria-label="AI 持续监测" onClick={onClick}>
      <span className="monitor-radar">
        <Radar size={18} />
      </span>
      <span>AI 监测</span>
    </button>
  );
}

function TrendPreview({ metrics, plan }) {
  const target = metrics.totalTargetPv;
  const points = Array.from({ length: 9 }, (_, index) => {
    const year = Math.round((metrics.latestGoalYear || plan.workYears || 40) * (index / 8));
    let value = metrics.netWorth;
    for (let currentYear = 1; currentYear <= year; currentYear += 1) {
      value *= 1 + decimal(plan.returnRate);
      if (currentYear <= plan.workYears) value += annualSurplusAtYear(plan, currentYear);
    }
    return { year, value };
  });
  const max = Math.max(target, ...points.map((point) => point.value), 1);

  return (
    <div className="trend-preview">
      <div className="target-line" style={{ bottom: `${clamp((target / max) * 100, 8, 92)}%` }}>
        <span>目标</span>
      </div>
      {points.map((point) => (
        <div className="trend-bar" key={`${point.year}-${point.value}`}>
          <i style={{ height: `${clamp((point.value / max) * 100, 6, 100)}%` }} />
          <span>{point.year}</span>
        </div>
      ))}
    </div>
  );
}

function BottomTabs({ activeTab, setActiveTab }) {
  const tabs = [
    ['asset', '资产', <WalletCards size={20} />],
    ['planning', '规划', <Home size={20} />],
    ['goal', '目标', <Target size={20} />],
  ];

  return (
    <nav className="bottom-tabs" aria-label="主导航">
      {tabs.map(([key, label, icon]) => (
        <button className={activeTab === key ? 'active' : ''} key={key} type="button" onClick={() => setActiveTab(key)}>
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function statusLabel(status) {
  return {
    good: '达标',
    warning: '预警',
    danger: '危险',
  }[status];
}

function goalKindText(goal) {
  return goal.kind === 'recurring' ? '持续性' : '一次性';
}

function priorityText(priority) {
  return priority === 'need' ? '必须要' : '想要';
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(<App />);
