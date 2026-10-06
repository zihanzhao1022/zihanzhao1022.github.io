# 主页内置编辑模式：设计文档

- 日期：2026-10-06
- 状态：设计已确认，待实施
- 仓库：`zihanzhao1022/zihanzhao1022.github.io`

## 1. 背景与目标

**现状**

- Vite + React + TypeScript 单页应用，使用 HashRouter；Tailwind 通过 CDN 脚本在运行时生成样式。
- 所有内容写在 `data.ts`。
- 更新流程：本地修改 `data.ts` → `npm run deploy`（本地构建，再用 `gh-pages` 推送到 `gh-pages` 分支）→ Pages 从该分支发布。

**目标**

1. 只有站点所有者（GitHub 账号 `zihanzhao1022`）能通过"用 GitHub 登录"进入编辑模式。
2. 编辑体验参考领英：直接在原页面上编辑，每条内容旁有编辑按钮，板块旁有添加按钮，点开是表单弹窗。
3. 所有公开板块的文字都能编辑，并支持上传图片。
4. 每次点"保存"立即提交到仓库，由 GitHub Actions 自动构建部署，不再需要本地操作。

**本期不做**

- CV 页（目前隐藏）专用字段的编辑界面：`education`、`researchInterests`、`skills`、`profile.awards`。数据保留在 `profile.json`，需要时手动修改。
- 草稿与批量发布、多人协作、版本回滚界面（Git 历史本身可以回滚）。
- refresh token 自动续期。
- 自动清理不再使用的图片。

## 2. 已确认的关键决策

| 决策 | 结论 |
|---|---|
| 方案 | 网站内置编辑模式，不使用现成 CMS，也不使用云数据库 |
| 登录 | "用 GitHub 登录"按钮：GitHub App + Cloudflare Worker 换取令牌 |
| 编辑范围 | 所有公开板块的文字，加上图片上传 |
| 保存方式 | 每次保存立即提交：一次保存 = 一次提交 = 一次部署 |
| 部署 | GitHub Actions，Pages 来源改为 "GitHub Actions" |

## 3. 总体架构

```
访客   ──► GitHub Pages（静态站点；内容在构建时打包进来）

所有者 ──► 同一站点 →「用 GitHub 登录」→ GitHub 授权页
         → 带着 code 回到站点 → Cloudflare Worker 用 client secret 换取令牌，并确认是本人
         → 编辑模式：表单保存 → 浏览器用令牌调用 GitHub API，提交到 main
         → GitHub Actions：npm ci → 测试 → 构建 → 发布到 Pages（约 1–2 分钟）
```

## 4. 内容数据

### 4.1 文件

`data.ts` 拆成 `content/` 下的 7 个 JSON 文件（2 空格缩进，末尾带换行）：

| 文件 | 内容 | 类型 |
|---|---|---|
| `content/profile.json` | 姓名、职位、单位、邮箱、头像、简介、联系方式、语言，以及 CV 专用字段 | `Profile` |
| `content/news.json` | 新闻（从 profile 中拆出，每条新增 `id`） | `NewsItem[]` |
| `content/experiences.json` | 经历 | `Experience[]` |
| `content/publications.json` | 论文 | `Publication[]` |
| `content/projects.json` | 项目 | `Project[]` |
| `content/talks.json` | 报告 | `Talk[]` |
| `content/awards.json` | 奖项（原 `awardsList`） | `Award[]` |

类型调整：`Profile` 去掉 `news`；`NewsItem` 增加 `id`；新增 `SiteContent`，由上面七个集合组成。

### 4.2 加载方式

- `content/index.ts` 取代 `data.ts`：带类型地导入同目录下的 7 个 JSON，导出 `bundledContent: SiteContent`。
- `ContentProvider` + `useContent()` 保存当前内容：
  - 访客看到的始终是 `bundledContent`。
  - 所有者进入编辑模式后，替换为从 GitHub 读取的最新内容。
  - 每次保存成功后，替换对应的集合。
- 所有页面（包括 CV 页）都改为通过 `useContent()` 读取数据。

### 4.3 轻量 Markdown（用于简介和新闻）

