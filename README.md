# Zihan ZHAO 的学术主页

线上地址：https://zihanzhao1022.github.io/

使用 Vite + React + TypeScript + Tailwind CSS 构建，部署在 GitHub Pages 上。

## 修改内容

网站内容都在 `content/` 目录下的 JSON 文件里：

| 文件 | 内容 |
|---|---|
| `content/profile.json` | 姓名、职位、简介、头像、联系方式、语言等 |
| `content/news.json` | 新闻 |
| `content/experiences.json` | 教育、工作、志愿经历 |
| `content/publications.json` | 论文 |
| `content/projects.json` | 项目 |
| `content/talks.json` | 报告 |
| `content/awards.json` | 奖项 |
| `content/navigation.json` | 导航栏：顺序、名称、自定义页面的正文、外部链接 |
| `content/results.json` | 论文结果页的公开快照（由编辑器自动生成，不要手改） |

- 简介和新闻支持 `[文字](链接)` 和 `**加粗**`，不支持其他 HTML。
- 论文作者用 `**名字**` 表示加粗高亮。
- 图片放在 `public/images/` 下，在 JSON 里用 `/images/...` 引用。
- 列表里的每一条都需要一个不重复的 `id`。
- 条目加上 `"hidden": true` 后不会在网站上显示，但仍然保留在仓库里，也可以在编辑模式里取消隐藏。仓库是公开的，隐藏不等于保密。

改好后推送到 `main` 分支，也可以直接在 GitHub 网页上编辑这些文件。GitHub Actions 会自动测试、构建并发布，1–2 分钟后生效，进度可以在仓库的 Actions 页面查看。

### 在网页上编辑

点页脚的小锁图标，用 GitHub 账号 zihanzhao1022 登录后进入编辑模式：每条内容旁有编辑按钮，左侧的把手可以拖动排序，各板块有"添加"按钮，导航栏末尾可以编辑导航。保存后立即提交并自动部署。配置和维护方法见 [docs/admin-setup.md](docs/admin-setup.md)。本地调试编辑界面可以运行 `npm run dev:mock`，这时不需要登录，保存也不会写入 GitHub。

### 论文结果页

导航里的 results 页面（默认隐藏）用来整理论文的实验结果：每篇论文一个页面，由文字、图、表格三种块组成，每个块都是一段 LaTeX，在浏览器里用 pdfTeX 编译成 PDF 显示。

- 未公开的论文只存在私有仓库 `zihanzhao1022/homepage-private` 里，只有登录后能看到；在论文信息里"取消隐藏"才会复制到本仓库（`content/results.json` 和 `public/results/`）并发布。
- 每篇论文可以设置自己的导言区（直接粘贴论文的）和附件（会议模板的 .sty、图片等），编号和 `\ref` 在块之间连续。
- 编辑器左边写代码、右边实时预览；表格可以"复制 LaTeX"，开头会注明需要的宏包。
- TeX 引擎和常用宏包在 `public/texlive/`（说明见其中的 README），其他宏包从 TeXlyre 的 TeX Live 服务器按需下载，只发送文件名。
- 配置方法见 [docs/admin-setup.md](docs/admin-setup.md)。

## 本地开发

```bash
npm install
npm run dev      # 本地预览：http://localhost:3000
npm test         # 运行测试
npm run build    # 生产构建，输出到 dist/
```

`views/__snapshots__/` 里是页面快照测试，用的是 `views/__fixtures__/content.json` 中的固定内容，所以修改网站内容不会让它失败。修改页面结构后，如果快照测试失败，确认差异符合预期，再运行 `npx vitest run -u` 更新快照。
