# AI Monitor Supplement Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic continue-AI entry with a monitoring-style AI entry and let users click it to enter a supplemental chat flow that updates the plan and returns to a regenerated planning page.

**Architecture:** Keep supplement data transforms in `src/supplement.mjs` with Node tests. Add a `SupplementExperience` React flow in `src/main.jsx`, launched from both the floating AI dock and the planning card. Reuse existing chat/onboarding visual language and keep the feature local-only.

**Tech Stack:** React 18, Vite, lucide-react, Node built-in test runner.

---

### Task 1: Supplement Data Logic

**Files:**
- Create: `src/supplement.mjs`
- Create: `src/supplement.test.mjs`
- Modify: `package.json`

- [x] Add failing tests for asset supplement and goal supplement.
- [x] Run `npm test` and verify red failure from missing implementation.
- [x] Implement `buildSupplementGoal` and `applyPlanSupplement`.
- [x] Run `npm test` and verify green.

### Task 2: Supplement Chat Flow

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [x] Add App-level supplement mode.
- [x] Add `SupplementExperience` with choose/update-assets/add-goal/loading stages.
- [x] Wire floating AI dock and planning AI card to the same flow.
- [x] Return to planning page after completion.

### Task 3: Monitoring Entry Visual

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/styles.css`

- [x] Replace Sparkles icon in the floating entry with a monitoring/radar icon.
- [x] Update copy to `AI 监测`.
- [x] Add pulse/scan visual treatment.

### Task 4: Verification

**Files:**
- Verify: project root

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Confirm preview URL returns `200 OK`.
- [x] Scan changed files for placeholders and broken text.
