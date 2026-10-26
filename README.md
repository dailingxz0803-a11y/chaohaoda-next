# 抄好搭 Next

AI 驱动的 H5 内容聚合页工作台，用于制作活动、课程、直播和品牌内容页面。

**描述需求 → 生成页面 → 对话或手动编辑 → 手机预览 → 导出与分享。**

![工作台首页](docs/home.png)

## 主要功能

- 根据文字需求或参考图生成页面，也可从场景模板开始。
- 通过 AI 对话或编辑面板调整文案、组件、配色和布局，支持撤销 AI 修改。
- 上传封面、生成 AI 配图，组合直播、视频合集、讲师、时间线等内容。
- 导入保利威直播频道和点播视频，提供独立观看页。
- 自动保存到当前浏览器，支持手机预览、HTML 导出、分享链接和二维码。

![页面编辑器](docs/editor.png)

## 快速开始

需要 **Node.js 20+** 和 **pnpm**。

```bash
git clone https://github.com/dailingxz0803-a11y/chaohaoda-next.git
cd chaohaoda-next
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm run build
pnpm start
```

打开 <http://127.0.0.1:8780>。私有仓库需要先获得访问权限。

未配置 AI 密钥时可使用演示模式；启用真实生成前，请填写下方配置。修改源码后重新运行 `pnpm run build`；也可使用 `pnpm run dev` 构建并启动，但不会自动热更新。

## 配置

账号和密钥填写在本机 `.env.local`，不要提交到版本库。手动修改配置后需重启服务；完整字段见 [.env.example](.env.example)。

| 能力 | 必要配置 |
| --- | --- |
| 千问文本生成、参考图分析与 AI 配图 | `DASHSCOPE_API_KEY` |
| DeepSeek 文本生成 | `AI_PROVIDER=deepseek`、`DEEPSEEK_API_KEY` |
| 保利威直播内容导入 | `POLYV_LIVE_APP_ID`、`POLYV_LIVE_APP_SECRET` |
| 保利威点播内容导入与播放凭证 | `POLYV_VOD_USER_ID`、`POLYV_VOD_SECRET_KEY` |
| 公网分享地址 | `PUBLIC_BASE_URL` |

文本模型也可在首页的模型设置中配置。使用 DeepSeek 时，参考图分析和 AI 配图仍需千问密钥。模型名称等可选设置见示例配置。

## 导出与分享

- **导出 HTML**：适合保存页面或自行托管；视频及第三方服务仍需要网络与相应权限。
- **局域网分享**：保持服务运行，手机与电脑连接同一网络，通过分享二维码访问。
- **公网分享**：部署服务并设置 `PUBLIC_BASE_URL`，或运行 `bash tunnel.sh` 使用 Cloudflare 临时隧道。临时地址可能变化，变化后需重新生成分享链接。

## 使用边界

- 当前为本地工作台，未实现多用户登录、租户隔离、云端项目同步和发布版本管理。
- 编辑中的页面保存在浏览器 localStorage，分享快照保存在服务端 `.data/shares`；清理浏览器数据或服务端文件会影响对应内容。
- 保利威播放效果取决于账号授权、视频加密设置和频道开播状态。
- 微信登录、真实预约通知、学习进度和通用素材库尚未实现。
- 临时隧道适合演示；对外长期部署前需补齐访问控制。

## 项目结构

技术栈：React 19、TypeScript、Node.js、esbuild。

```text
src/                 前端界面、模板与页面渲染器
server/              AI 与保利威接口代理、分享快照服务
public/              图片、视频及播放器资源
scripts/build.mjs    前端构建脚本
watch.html           独立观看页
docs/                功能截图
```

开发交接与关键实现见 [HANDOFF.md](HANDOFF.md)。具体代码变更通过 Git 提交记录查看。
