# 编辑模式：一次性配置与维护

网站的编辑模式由三部分组成：

| 部分 | 作用 | 位置 |
|---|---|---|
| GitHub App `zihanzhao-homepage-editor` | 提供"用 GitHub 登录"，并授予这个仓库的内容读写权限 | GitHub → Settings → Developer settings → GitHub Apps |
| Cloudflare Worker `homepage-auth` | 用 client secret 把登录授权码换成令牌，并且只放行 zihanzhao1022 | `auth-worker/`，部署在 Cloudflare |
| 网站里的编辑器 | 页脚锁形图标登录，编辑后提交到 `main` | `editor/`、`components/EditMode.tsx` |
| 私有仓库 `homepage-private` | 存放未公开的论文结果 | GitHub，和网站仓库共用同一个 GitHub App |

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

## 三、论文结果页的私有仓库

论文结果页把未公开的内容存在私有仓库 `zihanzhao1022/homepage-private`（已创建）：

1. 仓库必须至少有一次提交（创建时勾选 "Add a README file"），空仓库无法通过 API 提交。
2. GitHub → Settings → Applications → Installed GitHub Apps → `zihanzhao-homepage-editor` → Configure → Repository access，确认 `homepage-private` 在列表里。权限不用改。

仓库里的结构：`results.json` 是所有论文的数据（信息、导言区、附件列表、每个块的 LaTeX 源码和编译结果）；`results/<论文id>/files/` 是附件；`results/<论文id>/<块id>-<哈希>.pdf` 是编译结果。可以直接在 GitHub 上查看历史或回滚。

## 四、日常使用

- 点页脚版权文字后面的小锁图标登录。登录后页面顶部出现管理栏，各处出现编辑按钮。
- 每次保存都会立即提交到 `main`，GitHub Actions 自动部署，约 1 分钟后访客可以看到。管理栏会显示部署进度。
- 登录 8 小时后过期，再点一次登录即可，不需要重新授权。
- 编辑弹窗里的"隐藏"可以让条目暂时不对访客显示，编辑模式下它会变成半透明并带"已隐藏"标签，随时可以取消隐藏。仓库是公开的，需要保密的内容请删除。
- 拖动条目左侧的把手可以调整顺序，松手即保存。论文、项目、奖项只能在同一年内拖动，经历只能在同一分类内拖动。
- 图片字段旁的"选择已有图片"可以直接复用网站上已经在用的图片（比如学校 logo），不用重复上传。
- 导航栏末尾的"编辑导航"可以调整导航顺序、改名、隐藏或删除页面（内置页面删除后数据仍在，可以在"恢复已删除"里加回来），也可以新增自定义页面（标题加 Markdown 正文，网址为 `#/p/<地址>`）和外部链接。cv 页面默认是隐藏的，需要时在这里取消隐藏。
- 论文结果页：导航里的 results 默认隐藏，所有者登录后在编辑模式下可以打开。"添加论文"新建的论文默认隐藏，只存在私有仓库；在论文信息里"取消隐藏"会先确认，再把这篇论文的可见块复制到网站上。论文页顶部"导言区与附件"可以粘贴论文的导言区、上传会议模板的 .sty 和图片；底部"＋ 文字 / ＋ 图 / ＋ 表格"添加块。编辑器里 `Ctrl/Cmd+Enter` 编译、`Ctrl/Cmd+S` 保存，有错误时不能保存。拖动块调整顺序后，编号受影响的块会自动重新编译。第一次打开编辑器要下载约 5 MB 的 TeX 引擎，之后浏览器会缓存。
- 本地调试界面用 `npm run dev:mock`：不需要登录，保存只写入内存。可以用 `localStorage.setItem('mock-fail', 'conflict' | 'network' | 'expired' | 'deploy')` 模拟各种失败。

## 五、出问题时

| 现象 | 原因与处理 |
|---|---|
| 看不到锁形图标 | `editor/config.ts` 中的 `clientId` 或 `workerUrl` 为空 |
| 登录后提示"该账号没有编辑权限" | 登录的不是 zihanzhao1022 |
| 登录后提示"登录失败" | 检查 Worker 的 secret 是否正确（重新运行 `secret put`），以及回调地址是否和 GitHub App 设置一致 |
| 保存时提示"没有写入权限" | GitHub App 没有安装到这个仓库，或缺少 Contents 写权限 |
| 管理栏显示"部署失败" | 点击查看 Actions 日志。线上会保持上一次成功的版本 |
| 结果页提示"读不到私有仓库" | 私有仓库不存在，或 GitHub App 没有安装到它上面（见第三节） |
| 结果页提示"私有仓库还是空的" | 在 GitHub 上给 `homepage-private` 加一个 README |
| 编辑器提示"已保存，但更新网站上的公开内容失败" | 点提示里的"重试"；私有仓库里的内容已经保存好了 |
| 编译报错找不到某个 .sty | 在"导言区与附件"里上传这个文件 |
| 怀疑令牌泄露 | 在 GitHub → Settings → Applications → Authorized GitHub Apps 中撤销授权，或在 App 设置页重新生成 client secret 后再运行一次 `secret put` |
