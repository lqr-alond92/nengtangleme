# 腾讯云手机 Alpha 部署说明

目标：把「能躺了吗」作为静态 PWA 发给中国内地体验用户。用户用手机打开 HTTPS 链接，添加到主屏幕，不登录、不注册。规划数据保存在当前手机浏览器；AI 问答默认通过 CloudBase 云函数调用 DeepSeek。

## 推荐入口

优先使用腾讯云 CloudBase / Webify 的静态网站托管能力。它比 OSS 默认文件 URL 更适合做网页/PWA 入口，因为平台会给一个可直接打开的 HTTPS 访问地址。

官方入口：

- CloudBase 静态网站托管：https://docs.cloudbase.net/hosting/introduce
- Webify：https://webify.cloudbase.net/

## 上传包

当前项目已经准备了一个适合腾讯云上传的静态包：

```text
neng-tang-mobile-alpha-cloudbase.zip
```

注意：这个包的顶层就是 `index.html`、`assets/`、`manifest.webmanifest`、`sw.js` 等文件。不要上传外面套了一层 `dist/` 的 zip，否则访问根路径时可能找不到首页。

如需重新生成：

```bash
npm run build
cd dist
zip -r ../neng-tang-mobile-alpha-cloudbase.zip .
```

## 控制台部署步骤

1. 进入腾讯云 CloudBase / Webify 控制台。
2. 新建一个 Web 应用或静态网站托管项目。
3. 选择“上传静态文件 / 上传构建产物 / 手动部署”一类入口。
4. 上传 `neng-tang-mobile-alpha-cloudbase.zip`。
5. 发布后复制平台生成的 HTTPS 默认域名。
6. 用手机浏览器打开这个域名。
7. 手机浏览器菜单里选择“添加到主屏幕”。

## 发布后检查

- 手机打开链接不是下载文件，而是正常进入 App。
- 首页能完成首次问诊。
- 刷新页面后规划数据还在。
- 进入“模型”页后能填写 API Key。
- 刷新页面后模型配置还在。
- “测试模型调用”成功，或明确看到模型服务商的 CORS/网络错误。
- “继续问 AI”能调用配置的大模型。

## AI 服务边界

当前版本需要额外部署 `cloudfunctions/ai-chat` 云函数：

- DeepSeek API Key 只放在 CloudBase 云函数环境变量 `DEEPSEEK_API_KEY`。
- 前端静态包不包含 API Key。
- 点击“测试 AI 服务”或“继续问 AI”时，当前规划摘要会发送到 CloudBase 云函数，再由云函数调用 DeepSeek。
- 规划数据仍保存在用户手机浏览器 `localStorage`，本阶段不做账号同步和云端恢复。

部署细节见 [cloudbase-deepseek-proxy.md](./cloudbase-deepseek-proxy.md)。