- 支持 `[文字](链接)` 和 `**加粗**`，其余字符一律做 HTML 转义。
- 链接只允许 `http:`、`https:`、`mailto:` 和站内路径（以 `/`、`#`、`./` 开头）。其他协议（如 `javascript:`）只显示文字，不生成链接。
- 链接统一使用 `text-purple-600 hover:underline font-medium` 样式，新窗口打开，带 `rel="noreferrer"`。
- 迁移时把简介里现有的 `<a>` 标签转换成 Markdown 链接，渲染效果保持不变。
- 简介在 JSON 里仍是段落数组；编辑时合并到一个文本框里，用空行分段。

## 5. 登录与安全

### 5.1 GitHub App 配置

- 仓库权限：Contents 读写、Actions 只读、Metadata 只读（GitHub 强制要求）。不申请任何账号级权限。
- 只安装在 `zihanzhao1022.github.io` 这一个仓库上。
- Callback URL：`https://zihanzhao1022.github.io/` 和 `http://localhost:3000/`。
- 不启用 webhook。保持"用户令牌会过期"的默认设置（8 小时）。

### 5.2 登录流程

1. 用户点击页脚的锁形图标。浏览器生成随机的 `state` 和 PKCE `code_verifier`，连同当前页面路由（hash）一起存入 sessionStorage。
2. 跳转到 `https://github.com/login/oauth/authorize`，带上 `client_id`、`redirect_uri`、`state`、`code_challenge` 和 `code_challenge_method=S256`。`redirect_uri` 是当前站点的根地址，必须与 Callback URL 完全一致。
3. GitHub 回跳到 `/?code=…&state=…`。页面校验 `state`，不一致就中止。
4. 页面把 `code`、`code_verifier`、`redirect_uri` POST 给 Worker 的 `/token`。
5. 成功后把会话写入 localStorage，用 `history.replaceState` 清掉地址栏参数，回到登录前的页面，然后加载编辑模式。
6. 如果用户在 GitHub 上取消授权（回跳带 `?error=access_denied`），清理地址栏并提示"已取消登录"。

### 5.3 Worker（`auth-worker/`，无状态）

`POST /token`：

1. 校验 `redirect_uri` 在允许列表内。
2. 用 client id、client secret、code 和 code_verifier 向 `https://github.com/login/oauth/access_token` 换取令牌。
3. 用该令牌请求 `GET /user`。如果登录名不是 `OWNER_LOGIN`，立即调用 `DELETE /applications/{client_id}/token` 吊销令牌，并返回 403。
4. 返回 `{ access_token, expires_at, login, avatar_url }`，不返回 refresh token。

`POST /revoke`：吊销传入的令牌，供退出登录时使用。

其他规则：

- CORS 只允许 `ALLOWED_ORIGINS` 中的来源。来源不在列表内返回 403，路径不存在返回 404。
- `GITHUB_CLIENT_ID`、`OWNER_LOGIN`、`ALLOWED_ORIGINS` 是普通环境变量；`GITHUB_CLIENT_SECRET` 是加密 secret，不进入代码仓库。

### 5.4 浏览器端会话

- localStorage 保存 `{ token, login, avatarUrl, expiresAt }`，过期后视为未登录。
- 打开编辑弹窗前，如果令牌剩余有效期不足 15 分钟，先提示重新登录。重新登录不需要再次确认授权，约 2 秒完成。
- 退出登录：调用 Worker 的 `/revoke`（调用失败也继续），然后清除本地会话。

### 5.5 安全边界

| 情况 | 结果 |
|---|---|
| 普通访客 | 看不到编辑按钮，编辑器代码不会加载 |
| 他人点击登录 | 能完成 GitHub 授权，但 Worker 判定不是本人，吊销令牌并拒绝 |
| 绕过页面直接调用 GitHub API | 没有仓库写权限，GitHub 拒绝 |
| 令牌泄露 | 只能修改本仓库的内容，最长 8 小时有效 |

配套加固：

- 页面不再运行任何第三方脚本：Tailwind 改为构建时编译，删除 `index.html` 中未使用的 importmap。
- 内容渲染不接受任意 HTML（见 4.3）。
- 不允许上传 SVG，因为同源的 SVG 可以执行脚本。

## 6. 编辑界面

### 6.1 加载方式

