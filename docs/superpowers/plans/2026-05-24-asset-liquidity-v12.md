# Asset Liquidity v1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the v1.2 asset liquidity model so the app distinguishes immediately usable assets from hard-to-liquidate assets and reflects that in onboarding, calculations, AI summary, and the asset page.

**Architecture:** Keep the calculation logic in `src/finance.mjs` and treat `assets` as a derived compatibility field equal to `liquidAssets + lockedAssets`. Update `src/main.jsx` to collect and edit the two asset fields while preserving old saved data. Keep UI changes scoped to existing onboarding, asset page, and planning page components.

**Tech Stack:** React 18, Vite, localStorage, Node built-in test runner.

---

### Task 1: Calculation Model

**Files:**
- Modify: `src/finance.mjs`
- Test: `src/finance.test.mjs`

- [x] Add failing tests for `liquidAssets`, `lockedAssets`, callable resources, book resources, and asset lock risk.
- [x] Run `npm test` and verify the new tests fail before implementation.
- [x] Implement derived asset metrics in `buildMetrics`.
- [x] Update `buildAiReport` ratios, risks, headline, and actions.
- [x] Run `npm test` and verify all finance tests pass.

### Task 2: Onboarding and Data Normalization

**Files:**
- Modify: `src/main.jsx`

- [x] Add `liquidAssets` and `lockedAssets` to `defaultPlan`.
- [x] Update `normalizePlan` so old `assets`-only data maps to `lockedAssets = assets`, `liquidAssets = 0`.
- [x] Change onboarding first two asset questions to collect可立即动用资产 and不易变现资产.
- [x] Ensure `assets` is saved as `liquidAssets + lockedAssets`.

### Task 3: Asset and Planning Pages

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [x] Asset page shows editable可立即动用资产 and不易变现资产.
- [x] Asset page shows read-only总资产 and当前净资产.
- [x] Planning page shows可调用资源 and账面资源 together.
- [x] Planning page uses callable coverage as the main resource coverage and still shows book coverage.

### Task 4: Verification

**Files:**
- Verify: project root

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Confirm preview URL returns `200 OK`.
- [x] Scan for placeholder or broken text in changed files.
