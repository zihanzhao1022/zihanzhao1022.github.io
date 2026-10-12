import { phrases } from '../i18n';

/** Japanese and English for the site: what visitors and invited collaborators see, and the owner's buttons on the public pages. */
export const { t, useT, table } = phrases({
  // A count of comments: the plural, unlike the button that adds one.
  '批注 {n}': { ja: 'コメント {n}', en: 'Comments {n}' },
  // The owner's buttons on the public pages, and signing in
  '已隐藏': { ja: '非公開', en: 'Hidden' },
  '编辑页面': { ja: 'ページを編集', en: 'Edit page' },
  '编辑导航': { ja: 'ナビゲーションを編集', en: 'Edit navigation' },
  '编辑基本信息': { ja: '基本情報を編集', en: 'Edit basic info' },
  '编辑简介': { ja: '自己紹介を編集', en: 'Edit bio' },
  '更换头像': { ja: 'プロフィール写真を変更', en: 'Change profile picture' },
  '更换照片': { ja: '写真を変更', en: 'Change photo' },
  '编辑联系方式': { ja: '連絡先を編集', en: 'Edit contact info' },
  '添加新闻': { ja: 'ニュースを追加', en: 'Add news' },
  '编辑这条新闻': { ja: 'このニュースを編集', en: 'Edit this news item' },
  '添加奖项': { ja: '受賞歴を追加', en: 'Add award' },
  '添加教育经历': { ja: '学歴を追加', en: 'Add education' },
  '添加工作经历': { ja: '職歴を追加', en: 'Add work experience' },
  '添加志愿经历': { ja: 'ボランティア経験を追加', en: 'Add volunteer experience' },
  '添加项目': { ja: 'プロジェクトを追加', en: 'Add project' },
  '添加论文': { ja: '論文を追加', en: 'Add paper' },
  '添加报告': { ja: '講演を追加', en: 'Add talk' },
  '编辑这场报告': { ja: 'この講演を編集', en: 'Edit this talk' },
  '管理员登录': { ja: '管理者ログイン', en: 'Admin sign-in' },
  '登录失败，请重新登录': { ja: 'ログインに失敗しました。もう一度ログインしてください', en: 'Sign-in failed. Sign in again' },
  '无法开始登录，请稍后重试': {
    ja: 'ログインを開始できません。しばらくしてからもう一度お試しください',
    en: 'Could not start signing in. Please try again later',
  },

  // Signing in to the results pages, and asking for access
  '登录 GitHub 后查看作者共享给你的论文结果。': {
    ja: 'GitHub でログインすると、著者があなたと共有した研究結果を閲覧できます。',
    en: 'Sign in with GitHub to see the results shared with you.',
  },
  '申请访问': { ja: 'アクセスを申請', en: 'Request access' },
  '申请访问论文结果': { ja: '研究結果へのアクセスを申請', en: 'Request access to the results' },
  'GitHub 账号 {login} 还没有访问权限。可以向作者申请，附一句话说明你是谁：': {
    ja: 'GitHub アカウント {login} にはまだアクセス権がありません。著者に申請できます。あなたが誰なのか一言添えてください：',
    en: 'The GitHub account {login} has no access yet. You can ask the author for it, with a line saying who you are:',
  },
  '例如：我是这篇论文的合作者 ××': { ja: '例：この論文の共著者の○○です', en: "e.g. I'm [name], a co-author of this paper" },
  '发送中…': { ja: '送信中…', en: 'Sending…' },
  '发送申请': { ja: '申請を送信', en: 'Send request' },
  '申请没有发出去，请稍后重试': { ja: '申請を送信できませんでした。しばらくしてからもう一度お試しください', en: 'The request was not sent. Try again later' },
  '申请已发给作者。作者同意后，重新点一次登录就能看到论文结果。': {
    ja: '申請を著者に送信しました。承認されたら、もう一度ログインすると研究結果を閲覧できます。',
    en: 'Your request was sent to the author. Once it is approved, sign in again to see the results.',
  },
  '好的': { ja: 'OK', en: 'OK' },

  // The collaborator's bar
  '协作者': { ja: '共同研究者', en: 'Collaborator' },
  '共享给你的论文': { ja: 'あなたと共有された論文', en: 'Papers shared with you' },
  '正在读取…': { ja: '読み込み中…', en: 'Loading…' },
  '重新登录': { ja: '再ログイン', en: 'Sign in again' },
  '登录即将过期，请重新登录后再编辑': { ja: 'ログインの有効期限がまもなく切れます。もう一度ログインしてから編集してください', en: 'Your sign-in expires soon. Sign in again before editing' },
  '你只能编辑作者允许你编辑的论文': { ja: '著者が編集を許可した論文だけを編集できます', en: 'You can only edit the papers the author lets you edit' },
  '论文还在加载，请稍后再试': {
    ja: '論文を読み込み中です。しばらくしてからもう一度お試しください',
    en: 'The papers are still loading. Please try again shortly',
  },
  '暂时读不到共享的论文，请刷新页面重试': {
    ja: '共有された論文を今は読み込めません。ページを再読み込みしてもう一度お試しください',
    en: 'The shared papers cannot be read right now. Please reload the page and try again',
  },
  '正在保存新的顺序并更新编号，请几秒后再编辑': { ja: '新しい順序を保存し、番号を更新しています。数秒後にもう一度編集してください', en: 'Saving the new order and updating the numbers. Edit again in a few seconds' },

  // The list of results papers
  '读不到私有仓库 zihanzhao1022/homepage-private：请确认仓库存在，并且 GitHub App 已安装到它上面。': {
    ja: '非公開リポジトリ zihanzhao1022/homepage-private を読み込めません。リポジトリが存在し、GitHub App がインストールされているか確認してください。',
    en: 'Cannot read the private repository zihanzhao1022/homepage-private: check that it exists and that the GitHub App is installed on it.',
  },
  '私有仓库 zihanzhao1022/homepage-private 还是空的：在 GitHub 上给它加一个 README，再刷新页面。': {
    ja: '非公開リポジトリ zihanzhao1022/homepage-private はまだ空です。GitHub で README を追加してから、ページを再読み込みしてください。',
    en: 'The private repository zihanzhao1022/homepage-private is still empty: add a README to it on GitHub, then reload the page.',
  },
  '读取私有仓库失败，请刷新页面重试。': {
    ja: '非公開リポジトリを読み込めませんでした。ページを再読み込みしてもう一度お試しください。',
    en: 'Could not read the private repository. Please reload the page and try again.',
  },
  '暂时读不到共享给你的论文，请稍后刷新页面重试。': {
    ja: 'あなたと共有された論文を今は読み込めません。しばらくしてからページを再読み込みしてください。',
    en: 'The papers shared with you cannot be read right now. Please reload the page in a while.',
  },
  '现在显示的是网站上已公开的内容，暂时不能编辑。': {
    ja: '現在はサイトで公開中の内容を表示しているため、しばらく編集できません。',
    en: 'What you see is the public version on the site, which cannot be edited for now.',
  },
  '网站上的公开内容还没有同步成功，访客看到的可能是旧版本（隐藏的论文也可能还在）。': {
    ja: 'サイトの公開内容の同期がまだ完了していません。訪問者には古い版が表示されている可能性があります（非公開にした論文が残っていることもあります）。',
    en: 'The public copy on the site has not synced yet: visitors may see an old version (hidden papers may still be there).',
  },
  '立即同步': { ja: '今すぐ同期', en: 'Sync now' },
  '你可以编辑': { ja: '編集できます', en: 'You can edit' },
  '仅查看': { ja: '閲覧のみ', en: 'View only' },
  '有待发布的修改': { ja: '未公開の変更あり', en: 'Unpublished changes' },
  '编辑论文信息': { ja: '論文情報を編集', en: 'Edit paper details' },
  '这些 GitHub 用户登录后能看到所有论文': {
    ja: 'これらの GitHub ユーザーはログインするとすべての論文を閲覧できます',
    en: 'These GitHub users can see every paper once signed in',
  },
  '可以查看全部论文的人': { ja: 'すべての論文を閲覧できる人', en: 'People who can see all papers' },
  '可以查看全部论文的人（{n}）': { ja: 'すべての論文を閲覧できる人（{n}）', en: 'People who can see all papers ({n})' },
  '这里是作者共享给你的论文。': { ja: '著者があなたと共有した論文です。', en: 'These are the papers the author shared with you.' },
  '还没有论文，点上面的"添加论文"开始。新论文默认只有你能看到。': {
    ja: 'まだ論文がありません。上の「論文を追加」から始めてください。新しい論文は、最初はあなただけが閲覧できます。',
    en: 'No papers yet: start with "Add paper" above. A new paper is visible only to you at first.',
  },
  '"{name}" 不是 GitHub 用户名：每行一个，只能包含字母、数字和连字符': {
    ja: '「{name}」は GitHub のユーザー名ではありません。1 行に 1 つずつ、英数字とハイフンだけで入力してください',
    en: '"{name}" is not a GitHub username: one per line, with letters, digits and hyphens only',
  },
  '保存失败，请稍后重试': { ja: '保存できませんでした。しばらくしてからもう一度お試しください', en: 'Could not save. Try again later' },
  '每行一个 GitHub 用户名。他们用 GitHub 登录后能看到这里所有的论文（只看到可见块的结果，看不到 LaTeX 代码），包括以后新建的。只想共享某一篇，就在那篇的"编辑论文信息"里填。': {
    ja: '1 行に 1 つずつ GitHub のユーザー名を入力します。登録した人は GitHub でログインすると、今後追加される論文も含め、ここにあるすべての論文を閲覧できます（公開中のブロックの結果だけで、LaTeX コードは見えません）。1 本だけ共有したい場合は、その論文の「論文情報を編集」で設定してください。',
    en: 'One GitHub username per line. Once signed in with GitHub, they can see every paper here, including papers added later (only the results of visible blocks, not the LaTeX code). To share a single paper, fill in its "Edit paper details" instead.',
  },
  '保存中…': { ja: '保存中…', en: 'Saving…' },

  // A results paper
  '这篇论文目前不公开，只有作者和受邀的协作者能看到。': {
    ja: 'この論文は非公開です。著者と招待された共同研究者だけが閲覧できます。',
    en: 'This paper is not public: only the author and invited collaborators can see it.',
  },
  '这篇论文目前不公开，只有你和共享名单里的人登录后能看到。在"编辑论文信息"里取消隐藏，才会发布到网站。': {
    ja: 'この論文は非公開です。ログインしたあなたと共有リストの人だけが閲覧できます。「論文情報を編集」で非公開を解除すると、サイトに公開されます。',
    en: 'This paper is not public: only you and the people on its sharing list can see it, once signed in. Unhide it in "Edit paper details" to publish it to the site.',
  },
  '这篇论文目前不公开，只有你登录后能看到。在"编辑论文信息"里取消隐藏，才会发布到网站。': {
    ja: 'この論文は非公開です。ログインしたあなただけが閲覧できます。「論文情報を編集」で非公開を解除すると、サイトに公開されます。',
    en: 'This paper is not public: only you can see it, once signed in. Unhide it in "Edit paper details" to publish it to the site.',
  },
  '这篇论文已经公开。你的修改会先保存，作者确认后才会更新到公开的网站上。': {
    ja: 'この論文は公開済みです。あなたの変更はまず保存され、著者が確認してから公開サイトに反映されます。',
    en: 'This paper is public. Your changes are saved first, and reach the public site once the author approves them.',
  },
  '{logins} 修改过这篇已公开的论文，网站上仍是修改前的版本。': {
    ja: '{logins} が公開済みのこの論文を変更しました。サイトにはまだ変更前の版が表示されています。',
    en: '{logins} changed this public paper; the site still shows the version before the changes.',
  },
  // Between the names of a list.
  '、': { ja: '、', en: ', ' },
  '发布这些修改': { ja: 'これらの変更を公開', en: 'Publish these changes' },
  '编辑文字': { ja: 'テキストを編集', en: 'Edit text' },
  '编辑图': { ja: '図を編集', en: 'Edit figure' },
  '编辑表格': { ja: '表を編集', en: 'Edit table' },
  '复制 LaTeX': { ja: 'LaTeX をコピー', en: 'Copy LaTeX' },
  '复制 LaTeX 代码（开头注明需要的宏包）': { ja: 'LaTeX コードをコピー（必要なパッケージを冒頭に記載）', en: 'Copy the LaTeX code (with the packages it needs listed at the top)' },
  '导出全文 LaTeX': { ja: '全文の LaTeX を書き出す', en: 'Export full LaTeX' },
  '按顺序复制所有块（包括隐藏的），开头注明需要的宏包，不含 References': {
    ja: 'すべてのブロック（非公開のものも含む）を順にコピーします。必要なパッケージを冒頭に記載し、References は含みません',
    en: 'Copy every block (hidden ones too) in order, with the packages they need listed at the top, without References',
  },
  '在当前块下方插入内容': { ja: 'このブロックの下に挿入', en: 'Insert below this block' },
  '还没有编译': { ja: 'まだコンパイルされていません', en: 'Not compiled yet' },
  '读取 PDF 失败，请刷新页面重试': {
    ja: 'PDF を読み込めませんでした。ページを再読み込みしてもう一度お試しください',
    en: 'Could not load the PDF. Please reload the page and try again',
  },
  'PDF 显示失败': { ja: 'PDF を表示できませんでした', en: 'Could not display the PDF' },
  '参考文献 {key}': { ja: '参考文献 {key}', en: 'Reference {key}' },
  '查看参考文献 {key}': { ja: '参考文献 {key} を見る', en: 'See reference {key}' },
  '跳转到 {name}': { ja: '{name} へ移動', en: 'Go to {name}' },
  '跳转到文档中的引用位置': { ja: '文書内の参照先へ移動', en: 'Go to the referenced place in the document' },
  'References：正文里还没有用 \\cite 引用 references.bib 里的文献。': {
    ja: 'References：本文ではまだ \\cite で references.bib の文献を引用していません。',
    en: 'References: the text does not \\cite any entry of references.bib yet.',
  },
  '用下面的按钮添加文字、图或表格。': {
    ja: '下のボタンでテキスト、図、表を追加できます。',
    en: 'Add text, figures or tables with the buttons below.',
  },

  // The outline, and who is reading where
  '目录': { ja: '目次', en: 'Contents' },
  '关闭目录': { ja: '目次を閉じる', en: 'Close contents' },
  '在文字块里用 \\section 等写小节标题后，这里会出现目录。': {
    ja: 'テキストブロックで \\section などの見出しを書くと、ここに目次が表示されます。',
    en: 'Write headings with \\section and the like in text blocks, and the contents will show here.',
  },
  '图 {n}': { ja: '図 {n}', en: 'Figure {n}' },
  '表 {n}': { ja: '表 {n}', en: 'Table {n}' },
  '表': { ja: '表', en: 'Table' },
  '正在看': { ja: '閲覧中', en: 'Viewing' },
  '正在看这篇论文的人': { ja: 'この論文を閲覧中の人', en: 'People viewing this paper' },
  '正在看这一块的人': { ja: 'このブロックを閲覧中の人', en: 'People viewing this block' },
  '@{login} 正在看这里': { ja: '@{login} がここを閲覧中', en: '@{login} is viewing this' },
  '@{login} 正在看{place}，点击跳过去': { ja: '@{login} が{place}を閲覧中です。クリックで移動します', en: '@{login} is viewing {place}. Click to go there' },
  '开头': { ja: '冒頭', en: 'the top of the page' },
  '这篇论文': { ja: 'この論文', en: 'this paper' },
  '第 {n} 块（{kind}）': { ja: '{n} 番目のブロック（{kind}）', en: 'block {n} ({kind})' },

  // Comments
  '批注这一块': { ja: 'このブロックにコメント', en: 'Comment on this block' },
  '收起批注': { ja: 'コメントを閉じる', en: 'Close comments' },
  '隐藏已解决': { ja: '解決済みを非表示', en: 'Hide resolved' },
  '显示已解决（{n}）': { ja: '解決済みを表示（{n}）', en: 'Show resolved ({n})' },
  '对这段文字的批注…': { ja: 'このテキストへのコメント…', en: 'Comment on this text…' },
  '对这一块的批注…': { ja: 'このブロックへのコメント…', en: 'Comment on this block…' },
  '发布': { ja: '投稿', en: 'Post' },
  '选中 PDF 里的文字，或点块右上角的批注图标，就能添加批注。': {
    ja: 'PDF のテキストを選択するか、ブロック右上のコメントアイコンをクリックすると、コメントを追加できます。',
    en: 'Select text in a PDF, or click the comment icon at the top right of a block, to add a comment.',
  },
  '正在连接…': { ja: '接続中…', en: 'Connecting…' },
  '解决': { ja: '解決', en: 'Resolve' },
  '重新打开': { ja: '再開', en: 'Reopen' },
  '@{login} 标记为已解决': { ja: '@{login} が解決済みにしました', en: 'Resolved by @{login}' },
  '删除这条批注和它的所有回复？': { ja: 'このコメントとすべての返信を削除しますか？', en: 'Delete this comment and all its replies?' },
  '删除这条回复？': { ja: 'この返信を削除しますか？', en: 'Delete this reply?' },
  '回复…': { ja: '返信…', en: 'Reply…' },
  '刚刚': { ja: 'たった今', en: 'just now' },
  '{n} 分钟前': { ja: '{n} 分前', en: '{n} min ago' },
  '{n} 小时前': { ja: '{n} 時間前', en: '{n} h ago' },
  '{n} 天前': { ja: '{n} 日前', en: '{n} d ago' },

  // The public pages. The English is what the pages said before they were translated.
  // Names of the built-in pages in the navigation, also the pages' titles; the English is their default label.
  '关于': { ja: 'プロフィール', en: 'about' },
  '经历': { ja: '経歴', en: 'experiences' },
  '论文': { ja: '論文', en: 'publications' },
  '项目': { ja: 'プロジェクト', en: 'projects' },
  '报告': { ja: '講演', en: 'talks' },
  '奖项': { ja: '受賞歴', en: 'awards' },
  '简历': { ja: 'CV', en: 'cv' },
  '论文结果': { ja: '研究結果', en: 'results' },
  '© {year} Zihan ZHAO 版权所有。基于 React 构建，托管于 GitHub Pages。': {
    ja: '© {year} Zihan ZHAO. React で構築し、GitHub Pages で公開しています。',
    en: '© Copyright {year} Zihan ZHAO. Powered by React. Hosted by GitHub Pages.',
  },
  // The home page; "{affiliation} {title}" is the line under the name, e.g. "PhD Candidate at …".
  '{affiliation} {title}': { ja: '{affiliation} {title}', en: '{title} at {affiliation}' },
  '新闻': { ja: 'ニュース', en: 'news' },
  '头像': { ja: 'プロフィール写真', en: 'Profile' },
  '{platform} 二维码': { ja: '{platform} の QR コード', en: '{platform} QR' },
  '扫码添加': { ja: 'スキャンして追加', en: 'Scan to Add' },
  '守望先锋段位': { ja: 'オーバーウォッチのランク', en: 'Overwatch ranks' },
  '守望先锋竞技段位': { ja: 'オーバーウォッチの競技ランク', en: 'Overwatch competitive ranks' },
  // Overwatch's roles and competitive tiers, as the game names them.
  '重装': { ja: 'タンク', en: 'Tank' },
  '输出': { ja: 'ダメージ', en: 'Damage' },
  '支援': { ja: 'サポート', en: 'Support' },
  '青铜': { ja: 'ブロンズ', en: 'Bronze' },
  '白银': { ja: 'シルバー', en: 'Silver' },
  '黄金': { ja: 'ゴールド', en: 'Gold' },
  '白金': { ja: 'プラチナ', en: 'Platinum' },
  '钻石': { ja: 'ダイヤモンド', en: 'Diamond' },
  '大师': { ja: 'マスター', en: 'Master' },
  '宗师': { ja: 'グランドマスター', en: 'Grandmaster' },
  '英杰': { ja: 'チャンピオン', en: 'Champion' },
  // Experiences
  '我的求学、工作经历，以及在大学里的志愿与服务经历。': {
    ja: '学歴と職歴、そして大学でのボランティア活動です。',
    en: 'My academic journey, professional roles, and volunteer experiences in universities.',
  },
  '教育经历': { ja: '学歴', en: 'Education' },
  '工作经历': { ja: '職歴', en: 'Work Experience' },
  '志愿与服务': { ja: 'ボランティア・社会貢献', en: 'Volunteer & Service' },
  '排名：{rank}': { ja: '順位：{rank}', en: 'Rank: {rank}' },
  // Publications
  '按类别分组，按时间倒序排列。': { ja: '種類ごとに、新しい順に並べています。', en: 'publications by categories in reversed chronological order.' },
  '输入关键词筛选…': { ja: 'キーワードで絞り込み…', en: 'Type to filter...' },
  '类型：': { ja: '種類：', en: 'Type:' },
  '全部': { ja: 'すべて', en: 'All' },
  '期刊': { ja: 'ジャーナル', en: 'Journal' },
  '会议': { ja: '会議', en: 'Conference' },
  '等级：': { ja: 'ランク：', en: 'Rank:' },
  '其他': { ja: 'その他', en: 'Else' },
  '清除': { ja: 'クリア', en: 'Clear' },
  '期刊论文': { ja: 'ジャーナル論文', en: 'journals' },
  '会议论文': { ja: '会議論文', en: 'conferences' },
  '（收起）': { ja: '（閉じる）', en: '(show less)' },
  '…（还有 {n} 位）': { ja: '…（ほか {n} 名）', en: '... ({n} more)' },
  '没有符合筛选条件的论文。': { ja: '条件に一致する論文はありません。', en: 'No publications match the selected filters.' },
  '缩略图': { ja: 'サムネイル', en: 'thumbnail' },
  '无图片': { ja: '画像なし', en: 'No Image' },
  // Projects and talks
  '科研与开发项目。': { ja: '研究・開発プロジェクト。', en: 'research and development projects.' },
  '暂无项目。': { ja: 'プロジェクトはありません。', en: 'No projects found.' },
  '受邀报告': { ja: '招待講演', en: 'invited talks' },
  '主办：{host}': { ja: '主催：{host}', en: 'Host: {host}' },
  '合作：{collaborators}': { ja: '共同：{collaborators}', en: 'With: {collaborators}' },
  // Awards
  '荣誉与奖项': { ja: '受賞歴', en: 'honors & awards' },
  '竞赛、奖学金与其他荣誉。': { ja: 'コンテスト、奨学金、表彰など。', en: 'competitions, scholarships, and recognitions.' },
  '筛选奖项…': { ja: '受賞歴を絞り込み…', en: 'Filter awards...' },
  '国际': { ja: '国際', en: 'International' },
  '国家级（中国）': { ja: '国家レベル（中国）', en: 'National (China)' },
  '省级（中国）': { ja: '省レベル（中国）', en: 'Provincial (China)' },
  '奖学金': { ja: '奨学金', en: 'Scholarship' },
  '国家级': { ja: '国家レベル', en: 'National' },
  '省级': { ja: '省レベル', en: 'Provincial' },
  '没有符合条件的奖项。': { ja: '条件に一致する受賞歴はありません。', en: 'No awards found matching criteria.' },
  // The CV
  '下载 PDF': { ja: 'PDF をダウンロード', en: 'Download PDF' },
  '研究兴趣': { ja: '研究分野', en: 'Research Interests' },
  '期刊论文（同行评审）': { ja: '査読付きジャーナル論文', en: 'Refereed Journal Articles' },
  '会议论文集': { ja: '会議録', en: 'Conference Proceedings' },
  '代表性项目': { ja: '主なプロジェクト', en: 'Selected Projects' },
  '（合作：{collaborators}）': { ja: '（共同：{collaborators}）', en: '(w/ {collaborators})' },
  '技术技能': { ja: '技術スキル', en: 'Technical Skills' },
  '语言': { ja: '言語', en: 'Languages' },
  // The results pages
  '我论文中的图、表和笔记。': { ja: '論文の図・表・メモです。', en: 'figures, tables and notes from my papers.' },
  '查看结果 →': { ja: '結果を見る →', en: 'view results →' },
  '这里还没有内容。': { ja: 'まだ何もありません。', en: 'Nothing here yet.' },
  '用 GitHub 登录': { ja: 'GitHub でログイン', en: 'Sign in with GitHub' },

  // Turning a figure into a table, or a table into a figure
  '转为表格': { ja: '表に変換', en: 'Turn into a table' },
  '转为图': { ja: '図に変換', en: 'Turn into a figure' },
  '把这张图换成表格，保留图题和引用名；这张图会存下，随时可以换回来': {
    ja: 'この図を表に置き換えます（キャプションとラベルは引き継ぎます）。図は残るので、いつでも戻せます',
    en: 'Redo this figure as a table, keeping its caption and label; the figure is kept, so you can switch back at any time',
  },
  '把这张表格换成图，保留图题和引用名；这张表格会存下，随时可以换回来': {
    ja: 'この表を図に置き換えます（キャプションとラベルは引き継ぎます）。表は残るので、いつでも戻せます',
    en: 'Redo this table as a figure, keeping its caption and label; the table is kept, so you can switch back at any time',
  },
  '换回之前存下的表格；这张图也会存下，随时可以换回来': {
    ja: '以前の表に切り替えます。この図も残るので、いつでも戻せます',
    en: 'Switch to the table kept from before; this figure is kept too, so you can switch back at any time',
  },
  '换回之前存下的图；这张表格也会存下，随时可以换回来': {
    ja: '以前の図に切り替えます。この表も残るので、いつでも戻せます',
    en: 'Switch to the figure kept from before; this table is kept too, so you can switch back at any time',
  },
});
