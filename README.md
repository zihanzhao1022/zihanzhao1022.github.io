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

- 简介和新闻支持 `[文字](链接)` 和 `**加粗**`，不支持其他 HTML。
- 论文作者用 `**名字**` 表示加粗高亮。
- 图片放在 `public/images/` 下，在 JSON 里用 `/images/...` 引用。
- 列表里的每一条都需要一个不重复的 `id`。
- 条目加上 `"hidden": true` 后不会在网站上显示，但仍然保留在仓库里，也可以在编辑模式里取消隐藏。仓库是公开的，隐藏不等于保密。

改好后推送到 `main` 分支，也可以直接在 GitHub 网页上编辑这些文件。GitHub Actions 会自动测试、构建并发布，1–2 分钟后生效，进度可以在仓库的 Actions 页面查看。

### 在网页上编辑

点页脚的小锁图标，用 GitHub 账号 zihanzhao1022 登录后进入编辑模式：每条内容旁有编辑按钮，左侧的把手可以拖动排序，各板块有"添加"按钮，导航栏末尾可以编辑导航。保存后立即提交并自动部署。配置和维护方法见 [docs/admin-setup.md](docs/admin-setup.md)。本地调试编辑界面可以运行 `npm run dev:mock`，这时不需要登录，保存也不会写入 GitHub。

## 本地开发

```bash
npm install
npm run dev      # 本地预览：http://localhost:3000
npm test         # 运行测试
npm run build    # 生产构建，输出到 dist/
```

`views/__snapshots__/` 里是页面快照测试，用的是 `views/__fixtures__/content.json` 中的固定内容，所以修改网站内容不会让它失败。修改页面结构后，如果快照测试失败，确认差异符合预期，再运行 `npx vitest run -u` 更新快照。