- 主包只包含三样东西：会话检查、`EditModeContext`（提供 `isEditing` 和 `openEditor()`）、页面里的编辑按钮组件（未登录时什么都不渲染）。
- 弹窗、表单、GitHub 客户端等都放在 `editor/` 目录下，登录后通过动态 `import()` 按需加载。

### 6.2 管理栏

登录后页面顶部显示一条管理栏，包含：

- 头像和用户名
- "编辑模式"开关：关闭后以访客视角预览页面
- 部署状态：部署中 / 已上线 / 部署失败（失败时链接到 Actions 日志）
- 退出登录

### 6.3 编辑入口

| 位置 | 按钮 |
|---|---|
| About：姓名、职位、语言区域 | 铅笔 → "基本信息"弹窗 |
| About：简介 | 铅笔 → "简介"弹窗 |
| About：头像 | 头像底部的"更换照片"按钮 → 头像弹窗 |
| About：社交图标 | 铅笔 → "联系方式"弹窗 |
| About：新闻 | 标题旁"＋ 添加"和"⇅ 排序"；每条一个铅笔 |
| Experiences：三个分类 | 每个分类有"＋ 添加"（自动预选该分类）和"⇅ 排序"；每条一个铅笔 |
| Publications / Projects / Awards | 标题旁"＋ 添加"；每条一个铅笔。按年份自动排序，因此没有排序按钮 |
| Talks | "＋ 添加"和"⇅ 排序"；每条一个铅笔 |

编辑模式下所有编辑按钮（包括头像的"更换照片"）始终可见，不依赖鼠标悬停，触屏上也能用。

### 6.4 字段

带 * 的为必填项。

| 类型 | 字段 |
|---|---|
| 基本信息 | 名*、姓*、中文名、职位、单位、邮箱、语言列表（语言 + 水平，可增删、可排序） |
| 简介 | 多段文本，用空行分段，支持轻量 Markdown |
| 联系方式 | 列表，每项包含平台*（email/github/linkedin/orcid/wechat）、链接*、二维码图片；可增删、可排序 |
| 头像 | 图片* |
| 新闻 | 日期*、内容*（支持轻量 Markdown） |
| 论文 | 标题*、作者*（每行一位，`**名字**` 表示加粗高亮）、年份*（四位数字）、期刊或会议*、类型*、等级*、影响因子（仅期刊显示）、缩略图、链接 abs/pdf/doi/code |
| 经历 | 分类*、职位或学位*、机构*、地点、时间*、logo。教育类另有院系、GPA、排名；工作和志愿类另有描述 |
| 项目 | 标题*、角色、描述、时间*（需包含四位年份，用于分组）、级别、图片 |
| 报告 | 标题*、活动名称、日期*、主办方、地点、合作方 |
| 奖项 | 标题*、颁发机构*、日期*（需包含四位年份）、类型*、等级、奖金、图片。`year` 从日期中自动提取 |

字段由 `editor/schemas.ts` 中的声明驱动，通用表单组件按声明渲染。

### 6.5 弹窗行为

- 表单的初始值是该条的完整数据，保存时整条替换。因此表单里没有显示的字段（如 `highlight`）会原样保留。
- 必填项或格式校验不通过时，在字段下方给出提示，不会提交。
- 有未保存的修改时点关闭或取消，先确认"放弃修改？"。删除前需要二次确认。
- 保存过程中按钮显示加载状态。成功后关闭弹窗，页面立即更新；失败时弹窗保留全部输入，并显示失败原因。
- 在手机上弹窗全屏显示。
- 排序弹窗列出该板块的所有条目，用 ↑↓ 调整顺序，保存时只产生一次提交。

### 6.6 图片

- 接受 PNG、JPEG、WebP、GIF，单个文件不超过 5MB；SVG 和其他类型一律拒绝。
- PNG、JPEG、WebP 的长边超过 1600px 时，在浏览器内等比缩小，格式保持不变。GIF 不做处理，以免丢失动画。
- 保存时图片写入 `public/images/uploads/<YYYYMMDD-HHmmss>-<文件名>.<扩展名>`，与 JSON 修改放在同一次提交里；字段值为 `/images/uploads/...`。
  - 文件名部分转成小写，非字母数字的字符替换为 `-`；如果结果为空（例如纯中文文件名），就用 `image`。
  - 示例：`public/images/uploads/20261006-153012-hosei-logo.png`。
