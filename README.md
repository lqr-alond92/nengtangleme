# 能躺了吗

「能躺了吗」是一个面向家庭长期财务规划的 PWA 原型，用聊天式问诊帮助用户补全家庭资产、负债、收入、支出和人生目标，并生成“是否具备躺的条件”的规划判断。

## 核心功能

- 新人引导：通过分步问诊收集关键家庭财务信息。
- 资产页：维护总资产、可立即动用资产、不易变现资产、负债、收入和支出。
- 规划页：展示核心结论、风险解释、行动建议和 AI 补充入口。
- 目标页：维护一次性目标和持续性目标，区分必须目标与想要目标。
- 设备保存：使用当前手机浏览器本地存储保留用户规划数据。
- 托管 AI：测试版本默认通过 CloudBase 云函数调用 DeepSeek，体验用户不需要填写 API Key。
- PWA 支持：包含 Web App Manifest、Service Worker 和应用图标。

## 技术栈

- React 18
- Vite
- lucide-react
- Node.js test runner

## 开发者本地开发

```bash
npm install
npm run dev
```

开发服务默认运行在 `http://127.0.0.1:5173`。

`127.0.0.1` 只适合开发者在自己的电脑上调试，不是体验用户的手机入口。

如果需要调试第一阶段后端 API，可以额外启动：

```bash
npm run dev:full
```

前端仍然运行在 `http://127.0.0.1:5173`，后端 API 运行在 `http://127.0.0.1:8787`。

## 手机 Alpha 体验用户说明

手机体验用户不需要安装 Node.js，也不需要注册登录。正确方式是由开发者先把 `dist/` 部署到一个 HTTPS 静态站点，然后把站点地址发给体验用户。

开发者构建静态 PWA：

```bash
npm install
npm run build
```

部署 `dist/` 目录到任意 HTTPS 静态托管服务。当前腾讯云测试版本还需要同时部署 `cloudfunctions/ai-chat` 云函数，用于服务端代理 DeepSeek。

体验用户操作：

1. 用手机浏览器打开开发者提供的 HTTPS 地址。
2. 在浏览器菜单中选择“添加到主屏幕”，之后可像普通 App 一样从桌面打开。
3. 完成首次问诊。规划数据会保存在当前手机浏览器的 `localStorage`，不要求注册或登录。
4. 点击顶部状态条的“AI”或底部“AI”Tab，可以测试托管 AI 服务是否可用。
5. 回到“规划”页，在底部输入框继续提问，或点击“继续问 AI / AI 监测”。浏览器会请求 CloudBase 云函数，由云函数调用 DeepSeek。

DeepSeek API Key 不写入前端代码。请在 CloudBase 云函数环境变量中配置 `DEEPSEEK_API_KEY`，并将云函数 HTTP 路径映射到 `/api/ai-chat`。

更完整的手机 Alpha 流程见 [docs/mobile-alpha-pwa.md](docs/mobile-alpha-pwa.md)。
DeepSeek 代理部署见 [docs/cloudbase-deepseek-proxy.md](docs/cloudbase-deepseek-proxy.md)。

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

## 上线计划

正式上线实施方案见 [docs/launch/正式上线实施方案.md](docs/launch/正式上线实施方案.md)。
下一步执行清单见 [docs/launch/NEXT_STEPS.md](docs/launch/NEXT_STEPS.md)。
阿里云部署架构与域名解析规划见 [docs/launch/阿里云部署架构与域名解析规划.md](docs/launch/阿里云部署架构与域名解析规划.md)。
`nengtangleme.cn` 域名、ICP备案、公安备案、DNS 和 HTTPS 清单见 [docs/launch/nengtangleme-cn-备案上线清单.md](docs/launch/nengtangleme-cn-备案上线清单.md)。
