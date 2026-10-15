import { phrases } from '../i18n';

/** Japanese and English for Galley, the results pages as an app of their own (app/, a prototype). */
export const { t, useT, table } = phrases({
  // The prototype itself
  'Galley 原型只能在本地用 npm run dev:mock 打开。': { ja: 'Galley のプロトタイプはローカルで npm run dev:mock から開いてください。', en: 'The Galley prototype only opens locally, with npm run dev:mock.' },
  '这是原型：账号是虚构的，数据只存在这个浏览器里。': { ja: 'プロトタイプです：アカウントは架空で、データはこのブラウザにだけ保存されます。', en: 'This is a prototype: the accounts are made up and the data stays in this browser.' },
  '用 GitHub 登录（原型）': { ja: 'GitHub でログイン（プロトタイプ）', en: 'Sign in with GitHub (prototype)' },
  '原型不连真的 GitHub，选一个虚构的账号登录：': { ja: 'プロトタイプは本物の GitHub につながりません。架空のアカウントを選んでください：', en: 'The prototype does not reach the real GitHub; sign in as one of these made-up accounts:' },
  '你的账号，已经有一篇示例论文': { ja: 'あなたのアカウント。サンプルの論文があります', en: 'Your account, with an example paper' },
  '合作者：共享了一篇论文给你': { ja: '共同研究者：あなたに論文を 1 本共有しています', en: 'A collaborator who shared a paper with you' },
  '新用户：从连接仓库开始': { ja: '新しいユーザー：リポジトリの接続から始めます', en: 'A new user, starting by connecting a repository' },

  // The bar over every page
  账号: { ja: 'アカウント', en: 'Account' },
  还没有连接仓库: { ja: 'リポジトリはまだ接続されていません', en: 'No repository connected yet' },
  换个账号: { ja: 'アカウントを切り替える', en: 'Switch account' },
  退出登录: { ja: 'ログアウト', en: 'Sign out' },
  我的论文: { ja: '自分の論文', en: 'My papers' },
  首页: { ja: 'ホーム', en: 'Home' },
  回到首页: { ja: 'ホームに戻る', en: 'Back to home' },

  // The landing page
  '写论文用 Overleaf，': { ja: '論文を書くのは Overleaf、', en: 'Write the paper in Overleaf.' },
  '给人看结果用 Galley。': { ja: '結果を見せるのは Galley。', en: 'Show the results in Galley.' },
  '把 LaTeX 写的文字、图和表格编译成一页页清楚的结果，按章节排好。合作者在页边批注，组会时直接演示。所有内容都存在你自己的 GitHub 私有仓库里。': {
    ja: 'LaTeX で書いた文章・図・表を、見やすい結果のページにコンパイルし、章ごとに並べます。共同研究者は余白にコメントを書き、ゼミではそのまま発表できます。内容はすべてあなた自身の GitHub プライベートリポジトリに保存されます。',
    en: 'Compile the text, figures and tables you write in LaTeX into clear pages of results, ordered by section. Collaborators comment in the margin, and group meetings run straight from it. Everything stays in your own private GitHub repository.',
  },
  '用 GitHub 登录': { ja: 'GitHub でログイン', en: 'Sign in with GitHub' },
  目录: { ja: '目次', en: 'Contents' },
  '图 2': { ja: '図 2', en: 'Figure 2' },
  '表 1': { ja: '表 1', en: 'Table 1' },
  '这个提升是 5 次运行的平均吗？': { ja: 'この改善は 5 回の実行の平均ですか？', en: 'Is this gain the mean of 5 runs?' },
  三步开始: { ja: '3 ステップで始める', en: 'Three steps to start' },
  连接一个仓库: { ja: 'リポジトリを接続する', en: 'Connect a repository' },
  '选一个 GitHub 私有仓库，Galley 只读写这一个。': { ja: 'GitHub のプライベートリポジトリを 1 つ選びます。Galley が読み書きするのはそれだけです。', en: 'Pick one private GitHub repository; it is the only one Galley reads or writes.' },
  放进结果: { ja: '結果を入れる', en: 'Add your results' },
  '粘贴 LaTeX，或者把图、表格文件拖进来，在浏览器里直接编译。': { ja: 'LaTeX を貼り付けるか、図や表のファイルをドロップすると、ブラウザの中でそのままコンパイルされます。', en: 'Paste LaTeX, or drop in figure and table files; they compile right in the browser.' },
  分享: { ja: '共有', en: 'Share' },
  '按 GitHub 用户名邀请合作者，或者公开一个只读链接。': { ja: 'GitHub のユーザー名で共同研究者を招待するか、閲覧専用のリンクを公開します。', en: 'Invite collaborators by GitHub user name, or publish a read-only link.' },
  为展示结果而做: { ja: '結果を見せるために', en: 'Made for showing results' },
  '目录跟着 \\section 自动生成': { ja: '目次は \\section から自動で作られます', en: 'The contents follow your \\section commands' },
  '图和表格可以互相切换，两份都保留': { ja: '図と表を切り替えられ、どちらの版も残ります', en: 'Switch a figure to a table and back, keeping both' },
  '点图放大，PDF 矢量图怎么放大都清楚': { ja: '図はクリックで拡大でき、PDF のベクター画像はいくら拡大しても鮮明です', en: 'Click a figure to enlarge it; PDF figures stay sharp at any size' },
  '批注贴在原文上，还能看到谁在看哪一段': { ja: 'コメントは本文に付き、誰がどこを読んでいるかも見えます', en: 'Comments sit on the text, and you see who is reading where' },
  '演示模式：一块一屏，方向键翻页': { ja: '発表モード：1 画面に 1 ブロック、矢印キーで送ります', en: 'Presentation mode: one block per screen, arrow keys to move on' },
  '把整个文件夹拖进来就能上传': { ja: 'フォルダーごとドロップしてアップロードできます', en: 'Drop a whole folder in to upload it' },
  'Galley 开源（AGPL-3.0）。编译在你的浏览器里完成，服务器只负责登录、共享和批注。': {
    ja: 'Galley はオープンソースです（AGPL-3.0）。コンパイルはあなたのブラウザで行われ、サーバーが扱うのはログイン・共有・コメントだけです。',
    en: 'Galley is open source (AGPL-3.0). Compiling happens in your browser; the server only handles sign-in, sharing and comments.',
  },

  // Connecting a repository
  选一个仓库存放你的论文结果: { ja: '論文の結果を保存するリポジトリを選ぶ', en: 'Choose a repository for your results' },
  'Galley 把论文结果存在你选的 GitHub 私有仓库里：一个 results.json 和编译好的 PDF。它只能读写这一个仓库，你的其他仓库它看不到。': {
    ja: 'Galley は論文の結果を、あなたが選んだ GitHub のプライベートリポジトリに保存します（results.json とコンパイル済みの PDF）。読み書きできるのはそのリポジトリだけで、ほかのリポジトリは見えません。',
    en: 'Galley keeps your results in the private GitHub repository you choose: a results.json and the compiled PDFs. It can read and write only that repository and cannot see your others.',
  },
  仓库: { ja: 'リポジトリ', en: 'Repository' },
  '新建一个空仓库，推荐': { ja: '新しい空のリポジトリ（おすすめ）', en: 'A new, empty repository (recommended)' },
  已有的私有仓库: { ja: '既存のプライベートリポジトリ', en: 'An existing private repository' },
  连接这个仓库: { ja: 'このリポジトリを接続', en: 'Connect this repository' },
  '正式版会跳到 GitHub，让你确认把 Galley 装到这个仓库上；原型里点一下就算连接好了。': {
    ja: '正式版では GitHub に移動し、このリポジトリに Galley をインストールしてよいか確認します。プロトタイプではクリックするだけで接続されます。',
    en: 'The real service takes you to GitHub to confirm installing Galley on this repository; in the prototype one click connects it.',
  },

  // My papers
  '存放在 GitHub 仓库 {repo}': { ja: 'GitHub リポジトリ {repo} に保存', en: 'Kept in the GitHub repository {repo}' },
  新建论文: { ja: '新しい論文', en: 'New paper' },
  '正在读取你的仓库…': { ja: 'リポジトリを読み込んでいます…', en: 'Reading your repository…' },
  还没有论文: { ja: '論文はまだありません', en: 'No papers yet' },
  '新建一篇，把第一张图或表格放进去，再把链接发给合作者。': { ja: '1 本作って最初の図か表を入れ、リンクを共同研究者に送りましょう。', en: 'Create one, put in your first figure or table, then send the link to your collaborators.' },
  '{n} 段文字': { ja: '文章 {n} 個', en: '{n} text blocks' },
  '{n} 张图': { ja: '図 {n} 個', en: '{n} figures' },
  '{n} 个表格': { ja: '表 {n} 個', en: '{n} tables' },
  '，': { ja: '、', en: ', ' },
  还是空的: { ja: 'まだ空です', en: 'Still empty' },
  公开: { ja: '公開', en: 'Public' },
  '共享给 {n} 人': { ja: '{n} 人と共有', en: 'Shared with {n}' },
  只有你: { ja: 'あなただけ', en: 'Only you' },
  共享给我的: { ja: '共有されたもの', en: 'Shared with me' },
  '正在读取…': { ja: '読み込んでいます…', en: 'Reading…' },
  '别人把论文共享给你后，会出现在这里。': { ja: 'ほかの人が論文を共有すると、ここに表示されます。', en: 'Papers others share with you show up here.' },
  可查看: { ja: '閲覧可', en: 'Can view' },
  可编辑: { ja: '編集可', en: 'Can edit' },

  // A new paper
  先给论文起个标题: { ja: 'まず論文のタイトルを付けてください', en: 'Give the paper a title first' },
  创建: { ja: '作成', en: 'Create' },
  '创建中…': { ja: '作成しています…', en: 'Creating…' },
  标题: { ja: 'タイトル', en: 'Title' },
  '投稿去向或状态（可以不填）': { ja: '投稿先や状況（空欄でもかまいません）', en: 'Venue or status (optional)' },
  '新论文只有你能看到；建好后在页面上添加文字、图和表格，再决定分享给谁。': {
    ja: '新しい論文はあなたにしか見えません。作成後にページで文章・図・表を追加し、誰と共有するかを決めてください。',
    en: 'Only you can see a new paper. Add text, figures and tables on its page, then decide whom to share it with.',
  },

  // A paper's page
  '正在打开论文…': { ja: '論文を開いています…', en: 'Opening the paper…' },
  '论文还在加载，请稍后再试': { ja: '論文を読み込み中です。少ししてからもう一度お試しください', en: 'The paper is still loading; try again in a moment' },
  '正在更新编号并保存，请几秒后再编辑': { ja: '番号を更新して保存しています。数秒後にもう一度編集してください', en: 'Updating the numbers and saving. Edit again in a few seconds' },
  你只能编辑作者允许你编辑的论文: { ja: '著者が編集を許可した論文しか編集できません', en: 'You can only edit papers the author lets you edit' },
  '找不到这篇论文，可能已经删除，或者作者取消了共享。': { ja: 'この論文が見つかりません。削除されたか、著者が共有をやめた可能性があります。', en: 'This paper was not found; it may have been deleted, or the author stopped sharing it.' },
  回到我的论文: { ja: '自分の論文に戻る', en: 'Back to my papers' },
  '{name} 共享给你': { ja: '{name} さんが共有', en: 'Shared by {name}' },
  '保存中…': { ja: '保存しています…', en: 'Saving…' },
  看读者视角: { ja: '読者の表示で見る', en: 'View as a reader' },
  回到编辑: { ja: '編集に戻る', en: 'Back to editing' },
  演示: { ja: '発表', en: 'Present' },
  只读: { ja: '閲覧のみ', en: 'Read only' },

  // A published paper
  读不到这个文件: { ja: 'このファイルを読めません', en: 'This file cannot be read' },
  '找不到这篇论文。': { ja: 'この論文が見つかりません。', en: 'This paper was not found.' },
  '链接可能写错了，或者作者已经删除了它。': { ja: 'リンクが間違っているか、著者が削除した可能性があります。', en: 'The link may be wrong, or the author deleted it.' },
  '这篇论文没有公开。': { ja: 'この論文は公開されていません。', en: 'This paper is not public.' },
  '作者没有把它共享给你。': { ja: '著者はあなたと共有していません。', en: 'The author has not shared it with you.' },
  '如果作者把它共享给了你，请先登录。': { ja: '著者があなたと共有している場合は、先にログインしてください。', en: 'If the author shared it with you, sign in first.' },
  '{name} 公开的论文': { ja: '{name} さんが公開した論文', en: 'Published by {name}' },

  // Presentation mode
  全屏: { ja: '全画面', en: 'Full screen' },
  退出全屏: { ja: '全画面を終了', en: 'Exit full screen' },
  结束演示: { ja: '発表を終える', en: 'End the presentation' },
  '结束演示（Esc）': { ja: '発表を終える（Esc）', en: 'End the presentation (Esc)' },
  '这篇论文还没有能演示的块。': { ja: 'この論文にはまだ発表できるブロックがありません。', en: 'This paper has no blocks to present yet.' },
  上一块: { ja: '前のブロック', en: 'Previous block' },
  下一块: { ja: '次のブロック', en: 'Next block' },

  // Sharing
  '分享「{title}」': { ja: '「{title}」を共有', en: 'Share "{title}"' },
  完成: { ja: '完了', en: 'Done' },
  邀请合作者: { ja: '共同研究者を招待', en: 'Invite collaborators' },
  'GitHub 用户名': { ja: 'GitHub ユーザー名', en: 'GitHub user name' },
  权限: { ja: '権限', en: 'Access' },
  '{login} 的权限': { ja: '{login} の権限', en: "{login}'s access" },
  '不再和 {login} 共享': { ja: '{login} との共有をやめる', en: 'Stop sharing with {login}' },
  '对方用 GitHub 登录 Galley 后，会在“共享给我的”里看到这篇论文。原型里可以试 alice 和 bob。': {
    ja: '相手が GitHub で Galley にログインすると、「共有されたもの」にこの論文が表示されます。プロトタイプでは alice と bob で試せます。',
    en: 'Once they sign in to Galley with GitHub, they find this paper under "Shared with me". In the prototype, try alice and bob.',
  },
  这是你自己的论文: { ja: 'これはあなた自身の論文です', en: 'This is your own paper' },
  作者: { ja: '著者', en: 'Author' },
  链接: { ja: 'リンク', en: 'Link' },
  只有你和上面的人能打开: { ja: 'あなたと上の人だけが開けます', en: 'Only you and the people above can open it' },
  '公开：任何拿到链接的人都能看': { ja: '公開：リンクを知っている人は誰でも読めます', en: 'Public: anyone with the link can read it' },
  '公开后，读者看不到隐藏的块和 LaTeX 源码。': { ja: '公開しても、読者には非表示のブロックと LaTeX のソースは見えません。', en: 'Once public, readers still do not see hidden blocks or the LaTeX source.' },
  '读者看不到隐藏的块和 LaTeX 源码。': { ja: '読者には非表示のブロックと LaTeX のソースは見えません。', en: 'Readers do not see hidden blocks or the LaTeX source.' },
  '公开后，任何拿到链接的人都能看这篇论文（看不到隐藏的块和 LaTeX 源码）。确定公开吗？': {
    ja: '公開すると、リンクを知っている人は誰でもこの論文を読めます（非表示のブロックと LaTeX のソースは見えません）。公開しますか？',
    en: 'Once public, anyone with the link can read this paper (without the hidden blocks or the LaTeX source). Publish it?',
  },
  取消公开: { ja: '公開をやめる', en: 'Stop publishing' },
  论文链接: { ja: '論文のリンク', en: 'Link to the paper' },
  复制链接: { ja: 'リンクをコピー', en: 'Copy link' },
  '复制失败，请手动复制链接': { ja: 'コピーできませんでした。リンクを手動でコピーしてください', en: 'Copying failed; copy the link by hand' },
});