- 部署完成前，新上传的图片通过 `resolveImage()` 使用本地预览地址显示，避免出现裂图。
- 替换或删除图片时，不删除仓库里的旧文件。

### 6.7 登录入口

页脚版权文字末尾放一个低对比度的锁形图标；已登录时不显示。

## 7. 保存与部署

### 7.1 内容操作

```ts
type ContentOp =
  // 按 id 整条替换；id 不存在时插入到列表开头
  | { kind: 'upsert'; collection: ListCollection; item: Item }
  | { kind: 'delete'; collection: ListCollection; id: string }
  // ids 中的条目按新顺序依次填回它们原来占据的位置，其他条目不动
  | { kind: 'reorder'; collection: ListCollection; ids: string[] }
  // 只覆盖指定字段
  | { kind: 'patchProfile'; fields: Partial<Profile> };
```

- 新条目插入在整个列表的开头。对经历来说，这会让新条目排在所属分类的第一位。
- 新条目的 id 格式为 `<前缀>-<base36 时间戳>`，例如 `pub-lx3k9a`。

### 7.2 保存流程（Git Data API）

1. `GET git/ref/heads/main` 获取最新提交的 sha，再 `GET git/commits/{sha}` 获取 tree sha。
2. `GET contents/content/<集合>.json?ref=<sha>` 读取最新的 JSON，按 UTF-8 解码。
3. 把操作应用到最新内容上，得到新的 JSON 文本。
4. 每张图片调用一次 `POST git/blobs`（base64 编码）。
5. `POST git/trees`（以原 tree 为基础，加入 JSON 和图片），然后 `POST git/commits`（parent 为第 1 步的 sha）。
6. `PATCH git/refs/heads/main`，`force: false`。如果返回 422（说明 main 已经前进），从第 1 步重试，最多 3 次。
7. 成功后用新的 JSON 更新 `ContentProvider`，并返回提交 sha。

提交信息格式为 `content: <add|update|delete|reorder> <集合> "<标题>"`，例如 `content: update publication "Federated Large Domain Model System"`。

### 7.3 进入编辑模式时

从 GitHub 读取 main 上最新的 7 个 JSON 文件，替换打包内容，因为上一次保存触发的部署可能还没有完成。

### 7.4 部署工作流 `.github/workflows/deploy.yml`

- 触发条件：push 到 main，或手动触发。
- 步骤：checkout → setup-node（启用 npm 缓存）→ `npm ci` → `npm test` → `npm run build` → upload-pages-artifact（上传 `dist`）→ deploy-pages。
- 权限：`contents: read`、`pages: write`、`id-token: write`。
- 并发：`group: pages`，`cancel-in-progress: false`。排队中的旧任务会被新任务替换，保证最终线上是最新的提交。
- 收尾：
  - Pages 来源改为 "GitHub Actions"。
  - 删除 `package.json` 中的 `predeploy`、`deploy` 脚本和 `gh-pages` 依赖。
  - `gh-pages` 分支保留不动。

### 7.5 部署状态

- 保存成功后记录提交 sha，每 10 秒查询一次 `GET actions/runs?head_sha=<sha>`，直到运行结束或超过 10 分钟。
- 连续保存时只跟踪最新的一次。
- 状态对应关系：

  | 运行状态 | 管理栏显示 |
  |---|---|
  | 排队或运行中 | 部署中 |
  | 成功 | 已上线 |
  | 失败 | 部署失败，附日志链接 |

## 8. 出错处理

| 情况 | 处理 |
|---|---|
| 令牌过期或失效（401） | 弹窗保留输入，提示重新登录 |
| main 已前进（422） | 自动重试；3 次后仍失败，提示"内容已在别处修改，请刷新后再试" |
| 网络错误或其他 API 错误 | 在弹窗内显示原因，保留输入，可以再次保存 |
| 图片类型或大小不符合要求 | 在图片字段下方提示，不会上传 |
| 构建或部署失败 | 管理栏显示"部署失败"并附日志链接；线上保持上一次成功的版本 |
| Worker 返回 403（不是本人） | 提示"该账号没有编辑权限" |
| 回调时 state 不匹配或缺少会话数据 | 中止登录，提示重新登录 |

