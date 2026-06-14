import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Check,
  Coins,
  Eye,
  Home,
  KeyRound,
  Landmark,
  Monitor,
  MousePointer2,
  Pencil,
  PiggyBank,
  Play,
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
  buildMetrics,
  clamp,
  decimal,
  money,
  percent,
  toNumber,
} from './finance.mjs';
import {
  MODEL_PROVIDERS,
  MANAGED_MODEL_LABEL,
  MODEL_SETTINGS_STORAGE_KEY,
  callManagedAnalysis,
  callManagedModel,
  callConfiguredModel,
  defaultModelSettings,
  getProviderConfig,
  hasModelKey,
  maskApiKey,
  normalizeModelSettings,
  parseAnalysisContent,
} from './modelClient.mjs';
import { applyPlanSupplement } from './supplement.mjs';
import './styles.css';

const PLAN_STORAGE_KEY = 'neng_tang_plan_v1';
const ONBOARDING_STORAGE_KEY = 'neng_tang_onboarding_complete_v1';
const API_BASE = '';

const defaultPlan = {
  planningScope: 'single',
  familyResponsibilities: [],
  cityTier: 'newFirstTier',
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

const planningScopeOptions = [
  { id: 'single', name: '单身为自己规划' },
  { id: 'couple', name: '和伴侣 / 夫妻共同规划' },
];

const familyResponsibilityOptions = [
  { id: 'children', name: '有孩子' },
  { id: 'education', name: '需要考虑教育' },
  { id: 'elderCare', name: '需要赡养老人' },
  { id: 'other', name: '其他家庭责任' },
];

const cityTierOptions = [
  { id: 'firstTier', name: '一线城市' },
  { id: 'newFirstTier', name: '新一线/强二线' },
  { id: 'secondTier', name: '普通二线' },
  { id: 'lowerTier', name: '三四线及以下' },
];

const coachScenarios = [
  {
    id: 'managed-ai',
    name: '配置托管 AI',
    summary: 'CloudBase 云函数 + DeepSeek Key',
    checkpoints: [
      {
        title: '确认配置目标',
        observed: '你应该停在 CloudBase 云函数或部署清单页面，准备配置服务端环境变量。',
        nextAction: '先找到云函数 ai-chat 的环境变量区域，准备新增 DEEPSEEK_API_KEY。',
        risk: '不要把 Key 粘贴到前端文件、README 截图或公开聊天里。',
        verify: '保存后页面能看到环境变量名，但不应明文显示完整 Key。',
      },
      {
        title: '绑定访问路径',
        observed: '页面上会出现 HTTP 访问服务、路径映射或触发器配置。',
        nextAction: '把云函数 HTTP 路径映射到 /api/ai-chat，保留 POST 请求能力。',
        risk: '如果路径写成完整第三方接口，前端会绕过代理并暴露调用细节。',
        verify: '本地或线上请求 /api/ai-chat 时返回 JSON，而不是 404。',
      },
      {
        title: '完成连通性测试',
        observed: '回到 App 的 AI 页面，点击测试 AI 服务后等待返回。',
        nextAction: '看到“可用”再继续；如果失败，先检查 Key、云函数日志和路径映射。',
        risk: '不要为了省事把 API Key 写进 Vite 环境变量或浏览器 localStorage。',
        verify: '测试状态包含服务商、模型名和一小段 AI 返回内容。',
      },
    ],
  },
  {
    id: 'local-dev',
    name: '跑通本地开发',
    summary: '安装依赖、启动服务、检查页面',
    checkpoints: [
      {
        title: '确认项目目录',
        observed: '终端当前位置应显示项目根目录，能看到 package.json。',
        nextAction: '如果不在项目根目录，先切到这个项目文件夹，再执行依赖安装。',
        risk: '不要在系统目录或其他项目里安装依赖，避免把文件写错地方。',
        verify: '执行 npm install 后没有严重报错，并生成 node_modules。',
      },
      {
        title: '启动开发服务',
        observed: '终端里会出现 Vite 的本地访问地址，通常是 127.0.0.1:5173。',
        nextAction: '保持终端运行，不要关闭窗口，然后用浏览器打开本地地址。',
        risk: '如果端口被占用，不要反复重装，换端口或关闭旧服务即可。',
        verify: '浏览器能看到应用首屏，控制台没有连续刷新或白屏。',
      },
      {
        title: '验证核心流程',
        observed: '页面应能完成问诊、进入规划页，并能切换资产、目标、模型页面。',
        nextAction: '按最小流程走一遍，再记录任何卡住的页面和报错文案。',
        risk: '测试时不要输入真实隐私数据，先用样例数字跑通流程。',
        verify: '刷新后数据仍在当前设备保留，说明 localStorage 生效。',
      },
    ],
  },
  {
    id: 'launch-domain',
    name: '上线域名',
    summary: 'DNS、备案、HTTPS 发布检查',
    checkpoints: [
      {
        title: '确认上线材料',
        observed: '你会在域名、备案、DNS 或静态托管控制台之间切换。',
        nextAction: '先核对域名主体、备案状态、静态站点地址是否齐全。',
        risk: '不要急着改 DNS；备案或证书没好时，改了也可能访问失败。',
        verify: '上线清单里每项都有明确状态：待办、进行中、已完成。',
      },
      {
        title: '配置解析记录',
        observed: 'DNS 控制台一般会要求填写记录类型、主机记录和值。',
        nextAction: '按托管平台给出的 CNAME 或 A 记录填写，保存前逐项复核。',
        risk: '主机记录 @ 和 www 容易填反；TTL 不会立刻生效，别频繁乱改。',
        verify: '解析生效后，域名能指向托管平台而不是旧页面。',
      },
      {
        title: '检查 HTTPS 与 PWA',
        observed: '浏览器地址栏应显示安全连接，PWA manifest 和图标能正常加载。',
        nextAction: '打开正式域名，检查首页、AI 代理路径和添加到主屏幕体验。',
        risk: 'HTTPS 混合内容会导致手机端体验异常，尤其是 AI 接口请求。',
        verify: '手机浏览器能打开、刷新、添加到主屏幕，并保留本地规划数据。',
      },
    ],
  },
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
    planningScope: plan.planningScope || defaultPlan.planningScope || 'unknown',
    familyResponsibilities: Array.isArray(plan.familyResponsibilities) ? plan.familyResponsibilities : defaultPlan.familyResponsibilities || [],
    cityTier: plan.cityTier || defaultPlan.cityTier || 'unknown',
    liquidAssets,
    lockedAssets,
    assets,
    liabilities: toNumber(plan.liabilities),
    annualIncome: toNumber(plan.annualIncome),
    annualExpense: toNumber(plan.annualExpense),
    workYears: toNumber(plan.workYears ?? defaultPlan.workYears),
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

function selectedOptionNames(options, ids) {
  const selected = options.filter((option) => ids.includes(option.id)).map((option) => option.name);
  return selected.join('、');
}

function onboardingInputConfig(step) {
  return {
    liquidAssets: {
      title: '请填写灵活资产',
      helper: '现金、存款、基金、股票、理财等，比较容易动用的钱。',
      unit: '万元',
      placeholder: '例如 15',
      quickValues: ['10', '30', '100'],
      label: '灵活资产约 ',
      multiplier: 10000,
    },
    lockedAssets: {
      title: '请填写固定资产',
      helper: '房产、车位、长期资产等，不太容易快速变现的资产。',
      unit: '万元',
      placeholder: '例如 900',
      quickValues: ['0', '300', '900'],
      label: '固定资产约 ',
      multiplier: 10000,
    },
    liabilities: {
      title: '请填写总负债',
      helper: '房贷、车贷、消费贷、信用卡、亲友借款都合并估算。',
      unit: '万元',
      placeholder: '例如 450',
      quickValues: ['0', '100', '450'],
      label: '负债约 ',
      multiplier: 10000,
    },
    annualIncome: {
      title: '请填写家庭年收入',
      helper: '按税后口径估算，包括工资、经营收入和稳定副业。',
      unit: '万元/年',
      placeholder: '例如 95',
      quickValues: ['30', '60', '100'],
      label: '年收入约 ',
      multiplier: 10000,
    },
    annualExpense: {
      title: '请填写家庭年支出',
      helper: '日常生活、房贷房租、孩子、父母、保险和固定支出都算进去。',
      unit: '万元/年',
      placeholder: '例如 25',
      quickValues: ['20', '40', '70'],
      label: '年支出约 ',
      multiplier: 10000,
    },
    workYears: {
      title: '请填写预计工作年限',
      helper: '从现在开始，你预计还会持续工作多少年？这会影响未来收入折现值。',
      unit: '年',
      placeholder: '例如 20',
      quickValues: ['10', '20', '30'],
      label: '预计还会工作 ',
      multiplier: 1,
    },
  }[step];
}

function App() {
  const [plan, setPlan] = useState(loadPlan);
  const [activeTab, setActiveTab] = useState('planning');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(loadOnboardingState);
  const [isSupplementing, setIsSupplementing] = useState(false);
  const [supplementInitialQuestion, setSupplementInitialQuestion] = useState('');
  const [supplementInitialMode, setSupplementInitialMode] = useState('');
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

  function startSupplement(initialQuestion = '', initialMode = '') {
    setSupplementInitialQuestion(initialQuestion);
    setSupplementInitialMode(initialMode);
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
        initialMode={supplementInitialMode}
        modelSettings={modelSettings}
        onCancel={() => setIsSupplementing(false)}
        onComplete={completeSupplement}
        onOpenSettings={openModelSettings}
        plan={plan}
      />
    );
  }

  const isPlanningView = activeTab === 'planning';

  return (
    <div className={isPlanningView ? 'app-shell planning-app-shell' : 'app-shell'}>
      <main className={isPlanningView ? 'app-frame planning-frame' : 'app-frame'}>
        {!isPlanningView && <LocalAlphaBar onBackToPlanning={() => setActiveTab('planning')} syncStatus={syncStatus} />}
        {activeTab === 'asset' && <AssetPage metrics={metrics} plan={plan} updatePlan={updatePlan} />}
        {activeTab === 'planning' && (
          <PlanningPage
            metrics={metrics}
            modelSettings={modelSettings}
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
        {activeTab === 'coach' && <CoachPage />}
        {activeTab === 'model' && (
          <ModelSettingsPage metrics={metrics} plan={plan} settings={modelSettings} updateSettings={setModelSettings} />
        )}
      </main>
    </div>
  );
}

function LocalAlphaBar({ onBackToPlanning, syncStatus }) {
  return (
    <section className="account-bar local-alpha-bar">
      <div>
        <strong>手机 Alpha，当前设备保存</strong>
        <span>{syncStatus} · {MANAGED_MODEL_LABEL} 已连接</span>
      </div>
      <button type="button" onClick={onBackToPlanning}>
        规划
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
  const [draftPlan, setDraftPlan] = useState({ ...defaultPlan, goals: [] });
  const [isDockLoading, setIsDockLoading] = useState(false);
  const [selectedPlanningScope, setSelectedPlanningScope] = useState('');
  const [selectedResponsibilities, setSelectedResponsibilities] = useState([]);
  const [assetDebtForm, setAssetDebtForm] = useState({ liquidAssets: '', lockedAssets: '', liabilities: '' });
  const [cashflowForm, setCashflowForm] = useState({ annualIncome: '', annualExpense: '', workYears: '' });
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [isCustomGoalOpen, setIsCustomGoalOpen] = useState(false);
  const [customGoalDraft, setCustomGoalDraft] = useState('');
  const [goalQueue, setGoalQueue] = useState([]);
  const [goalCursor, setGoalCursor] = useState(0);
  const [goalForm, setGoalForm] = useState({ frequency: '', amount: '', startYear: '', duration: '', priority: '' });
  const [collectedGoals, setCollectedGoals] = useState([]);
  const [assumptionForm, setAssumptionForm] = useState({ returnRate: '4', discountRate: '3' });
  const feedRef = useRef(null);
  const transitionTimerRef = useRef(null);

  const responsibilityOptions = selectedPlanningScope === 'single'
    ? [
        { id: 'elderCare', name: '赡养老人' },
        { id: 'other', name: '其他责任' },
        { id: 'none', name: '暂无' },
      ]
    : selectedPlanningScope
      ? [
          { id: 'children', name: '有孩子' },
          { id: 'education', name: '教育支出' },
          { id: 'elderCare', name: '赡养老人' },
          { id: 'other', name: '其他责任' },
          { id: 'none', name: '暂无' },
        ]
      : [];

  const intakeGoalOptions = [
    { id: 'home-upgrade', name: '换房' },
    { id: 'education', name: '子女教育' },
    { id: 'retirement', name: '养老' },
    { id: 'consumption-upgrade', name: '消费升级' },
    { id: 'career-shift', name: '创业/转型' },
  ];

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
  }, [messages, step, isDockLoading]);

  useEffect(() => () => window.clearTimeout(transitionTimerRef.current), []);

  function pushMessage(role, text) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  function ask(nextStep, text) {
    pushMessage('ai', text);
    setStep(nextStep);
    setIsDockLoading(false);
  }

  function transitionAsk(nextStep, text, loadingText = '正在整理下一步', delay = 560) {
    window.clearTimeout(transitionTimerRef.current);
    setStep(null);
    setIsDockLoading(loadingText);
    transitionTimerRef.current = window.setTimeout(() => ask(nextStep, text), delay);
  }

  function startPlanning() {
    setStage('chat');
    pushMessage('user', '我想生成一份家庭财务规划。');
    transitionAsk('planningScope', '这份规划先按谁来做？', '正在进入身份判断', 520);
  }

  function resetGoalForm() {
    setGoalForm({ frequency: '', amount: '', startYear: '', duration: '', priority: '' });
  }

  function updateMoneyForm(setter, field, value) {
    setter((current) => ({ ...current, [field]: cleanNumericInput(value) }));
  }

  function selectPlanningScope(scope) {
    setSelectedPlanningScope(scope);
    setSelectedResponsibilities([]);
  }

  function toggleResponsibility(id) {
    setSelectedResponsibilities((current) => {
      if (id === 'none') return current.includes('none') ? [] : ['none'];
      const withoutNone = current.filter((item) => item !== 'none');
      return withoutNone.includes(id) ? withoutNone.filter((item) => item !== id) : [...withoutNone, id];
    });
  }

  function responsibilityText(ids) {
    if (ids.includes('none')) return '暂无';
    const labels = responsibilityOptions
      .filter((option) => ids.includes(option.id))
      .map((option) => option.name);
    return labels.length ? labels.join('、') : '暂无';
  }

  function confirmProfile() {
    if (!selectedPlanningScope || selectedResponsibilities.length === 0) return;
    const responsibilities = selectedResponsibilities.includes('none') ? [] : selectedResponsibilities;
    const nextPlan = normalizePlan({ ...draftPlan, planningScope: selectedPlanningScope, familyResponsibilities: responsibilities });
    setDraftPlan(nextPlan);
    pushMessage('user', `${selectedOptionNames(planningScopeOptions, [selectedPlanningScope])}；家庭责任：${responsibilityText(selectedResponsibilities)}`);
    transitionAsk('assetDebt', '先看资产和负债。请一次填三项：流动资产、固定资产、当前总负债。', '正在整理资产问题');
  }

  function confirmAssetDebt() {
    if (!assetDebtForm.liquidAssets || !assetDebtForm.lockedAssets || !assetDebtForm.liabilities) return;
    const nextPlan = normalizePlan({
      ...draftPlan,
      liquidAssets: toNumber(assetDebtForm.liquidAssets) * 10000,
      lockedAssets: toNumber(assetDebtForm.lockedAssets) * 10000,
      liabilities: toNumber(assetDebtForm.liabilities) * 10000,
    });
    setDraftPlan(nextPlan);
    pushMessage('user', `流动资产 ${assetDebtForm.liquidAssets} 万，固定资产 ${assetDebtForm.lockedAssets} 万，当前总负债 ${assetDebtForm.liabilities} 万。`);
    transitionAsk('cashflow', '接下来算一年真实能留下多少钱。请填写年度收入、年度支出和预计工作年限。', '正在整理现金流问题');
  }

  function confirmCashflow() {
    if (!cashflowForm.annualIncome || !cashflowForm.annualExpense || !cashflowForm.workYears) return;
    const nextPlan = normalizePlan({
      ...draftPlan,
      annualIncome: toNumber(cashflowForm.annualIncome) * 10000,
      annualExpense: toNumber(cashflowForm.annualExpense) * 10000,
      workYears: toNumber(cashflowForm.workYears),
    });
    const annualSurplus = Math.max(0, nextPlan.annualIncome - nextPlan.annualExpense);
    setDraftPlan(nextPlan);
    pushMessage(
      'user',
      `年度收入 ${cashflowForm.annualIncome} 万，年度支出 ${cashflowForm.annualExpense} 万，预计工作 ${cashflowForm.workYears} 年，年度结余约 ${money(annualSurplus)}。`,
    );
    transitionAsk('goalSelect', '未来主要想规划哪些目标？可以一次选多个。', '正在整理未来目标');
  }

  function toggleGoal(option) {
    setSelectedGoals((current) => (
      current.some((goal) => goal.id === option.id)
        ? current.filter((goal) => goal.id !== option.id)
        : [...current, { id: option.id, name: option.name, custom: false }]
    ));
  }

  function uniqueGoalName(rawName) {
    const baseName = rawName.trim().replace(/\s+/g, ' ');
    if (!baseName) return '';
    let name = baseName;
    let index = 2;
    const existing = new Set(selectedGoals.map((goal) => goal.name));
    while (existing.has(name)) {
      name = `${baseName} ${index}`;
      index += 1;
    }
    return name;
  }

  function addCustomGoal() {
    const name = uniqueGoalName(customGoalDraft);
    if (!name) return;
    setSelectedGoals((current) => [...current, { id: `custom-${crypto.randomUUID()}`, name, custom: true }]);
    setCustomGoalDraft('');
    setIsCustomGoalOpen(false);
  }

  function confirmGoals() {
    if (!selectedGoals.length) return;
    const queue = selectedGoals.map((goal) => ({ ...goal }));
    pushMessage('user', queue.map((goal) => goal.name).join('、'));
    setGoalQueue(queue);
    setGoalCursor(0);
    resetGoalForm();
    transitionAsk('goalDetail', `补一下「${queue[0].name}」的信息。`, '正在准备目标补充');
  }

  function canSubmitGoalDetail() {
    if (!goalForm.frequency || !goalForm.amount || !goalForm.startYear || !goalForm.priority) return false;
    if (goalForm.frequency !== 'once' && !goalForm.duration) return false;
    return true;
  }

  function frequencyLabel(value) {
    return { monthly: '每月', yearly: '每年', once: '一次性' }[value] || '';
  }

  function priorityLabel(value) {
    return value === 'need' ? '必须' : '想要';
  }

  function answerGoalDetail() {
    if (!canSubmitGoalDetail()) return;
    const activeGoal = goalQueue[goalCursor];
    if (!activeGoal) return;

    const amount = toNumber(goalForm.amount) * 10000;
    const startYear = toNumber(goalForm.startYear);
    const priority = goalForm.priority === 'need' ? 'need' : 'want';
    const normalized = normalizeGoal(goalForm.frequency === 'once'
      ? {
          id: `${priority}-${activeGoal.id}`,
          name: activeGoal.name,
          kind: 'oneTime',
          priority,
          amount,
          year: startYear,
        }
      : {
          id: `${priority}-${activeGoal.id}`,
          name: activeGoal.name,
          kind: 'recurring',
          priority,
          frequency: goalForm.frequency,
          amount,
          startYear,
          endYear: startYear + toNumber(goalForm.duration),
        });
    const nextCollected = [...collectedGoals.filter((goal) => goal.id !== normalized.id), normalized];
    setCollectedGoals(nextCollected);
    pushMessage(
      'user',
      [
        normalized.name,
        priorityLabel(normalized.priority),
        frequencyLabel(goalForm.frequency),
        `${goalForm.amount} 万`,
        `${goalForm.startYear} 年后`,
        normalized.kind === 'recurring' ? `持续 ${goalForm.duration} 年` : '',
      ].filter(Boolean).join('，'),
    );

    const nextCursor = goalCursor + 1;
    if (nextCursor < goalQueue.length) {
      setGoalCursor(nextCursor);
      resetGoalForm();
      transitionAsk('goalDetail', `再补「${goalQueue[nextCursor].name}」的信息。`, '正在切换下一个目标');
      return;
    }

    transitionAsk('assumptions', '最后确认默认假设。先按预期收益率 4%、折现率 3% 来算；如果不满意，可以直接修改。', '正在整理默认假设');
    setDraftPlan((current) => ({ ...current, goals: nextCollected }));
  }

  function finishInterview(customText = '') {
    const returnRate = toNumber(assumptionForm.returnRate || 4);
    const discountRate = toNumber(assumptionForm.discountRate || 3);
    pushMessage('user', customText || `按默认先算：预期收益率 ${returnRate}%，折现率 ${discountRate}%。`);
    setStage('loading');
    setStep(null);
    setIsDockLoading(false);
    window.setTimeout(() => {
      onComplete({
        ...draftPlan,
        goals: collectedGoals,
        returnRate,
        inflationRate: 3,
        discountRate,
      });
    }, 3100);
  }

  function submitEditedAssumptions() {
    finishInterview(`预期收益率 ${assumptionForm.returnRate || 4}%，折现率 ${assumptionForm.discountRate || 3}%。`);
  }

  function renderDock() {
    if (isDockLoading) {
      return (
        <div className="onboarding-input-card onboarding-loading-dock">
          <span>{isDockLoading}</span>
          <span className="loading-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
      );
    }

    if (!step) return null;

    if (step === 'planningScope') {
      return (
        <div className="onboarding-input-card profile-composer">
          <div className="input-card-copy">
            <strong>规划对象</strong>
          </div>
          <div className="profile-choice-grid">
            {planningScopeOptions.map((option) => (
              <button
                className={selectedPlanningScope === option.id ? 'active' : ''}
                key={option.id}
                type="button"
                onClick={() => selectPlanningScope(option.id)}
              >
                {option.name}
              </button>
            ))}
          </div>

          {selectedPlanningScope && (
            <div className={`linked-responsibilities ${selectedPlanningScope === 'single' ? 'from-single' : 'from-couple'}`}>
              <span>家庭责任</span>
              <div className="choice-chip-row">
                {responsibilityOptions.map((option) => (
                  <button
                    className={selectedResponsibilities.includes(option.id) ? 'selected' : ''}
                    key={option.id}
                    type="button"
                    onClick={() => toggleResponsibility(option.id)}
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPlanningScope && (
            <button className="onboarding-primary" disabled={selectedResponsibilities.length === 0} type="button" onClick={confirmProfile}>
              发送
            </button>
          )}
        </div>
      );
    }

    if (step === 'assetDebt') {
      return (
        <div className="onboarding-input-card grouped-input-card">
          <div className="input-card-copy">
            <strong>资产与负债</strong>
          </div>
          <div className="asset-debt-list">
            <OnboardingNumberField
              label="流动资产"
              placeholder="现金、存款、基金、股票、理财合计"
              unit="万元"
              value={assetDebtForm.liquidAssets}
              onChange={(value) => updateMoneyForm(setAssetDebtForm, 'liquidAssets', value)}
            />
            <OnboardingNumberField
              label="固定资产"
              placeholder="房产等流动性较低资产估值"
              unit="万元"
              value={assetDebtForm.lockedAssets}
              onChange={(value) => updateMoneyForm(setAssetDebtForm, 'lockedAssets', value)}
            />
            <OnboardingNumberField
              label="当前总负债"
              placeholder="所有贷款和信用负债合计"
              unit="万元"
              value={assetDebtForm.liabilities}
              onChange={(value) => updateMoneyForm(setAssetDebtForm, 'liabilities', value)}
            />
          </div>
          <button
            className="onboarding-primary"
            disabled={!assetDebtForm.liquidAssets || !assetDebtForm.lockedAssets || !assetDebtForm.liabilities}
            type="button"
            onClick={confirmAssetDebt}
          >
            发送
          </button>
        </div>
      );
    }

    if (step === 'cashflow') {
      const annualSurplus = Math.max(0, (toNumber(cashflowForm.annualIncome) - toNumber(cashflowForm.annualExpense)));

      return (
        <div className="onboarding-input-card grouped-input-card">
          <div className="input-card-copy">
            <strong>年度收入与支出</strong>
          </div>
          <div className="form-grid two">
            <OnboardingNumberField
              label="年度收入"
              placeholder="年度收入"
              unit="万元/年"
              value={cashflowForm.annualIncome}
              onChange={(value) => updateMoneyForm(setCashflowForm, 'annualIncome', value)}
            />
            <OnboardingNumberField
              label="年度支出"
              placeholder="年度支出"
              unit="万元/年"
              value={cashflowForm.annualExpense}
              onChange={(value) => updateMoneyForm(setCashflowForm, 'annualExpense', value)}
            />
          </div>
          <OnboardingNumberField
            label="预计工作年限"
            placeholder="从现在开始还能工作几年"
            unit="年"
            value={cashflowForm.workYears}
            onChange={(value) => updateMoneyForm(setCashflowForm, 'workYears', value)}
          />
          {cashflowForm.annualIncome && cashflowForm.annualExpense && (
            <p className="dock-summary">年度结余约 {annualSurplus.toFixed(0)} 万，月均结余约 {(annualSurplus / 12).toFixed(1)} 万。</p>
          )}
          <button
            className="onboarding-primary"
            disabled={!cashflowForm.annualIncome || !cashflowForm.annualExpense || !cashflowForm.workYears}
            type="button"
            onClick={confirmCashflow}
          >
            发送
          </button>
        </div>
      );
    }

    if (step === 'goalSelect') {
      return (
        <div className="onboarding-input-card goal-select-card">
          <div className="input-card-copy">
            <strong>未来目标</strong>
            <span>可以一次选择多个，也可以添加多个自定义目标。</span>
          </div>
          <div className="choice-chip-row">
            {intakeGoalOptions.map((option) => {
              const isSelected = selectedGoals.some((goal) => goal.id === option.id);
              return (
                <button className={isSelected ? 'selected' : ''} key={option.id} type="button" onClick={() => toggleGoal(option)}>
                  {isSelected ? `✓ ${option.name}` : option.name}
                </button>
              );
            })}
            {selectedGoals.filter((goal) => goal.custom).map((goal) => (
              <button className="selected" key={goal.id} type="button" onClick={() => setSelectedGoals((current) => current.filter((item) => item.id !== goal.id))}>
                ✓ {goal.name}
              </button>
            ))}
          </div>
          <button className="secondary-action" type="button" onClick={() => setIsCustomGoalOpen(true)}>
            <Plus size={15} />
            添加其他目标
          </button>
          <button className="onboarding-primary" disabled={selectedGoals.length === 0} type="button" onClick={confirmGoals}>
            发送
          </button>
        </div>
      );
    }

    if (step === 'goalDetail') {
      const activeGoal = goalQueue[goalCursor];
      const isRecurring = goalForm.frequency === 'monthly' || goalForm.frequency === 'yearly';

      return (
        <div className="onboarding-input-card goal-detail-composer">
          <div className="input-card-copy">
            <strong>补充「{activeGoal?.name}」</strong>
          </div>
          <section className="goal-dimension-card">
            <strong>金额与周期</strong>
            <div className="goal-money-row">
              <div className="field-shell">
                <span>支出周期</span>
                <div className="frequency-segmented">
                  {[
                    ['monthly', '每月'],
                    ['yearly', '每年'],
                    ['once', '一次性'],
                  ].map(([value, label]) => (
                    <button
                      className={goalForm.frequency === value ? 'active' : ''}
                      key={value}
                      type="button"
                      onClick={() => setGoalForm((current) => ({ ...current, frequency: value, duration: value === 'once' ? '' : current.duration }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <OnboardingNumberField
                label={goalForm.frequency === 'once' ? '目标金额' : '金额'}
                placeholder={goalForm.frequency === 'once' ? '目标金额' : '每期金额'}
                unit="万元"
                value={goalForm.amount}
                onChange={(value) => setGoalForm((current) => ({ ...current, amount: cleanNumericInput(value) }))}
              />
            </div>
          </section>
          <section className="goal-dimension-card muted">
            <strong>时间安排</strong>
            <div className="form-grid two">
              <OnboardingNumberField
                label="发生时间"
                placeholder="几年后"
                unit="年后"
                value={goalForm.startYear}
                onChange={(value) => setGoalForm((current) => ({ ...current, startYear: cleanNumericInput(value) }))}
              />
              <OnboardingNumberField
                disabled={!isRecurring}
                label="持续时间"
                placeholder={isRecurring ? '持续几年' : '一次性无持续'}
                unit="年"
                value={goalForm.duration}
                onChange={(value) => setGoalForm((current) => ({ ...current, duration: cleanNumericInput(value) }))}
              />
            </div>
          </section>
          <section className="goal-dimension-card">
            <strong>目标属性</strong>
            <div className="goal-priority-row">
              {[
                ['need', '必须'],
                ['want', '想要'],
              ].map(([value, label]) => (
                <button
                  className={goalForm.priority === value ? 'selected' : ''}
                  key={value}
                  type="button"
                  onClick={() => setGoalForm((current) => ({ ...current, priority: value }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          <button className="onboarding-primary" disabled={!canSubmitGoalDetail()} type="button" onClick={answerGoalDetail}>
            发送
          </button>
        </div>
      );
    }

    if (step === 'assumptions') {
      return (
        <div className="onboarding-input-card">
          <div className="input-card-copy">
            <strong>默认假设</strong>
          </div>
          <div className="assumption-row compact">
            <span>预期收益率 {assumptionForm.returnRate || 4}%</span>
            <span>折现率 {assumptionForm.discountRate || 3}%</span>
          </div>
          <div className="button-row">
            <button className="secondary-action" type="button" onClick={() => setStep('editAssumptions')}>
              修改
            </button>
            <button className="onboarding-primary" type="button" onClick={() => finishInterview()}>
              开始生成规划
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    if (step === 'editAssumptions') {
      return (
        <div className="onboarding-input-card grouped-input-card">
          <div className="input-card-copy">
            <strong>修改假设</strong>
          </div>
          <div className="form-grid two">
            <OnboardingNumberField
              label="预期收益率"
              placeholder="例如 4"
              unit="%"
              value={assumptionForm.returnRate}
              onChange={(value) => updateMoneyForm(setAssumptionForm, 'returnRate', value)}
            />
            <OnboardingNumberField
              label="折现率"
              placeholder="例如 3"
              unit="%"
              value={assumptionForm.discountRate}
              onChange={(value) => updateMoneyForm(setAssumptionForm, 'discountRate', value)}
            />
          </div>
          <button className="onboarding-primary" type="button" onClick={submitEditedAssumptions}>
            保存并计算
            <ArrowRight size={16} />
          </button>
        </div>
      );
    }

    return null;
  }

  function renderCustomGoalDialog() {
    if (!isCustomGoalOpen) return null;

    return (
      <div className="custom-goal-backdrop" role="presentation" onClick={() => setIsCustomGoalOpen(false)}>
        <section className="custom-goal-dialog" role="dialog" aria-modal="true" aria-labelledby="custom-goal-title" onClick={(event) => event.stopPropagation()}>
          <h2 id="custom-goal-title">这个目标具体是什么？</h2>
          <p>可以添加多个自定义目标，每个目标后面都会单独补充金额和时间。</p>
          <label className="form-field">
            <span>目标名称</span>
            <input
              autoFocus
              placeholder="例如：父母医疗、进修学习、创业启动金"
              value={customGoalDraft}
              onChange={(event) => setCustomGoalDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addCustomGoal();
              }}
            />
          </label>
          <div className="button-row">
            <button className="secondary-action" type="button" onClick={() => setIsCustomGoalOpen(false)}>
              取消
            </button>
            <button className="onboarding-primary" disabled={!customGoalDraft.trim()} type="button" onClick={addCustomGoal}>
              添加
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (stage === 'landing') {
    return (
      <div className="onboarding-shell">
        <section className="onboarding-phone">
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
          <div className="loading-card">
            <Sparkles size={26} />
            <h2>正在把对话整理成你的规划页</h2>
            <p>正在把你的家庭画像、未来收入和未来目标折算到今天，再判断长期规划是否站得住。</p>
            <div className="loading-lines">
              <span>重构真实资产</span>
              <span>折现未来收入</span>
              <span>折现未来目标</span>
              <span>生成长期规划判断</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="onboarding-shell">
      <section className="onboarding-phone chat-phone">
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
        {renderCustomGoalDialog()}
      </section>
    </div>
  );
}

function cleanAiText(value = '') {
  return String(value || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+[.)、]\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactAiText(value = '', maxLength = 92) {
  const text = cleanAiText(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function firstSentence(value = '', maxLength = 42) {
  const text = cleanAiText(value).replace(/\s+/g, ' ').trim();
  const sentence = text.split(/[。！？!?]/).find(Boolean) || text;
  return compactAiText(sentence, maxLength);
}

function splitFallbackCards(content = '') {
  const cleaned = cleanAiText(content);
  const numbered = cleaned
    .split(/\n\s*(?:\d+[.)、]|[一二三四五六七八九十]+[、.])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 12);
  const chunks = numbered.length >= 2
    ? numbered
    : cleaned
        .split(/\n+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 12);

  return chunks.slice(0, 3).map((chunk, index) => {
    const title = firstSentence(chunk, 14) || `要点 ${index + 1}`;
    return {
      title,
      body: compactAiText(chunk.replace(title, '').trim() || chunk, 96),
    };
  });
}

function normalizeUserVoiceQuestion(value = '') {
  let text = cleanAiText(value).replace(/[。.!！]+$/g, '').trim();
  if (!text) return '';

  const replacements = [
    [/^你是否想知道/, '我想知道'],
    [/^你是否需要/, '我是否需要'],
    [/^你是否/, '我是否'],
    [/^您是否/, '我是否'],
    [/^是否考虑/, '我是否要考虑'],
    [/^是否需要/, '我是否需要'],
    [/^是否可以/, '我是否可以'],
    [/^你希望/, '我想'],
    [/^你想/, '我想'],
    [/^你应该/, '我应该'],
    [/^你可以/, '我可以'],
    [/^请补充/, '我还需要补充'],
    [/^建议你/, '我是否应该'],
    [/^用户是否/, '我是否'],
    [/^用户可以/, '我可以'],
    [/^用户需要/, '我需要'],
    [/^用户/, '我'],
  ];

  replacements.some(([pattern, replacement]) => {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      return true;
    }
    return false;
  });

  if (!/^(我|我的|如果我|假如我|先|能不能|要不要|怎么|哪些|还差|还需要)/.test(text)) {
    text = `我想知道${text}`;
  }

  if (!/[？?]$/.test(text)) text += '？';
  return compactAiText(text, 30);
}

function normalizeFollowUpAnswer(content, question = '') {
  const parsed = parseAnalysisContent(content);
  const cardsSource = Array.isArray(parsed?.cards) ? parsed.cards : [];
  const normalizedCards = cardsSource
    .slice(0, 3)
    .map((card, index) => ({
      title: compactAiText(card.title || card.label || `要点 ${index + 1}`, 16),
      body: compactAiText(card.body || card.detail || card.reason || card.suggestion || card.description || '', 98),
    }))
    .filter((card) => card.title || card.body);
  const fallbackCards = normalizedCards.length ? normalizedCards : splitFallbackCards(content);
  const cleanContent = cleanAiText(content);
  const headline = compactAiText(parsed?.headline || firstSentence(cleanContent || question, 26), 26);
  const summary = compactAiText(
    parsed?.summary || parsed?.answer || parsed?.conclusion || cleanContent,
    112,
  );
  const nextQuestions = Array.isArray(parsed?.nextQuestions)
    ? parsed.nextQuestions
    : Array.isArray(parsed?.followUpQuestions)
      ? parsed.followUpQuestions
      : [];

  return {
    headline: headline || '先看关键变化',
    summary: summary || '我会基于当前财务地图，把这次问题拆成几个可执行判断。',
    cards: fallbackCards.length
      ? fallbackCards
      : [{ title: '下一步', body: '请补充一个具体数字或目标，我再帮你重新判断。' }],
    nextQuestions: nextQuestions.map(normalizeUserVoiceQuestion).filter(Boolean).slice(0, 3),
  };
}

function FollowUpAnswerCard({ answer, onAsk }) {
  return (
    <article className="followup-answer-card">
      <small>AI 回答</small>
      <h3>{answer.headline}</h3>
      <p>{answer.summary}</p>
      <div className="followup-card-list">
        {answer.cards.map((card) => (
          <section className="followup-point-card" key={`${card.title}-${card.body}`}>
            <strong>{card.title}</strong>
            <span>{card.body}</span>
          </section>
        ))}
      </div>
      {answer.nextQuestions.length > 0 && (
        <div className="followup-next-questions">
          {answer.nextQuestions.map((question) => (
            <button key={question} type="button" onClick={() => onAsk(question)}>
              {question}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function SupplementExperience({ initialQuestion = '', initialMode = '', modelSettings, onCancel, onComplete, onOpenSettings, plan }) {
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
  const initialModeRef = useRef(false);
  const metrics = useMemo(() => buildMetrics(plan), [plan]);

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

  useEffect(() => {
    const mode = String(initialMode || '').trim();
    if (!mode || initialModeRef.current) return;
    initialModeRef.current = true;
    chooseMode(mode);
  }, [initialMode]);

  function pushMessage(role, text, answer = null) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text, answer }]);
  }

  async function submitQuestionText(question) {
    const trimmed = String(question || '').trim();
    if (!trimmed || isAskingModel) return;

    pushMessage('user', trimmed);
    setQuestionInput('');

    setIsAskingModel(true);
    try {
      const result = await callManagedModel({
        question: trimmed,
        plan,
        metrics,
        recentMessages: messages.map((message) => ({
          ...message,
          text: message.text || message.answer?.summary || '',
        })),
      });
      const answer = normalizeFollowUpAnswer(result.content, trimmed);
      pushMessage('ai', answer.summary, answer);
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
          <div className="supplement-tool-row" aria-label="快捷补充">
            <button
              className="supplement-tool-button"
              type="button"
              aria-label="更新资产结构"
              title="更新资产结构"
              onClick={() => chooseMode('assets')}
            >
              <Radar size={18} />
            </button>
            <button
              className="supplement-tool-button"
              type="button"
              aria-label="新增一个目标"
              title="新增一个目标"
              onClick={() => chooseMode('goal')}
            >
              <Target size={18} />
            </button>
          </div>
          <form className="ai-question-form" onSubmit={submitQuestion}>
            <input
              placeholder="输入你的问题..."
              value={questionInput}
              onChange={(event) => setQuestionInput(event.target.value)}
            />
            <button disabled={isAskingModel || !questionInput.trim()} type="submit">
              <Send size={16} />
            </button>
          </form>
          {isAskingModel && <p className="model-thinking">正在思考...</p>}
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
            <div className={`chat-bubble ${message.role} ${message.answer ? 'structured' : ''}`} key={message.id}>
              {message.role === 'ai' && <Bot size={16} />}
              {message.answer ? (
                <FollowUpAnswerCard answer={message.answer} onAsk={submitQuestionText} />
              ) : (
                <p>{cleanAiText(message.text)}</p>
              )}
            </div>
          ))}
        </div>
        {renderSupplementDock()}
      </section>
    </div>
  );
}

function OnboardingNumberField({ disabled = false, label, onChange, placeholder, unit, value }) {
  return (
    <label className={`form-field ${disabled ? 'disabled' : ''}`}>
      <span>{label}</span>
      <div className="field-input-wrap">
        <input
          disabled={disabled}
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{unit}</em>
      </div>
    </label>
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

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function valueOrFallback(value, fallback) {
  const numeric = toNumber(value);
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : fallback;
}

function numberOrFallback(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const numeric = toNumber(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function actionButtonLabel(type) {
  if (type === 'editGoal') return '更改目标';
  if (type === 'createAccount') return '建立账户';
  if (type === 'reviewCashflow') return '复核现金流';
  return '设置计划';
}

function normalizeActionPoint(action, index, plan, metrics) {
  const monthlySurplus = Math.max(0, metrics.annualSurplus / 12);
  const monthlyExpense = Math.max(0, plan.annualExpense / 12);
  const emergencyTarget = Math.max(metrics.liquidAssets, monthlyExpense * 6);
  const base = {
    title: firstText(action?.title, action?.task, index === 0 ? '补足应急资金' : `行动 ${index + 1}`),
    type: action?.type || (index === 1 ? 'editGoal' : index === 2 ? 'createAccount' : index === 3 ? 'reviewCashflow' : 'setPlan'),
    reason: firstText(action?.reason, action?.why, '这一步会直接影响长期规划能否稳定执行。'),
    goal: firstText(action?.goal, action?.plan?.goal, '把建议拆成月度或周度动作，并纳入计划清单。'),
    buttonLabel: firstText(action?.buttonLabel, actionButtonLabel(action?.type)),
    plan: action?.plan || {},
  };

  if (base.plan && Object.keys(base.plan).length) return base;

  if (base.type === 'editGoal') {
    return {
      ...base,
      plan: {
        current: metrics.maxGoal?.name || '最大目标',
        target: '重新选择金额或时间',
        monthlyAction: '本周先保存一个保守版目标',
        weeklyAction: '和家人确认目标优先级',
        estimatedTime: '本周完成',
        checklist: ['确认目标能否延期', '确认目标金额能否降配', '保存新目标后重新生成 AI 结论'],
      },
    };
  }

  if (base.type === 'createAccount') {
    return {
      ...base,
      plan: {
        current: '尚未单独建账',
        target: '建立长期专项账户',
        monthlyAction: monthlySurplus > 0 ? `每月转入 ${money(monthlySurplus * 0.2)}` : '每月固定转入可承受金额',
        weeklyAction: '每周检查账户是否被日常支出动用',
        estimatedTime: '本月启动',
        checklist: ['建立独立账户', '设置自动转入', '每月复核目标进度'],
      },
    };
  }

  if (base.type === 'reviewCashflow') {
    return {
      ...base,
      plan: {
        current: `月均结余 ${money(monthlySurplus)}`,
        target: '确认每月真实可投入金额',
        monthlyAction: '每月底复核收入、支出和还款',
        weeklyAction: '每周记录一次大额支出',
        estimatedTime: '连续 4 周',
        checklist: ['拆出月收入', '拆出月支出', '标记哪些还款已包含在支出中'],
      },
    };
  }

  return {
    ...base,
    plan: {
      current: money(metrics.liquidAssets),
      target: money(emergencyTarget),
      monthlyAction: monthlySurplus > 0 ? `每月转入月结余的 10%，约 ${money(monthlySurplus * 0.1)}` : '每月固定转入可承受金额',
      weeklyAction: '现金流波动时，改为每周小额转入',
      estimatedTime: '12-18 个月',
      checklist: ['建立单独账户', '下个发薪日开始自动转入', '每月底复核一次余额'],
    },
  };
}

function normalizeResultAnalysis(aiAnalysis, plan, metrics) {
  const planningPoolPv = metrics.liquidAssets + metrics.surplusPv;
  const debtAdjustedAvailablePv = planningPoolPv - plan.liabilities;
  const totalGoalGapOrSurplus = debtAdjustedAvailablePv - metrics.totalTargetPv;
  const needGoalGapOrSurplus = debtAdjustedAvailablePv - metrics.needTargetPv;
  const wantRemainingAfterNeed = Math.max(0, debtAdjustedAvailablePv - metrics.needTargetPv);
  const wantGoalGapOrSurplus = wantRemainingAfterNeed - metrics.wantTargetPv;
  const hasTotalGap = totalGoalGapOrSurplus < 0;
  const rec = aiAnalysis?.reconstructedAssets || {};
  const core = aiAnalysis?.coreConclusion || {};
  const coverage = core.coverage || {};
  const coverageGapOrSurplus = numberOrFallback(coverage.gapOrSurplus, totalGoalGapOrSurplus);

  const fallbackRisks = [
    {
      title: '高价值资产不能救急',
      reason: '固定资产默认不直接用于日常支出和未来目标。',
      impact: '遇到收入中断或突发支出时，真正能调度的钱会偏薄。',
      action: '先补足应急资金，再重新测算目标。',
    },
    {
      title: '目标池过满',
      reason: `全部目标按今天算约 ${money(metrics.totalTargetPv)}。`,
      impact: hasTotalGap ? `与债务后可规划资产相比，还差 ${money(Math.abs(totalGoalGapOrSurplus))}。` : '当前有余量，但需要继续复核收入稳定性。',
      action: '先保必要目标，再重排想要目标。',
    },
  ];

  const rawActions = Array.isArray(aiAnalysis?.actions?.actionPoints) ? aiAnalysis.actions.actionPoints : [];
  const normalizedActions = (rawActions.length ? rawActions : [
    {
      title: '补足应急资金',
      type: 'setPlan',
      reason: '灵活资产不足时，突发支出会打断长期规划。',
      goal: '按月结余的 10% 自动转入高流动性账户；现金流波动时改为每周小额转入。',
      buttonLabel: '设置计划',
    },
    {
      title: '调整最大目标',
      type: 'editGoal',
      reason: '最大目标往往是长期规划的主要压力源。',
      goal: '把最大目标做成延后版、降配版和标准版，保存一个更稳的版本。',
      buttonLabel: '更改目标',
    },
    {
      title: '建立专项账户',
      type: 'createAccount',
      reason: '长期目标不能混在日常账户里。',
      goal: '立刻建立独立账户，按月投入并单独追踪。',
      buttonLabel: '建立账户',
    },
    {
      title: '复核月结余',
      type: 'reviewCashflow',
      reason: '如果还款已经算在支出里，模型不能再重复扣一次。',
      goal: '拆出月收入、月支出和月还款，确认真实可执行金额。',
      buttonLabel: '复核现金流',
    },
  ]).map((action, index) => normalizeActionPoint(action, index, plan, metrics));
  const primaryActions = normalizedActions.filter(
    (action) => action.type !== 'reviewCashflow' && !/复核|现金流|输入/.test(`${action.title}${action.buttonLabel}`),
  );
  const actionPoints = (primaryActions.length ? primaryActions : normalizedActions).slice(0, 3);

  return {
    intro: firstText(
      aiAnalysis?.intro,
      '我会先重构你真正可用的资产，再把未来每年能留下的钱，换算成“未来收入的今天价值”，和现在手里的钱放在一起判断。',
    ),
    reconstructedAssets: {
      title: firstText(rec.title, '重构后的真实资产'),
      narrative: firstText(rec.narrative, rec.summary, '这里不让你看复杂公式，只直接给两个关键结果：先看现在和未来合起来能规划多少钱，再看扣掉已有负债后还剩多少。'),
      planningPool: {
        label: firstText(rec.planningPool?.label, '合起来能规划的钱'),
        value: valueOrFallback(rec.planningPool?.value, planningPoolPv),
        description: firstText(rec.planningPool?.description, `由现在手里的钱 ${money(metrics.liquidAssets)}，加上未来收入的今天价值 ${money(metrics.surplusPv)} 组成。`),
      },
      debtAdjusted: {
        label: firstText(rec.debtAdjusted?.label, '扣掉已有负债后，真正能用于目标的钱'),
        value: valueOrFallback(rec.debtAdjusted?.value, debtAdjustedAvailablePv),
        debtDeducted: valueOrFallback(rec.debtAdjusted?.debtDeducted, plan.liabilities),
        description: firstText(rec.debtAdjusted?.description, `这个数才是后面判断未来目标够不够用的核心。这里已扣除当前总负债约 ${money(plan.liabilities)}。`),
      },
    },
    coreConclusion: {
      headline: firstText(
        core.headline,
        aiAnalysis?.headline,
        hasTotalGap ? '全部目标暂时达不成，先保必要目标，再重排想要目标。' : '全部目标目前能覆盖，但安全余量仍要持续复核。',
      ),
      insight: firstText(
        core.insight,
        core.incomeSupport,
        core.longTermRisk,
        hasTotalGap
          ? `债务后可规划资产约 ${money(debtAdjustedAvailablePv)}，全部目标按今天算约 ${money(metrics.totalTargetPv)}，缺口约 ${money(Math.abs(totalGoalGapOrSurplus))}。`
          : `债务后可规划资产约 ${money(debtAdjustedAvailablePv)}，全部目标按今天算约 ${money(metrics.totalTargetPv)}，当前有 ${money(totalGoalGapOrSurplus)} 余量。`,
      ),
      coverage: {
        available: valueOrFallback(coverage.available, debtAdjustedAvailablePv),
        totalGoal: valueOrFallback(coverage.totalGoal, metrics.totalTargetPv),
        gapOrSurplus: coverageGapOrSurplus,
        status: coverageGapOrSurplus < 0 ? 'gap' : 'surplus',
      },
      needGoal: {
        label: firstText(core.needGoal?.label, '必要目标'),
        value: valueOrFallback(core.needGoal?.value, metrics.needTargetPv),
        status: core.needGoal?.status || (needGoalGapOrSurplus >= 0 ? 'covered' : 'gap'),
        description: firstText(
          core.needGoal?.description,
          needGoalGapOrSurplus >= 0 ? `必要目标可以守住，但缓冲约 ${money(needGoalGapOrSurplus)}。` : `必要目标仍差约 ${money(Math.abs(needGoalGapOrSurplus))}。`,
        ),
      },
      wantGoal: {
        label: firstText(core.wantGoal?.label, '想要目标'),
        value: valueOrFallback(core.wantGoal?.value, metrics.wantTargetPv),
        status: core.wantGoal?.status || (wantGoalGapOrSurplus >= 0 ? 'covered' : 'gap'),
        description: firstText(
          core.wantGoal?.description,
          wantGoalGapOrSurplus >= 0 ? `想要目标也能覆盖，但需要保持收入稳定。` : `想要目标还差约 ${money(Math.abs(wantGoalGapOrSurplus))}，需要延期、降配或重新排序。`,
        ),
      },
    },
    risks: (Array.isArray(aiAnalysis?.risks) && aiAnalysis.risks.length ? aiAnalysis.risks : fallbackRisks)
      .slice(0, 3)
      .map((risk) => ({
        title: firstText(risk.title, '长期规划风险'),
        reason: firstText(risk.reason, risk.explanation, risk.evidence, '这个风险来自当前资产、负债和目标结构。'),
        impact: firstText(risk.impact, '它会挤压目标覆盖余量。'),
        action: firstText(risk.action, '先调整最关键的输入，再重新测算。'),
      })),
    actionPoints,
    followUpQuestions:
      Array.isArray(aiAnalysis?.followUpQuestions) && aiAnalysis.followUpQuestions.length
        ? aiAnalysis.followUpQuestions.slice(0, 3)
        : [
            '如果收入下降 20%，必要目标还能守住吗？',
            '换房目标延期到 10 年后会怎样？',
            '先补应急金，计划清单怎么排？',
          ],
  };
}

function MoneyValue({ value }) {
  const text = money(value);
  const match = text.match(/^(.+?)(万|亿)$/);
  if (!match) return text;
  return (
    <>
      {match[1]}
      <small>{match[2]}</small>
    </>
  );
}

function goalRowsForPriority(metrics, priority) {
  return metrics.goals
    .filter((goal) => goal.priority === priority)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      value: goal.presentValue,
    }));
}

function fallbackGoalRow(label, value) {
  return value > 0 ? [{ id: label, name: label, value }] : [];
}

function GoalValueList({ goals, mark = 'check' }) {
  return (
    <div className="goal-value-list core-ledger-details">
      {goals.map((goal) => (
        <div className="goal-value-row" key={goal.id || goal.name}>
          {mark === 'check' ? <i className="goal-check" /> : <i className="goal-choice-mark">?</i>}
          <span>{goal.name}</span>
          <em>{money(goal.value)}</em>
        </div>
      ))}
    </div>
  );
}

function CoreConclusionCard({ analysis, metrics }) {
  const available = analysis.coverage.available;
  const totalGoal = analysis.coverage.totalGoal;
  const needTotal = analysis.needGoal.value;
  const wantTotal = analysis.wantGoal.value;
  const totalGap = available - totalGoal;
  const needGap = available - needTotal;
  const wantGap = available - needTotal - wantTotal;
  const needGoals = goalRowsForPriority(metrics, 'need');
  const wantGoals = goalRowsForPriority(metrics, 'want');
  const safeNeedGoals = needGoals.length ? needGoals : fallbackGoalRow('必要目标', needTotal);
  const safeWantGoals = wantGoals.length ? wantGoals : fallbackGoalRow('想要目标', wantTotal);
  const status = totalGap >= 0 ? 'all-covered' : needGap >= 0 ? 'need-covered' : 'need-gap';

  return (
    <section className="standard-stack">
      <div className="core-state-list">
        <article className="core-state-card is-current">
          <h4>{analysis.headline}</h4>
          <p>{analysis.insight}</p>

          {status === 'all-covered' && (
            <div className="core-subsection">
              <div className="core-ledger-total">
                <strong>全部目标折现总额</strong>
                <span>{money(totalGoal)}</span>
              </div>
              <GoalValueList goals={[...safeNeedGoals, ...safeWantGoals]} mark="check" />
              <div className="core-ledger-result">
                <span>覆盖后盈余</span>
                <strong>{money(Math.max(0, totalGap))}</strong>
              </div>
            </div>
          )}

          {status === 'need-covered' && (
            <>
              <div className="core-subsection">
                <div className="core-ledger-total">
                  <strong>必要目标折现总额</strong>
                  <span>{money(needTotal)}</span>
                </div>
                <GoalValueList goals={safeNeedGoals} mark="check" />
                <div className="core-ledger-result">
                  <span>必要目标覆盖余量</span>
                  <strong>{money(Math.max(0, needGap))}</strong>
                </div>
              </div>
              {wantTotal > 0 && (
                <div className="core-subsection">
                  <div className="core-ledger-total">
                    <strong>想要目标折现总额</strong>
                    <span>{money(wantTotal)}</span>
                  </div>
                  <GoalValueList goals={safeWantGoals} mark="question" />
                  <div className="core-ledger-result-stack">
                    <div className="core-ledger-result">
                      <span>扣掉必要目标后的余量</span>
                      <strong>{money(Math.max(0, needGap))}</strong>
                    </div>
                    <div className="core-ledger-result deficit">
                      <span>想要目标总缺口</span>
                      <strong>{money(Math.max(0, -wantGap))}</strong>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'need-gap' && (
            <div className="core-subsection">
              <div className="core-ledger-total">
                <strong>必要目标折现总额</strong>
                <span>{money(needTotal)}</span>
              </div>
              <GoalValueList goals={safeNeedGoals} mark="question" />
              <div className="core-ledger-result deficit">
                <span>必要目标缺口</span>
                <strong>{money(Math.abs(needGap))}</strong>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function TypewriterText({ text, as: Component = 'p', className = '', onDone }) {
  const [displayed, setDisplayed] = useState('');
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let cancelled = false;
    const fullText = String(text || '');
    setDisplayed('');

    if (!fullText) {
      onDoneRef.current?.();
      return () => {
        cancelled = true;
      };
    }

    let index = 0;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      index += 1;
      setDisplayed(fullText.slice(0, index));
      if (index >= fullText.length) {
        window.clearInterval(timer);
        onDoneRef.current?.();
      }
    }, 22);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [text]);

  return <Component className={className}>{displayed}</Component>;
}

function TypedResultBubble({ active, label, text, children, onDone }) {
  const [typed, setTyped] = useState(false);

  useEffect(() => {
    setTyped(false);
  }, [text, active]);

  if (!active) return null;

  return (
    <article className="result-bubble ai result-typed-bubble">
      <small>{label}</small>
      <TypewriterText
        text={text}
        onDone={() => {
          setTyped(true);
          onDone?.();
        }}
      />
      {typed && children}
    </article>
  );
}

function PlanningPage({ metrics, modelSettings, plan, restartOnboarding, setActiveTab, startSupplement }) {
  const [questionDraft, setQuestionDraft] = useState('');
  const [analysisState, setAnalysisState] = useState({ status: 'idle', data: null, error: '' });
  const [analysisStep, setAnalysisStep] = useState(0);
  const [activePlanAction, setActivePlanAction] = useState(null);
  const [savedActionPlans, setSavedActionPlans] = useState([]);
  const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);
  const analysisKey = useMemo(
    () =>
      JSON.stringify({
        liquidAssets: plan.liquidAssets,
        lockedAssets: plan.lockedAssets,
        liabilities: plan.liabilities,
        annualIncome: plan.annualIncome,
        annualExpense: plan.annualExpense,
        workYears: plan.workYears,
        discountRate: plan.discountRate,
        goals: plan.goals,
      }),
    [plan],
  );
  const aiAnalysis = analysisState.data;
  const normalizedAnalysis = useMemo(
    () => (aiAnalysis ? normalizeResultAnalysis(aiAnalysis, plan, metrics) : null),
    [aiAnalysis, plan, metrics],
  );
  const analysisFollowUpQuestions = normalizedAnalysis?.followUpQuestions
    ?.map(normalizeUserVoiceQuestion)
    .filter(Boolean)
    .slice(0, 3);
  const dynamicQuestions =
    analysisFollowUpQuestions?.length
      ? analysisFollowUpQuestions
      : [
          '我先保必要目标，想要目标还能剩多少？',
          '如果我未来收入下降 20%，规划会怎样？',
          '我先补应急金，计划清单怎么排？',
        ];

  useEffect(() => {
    let cancelled = false;
    setAnalysisState({ status: 'loading', data: null, error: '' });
    setAnalysisStep(0);
    setActivePlanAction(null);
    setSavedActionPlans([]);

    callManagedAnalysis({ plan, metrics })
      .then((result) => {
        if (!cancelled) {
          setAnalysisState({ status: 'ready', data: result.analysis, error: '' });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalysisState({ status: 'error', data: null, error: error.message || 'AI 分析生成失败' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analysisKey, metrics]);

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

  function saveActionPlan() {
    if (!activePlanAction) return;
    setSavedActionPlans((current) => {
      const next = current.filter((item) => item.title !== activePlanAction.title);
      return [{ ...activePlanAction, savedAt: Date.now() }, ...next].slice(0, 3);
    });
    setActivePlanAction(null);
  }

  function openSection(section) {
    setIsPageMenuOpen(false);
    setActiveTab(section);
  }

  return (
    <section className="screen result-screen">
      <section className="result-chat-shell">
        <header className="result-topbar result-topbar-minimal">
          <div className="result-menu">
            <button
              className="result-menu-trigger"
              type="button"
              aria-label="打开规划菜单"
              aria-expanded={isPageMenuOpen}
              onClick={() => setIsPageMenuOpen((current) => !current)}
            >
              ...
            </button>
            {isPageMenuOpen && (
              <div className="result-menu-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => openSection('asset')}>
                  <PiggyBank size={16} />
                  <span>资产</span>
                </button>
                <button type="button" role="menuitem" onClick={() => openSection('goal')}>
                  <Target size={16} />
                  <span>目标</span>
                </button>
                <button type="button" role="menuitem" onClick={() => openSection('planning')}>
                  <Home size={16} />
                  <span>计划</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="result-chat-feed">
          <article className="result-bubble user">
            <p>我把家里的资产、收入、支出和未来目标都填完了。你直接告诉我，长期规划站不站得住。</p>
          </article>

          <article className="result-bubble ai compact">
            <small>分析说明</small>
            <p>
              我会先重构你真正可用的资产，再把未来每年能留下的钱，换算成“未来收入的今天价值”，和现在手里的钱放在一起判断。
            </p>
          </article>

          {analysisState.status === 'loading' && (
            <article className="result-bubble ai result-loading">
              <small>正在整理</small>
              <p>我正在把你的家庭财务地图拆成可规划资产、目标压力和行动顺序。</p>
              <section className="result-card result-loading-card">
                <div className="typing-loader" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="result-loading-steps">
                  <span>重构真实资产</span>
                  <span>换算未来收入的今天价值</span>
                  <span>判断目标和风险</span>
                </div>
              </section>
            </article>
          )}

          {analysisState.status === 'error' && (
            <article className="result-bubble ai">
              <small>AI 分析暂时失败</small>
              <p>{analysisState.error}</p>
              <section className="result-card">
                <div className="choice-buttons">
                  <button className="primary" type="button" onClick={() => startSupplement('请基于我的家庭财务画像，重新生成结构化分析。')}>重新生成分析</button>
                  <button className="secondary" type="button" onClick={() => setActiveTab('asset')}>检查输入</button>
                </div>
              </section>
            </article>
          )}

          {normalizedAnalysis && (
            <>
              <TypedResultBubble
                active={analysisStep >= 0}
                label={normalizedAnalysis.reconstructedAssets.title}
                text={normalizedAnalysis.reconstructedAssets.narrative}
                onDone={() => setAnalysisStep((current) => Math.max(current, 1))}
              >
                <section className="standard-stack">
                  <div className="standard-result-card">
                    <span className="standard-card-label">{normalizedAnalysis.reconstructedAssets.planningPool.label}</span>
                    <strong className="standard-card-value">
                      <MoneyValue value={normalizedAnalysis.reconstructedAssets.planningPool.value} />
                    </strong>
                    <p className="standard-card-explain">
                      这笔钱表示还没扣负债前，当前和未来合起来能规划的总额，由当前可动用资产 {money(metrics.liquidAssets)} + 未来收入今天价值 {money(metrics.surplusPv)} 组成。
                    </p>
                  </div>
                  <div className="standard-result-card emphasis">
                    <span className="standard-card-label">{normalizedAnalysis.reconstructedAssets.debtAdjusted.label}</span>
                    <strong className="standard-card-value">
                      <MoneyValue value={normalizedAnalysis.reconstructedAssets.debtAdjusted.value} />
                    </strong>
                    <p className="standard-card-explain">
                      这笔钱表示扣掉已有负债后，真正能用于未来目标的金额，由 {money(normalizedAnalysis.reconstructedAssets.planningPool.value)} - 当前总负债 {money(normalizedAnalysis.reconstructedAssets.debtAdjusted.debtDeducted)} = {money(normalizedAnalysis.reconstructedAssets.debtAdjusted.value)} 得到。
                    </p>
                  </div>
                </section>
              </TypedResultBubble>

              <TypedResultBubble
                active={analysisStep >= 1}
                label="核心结论"
                text={normalizedAnalysis.coreConclusion.insight}
                onDone={() => setAnalysisStep((current) => Math.max(current, 2))}
              >
                <CoreConclusionCard analysis={normalizedAnalysis.coreConclusion} metrics={metrics} />
              </TypedResultBubble>

              <TypedResultBubble
                active={analysisStep >= 2}
                label="风险"
                text="下面这些风险不是单个数字的问题，而是资产重构后暴露出来的长期压力。"
                onDone={() => setAnalysisStep((current) => Math.max(current, 3))}
              >
                <section className="standard-risk-list">
                  {normalizedAnalysis.risks.map((risk) => (
                    <article className="standard-risk-card" key={risk.title}>
                      <strong>风险：{risk.title}</strong>
                      <p>原因：{risk.reason}</p>
                    </article>
                  ))}
                </section>
              </TypedResultBubble>

              <TypedResultBubble
                active={analysisStep >= 3}
                label="行动建议"
                text="先把建议变成月度或周度动作，再决定是设置计划、调整目标，还是建立专项账户。"
                onDone={() => setAnalysisStep((current) => Math.max(current, 4))}
              >
                <section className="standard-stack">
                  <div className="standard-action-scroll">
                    {normalizedAnalysis.actionPoints.map((action, index) => (
                      <article className="standard-action-card" key={action.title}>
                        <div className="standard-action-head">
                          <small className="standard-action-step">{String(index + 1).padStart(2, '0')}</small>
                          <strong>{action.title}</strong>
                          <button type="button" onClick={() => setActivePlanAction(action)}>
                            {action.buttonLabel}
                          </button>
                        </div>
                        <div className="standard-action-content">
                          <div className="standard-action-line">
                            <span>原因</span>
                            <p>{action.reason}</p>
                          </div>
                          <div className="standard-action-line">
                            <span>目标</span>
                            <p>{action.goal}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {savedActionPlans.length > 0 && (
                    <div className="saved-plan-list">
                      <span>已生成计划清单</span>
                      {savedActionPlans.map((item) => (
                        <div key={item.title}>
                          <Check size={14} />
                          <strong>{item.title}</strong>
                          <p>{item.plan?.monthlyAction || item.goal}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </TypedResultBubble>
            </>
          )}
        </div>

        <footer className="result-composer">
          <div className="composer-toolbar" aria-label="追问工具">
            <div className="composer-tools">
              <button
                type="button"
                aria-label="更新资产结构"
                title="更新资产结构"
                onClick={() => startSupplement('', 'assets')}
              >
                <Radar size={17} />
              </button>
              <button
                type="button"
                aria-label="新增一个目标"
                title="新增一个目标"
                onClick={() => startSupplement('', 'goal')}
              >
                <Target size={17} />
              </button>
            </div>
            <div className="chips">
              {dynamicQuestions.map((question) => (
                <button key={question} type="button" onClick={() => startSupplement(question)}>{question}</button>
              ))}
            </div>
          </div>
          <form className="result-input-shell" onSubmit={submitQuestion}>
            <input
              placeholder="输入你的问题..."
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
            />
            <button type="submit">
              <Send size={15} />
            </button>
          </form>
        </footer>
      </section>

      {activePlanAction && (
        <div className="result-plan-modal" role="dialog" aria-modal="true">
          <section className="result-plan-sheet">
            <button className="modal-close" type="button" onClick={() => setActivePlanAction(null)}>
              ×
            </button>
            <small>计划清单</small>
            <h3>{activePlanAction.title}</h3>
            <p>{activePlanAction.reason}</p>
            <div className="plan-detail-grid">
              <div>
                <span>当前状态</span>
                <strong>{activePlanAction.plan?.current || '待确认'}</strong>
              </div>
              <div>
                <span>目标状态</span>
                <strong>{activePlanAction.plan?.target || activePlanAction.goal}</strong>
              </div>
              <div>
                <span>月度动作</span>
                <strong>{activePlanAction.plan?.monthlyAction || '每月复核并执行一次'}</strong>
              </div>
              <div>
                <span>周度动作</span>
                <strong>{activePlanAction.plan?.weeklyAction || '每周做一次轻量检查'}</strong>
              </div>
              <div>
                <span>预计周期</span>
                <strong>{activePlanAction.plan?.estimatedTime || '连续 4 周'}</strong>
              </div>
            </div>
            <div className="modal-checklist">
              {(activePlanAction.plan?.checklist || ['确认目标', '设置提醒', '月底复核']).map((item) => (
                <label key={item}>
                  <input type="checkbox" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <div className="choice-buttons">
              <button className="primary" type="button" onClick={saveActionPlan}>生成计划清单</button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setActivePlanAction(null);
                  if (activePlanAction.type === 'editGoal') setActiveTab('goal');
                }}
              >
                {activePlanAction.type === 'editGoal' ? '去目标页' : '稍后处理'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function CoachPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState(coachScenarios[0].id);
  const [observerMode, setObserverMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [userNote, setUserNote] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      id: crypto.randomUUID(),
      role: 'ai',
      text: '我会先确认你要配置什么，再观察当前页面状态，只给你下一步该做的动作。敏感信息你自己确认，我不会要求你把密钥发出来。',
    },
  ]);
  const activeScenario = coachScenarios.find((scenario) => scenario.id === selectedScenarioId) || coachScenarios[0];
  const checkpoint = activeScenario.checkpoints[stepIndex];
  const progress = Math.round(((stepIndex + 1) / activeScenario.checkpoints.length) * 100);

  function pushMessage(role, text) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text }]);
  }

  function chooseScenario(id) {
    const nextScenario = coachScenarios.find((scenario) => scenario.id === id) || coachScenarios[0];
    setSelectedScenarioId(nextScenario.id);
    setStepIndex(0);
    setObserverMode(false);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'ai',
        text: `我们先跑「${nextScenario.name}」。我会按 ${nextScenario.checkpoints.length} 个节点陪你走，每次只推进一个可验证动作。`,
      },
    ]);
  }

  function toggleObserverMode() {
    setObserverMode((current) => {
      const next = !current;
      pushMessage(
        'ai',
        next
          ? '观察模式已开启。真实接入时这里会读取屏幕/浏览器状态；当前原型用任务节点模拟观察结果。'
          : '观察模式已暂停。你可以继续描述当前页面，我会按文字帮你判断。',
      );
      return next;
    });
  }

  function advanceStep() {
    if (stepIndex >= activeScenario.checkpoints.length - 1) {
      pushMessage('ai', `「${activeScenario.name}」已经走到最后一个验证点。现在适合做一次完整复测，再把成功截图或日志存档。`);
      return;
    }

    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    pushMessage('user', '我完成了这一步。');
    pushMessage('ai', `好，进入「${activeScenario.checkpoints[nextIndex].title}」。先看页面是否符合观察结果，再做下一步动作。`);
  }

  function reportStuck() {
    pushMessage('user', '我卡住了。');
    pushMessage('ai', `先停在当前页面，不要连续乱点。请看有没有报错、红色提示或保存按钮置灰；如果有，把提示文字描述给我，我会判断是权限、路径、网络还是填写格式问题。`);
  }

  function resetRun() {
    setStepIndex(0);
    setObserverMode(false);
    setUserNote('');
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'ai',
        text: `已重置「${activeScenario.name}」。我们从第一个节点重新走，这次每一步都先验证再继续。`,
      },
    ]);
  }

  function submitNote(event) {
    event.preventDefault();
    const note = userNote.trim();
    if (!note) return;
    pushMessage('user', note);
    setUserNote('');

    if (/报错|失败|打不开|404|403|500|error/i.test(note)) {
      pushMessage('ai', `这像是失败态。先不要改多处配置，只回到「${checkpoint.title}」这一项检查：${checkpoint.verify}`);
      return;
    }

    if (/key|密钥|token|密码|验证码/i.test(note)) {
      pushMessage('ai', '这里涉及敏感信息。你自己在页面里粘贴和确认即可，不要把完整内容发给我。完成后只告诉我“已保存”或“提示失败”。');
      return;
    }

    pushMessage('ai', `我会把你看到的状态对齐到当前节点。下一步建议：${checkpoint.nextAction}`);
  }

  return (
    <Screen
      eyebrow="陪跑"
      title="配置陪跑 agent"
      subtitle="把安装、授权、部署这些卡人的流程拆成下一步、风险点和验证结果"
      action={<Monitor size={20} />}
    >
      <section className="coach-hero">
        <div>
          <span className="coach-status-line">
            <Sparkles size={14} />
            可交互 MVP
          </span>
          <h2>你只负责确认关键选择</h2>
          <p>Agent 负责读当前状态、判断下一步、发现风险并把失败恢复路径讲清楚。</p>
        </div>
        <button className={observerMode ? 'coach-observe-button active' : 'coach-observe-button'} type="button" onClick={toggleObserverMode}>
          {observerMode ? <Eye size={18} /> : <Play size={18} />}
          <span>{observerMode ? '观察中' : '开始观察'}</span>
        </button>
      </section>

      <Panel title="配置任务" icon={<Settings size={18} />}>
        <div className="coach-scenario-grid">
          {coachScenarios.map((scenario) => (
            <button
              className={scenario.id === activeScenario.id ? 'active' : ''}
              key={scenario.id}
              type="button"
              onClick={() => chooseScenario(scenario.id)}
            >
              <strong>{scenario.name}</strong>
              <span>{scenario.summary}</span>
            </button>
          ))}
        </div>
      </Panel>

      <section className="panel coach-live-panel">
        <div className="panel-title">
          <div>
            <Radar size={18} />
            <h3>实时状态</h3>
          </div>
          <span>{progress}%</span>
        </div>
        <div className="coach-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="coach-step-list">
          {activeScenario.checkpoints.map((item, index) => (
            <button
              className={`${index === stepIndex ? 'active' : ''} ${index < stepIndex ? 'done' : ''}`}
              key={item.title}
              type="button"
              onClick={() => setStepIndex(index)}
            >
              {index < stepIndex ? <Check size={15} /> : <span>{index + 1}</span>}
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="coach-observation-grid">
        <section className="panel coach-observation-panel">
          <div className="panel-title">
            <div>
              <Eye size={18} />
              <h3>我看到的状态</h3>
            </div>
            <span>{observerMode ? '已授权' : '待授权'}</span>
          </div>
          <p>{observerMode ? checkpoint.observed : '开启观察后，Agent 会把当前屏幕状态归类到一个配置节点。当前原型先用模拟状态展示。'}</p>
          <div className="coach-screen-frame">
            <div className="coach-browser-bar">
              <i />
              <i />
              <i />
              <span>{activeScenario.summary}</span>
            </div>
            <div className="coach-screen-body">
              <b>{checkpoint.title}</b>
              <span>{observerMode ? checkpoint.observed : '等待屏幕观察授权'}</span>
            </div>
          </div>
        </section>

        <section className="panel coach-next-panel">
          <div className="panel-title">
            <div>
              <MousePointer2 size={18} />
              <h3>下一步</h3>
            </div>
          </div>
          <div className="coach-action-block">
            <strong>{checkpoint.nextAction}</strong>
            <span>{checkpoint.verify}</span>
          </div>
          <div className="coach-risk-block">
            <AlertTriangle size={17} />
            <p>{checkpoint.risk}</p>
          </div>
          <div className="coach-action-row">
            <button className="primary-button" type="button" onClick={advanceStep}>
              <Check size={17} />
              我完成了
            </button>
            <button className="done-button" type="button" onClick={reportStuck}>
              我卡住了
            </button>
          </div>
        </section>
      </section>

      <section className="panel coach-chat-panel">
        <div className="panel-title">
          <div>
            <Bot size={18} />
            <h3>陪跑对话</h3>
          </div>
          <button type="button" onClick={resetRun}>
            <RefreshCcw size={14} />
            重来
          </button>
        </div>
        <div className="coach-message-list">
          {messages.map((message) => (
            <div className={`coach-message ${message.role}`} key={message.id}>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <form className="result-input-shell" onSubmit={submitNote}>
          <input
            placeholder="描述你现在看到的页面或报错..."
            value={userNote}
            onChange={(event) => setUserNote(event.target.value)}
          />
          <button type="submit" aria-label="发送当前状态">
            <Send size={15} />
          </button>
        </form>
      </section>

      <section className="coach-safety-panel">
        <ShieldCheck size={18} />
        <div>
          <strong>安全边界</strong>
          <p>密码、验证码、API Key、付款确认由你自己输入和确认；Agent 只判断页面状态、提醒风险和验证结果。</p>
        </div>
      </section>
    </Screen>
  );
}

function ModelSettingsPage({ metrics, plan }) {
  const [testStatus, setTestStatus] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  async function testModel() {
    setIsTesting(true);
    setTestStatus('正在调用托管 AI 服务...');
    try {
      const result = await callManagedModel({
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
    <Screen eyebrow="AI" title="托管 AI 服务" subtitle="测试版本默认使用 DeepSeek；体验用户不需要填写 API Key" action={<Settings size={20} />}>
      <section className="panel model-privacy-panel">
        <div>
          <ShieldCheck size={20} />
          <strong>DeepSeek 已由测试方服务端统一配置</strong>
        </div>
        <p>体验用户不用填写 API Key。追问时，当前规划摘要会发送到 CloudBase 云函数，再由云函数调用 DeepSeek。规划数据仍保存在当前设备，云端只承担本次 AI 问答转发。</p>
      </section>

      <Panel title="当前模型" icon={<KeyRound size={18} />}>
        <ReadOnlyRow label="服务商" value="DeepSeek" />
        <ReadOnlyRow label="模型" value="deepseek-chat" />
        <ReadOnlyRow label="调用方式" value="CloudBase 云函数代理" />
      </Panel>

      <Panel title="连通性测试" icon={<Sparkles size={18} />}>
        <button className="primary-button" disabled={isTesting} type="button" onClick={testModel}>
          <Sparkles size={18} />
          测试 AI 服务
        </button>
        {testStatus && <p className={testStatus.includes('可用') ? 'model-test-status good' : 'model-test-status'}>{testStatus}</p>}
      </Panel>

      <section className="panel model-help-panel">
        <strong>部署要求</strong>
        <p>CloudBase 云函数需要配置环境变量 DEEPSEEK_API_KEY，并把 HTTP 访问路径映射到 /api/ai-chat。不要把 API Key 写进前端代码或静态托管文件。</p>
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
