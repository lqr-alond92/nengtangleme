# 能躺了吗

「能躺了吗」是一个面向家庭长期财务规划的 PWA 原型，用聊天式问诊帮助用户补全家庭资产、负债、收入、支出和人生目标，并生成“是否具备躺的条件”的规划判断。

## 核心功能

- 新人引导：通过分步问诊收集关键家庭财务信息。
- 资产页：维护总资产、可立即动用资产、不易变现资产、负债、收入和支出。
- 规划页：展示核心结论、风险解释、行动建议和 AI 补充入口。
- 目标页：维护一次性目标和持续性目标，区分必须目标与想要目标。
- 本地保存：使用浏览器本地存储保留用户规划数据。
- PWA 支持：包含 Web App Manifest、Service Worker 和应用图标。

## 技术栈

- React 18
- Vite
- lucide-react
- Node.js test runner

## 本地开发

```bash
npm install
npm run dev
```

开发服务默认运行在 `http://127.0.0.1:5173`。

## 测试与构建

```bash
npm test
npm run build
```

## 项目结构

```text
src/
  main.jsx              # App 入口和页面交互
  finance.mjs           # 财务指标、规划判断和 AI 报告逻辑
  supplement.mjs        # AI 补充信息归一化与计划更新
  *.test.mjs            # 核心计算测试
public/
  manifest.webmanifest  # PWA manifest
  sw.js                 # Service Worker
docs/
  mvp-prd.md            # MVP 产品需求文档
  prd/                  # PRD 版本记录和决策文档
```

## 产品文档

主要产品方案见 [docs/mvp-prd.md](docs/mvp-prd.md)，完整 PRD 版本记录见 [docs/prd/](docs/prd/)。
