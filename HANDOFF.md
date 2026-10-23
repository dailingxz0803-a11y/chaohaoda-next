# 抄好搭 Next · 交接说明

按《抄好搭产品需求与实施方案 V2.0》从零重写的 AI 内容聚合页工作台。独立工程，不复用、也不修改原 demo。

## 一、运行

需要 Node.js 20+（可选 pnpm）。

```bash
pnpm install        # 或 npm install
pnpm run build      # esbuild 构建到 dist/
pnpm start          # server/index.mjs → http://127.0.0.1:8780
```

macOS 也可以直接：

```bash
./start.sh          # 构建 + 启动
./stop.sh           # 停止 8780
# 或双击 start.command
```

核心依赖很少：React 19、TypeScript、esbuild、qrcode。构建不使用 Vite/Rollup，`scripts/build.mjs` 负责打包。

## 二、环境变量（.env.local，不要提交）

复制 `.env.example` 为 `.env.local` 后填写：

```bash
# 文本 / 视觉 / 图像
DASHSCOPE_API_KEY=sk-...
QWEN_MODEL=qwen-plus
QWEN_VISION_MODEL=qwen3-vl-plus
QWEN_IMAGE_MODEL=qwen-image-2.1-pro

# 可选：文本模型切换为 DeepSeek（图片/视觉仍走千问）
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 保利威
POLYV_USER_ID=...
POLYV_VOD_USER_ID=...
POLYV_LIVE_APP_ID=...
POLYV_LIVE_APP_SECRET=...
POLYV_VOD_SECRET_KEY=...

# 分享公网地址（可选，由 tunnel.sh 自动写入）
PUBLIC_BASE_URL=https://xxx.trycloudflare.com
```

密钥只从服务端读取。没有 AI 密钥时进入「演示模式」，返回可编辑示例结构。

## 三、目录结构

```
src/                 React 前端
  components/        Home、Editor、AIBar、ShareDialog、AISettings、PolyvPicker、StylePanel…
  templates.ts       8 套模板与页面结构
  render.ts          页面 JSON → 移动端 HTML
  types.ts           类型与组件标签
  assets.ts image.ts AI 配图与素材
  prompts.ts lib.ts  提示词与工具函数
server/
  index.mjs          静态服务 + AI 代理 + Polyv 代理 + 分享快照 + 观看页
  polyv.mjs          保利威签名、视频列表、点播 token、直播信息
watch.html           独立观看页（点播 / 直播 / 文件）
public/vendor/       本地化的 polyv-player.js 与 polyv-live-watch-sdk.js
docs/                各页面截图
```

## 四、关键实现

- **首页**：模板画廊（筛选 + 主推卡）、模板预览弹窗（先预览，点「使用此模板」才落库）。
- **编辑器**：三栏；参考图视觉分析、AI 生成配图、保利威导入、页面背景、金刚位（bento / pills）、数据条、倒计时、互动指标。
- **分享**：`POST /api/share` 把页面快照写入 `.data/shares`，返回短链 + 二维码；`PUBLIC_BASE_URL` 存在时优先用它。`./tunnel.sh` 启动 Cloudflare 临时隧道并自动更新分享地址。
- **观看页**：点播用 Playsafe token + 本地 player.js；直播用纯视频 iframe + Polyv Live Watch SDK 聊天室（游客授权、历史消息、发送）；文件用直链。

## 五、已知注意

- 测试直播频道当前离线，观看页显示「当前暂无直播」属正常，开播后出画面。
- 分享公网地址是临时隧道，进程重启后需重新 `./tunnel.sh` 并重新生成二维码。
- 用户页面数据保存在浏览器 localStorage；`.data/` 只存分享快照和运行时日志。
- 原 demo 位于 `../case 评估/chaohaoda-studio`，请不要改动它。

当前提交：以仓库 `git log` 为准（打包时指向 HEAD）。
