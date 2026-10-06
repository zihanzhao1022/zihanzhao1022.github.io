# 编辑模式：一次性配置与维护

网站的编辑模式由三部分组成：

| 部分 | 作用 | 位置 |
|---|---|---|
| GitHub App `zihanzhao-homepage-editor` | 提供"用 GitHub 登录"，并授予这个仓库的内容读写权限 | GitHub → Settings → Developer settings → GitHub Apps |
| Cloudflare Worker `homepage-auth` | 用 client secret 把登录授权码换成令牌，并且只放行 zihanzhao1022 | `auth-worker/`，部署在 Cloudflare |
| 网站里的编辑器 | 页脚锁形图标登录，编辑后提交到 `main` | `editor/`、`components/EditMode.tsx` |

## 一、GitHub App

1. 用预填好的链接创建：名称、回调地址（`https://zihanzhao1022.github.io/` 和 `http://localhost:3000/`）、权限（Contents 读写、Actions 只读）、关闭 webhook、仅限本账号。
2. 在 App 设置页记下 **Client ID**，点 **Generate a new client secret** 生成 secret。secret 只会显示一次，只用于下面第二步，不要提交到仓库。
3. 左侧 **Install App** → 选择本账号 → **Only select repositories** → 勾选 `zihanzhao1022.github.io`。

Client ID 已经填在 `editor/config.ts` 和 `auth-worker/wrangler.toml` 中。

## 二、Cloudflare Worker

在仓库的 `auth-worker` 目录下运行：

```bash
npx wrangler@4 login
npx wrangler@4 deploy
npx wrangler@4 secret put GITHUB_CLIENT_SECRET
```

`deploy` 输出的地址（`https://homepage-auth.<子域名>.workers.dev`）要填进 `editor/config.ts` 的 `workerUrl`，提交并推送后生效。

修改了 `auth-worker/` 中的代码或 `wrangler.toml` 之后，要重新运行 `npx wrangler@4 deploy`。

## 三、日常使用

- 点页脚版权文字后面的小锁图标登录。登录后页面顶部出现管理栏，各处出现编辑按钮。
- 每次保存都会立即提交到 `main`，GitHub Actions 自动部署，约 1 分钟后访客可以看到。管理栏会显示部署进度。
- 登录 8 小时后过期，再点一次登录即可，不需要重新授权。
- 本地调试界面用 `npm run dev:mock`：不需要登录，保存只写入内存。可以用 `localStorage.setItem('mock-fail', 'conflict' | 'network' | 'expired' | 'deploy')` 模拟各种失败。

## 四、出问题时

| 现象 | 原因与处理 |
|---|---|
| 看不到锁形图标 | `editor/config.ts` 中的 `clientId` 或 `workerUrl` 为空 |
| 登录后提示"该账号没有编辑权限" | 登录的不是 zihanzhao1022 |
| 登录后提示"登录失败" | 检查 Worker 的 secret 是否正确（重新运行 `secret put`），以及回调地址是否和 GitHub App 设置一致 |
| 保存时提示"没有写入权限" | GitHub App 没有安装到这个仓库，或缺少 Contents 写权限 |
| 管理栏显示"部署失败" | 点击查看 Actions 日志。线上会保持上一次成功的版本 |
| 怀疑令牌泄露 | 在 GitHub → Settings → Applications → Authorized GitHub Apps 中撤销授权，或在 App 设置页重新生成 client secret 后再运行一次 `secret put` |
