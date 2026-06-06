# CloudBase DeepSeek 代理部署说明

目标：体验用户打开 PWA 后默认可用 DeepSeek，不需要自己填写 API Key。DeepSeek API Key 只放在腾讯云 CloudBase 云函数环境变量里，不写入前端代码和静态托管文件。

## 安全提醒

不要把 DeepSeek API Key 写进：

- `src/` 前端代码
- `public/` 静态资源
- `dist/` 构建产物
- GitHub 仓库
- 聊天记录或公开文档

如果 Key 曾经发到聊天窗口、截图或公开页面，请立刻在 DeepSeek 平台删除/作废，并重新创建一个新 Key。

## 文件位置

当前项目已包含 CloudBase 云函数：

```text
cloudfunctions/ai-chat/index.js
cloudfunctions/ai-chat/package.json
```

前端会请求：

```text
POST /api/ai-chat
```

云函数再请求：

```text
https://api.deepseek.com/chat/completions
```

## CloudBase 控制台配置

1. 进入 CloudBase 环境。
2. 打开「云函数 / 托管 / 主机」或「云函数」功能。
3. 新建云函数：

```text
函数名称：ai-chat
运行环境：Node.js 18 或更新版本
入口文件：index.js
代码目录：cloudfunctions/ai-chat
```

4. 配置环境变量：

```text
DEEPSEEK_API_KEY=你的新 DeepSeek API Key
```

5. 配置 HTTP 访问或 HTTP 触发器，把路径映射为：

```text
/api/ai-chat
```

如果控制台不支持直接映射到这个路径，可以先记录它生成的 HTTP 访问地址，再把前端 `src/modelClient.mjs` 里的 `MANAGED_AI_ENDPOINT` 改成该完整地址后重新构建部署。

## CLI 部署参考

如果使用 CloudBase CLI，可以先登录：

```bash
tcb login
```

部署云函数：

```bash
tcb fn deploy ai-chat --dir ./cloudfunctions/ai-chat -e 你的环境ID
```

然后在控制台为 `ai-chat` 配置环境变量 `DEEPSEEK_API_KEY` 和 HTTP 访问路径。

部署前端静态站：

```bash
npm run build
tcb hosting deploy ./dist -e 你的环境ID
```

## 验证

1. 打开已部署的 PWA。
2. 完成首次问诊。
3. 进入底部「AI」页。
4. 点击「测试 AI 服务」。
5. 如果返回 DeepSeek 的回答，说明链路已接通。
6. 回到规划页，直接在底部输入问题，点击发送。

如果看到 `服务端未配置 DEEPSEEK_API_KEY`，说明云函数环境变量未配置或未生效。

如果看到 404，说明 `/api/ai-chat` 没有正确映射到云函数。

如果看到 DeepSeek 认证失败，说明 API Key 无效、已删除、余额不足或没有 API 调用权限。