## 9. 测试

- **单元测试（Vitest）**

  | 模块 | 测试内容 |
  |---|---|
  | `lib/markdown` | 链接、加粗、HTML 转义、拒绝危险协议 |
  | `editor/ops` | 增删改；子集排序；`patchProfile`；保留表单未显示的字段 |
  | `editor/github` | 用模拟的 fetch 检查调用顺序；图片和 JSON 在同一次提交里；422 时重试；中文内容的 UTF-8 往返 |
  | `editor/images` | 类型和大小校验、文件命名 |
  | `auth-worker` | CORS 白名单；`redirect_uri` 校验；不是本人时吊销令牌并返回 403；GitHub 错误的处理 |

- **本地模拟模式 `npm run dev:mock`**：跳过真实登录，用内存后端代替 GitHub，可以模拟延迟、冲突和失败。只在开发模式下生效，生产构建中不包含这部分代码。
- **迁移一致性校验**：迁移前后各构建一次，逐页比对页面文字和截图。
- **真实端到端测试**（所有者完成一次性配置后）：
  1. 登录。
  2. 新增一条测试新闻。
  3. 确认提交出现在仓库、部署成功、线上已更新。
  4. 删除这条测试新闻。
  5. 退出登录，确认令牌已被吊销。

## 10. 代码结构

```
content/*.json                  内容数据
content/index.ts                导入 JSON，导出 bundledContent
types.ts                        类型（调整 Profile / NewsItem，新增 SiteContent 等）
lib/markdown.ts                 轻量 Markdown 渲染
lib/session.ts                  会话读写与过期判断（主包和编辑器共用）
lib/localImages.ts              新上传图片的本地预览映射，提供 resolveImage()
components/ContentContext.tsx   ContentProvider / useContent
components/EditMode.tsx         EditModeContext，以及 EditButton / AddButton / ReorderButton
editor/config.ts                owner、repo、branch、clientId、workerUrl
editor/auth.ts                  登录跳转、回调处理、退出
editor/github.ts                GitHub REST 客户端：读文件、多文件提交、查询 Actions 运行
editor/ops.ts                   内容操作（纯函数）
editor/backend.ts               EditorBackend 接口，以及 GitHubBackend 实现
editor/mockBackend.ts           内存模拟后端（仅开发模式）
editor/images.ts                图片校验、缩放、命名
editor/schemas.ts               各内容类型的字段声明与校验
editor/EditorRoot.tsx           编辑模式根组件：管理栏、弹窗调度、部署状态
editor/components/*             AdminBar、ItemModal、ReorderModal、各字段组件
auth-worker/                    Cloudflare Worker（src/index.ts、wrangler.toml）
.github/workflows/deploy.yml    自动部署
docs/admin-setup.md             一次性配置指南
```

## 11. 实施阶段

每个阶段完成后都可以单独上线。

1. **基础设施**
   - 自动部署工作流
   - 内容迁移到 JSON（拆出 news，简介转为 Markdown）
   - 页面改用 `useContent()`
   - Tailwind 改为构建时编译（v3，外观不变）
   - 删除 importmap 和 `gh-pages` 依赖
   - 引入 Vitest
   - 更新 README

   上线前做迁移一致性校验，并把 Pages 来源切换为 GitHub Actions。
2. **编辑界面和模拟模式**：编辑按钮、弹窗、字段、排序、图片处理、内容操作、模拟后端。
3. **登录与真实保存**：Worker 及其测试、登录流程、GitHub 客户端、部署状态、配置指南。
4. **上线验证**：所有者完成一次性配置后，做真实的端到端测试。

## 12. 需要所有者完成的一次性配置

这些步骤涉及账号和密钥，需要所有者本人操作，`docs/admin-setup.md` 会给出逐步说明：

1. 注册 Cloudflare 免费账号，执行 `npx wrangler login`。
2. 在 GitHub 创建 GitHub App（按 5.1 填写），安装到本仓库，并生成 client secret。
3. 执行 `wrangler secret put GITHUB_CLIENT_SECRET` 保存密钥，再执行 `wrangler deploy` 部署 Worker。
4. 把 Worker 地址和 client ID 填入 `editor/config.ts`。这两项都是公开信息，可以提交到仓库。
