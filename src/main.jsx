import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Coins,
  Home,
  KeyRound,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Radar,
  RefreshCcw,
  Send,
  Settings,
  ShieldCheck,
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
import {
  MODEL_PROVIDERS,
  MODEL_SETTINGS_STORAGE_KEY,
  callConfiguredModel,
  defaultModelSettings,
  getProviderConfig,
  hasModelKey,
  maskApiKey,
  normalizeModelSettings,
} from './modelClient.mjs';
import { applyPlanSupplement } from './supplement.mjs';
import './styles.css';

const PLAN_STORAGE_KEY = 'neng_tang_plan_v1';
const ONBOARDING_STORAGE_KEY = 'neng_tang_onboarding_complete_v1';
const API_BASE = '';

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

function loadModelSettings() {
  try {
    const stored = localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY);
    return normalizeModelSettings(stored ? JSON.parse(stored) : defaultModelSettings);
  } catch {
    return normalizeModelSettings(defaultModelSettings);
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(data?.message || '请求失败');
  }
  return data;
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
  const [supplementInitialQuestion, setSupplementInitialQuestion] = useState('');
  const [modelSettings, setModelSettings] = useState(loadModelSettings);
  const [draftKind, setDraftKind] = useState('oneTime');
  const [draftGoal, setDraftGoal] = useState(() => freshGoal('oneTime'));
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const [planRecord, setPlanRecord] = useState(null);
  const [syncStatus, setSyncStatus] = useState('未登录草稿');
  const hasLoadedCloudRef = useRef(false);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    setAuthUser(null);
    setAuthStatus('guest');
    setPlanRecord(null);
    setSyncStatus('手机 Alpha：仅保存在当前设备');
    hasLoadedCloudRef.current = true;
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(saveTimerRef.current);
  }, [authUser, hasCompletedOnboarding, plan, planRecord?.id]);

  useEffect(() => {
    localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(modelSettings));
  }, [modelSettings]);

  const metrics = useMemo(() => buildMetrics(plan), [plan]);

  function completeOnboarding(nextPlan) {
    const normalized = normalizePlan(nextPlan);
    setPlan(normalized);
    setHasCompletedOnboarding(true);
    setActiveTab('planning');
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }

  async function sendAuthCode(identifier) {
    const data = await apiRequest('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
    return data;
  }

  async function login(identifier, code) {
    const { user } = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, code }),
    });
    setAuthUser(user);
    setAuthStatus('signed-in');
    setSyncStatus('已登录，正在同步...');
    const { plan: cloudPlan } = await apiRequest('/api/plans/current');
    if (cloudPlan?.plan) {
      const normalized = normalizePlan(cloudPlan.plan);
      setPlan(normalized);
      setPlanRecord(cloudPlan);
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      setHasCompletedOnboarding(true);
      setSyncStatus('已从云端加载');
    } else {
      setSyncStatus('已登录，本地草稿将保存到云端');
    }
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
    setAuthUser(null);
    setPlanRecord(null);
    setAuthStatus('guest');
    setSyncStatus('未登录草稿');
  }

  function startSupplement(initialQuestion = '') {
    setSupplementInitialQuestion(initialQuestion);
    setActiveTab('planning');
    setIsSupplementing(true);
  }

  function openModelSettings() {
    setIsSupplementing(false);
    setSupplementInitialQuestion('');
    setActiveTab('model');
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
    return (
      <SupplementExperience
        initialQuestion={supplementInitialQuestion}
        modelSettings={modelSettings}
        onCancel={() => setIsSupplementing(false)}
        onComplete={completeSupplement}
        onOpenSettings={openModelSettings}
        plan={plan}
      />
    );
  }

  return (
    <div className="app-shell">
      <main className="app-frame">
        <LocalAlphaBar modelSettings={modelSettings} onOpenSettings={openModelSettings} syncStatus={syncStatus} />
        {activeTab === 'asset' && <AssetPage metrics={metrics} plan={plan} updatePlan={updatePlan} />}
        {activeTab === 'planning' && (
          <PlanningPage
            metrics={metrics}
            modelSettings={modelSettings}
            openModelSettings={openModelSettings}
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
        {activeTab === 'model' && (
          <ModelSettingsPage metrics={metrics} plan={plan} settings={modelSettings} updateSettings={setModelSettings} />
        )}
        {activeTab === 'planning' && <AiDock onClick={startSupplement} />}
        <BottomTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      </main>
    </div>
  );
}

function LocalAlphaBar({ modelSettings, onOpenSettings, syncStatus }) {
  const config = getProviderConfig(modelSettings);
  const isReady = hasModelKey(modelSettings);

  return (
    <section className="account-bar local-alpha-bar">
      <div>
        <strong>手机 Alpha，当前设备保存</strong>
        <span>{syncStatus} · {config.name} {isReady ? `已配置 ${maskApiKey(config.apiKey)}` : '未配置 Key'}</span>
      </div>
      <button type="button" onClick={onOpenSettings}>
        模型
      </button>
    </section>
  );
}

function AccountBar({ authStatus, onLogin, onLogout, onSendCode, syncStatus, user }) {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSendCode() {
    if (!identifier.trim()) return;
    setIsBusy(true);
    try {
      const data = await onSendCode(identifier.trim());
      setMessage(`开发验证码：${data.devCode}`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!identifier.trim() || !code.trim()) return;
    setIsBusy(true);
    try {
      await onLogin(identifier.trim(), code.trim());
      setMessage('');
      setIsOpen(false);
      setCode('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  if (authStatus === 'checking') {
    return (
      <section className="account-bar">
        <span>正在检查登录状态...</span>
      </section>
    );
  }

  if (user) {
    return (
      <section className="account-bar signed-in">
        <div>
          <strong>云端保存已开启</strong>
          <span>{user.identifier} · {syncStatus}</span>
        </div>
        <button type="button" onClick={onLogout}>退出</button>
      </section>
    );
  }

  return (
    <section className={isOpen ? 'account-bar open' : 'account-bar'}>
      <div>
        <strong>未登录，当前设备草稿</strong>
        <span>{syncStatus}</span>
      </div>
      <button type="button" onClick={() => setIsOpen((current) => !current)}>
        {isOpen ? '收起' : '登录'}
      </button>
      {isOpen && (
        <form className="account-form" onSubmit={handleLogin}>
          <label>
            <span>邮箱或手机号</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            <span>验证码</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="开发环境 123456" />
          </label>
          <div className="account-actions">
            <button disabled={isBusy || !identifier.trim()} type="button" onClick={handleSendCode}>获取验证码</button>
            <button disabled={isBusy || !identifier.trim() || !code.trim()} type="submit">登录并同步</button>
          </div>
          {message && <p>{message}</p>}
        </form>
      )}
    </section>
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

function SupplementExperience({ initialQuestion = '', modelSettings, onCancel, onComplete, onOpenSettings, plan }) {
  const [stage, setStage] = useState('chat');
  const [step, setStep] = useState('choose');
  const [questionInput, setQuestionInput] = useState('');
  const [isAskingModel, setIsAskingModel] = useState(false);
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
  const initialQuestionRef = useRef(false);
  const metrics = useMemo(() => buildMetrics(plan), [plan]);
  const modelConfig = getProviderConfig(modelSettings);
  const isModelReady = hasModelKey(modelSettings);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    const question = String(initialQuestion || '').trim();
    if (!question || initialQuestionRef.current) return;
    initialQuestionRef.current = true;
    submitQuestionText(question);
  }, [initialQuestion]);

  function pushMessage(role, text) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  async function submitQuestionText(question) {
    const trimmed = String(question || '').trim();
    if (!trimmed || isAskingModel) return;

    pushMessage('user', trimmed);
    setQuestionInput('');

    if (!isModelReady) {
      pushMessage('ai', `还没配置模型 Key。先到模型设置里填写 ${modelConfig.name} 的 API Key，我就能基于这份当前设备上的规划继续回答。`);
      return;
    }

    setIsAskingModel(true);
    try {
      const result = await callConfiguredModel(modelSettings, {
        question: trimmed,
        plan,
        metrics,
        recentMessages: messages,
      });
      pushMessage('ai', result.content);
    } catch (error) {
      pushMessage('ai', error.message);
    } finally {
      setIsAskingModel(false);
    }
  }

  function submitQuestion(event) {
    event.preventDefault();
    submitQuestionText(questionInput);
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
            <strong>这次想问什么？</strong>
            <span>
              {isModelReady
                ? `当前使用 ${modelConfig.name} / ${modelConfig.model}。也可以直接更新结构化数据。`
                : `先配置 ${modelConfig.name} API Key，或继续用本地规则更新资产和目标。`}
            </span>
          </div>
          {!isModelReady && (
            <button className="model-config-callout" type="button" onClick={onOpenSettings}>
              <KeyRound size={17} />
              <span>去配置模型 Key</span>
              <ChevronRight size={16} />
            </button>
          )}
          <form className="ai-question-form" onSubmit={submitQuestion}>
            <input
              placeholder={isModelReady ? '直接问：我现在最该先改什么？' : '配置 Key 后可直接追问 AI'}
              value={questionInput}
              onChange={(event) => setQuestionInput(event.target.value)}
            />
            <button disabled={isAskingModel || !questionInput.trim()} type="submit">
              <Send size={16} />
            </button>
          </form>
          {isAskingModel && <p className="model-thinking">正在调用 {modelConfig.name}...</p>}
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

function goalTiming(goal) {
  if (!goal) return '目标时间待补充';
  if (goal.kind === 'recurring') return `${goal.startYear} 年后开始`;
  return `${goal.year} 年后发生`;
}

function PlanningPage({ metrics, modelSettings, openModelSettings, plan, restartOnboarding, setActiveTab, startSupplement }) {
  const [questionDraft, setQuestionDraft] = useState('');
  const aiReport = buildAiReport(plan, metrics);
  const judgement = aiReport.judgement;
  const modelConfig = getProviderConfig(modelSettings);
  const isModelReady = hasModelKey(modelSettings);
  const progress = clamp(metrics.callableCoverage, 0, 1);
  const progressValue = Math.round(progress * 100);
  const monthlyExpense = plan.annualExpense / 12;
  const cashCushion = monthlyExpense > 0 ? metrics.liquidAssets / monthlyExpense : 0;
  const cashCushionText = `${Math.max(0, Math.round(cashCushion))}个月`;
  const yearsText = metrics.yearsNeeded === null ? '80年+' : `${metrics.yearsNeeded}年`;
  const pressureGoals = [...metrics.goals]
    .sort((a, b) => b.presentValue - a.presentValue)
    .slice(0, 3)
    .map((goal) => ({
      ...goal,
      share: metrics.totalTargetPv > 0 ? goal.presentValue / metrics.totalTargetPv : 0,
    }));

  function submitQuestion(event) {
    event.preventDefault();
    const question = questionDraft.trim();
    if (!question) {
      startSupplement();
      return;
    }
    setQuestionDraft('');
    startSupplement(question);
  }

  return (
    <section className="screen result-screen">
      <section className="result-chat-shell">
        <header className="result-topbar">
          <div className="result-person">
            <div className="result-avatar">姐</div>
            <div>
              <strong>知心姐姐</strong>
              <span>{isModelReady ? `${modelConfig.name} · ${modelConfig.model}` : '家庭财务 AI · 待配置模型'}</span>
            </div>
          </div>
          <button className="result-pill" type="button" onClick={openModelSettings}>
            <Check size={13} />
            {isModelReady ? '模型已配置' : '配置模型'}
          </button>
        </header>

        <div className="result-chat-feed">
          <article className="result-bubble user">
            <p>我把家里的资产、收入、支出和未来目标都填完了。你直接告诉我，我现在到底能不能躺？</p>
          </article>

          <article className="result-bubble ai compact">
            <small>知心姐姐</small>
            <p>我先接住你这个问题：你真正想知道的不是账上有多少钱，而是这个家庭有没有一条稳稳的退路。</p>
          </article>

          <article className="result-bubble ai">
            <small>一句话承接</small>
            <p>{judgement.leadIn}</p>
          </article>

          <article className="result-bubble ai">
            <small>核心结论</small>
            <p>{judgement.reason}</p>
            <section className="result-card result-hero-card">
              <div className="result-card-head">
                <div>
                  <strong>今天的判断</strong>
                  <span>基于当前目标和保守假设</span>
                </div>
                <em>{judgement.pressure.title}</em>
              </div>
              <div className="result-verdict">
                <b>{metrics.verdict.title}</b>
                <span>{judgement.verdict}</span>
              </div>
            </section>
          </article>

          <article className="result-bubble ai">
            <small>核心指标支撑</small>
            <p>我先不讲一堆公式，只看会影响判断的几个指标。它们共同说明：方向可以讨论，但安全余量还需要被托住。</p>
            <section className="result-card">
              <div className="progress-head">
                <span>能躺进度</span>
                <b>{progressValue}%</b>
              </div>
              <div className="result-track">
                <i style={{ width: `${progressValue}%` }} />
              </div>
              <div className="metric-grid">
                <div className="metric"><span>可调用覆盖</span><strong>{percent(metrics.callableCoverage)}</strong></div>
                <div className="metric"><span>当前缺口</span><strong>{metrics.gap > 0 ? money(metrics.gap) : '无缺口'}</strong></div>
                <div className="metric"><span>现金垫</span><strong>{cashCushionText}</strong></div>
              </div>
              <div className="metric-grid">
                <div className="metric"><span>预计还需</span><strong>{yearsText}</strong></div>
                <div className="metric"><span>月结余目标</span><strong>{judgement.shortTermPlan[2]?.value.replace('至少 ', '')}</strong></div>
                <div className="metric"><span>年度可规划</span><strong>{money(Math.max(0, metrics.annualSurplus))}</strong></div>
              </div>
              <details className="formula-drawer">
                <summary>查看精算指标</summary>
                <div className="formula-list">
                  {aiReport.ratios.slice(0, 4).map((ratio) => (
                    <div key={ratio.name}>
                      <span>{ratio.name}</span>
                      <strong>{ratio.value}</strong>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          </article>

          <article className="result-bubble ai">
            <small>压力来源</small>
            <p>{judgement.pressure.impact}</p>
            <section className="result-card">
              <div className="combined-title">
                <strong>{judgement.pressure.title}</strong>
                <span>{judgement.pressure.level}</span>
              </div>
              <div className="bar-row">
                <div className="bar-label"><strong>资源</strong><span>可调用口径</span></div>
                <div className="mini-track"><i style={{ width: `${Math.min(100, progressValue)}%` }} /></div>
                <b>{money(metrics.callableResourcesPv)}</b>
              </div>
              <div className="bar-row">
                <div className="bar-label"><strong>目标</strong><span>长期需求</span></div>
                <div className="mini-track"><i className="target" style={{ width: '100%' }} /></div>
                <b>{money(metrics.totalTargetPv)}</b>
              </div>
              {pressureGoals.map((goal) => (
                <div className="pressure-row" key={goal.id}>
                  <strong>{goal.name}</strong>
                  <span><i style={{ width: `${Math.max(8, Math.round(goal.share * 100))}%` }} /></span>
                  <b>{percent(goal.share)}</b>
                </div>
              ))}
              <div className="timeline">
                <div><b>现在</b><span>稳住现金垫</span></div>
                <div><b>{metrics.maxGoal ? goalTiming(metrics.maxGoal) : '先补目标'}</b><span>{metrics.maxGoal?.name || '目标待补充'}</span></div>
                <div><b>{metrics.latestGoalYear || 0}年</b><span>最远目标边界</span></div>
              </div>
            </section>
          </article>

          <article className="result-bubble ai">
            <small>我的长期建议</small>
            <p>{judgement.longTermAdvice.recommendation}</p>
            <section className="result-card">
              <div className="setting-row">
                <span>调整目标</span>
                <strong>{judgement.longTermAdvice.target}</strong>
              </div>
              <div className="setting-row">
                <span>第一版动作</span>
                <strong>{metrics.callableCoverage >= 1 ? '每月复核可调用资产' : '延后 3 年 + 降低 20% 预算'}</strong>
              </div>
              <div className="impact-line">
                <span>为什么先动这里</span>
                <b>{judgement.longTermAdvice.impact}</b>
              </div>
              <div className="result-track">
                <i style={{ width: `${Math.min(100, Math.max(progressValue, Math.round(clamp(metrics.bookCoverage, 0, 1) * 100)))}%` }} />
              </div>
              <div className="choice-buttons">
                <button className="primary" type="button" onClick={() => setActiveTab('goal')}>调整目标</button>
                <button className="secondary" type="button" onClick={() => startSupplement()}>继续问 AI</button>
              </div>
            </section>
          </article>

          <article className="result-bubble ai">
            <small>今年的短期计划</small>
            <p>长期目标要靠今年的执行来托住。先把今年拆成一个能复盘的计划：每周看一次偏差，每月底看长期进度有没有变形。</p>
            <section className="result-card">
              <div className="plan-grid">
                {judgement.shortTermPlan.map((item) => (
                  <div className="setting-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="choice-buttons">
                <button className="primary" type="button" onClick={() => startSupplement()}>确认并继续监测</button>
                <button className="secondary" type="button" onClick={() => setActiveTab('asset')}>调整资产</button>
              </div>
            </section>
          </article>
        </div>

        <footer className="result-composer">
          <div className="chips">
            <button type="button" onClick={() => startSupplement('为什么我的压力偏大？请按资产、现金流、目标三个角度解释。')}>为什么压力偏大？</button>
            <button type="button" onClick={() => setActiveTab('goal')}>长期目标还能怎么调？</button>
            <button type="button" onClick={() => startSupplement('请把今年的计划拆成本周能开始执行的 3 个动作。')}>本周计划怎么执行？</button>
            <button type="button" onClick={restartOnboarding}>重新问诊</button>
          </div>
          <form className="result-input-shell" onSubmit={submitQuestion}>
            <input
              placeholder={isModelReady ? '继续问知心姐姐...' : '先配置模型 Key，再继续问 AI'}
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
            />
            <button type="submit">
              <Send size={15} />
            </button>
          </form>
        </footer>
      </section>

      <section className="result-workspace-links">
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
        <button className="ask-ai-card" type="button" onClick={() => startSupplement()}>
          <Sparkles size={18} />
          <span>AI 监测</span>
          <strong>补充情况、测试决定、调整目标</strong>
          <ChevronRight size={16} />
        </button>
      </section>
    </section>
  );
}

function ModelSettingsPage({ metrics, plan, settings, updateSettings }) {
  const [testStatus, setTestStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const config = getProviderConfig(settings);
  const providers = Object.values(MODEL_PROVIDERS);

  function updateProvider(provider) {
    updateSettings((current) => normalizeModelSettings({ ...current, provider }));
    setTestStatus('');
  }

  function updateProviderValue(group, value) {
    updateSettings((current) => {
      const normalized = normalizeModelSettings(current);
      return normalizeModelSettings({
        ...normalized,
        [group]: {
          ...normalized[group],
          [normalized.provider]: value,
        },
      });
    });
    setTestStatus('');
  }

  async function testModel() {
    setIsTesting(true);
    setTestStatus('正在调用模型...');
    try {
      const result = await callConfiguredModel(settings, {
        question: '请用两句话确认你能读取我当前设备上的规划摘要，并指出当前最该复核的一项。',
        plan,
        metrics,
      });
      setTestStatus(`${result.provider} / ${result.model} 可用：${result.content.slice(0, 96)}`);
    } catch (error) {
      setTestStatus(error.message);
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Screen eyebrow="模型" title="手机模型设置" subtitle="体验用户自己填写 Key；Key 只保存在当前手机浏览器" action={<Settings size={20} />}>
      <section className="panel model-privacy-panel">
        <div>
          <ShieldCheck size={20} />
          <strong>不会上传到「能躺了吗」服务器</strong>
        </div>
        <p>手机 Alpha 不做账号登录和云端保存。API Key 会写入当前手机浏览器 localStorage，只在你点击“继续问 AI”或“测试调用”时由这个浏览器直接发给所选模型服务商。</p>
      </section>

      <Panel title="服务商" icon={<KeyRound size={18} />}>
        <div className="provider-grid">
          {providers.map((provider) => (
            <button
              className={settings.provider === provider.key ? 'active' : ''}
              key={provider.key}
              type="button"
              onClick={() => updateProvider(provider.key)}
            >
              <strong>{provider.name}</strong>
              <span>{provider.defaultModel}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={`${config.name} 配置`} icon={<Settings size={18} />}>
        <label className="input-row model-field">
          <span>API Key</span>
          <div>
            <input
              autoComplete="off"
              placeholder={config.keyHint}
              type="password"
              value={config.apiKey}
              onChange={(event) => updateProviderValue('apiKeys', event.target.value)}
            />
          </div>
        </label>
        <TextField label="模型名称" value={config.model} placeholder={config.defaultModel} onChange={(value) => updateProviderValue('models', value)} />
        <TextField
          label="接口地址"
          value={config.endpoint}
          placeholder={config.defaultEndpoint}
          onChange={(value) => updateProviderValue('endpoints', value)}
        />
        <button className="primary-button" disabled={isTesting || !config.apiKey.trim()} type="button" onClick={testModel}>
          <Sparkles size={18} />
          测试模型调用
        </button>
        {testStatus && <p className={testStatus.includes('可用') ? 'model-test-status good' : 'model-test-status'}>{testStatus}</p>}
      </Panel>

      <section className="panel model-help-panel">
        <strong>体验用户怎么填</strong>
        <p>优先选择通义千问，在阿里云百炼控制台创建 API Key 后粘贴到这里；如果体验用户已有 DeepSeek 或 Kimi Key，也可以切换服务商后填写。模型名和接口地址保持默认即可，除非服务商文档要求调整。</p>
      </section>
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
    <button className="ai-dock" type="button" aria-label="AI 持续监测" onClick={() => onClick()}>
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
    ['model', '模型', <KeyRound size={20} />],
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
