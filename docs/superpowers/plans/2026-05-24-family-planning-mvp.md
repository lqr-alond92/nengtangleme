# Family Planning MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved PRD into a working mobile-first React MVP with PRD version management, AI-style onboarding, step-by-step interview, planning results, and persistent 3-tab workspace.

**Architecture:** Keep the app lightweight and local-first. Extract financial calculations into a pure module with Node tests, then let `src/main.jsx` handle UI state, onboarding flow, and localStorage persistence. The visual system keeps the current warm professional planning UI while adding a dark premium AI onboarding surface from the approved demo.

**Tech Stack:** React 18, Vite, lucide-react, CSS, Node built-in test runner.

---

### Task 1: PRD Version Management

**Files:**
- Create: `docs/prd/README.md`
- Create: `docs/prd/_template.md`
- Create: `docs/prd/PRD-001-family-planning-mvp/v0.1.md`
- Create: `docs/prd/PRD-001-family-planning-mvp/v1.0.md`
- Create: `docs/prd/PRD-001-family-planning-mvp/CHANGELOG.md`
- Create: `docs/prd/PRD-001-family-planning-mvp/decisions.md`

- [x] **Step 1: Create PRD folder structure**

Run:

```bash
mkdir -p docs/prd/PRD-001-family-planning-mvp
```

- [x] **Step 2: Preserve existing PRD as v0.1**

Run:

```bash
cp docs/mvp-prd.md docs/prd/PRD-001-family-planning-mvp/v0.1.md
```

- [x] **Step 3: Create approved v1.0 baseline**

Run:

```bash
cp docs/prd/PRD-001-family-planning-mvp/v0.1.md docs/prd/PRD-001-family-planning-mvp/v1.0.md
```

Patch the header to:

```markdown
版本：v1.0
日期：2026-05-24
状态：Approved
阶段：MVP 产品开发基准
```

### Task 2: Financial Calculation Module

**Files:**
- Create: `src/finance.mjs`
- Create: `src/finance.test.mjs`
- Modify: `package.json`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write tests for present-value and metric behavior**

Create `src/finance.test.mjs` with tests for:

- one-time goal PV discounts future lump-sum goals;
- recurring goal PV discounts annualized monthly spending;
- metrics include 7 ratios and classify future income dependency.

Run:

```bash
node --test src/finance.test.mjs
```

Expected: fail because `src/finance.mjs` does not exist.

- [ ] **Step 2: Implement `src/finance.mjs`**

Move pure calculation helpers out of `src/main.jsx`:

- `toNumber`
- `decimal`
- `money`
- `percent`
- `annualSurplusAtYear`
- `futureSurplusPresentValue`
- `oneTimeGoalPresentValue`
- `recurringGoalPresentValue`
- `goalPresentValue`
- `buildMetrics`
- `buildAiReport`

- [ ] **Step 3: Run tests until green**

Run:

```bash
node --test src/finance.test.mjs
```

Expected: all tests pass.

### Task 3: Onboarding Interview State

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add onboarding state**

Add app states:

```js
const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(loadOnboardingState);
const [onboardingStage, setOnboardingStage] = useState('landing');
const [messages, setMessages] = useState(initialOnboardingMessages);
const [interviewStep, setInterviewStep] = useState('start');
```

- [ ] **Step 2: Add landing choice**

First option text:

```txt
生成我的家庭财务规划
```

Clicking it appends user message:

```txt
我想生成一份家庭财务规划。
```

Then AI replies:

```txt
我先帮你搭一张家庭财务地图。你不用一次填完，我会一个问题一个问题问，只收集会影响人生计划的数字。
```

- [ ] **Step 3: Ask one question at a time**

Implement interview order:

1. 总资产；
2. 总负债；
3. 年度收入；
4. 年度结余；
5. 必须目标多选；
6. 逐个补全必须目标；
7. 想要目标多选；
8. 默认假设确认。

### Task 4: Planning Workspace

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Rename tabs**

Bottom tabs must be:

```txt
资产 / 规划 / 目标
```

- [ ] **Step 2: Add planning page structure**

Planning page sections:

1. 懂你的 AI；
2. 核心判断；
3. 理性的我；
4. 理性行动的我；
5. 我的资产；
6. 我的目标；
7. 继续问 AI。

- [ ] **Step 3: Keep AI inside planning**

Do not create a standalone AI tab. Add a persistent AI entry above the bottom nav:

```txt
继续问 AI：补充情况、测试决定、调整目标
```

### Task 5: Visual Integration

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add dark premium onboarding style**

Use the approved demo direction:

- deep brown / warm black background;
- cream cards;
- restrained gold accent;
- chat bubbles;
- staged loading.

- [ ] **Step 2: Preserve product workspace clarity**

Formal workspace keeps lighter planning cards for readability, but aligns accent colors and spacing with onboarding.

### Task 6: Verification

**Files:**
- `package.json`
- `src/finance.test.mjs`
- `src/main.jsx`
- `src/styles.css`

- [ ] **Step 1: Run calculation tests**

```bash
npm test
```

- [ ] **Step 2: Run production build**

```bash
npm run build
```

- [ ] **Step 3: Run preview and inspect app**

```bash
npm run preview
```

Open `http://127.0.0.1:4173/` and verify:

- first-time user sees onboarding landing;
- first option enters chat;
- questions appear one at a time;
- completion shows loading, then planning page;
- bottom tabs show 资产 / 规划 / 目标;
- planning page includes 7 indicators;
- no broken text, `undefined`, `NaN`, or stray demo glyphs.
