# 能躺了吗

「能躺了吗」是一个面向家庭长期财务规划的 PWA 原型，用聊天式问诊帮助用户补全家庭资产、负债、收入、支出和人生目标，并生成“是否具备躺的条件”的规划判断。

## 核心功能

- 新人引导：通过分步问诊收集关键家庭财务信息。
- 资产页：维护总资产、可立即动用资产、不易变现资产、负债、收入和支出。
- 规划页：展示核心结论、风险解释、行动建议和 AI 补充入口。
- 目标页：维护一次性目标和持续性目标，区分必须目标与想要目标。
- 设备保存：使用当前手机浏览器本地存储保留用户规划数据。
- 自带模型 Key：体验用户可在自己手机上填写通义千问 / DeepSeek / Kimi API Key，用于“继续问 AI”。
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

部署 `dist/` 目录到任意 HTTPS 静态托管服务。可选方案包括 GitHub Pages、Cloudflare Pages、Netlify、Vercel、对象存储静态网站等。这个静态站点只负责分发前端文件，不保存用户计划、不保存 API Key。

体验用户操作：

1. 用手机浏览器打开开发者提供的 HTTPS 地址。
2. 在浏览器菜单中选择“添加到主屏幕”，之后可像普通 App 一样从桌面打开。
3. 完成首次问诊。规划数据会保存在当前手机浏览器的 `localStorage`，不要求注册或登录。
4. 点击顶部状态条的“模型”或底部“模型”Tab，选择模型服务商。优先推荐“通义千问”，默认接口为阿里云百炼 OpenAI 兼容接口。
5. 在“API Key”输入框粘贴自己的模型 Key。Key 只保存在当前手机浏览器 `localStorage`，不会上传到「能躺了吗」服务器。
6. 可点击“测试模型调用”确认 Key、模型名和接口地址可用。
7. 回到“规划”页，在底部输入框继续提问，或点击“继续问 AI / AI 监测”。浏览器会用你配置的 Key 直接调用所选模型服务商。

默认模型配置：

| 服务商 | 默认模型 | 默认接口 |
| --- | --- | --- |
| 通义千问 | `qwen-plus` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| DeepSeek | `deepseek-chat` | `https://api.deepseek.com/chat/completions` |
| Kimi | `kimi-k2.6` | `https://api.moonshot.ai/v1/chat/completions` |

如果服务商调整模型名或接口地址，可以在模型设置页直接修改。

注意：手机浏览器直连模型服务商需要服务商接口允许浏览器跨域调用。如果“测试模型调用”出现 CORS 或网络拦截，说明该服务商不支持这种纯前端直连方式；此时要么让体验用户使用自己的代理地址，要么后续改成服务端代理方案。服务端代理会让 Key 经过服务器，和“Key 不上传”的约束不同，需要单独评审。

更完整的手机 Alpha 流程见 [docs/mobile-alpha-pwa.md](docs/mobile-alpha-pwa.md)。

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
