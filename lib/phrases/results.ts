import { phrases } from '../i18n';

/** Japanese and English for the results editors: blocks, preamble and attachments, references, compiling and saving. */
export const { t, useT, table } = phrases({
  // Sent by the worker as written (editor/results/collaborators.ts, auth-worker/src/results.ts); the site translates them.
  只能修改共享给你的论文: { ja: 'あなたに共有された論文しか変更できません', en: 'You can only change papers shared with you' },
  请求的内容不符合要求: { ja: 'リクエストの内容が要件を満たしていません', en: 'The request is not in the expected format' },
  只能修改导言区: { ja: '変更できるのはプリアンブルだけです', en: 'Only the preamble can be changed' },
  这个操作只有作者本人能做: { ja: 'この操作は著者本人しかできません', en: 'Only the author can do this' },
  文件位置不对: { ja: 'ファイルの場所が正しくありません', en: 'The file is in the wrong place' },
  '找不到 GitHub 用户 {name}，请检查用户名': {
    ja: 'GitHub ユーザー {name} が見つかりません。ユーザー名を確認してください',
    en: 'GitHub user {name} was not found; check the user name',
  },

  // Talking to the worker and to GitHub.
  '网络连接失败，请检查网络后重试': { ja: 'ネットワークに接続できませんでした。接続を確認してから再試行してください', en: 'Network error. Check your connection and try again' },
  '登录已过期，请重新登录': { ja: 'ログインの有効期限が切れました。もう一度ログインしてください', en: 'Your sign-in has expired; please sign in again' },
  '你没有这篇论文的权限，或者作者已经取消了共享': {
    ja: 'この論文へのアクセス権がないか、著者が共有を取り消しました',
    en: "You don't have access to this paper, or the author stopped sharing it",
  },
  '文件超过 1 MB，协作者暂时不能上传这么大的文件': {
    ja: 'ファイルが 1 MB を超えています。共同研究者は今のところ、これほど大きなファイルをアップロードできません',
    en: 'The file is over 1 MB; collaborators cannot upload files this large for now',
  },
  '{name} 超过 1 MB，协作者暂时不能上传这么大的文件': {
    ja: '{name} は 1 MB を超えています。共同研究者は今のところ、これほど大きなファイルをアップロードできません',
    en: '{name} is over 1 MB; collaborators cannot upload files this large for now',
  },
  '请求失败（{status}），请稍后重试': {
    ja: 'リクエストに失敗しました（{status}）。しばらくしてから再試行してください',
    en: 'The request failed ({status}); please try again later',
  },
  一次只能修改一篇论文: { ja: '一度に変更できる論文は 1 本だけです', en: 'Only one paper can be changed at a time' },
  '查询 GitHub 用户失败（GitHub 返回 {status}），请稍后重试': {
    ja: 'GitHub ユーザーを検索できませんでした（GitHub の応答 {status}）。しばらくしてから再試行してください',
    en: 'Looking up the GitHub user failed (GitHub returned {status}); please try again later',
  },

  // Compiling: the TeX engine, problems and rebuilds.
  'TeX 引擎加载失败，请检查网络后重试': {
    ja: 'TeX エンジンを読み込めませんでした。ネットワークを確認してから再試行してください',
    en: 'The TeX engine failed to load; check your connection and try again',
  },
  'TeX 引擎意外退出': { ja: 'TeX エンジンが予期せず終了しました', en: 'The TeX engine quit unexpectedly' },
  'TeX 引擎已重启，请重新编译': { ja: 'TeX エンジンを再起動しました。もう一度コンパイルしてください', en: 'The TeX engine restarted; compile again' },
  '编译超时：可能有无限循环的宏': {
    ja: 'コンパイルがタイムアウトしました：無限ループするマクロがあるかもしれません',
    en: 'Compilation timed out: a macro may be looping forever',
  },
  'BibTeX 意外退出': { ja: 'BibTeX が予期せず終了しました', en: 'BibTeX quit unexpectedly' },
  'TeX 引擎出错，请重试': { ja: 'TeX エンジンでエラーが発生しました。再試行してください', en: 'The TeX engine hit an error; please try again' },
  'TeX 没有生成 PDF，详情见日志': {
    ja: 'TeX が PDF を生成しませんでした。詳しくはログを確認してください',
    en: 'TeX produced no PDF; see the log for details',
  },
  'TeX 没有生成参考文献，详情见日志': {
    ja: 'TeX が参考文献を生成しませんでした。詳しくはログを確認してください',
    en: 'TeX produced no references; see the log for details',
  },
  '未生成以下引用：{keys}。请检查 {file} 中的引用键、条目格式和 BibTeX 日志。': {
    ja: '次の引用が生成されませんでした：{keys}。{file} の引用キーとエントリの書式、BibTeX のログを確認してください。',
    en: 'These citations were not generated: {keys}. Check their keys and entry format in {file}, and the BibTeX log.',
  },
  'BibTeX：{lines}': { ja: 'BibTeX：{lines}', en: 'BibTeX: {lines}' },
  '{file} 第 {line} 行：{message}': { ja: '{file} {line} 行目：{message}', en: '{file}, line {line}: {message}' },
  '{where}第 {line} 行：{message}': { ja: '{where} {line} 行目：{message}', en: '{where}, line {line}: {message}' },
  代码: { ja: 'コード', en: 'Code' },
  导言区: { ja: 'プリアンブル', en: 'Preamble' },
  包装文档: { ja: 'ラッパー文書', en: 'Wrapper document' },
  包装: { ja: 'ラッパー', en: 'Wrapper' },
  '参考文献：{message}': { ja: '参考文献：{message}', en: 'References: {message}' },
  编译失败: { ja: 'コンパイルに失敗しました', en: 'Compilation failed' },
  '参考文献编译失败：{message}': { ja: '参考文献のコンパイルに失敗しました：{message}', en: 'The references failed to compile: {message}' },
  '第 {n} 个块编译失败：{message}': {
    ja: '{n} 番目のブロックのコンパイルに失敗しました：{message}',
    en: 'Block {n} failed to compile: {message}',
  },
  '删除后第 {n} 个块编译失败：{message}': {
    ja: '削除すると {n} 番目のブロックのコンパイルに失敗します：{message}',
    en: 'After the deletion, block {n} fails to compile: {message}',
  },
  '改动后第 {n} 个块编译失败：{message}': {
    ja: '変更すると {n} 番目のブロックのコンパイルに失敗します：{message}',
    en: 'With these changes, block {n} fails to compile: {message}',
  },
  '{problem}。先修好再删除。': { ja: '{problem}。先に修正してから削除してください。', en: '{problem}. Fix it before deleting.' },
  '重新编译失败：{message}': { ja: '再コンパイルに失敗しました：{message}', en: 'Recompiling failed: {message}' },
  编译: { ja: 'コンパイル', en: 'Compile' },
  '编译中…': { ja: 'コンパイル中…', en: 'Compiling…' },
  '已编译 · {ms} ms': { ja: 'コンパイル済み · {ms} ms', en: 'Compiled · {ms} ms' },
  '{n} 个错误': { ja: 'エラー {n} 件', en: 'Errors: {n}' },
  '{n} 条警告': { ja: '警告 {n} 件', en: 'Warnings: {n}' },
  编译日志: { ja: 'コンパイルログ', en: 'Compile log' },
  日志: { ja: 'ログ', en: 'Log' },

  // Lists joined in messages.
  '、': { ja: '、', en: ', ' },
  '；': { ja: '／', en: '; ' },

  // Saving and publishing (editor/results/useResults.ts).
  '公开后，这篇论文的结果会提交到网站的公开仓库，访客可以看到。之后再隐藏，Git 历史里仍会保留。确定公开吗？': {
    ja: '公開すると、この論文の研究結果はサイトの公開リポジトリにコミットされ、訪問者が閲覧できるようになります。あとで非公開にしても Git の履歴には残ります。公開しますか？',
    en: "Once public, this paper's results are committed to the site's public repository, where visitors can see them. Hiding it later still leaves them in the Git history. Make it public?",
  },
  私有仓库还没有准备好: { ja: '非公開リポジトリの準備がまだできていません', en: 'The private repository is not ready yet' },
  '协作者修改了已公开的论文，在论文页确认后才会更新到网站': {
    ja: '共同研究者が公開中の論文を変更しました。論文ページで確認すると、サイトに反映されます',
    en: 'Collaborators changed a public paper; the site shows the changes once you confirm them on the paper page',
  },
  已更新网站上的公开论文结果: { ja: 'サイトで公開中の研究結果を更新しました', en: 'Updated the public results on the site' },
  作者已经不再和你共享论文: { ja: '著者はもうあなたと論文を共有していません', en: 'The author no longer shares papers with you' },
  网站上的公开内容已更新: { ja: 'サイトの公開内容を更新しました', en: 'Updated the public content on the site' },
  '已保存，但更新网站上的公开内容失败': {
    ja: '保存しましたが、サイトの公開内容を更新できませんでした',
    en: "Saved, but updating the site's public content failed",
  },
  '论文结果还在加载，请稍后再试': { ja: '研究結果を読み込み中です。しばらくしてからもう一度お試しください', en: 'The results are still loading. Try again in a moment' },
  '私有仓库不可用，暂时不能保存': { ja: '非公開リポジトリを利用できないため、今は保存できません', en: 'The private repository is unavailable, so nothing can be saved for now' },
  不支持的操作: { ja: 'サポートされていない操作です', en: 'Unsupported operation' },
  已取消公开: { ja: '公開をキャンセルしました', en: 'Publishing cancelled' },
  '修改已发布，网站约 1 分钟后更新': { ja: '変更を公開しました。サイトは約 1 分後に更新されます', en: 'Changes published; the site updates in about a minute' },
  '正在更新编号…': { ja: '番号を更新しています…', en: 'Updating numbers…' },
  顺序已保存: { ja: '順序を保存しました', en: 'Order saved' },

  // Attachments (editor/results/actions.ts and the editors).
  '不支持 {extension} 文件，可以上传 {types}': {
    ja: '{extension} ファイルには対応していません。アップロードできるのは {types} です',
    en: '{extension} files are not supported; you can upload {types}',
  },
  '不支持 没有扩展名的 文件，可以上传 {types}': {
    ja: '拡張子のないファイルには対応していません。アップロードできるのは {types} です',
    en: 'Files without an extension are not supported; you can upload {types}',
  },
  '文件超过 20 MB': { ja: 'ファイルが 20 MB を超えています', en: 'The file is over 20 MB' },
  '{name}：{reason}': { ja: '{name}：{reason}', en: '{name}: {reason}' },
  '读取论文附件失败，请关闭后重试': {
    ja: '論文の添付ファイルを読み込めませんでした。閉じてから再試行してください',
    en: "Couldn't read the paper's attachments; close and try again",
  },
  '正在读取附件…': { ja: '添付ファイルを読み込んでいます…', en: 'Reading attachments…' },

  // The block editor (editor/results/BlockEditor.tsx).
  添加文字: { ja: 'テキストを追加', en: 'Add text' },
  编辑文字: { ja: 'テキストを編集', en: 'Edit text' },
  添加图: { ja: '図を追加', en: 'Add figure' },
  编辑图: { ja: '図を編集', en: 'Edit figure' },
  添加表格: { ja: '表を追加', en: 'Add table' },
  编辑表格: { ja: '表を編集', en: 'Edit table' },
  '{kind}编辑器': { ja: '{kind}エディタ', en: '{kind} editor' },
  '放弃未保存的修改？': { ja: '保存していない変更を破棄しますか？', en: 'Discard unsaved changes?' },
  '编译有错误，修好后才能保存': { ja: 'コンパイルエラーがあります。修正してから保存してください', en: 'There are compile errors; fix them before saving' },
  '确定删除这个块吗？': { ja: 'このブロックを削除しますか？', en: 'Delete this block?' },
  '这篇论文已公开，取消隐藏后这个块会发布到网站。确定吗？': {
    ja: 'この論文は公開中です。このブロックを表示すると、サイトに公開されます。よろしいですか？',
    en: 'This paper is public: unhiding this block publishes it to the site. Continue?',
  },
  '这篇论文已公开，保存后访客就能看到这个块。': {
    ja: 'この論文は公開中です。保存すると、訪問者がこのブロックを閲覧できるようになります。',
    en: 'This paper is public: visitors will see this block once you save.',
  },
  'LaTeX 已复制': { ja: 'LaTeX をコピーしました', en: 'LaTeX copied' },
  '复制失败，请改用"下载"': { ja: 'コピーできませんでした。「ダウンロード」を使ってください', en: 'Copy failed; use "Download" instead' },
  '立即编译（Ctrl/Cmd+Enter）': { ja: '今すぐコンパイル（Ctrl/Cmd+Enter）', en: 'Compile now (Ctrl/Cmd+Enter)' },
  '复制 LaTeX 代码（开头注明需要的宏包）': { ja: 'LaTeX コードをコピー（必要なパッケージを冒頭に記載）', en: 'Copy the LaTeX code (with the packages it needs listed at the top)' },
  '复制 LaTeX': { ja: 'LaTeX をコピー', en: 'Copy LaTeX' },
  '下载为 .tex 文件': { ja: '.tex ファイルとしてダウンロード', en: 'Download as a .tex file' },
  '保存（Ctrl/Cmd+S）': { ja: '保存（Ctrl/Cmd+S）', en: 'Save (Ctrl/Cmd+S)' },
  '保存中…': { ja: '保存中…', en: 'Saving…' },
  预览: { ja: 'プレビュー', en: 'Preview' },
  // The table's two modes: "Visual" and "LaTeX mode", as the table editor's messages call them (lib/phrases/table.ts).
  表格编辑方式: { ja: '表の編集モード', en: 'Table editing mode' },
  可视化: { ja: 'ビジュアル', en: 'Visual' },
  撤销表格修改: { ja: '表の変更を元に戻す', en: 'Undo table change' },
  撤销: { ja: '元に戻す', en: 'Undo' },
  重做表格修改: { ja: '表の変更をやり直す', en: 'Redo table change' },
  重做: { ja: 'やり直す', en: 'Redo' },
  自动更新预览: { ja: 'プレビューは自動で更新されます', en: 'Preview updates automatically' },
  '还没有图片：上传 PDF、PNG 或 JPG（不超过 20 MB）': {
    ja: 'まだ画像がありません：PDF・PNG・JPG をアップロードしてください（20 MB まで）',
    en: 'No images yet: upload a PDF, PNG or JPG (up to 20 MB)',
  },
  '在光标处插入 \\includegraphics': { ja: 'カーソル位置に \\includegraphics を挿入', en: 'Insert \\includegraphics at the cursor' },
  '插入 {name}': { ja: '{name} を挿入', en: 'Insert {name}' },
  // The new figure's starting code names the button above.
  插入: { ja: '挿入', en: 'Insert' },
  上传图片: { ja: '画像をアップロード', en: 'Upload image' },
  '这张表格需要使用 LaTeX 编辑': { ja: 'この表は LaTeX モードで編集する必要があります', en: 'This table needs to be edited in LaTeX mode' },
  '暂时无法读取表格结构。': { ja: '今のところ表の構造を読み取れません。', en: "The table's structure can't be read for now." },
  '原代码已保留，不会自动替换或丢失内容。': {
    ja: '元のコードはそのまま残ります。自動で置き換えられたり、内容が失われたりすることはありません。',
    en: 'The original code is kept: nothing is replaced or lost automatically.',
  },
  '返回 LaTeX 编辑': { ja: 'LaTeX モードに戻る', en: 'Back to LaTeX mode' },
  编译后在这里显示: { ja: 'コンパイルするとここに表示されます', en: 'Appears here once compiled' },

  // BibTeX entries pasted in the block editor or the references editor; 引用名 here is a citation key.
  '把 BibTeX 条目粘贴到这里': { ja: 'ここに BibTeX エントリを貼り付けてください', en: 'Paste the BibTeX entries here' },
  '剪贴板里没有 BibTeX 条目（应该以 @article{… 这样开头）': {
    ja: 'クリップボードに BibTeX エントリがありません（@article{… のように始まるものです）',
    en: 'No BibTeX entries on the clipboard (they start like @article{…)',
  },
  '这篇论文还没有参考文献文件，要新建 {file} 并加入这些条目吗？': {
    ja: 'この論文にはまだ参考文献ファイルがありません。{file} を作成して、これらのエントリを追加しますか？',
    en: 'This paper has no references file yet. Create {file} and add these entries?',
  },
  '已加入 {n} 条文献': { ja: '文献を {n} 件追加しました', en: 'Entries added: {n}' },
  '已加入 {n} 条文献（新建了 {file}）': { ja: '文献を {n} 件追加しました（{file} を作成）', en: 'Entries added: {n} (created {file})' },
  '{keys} 已经在参考文献里': { ja: '{keys} はすでに参考文献にあります', en: '{keys}: already in the references' },
  '已加入 {n} 条，保存后生效': { ja: '{n} 件追加しました（保存すると反映されます）', en: 'Entries added: {n} (applied when you save)' },
  '{keys} 已经有了': { ja: '{keys} はすでにあります', en: '{keys}: already there' },
  // Never first in the notice, so lowercase in English.
  '引用名已复制：{keys}': { ja: '引用キーをコピーしました：{keys}', en: 'citation keys copied: {keys}' },
  '引用名：{keys}': { ja: '引用キー：{keys}', en: 'citation keys: {keys}' },
  '{parts}。在正文中引用后，预览会自动更新。': {
    ja: '{parts}。本文で引用すると、プレビューが自動で更新されます。',
    en: '{parts}. Cite them in the text and the preview updates by itself.',
  },
  '把复制来的 BibTeX 条目加入 references.bib，并把它们的引用名放到剪贴板': {
    ja: 'コピーした BibTeX エントリを references.bib に追加し、引用キーをクリップボードに入れます',
    en: 'Add copied BibTeX entries to references.bib and put their citation keys on the clipboard',
  },
  '粘贴 BibTeX': { ja: 'BibTeX を貼り付け', en: 'Paste BibTeX' },

  // The preamble and attachments (editor/results/PaperSettings.tsx).
  '保存并重新编译…': { ja: '保存して再コンパイル中…', en: 'Saving and recompiling…' },
  '导言区：从 \\documentclass 到 \\begin{document} 之前，可以直接粘贴论文的': {
    ja: 'プリアンブル：\\documentclass から \\begin{document} の前まで。論文のものをそのまま貼り付けられます',
    en: "Preamble: from \\documentclass up to \\begin{document}; you can paste your paper's as is",
  },
  恢复为保存前的内容: { ja: '保存済みの内容に戻す', en: 'Revert to the saved version' },
  还原: { ja: '元に戻す', en: 'Revert' },
  附件: { ja: '添付ファイル', en: 'Attachments' },
  '会议模板的 .sty/.cls、导言区 \\input 的 .tex、图片（PDF/PNG/JPG）。编译时和 main.tex 放在同一目录，不超过 20 MB。': {
    ja: '学会テンプレートの .sty/.cls、プリアンブルで \\input する .tex、画像（PDF/PNG/JPG）。コンパイル時は main.tex と同じディレクトリに置かれます。20 MB まで。',
    en: 'Conference template .sty/.cls files, .tex files the preamble loads with \\input, images (PDF/PNG/JPG). They sit next to main.tex when compiling; up to 20 MB.',
  },
  新上传: { ja: '新規アップロード', en: 'New upload' },
  恢复: { ja: '復元', en: 'Restore' },
  测试编译: { ja: 'テストコンパイル', en: 'Test compile' },
  '用一段示例文字和表格检查导言区能否编译。保存时这篇论文的所有块都会重新编译。': {
    ja: 'サンプルの文章と表で、プリアンブルがコンパイルできるか確認します。保存すると、この論文のすべてのブロックが再コンパイルされます。',
    en: 'Checks that the preamble compiles, with sample text and a table. Saving recompiles every block of this paper.',
  },

  // The references editor (editor/results/ReferencesEditor.tsx).
  '% 在这里粘贴 BibTeX 条目，或者点"粘贴 BibTeX"。正文里用 \\cite{引用名} 引用。': {
    ja: '% ここに BibTeX エントリを貼り付けるか、「BibTeX を貼り付け」を押してください。本文では \\cite{引用キー} で引用します。',
    en: '% Paste BibTeX entries here, or click "Paste BibTeX". Cite them in the text with \\cite{key}.',
  },
  '读取 {file} 失败，请关闭后重试': { ja: '{file} を読み込めませんでした。閉じてから再試行してください', en: "Couldn't read {file}; close and try again" },
  '参考文献还没保存，确定关闭吗？': { ja: '参考文献はまだ保存されていません。閉じますか？', en: "The references aren't saved yet. Close anyway?" },
  '把复制来的 BibTeX 条目加进来，并把它们的引用名放到剪贴板': {
    ja: 'コピーした BibTeX エントリを追加し、引用キーをクリップボードに入れます',
    en: 'Add copied BibTeX entries and put their citation keys on the clipboard',
  },
  '这篇论文还没有参考文献文件。': { ja: 'この論文にはまだ参考文献ファイルがありません。', en: 'This paper has no references file yet.' },
  '新建 {file}': { ja: '{file} を作成', en: 'Create {file}' },
  '新建后，正文里用 \\cite 引用的文献会自动排在论文页最后的 References 里，编号在各个块之间连续。': {
    ja: '作成すると、本文で \\cite した文献が論文ページ末尾の References に自動で並び、番号はブロックをまたいで通しで付きます。',
    en: 'Once it exists, works cited with \\cite are listed automatically in References at the end of the paper page, numbered continuously across blocks.',
  },
  '正在读取 {file}…': { ja: '{file} を読み込んでいます…', en: 'Reading {file}…' },
  '{file}：共 {n} 条。引用格式 {style}{note}；在"导言区与附件"上传会议的 .bst 可以换成它的格式。References 只列出正文引用过的文献。': {
    ja: '{file}：{n} 件。引用スタイル {style}{note}。「プリアンブルと添付ファイル」で学会の .bst をアップロードすると、そのスタイルに切り替わります。References には本文で引用した文献だけが載ります。',
    en: 'Entries in {file}: {n}. Citation style {style}{note}. Upload a conference .bst under "Preamble & attachments" to switch to its style. References lists only the works cited in the text.',
  },
  '（作者-年份，导言区用了 natbib）': { ja: '（著者-年方式、プリアンブルで natbib を使用）', en: ' (author–year; the preamble uses natbib)' },
  '（按引用顺序编号）': { ja: '（引用順に番号付け）', en: ' (numbered in citation order)' },
  '（来自上传的 .bst）': { ja: '（アップロードした .bst）', en: ' (from the uploaded .bst)' },

  // Color definitions repeated in blocks, moved to the preamble
  '{n} 个块里重复定义了这些颜色：{names}': {
    ja: '{n} 個のブロックでこれらの色が重複して定義されています：{names}',
    en: 'These colours are defined again in {n} block(s): {names}',
  },
  '移到导言区': { ja: 'プリアンブルに移す', en: 'Move to the preamble' },
  '已移到导言区：保存时会从 {n} 个块里删掉这些颜色定义，并重新编译所有块。': {
    ja: 'プリアンブルに移しました。保存すると {n} 個のブロックからこれらの色の定義を削除し、すべてのブロックを再コンパイルします。',
    en: 'Moved to the preamble: saving removes these colour definitions from {n} block(s) and recompiles every block.',
  },

  // An empty text block
  '在这里写文字，数学公式照常可用：$E = mc^2$': {
    ja: 'ここに本文を書きます。数式もいつも通り使えます：$E = mc^2$',
    en: 'Write the text here; math works as usual: $E = mc^2$',
  },
  '请先输入内容': { ja: '先に内容を入力してください', en: 'Write something first' },

  // Turning a figure into a table, or a table into a figure (editor/results/convert.ts)
  '把图转换成表格': { ja: '図を表に変換', en: 'Turn the figure into a table' },
  '把表格转换成图': { ja: '表を図に変換', en: 'Turn the table into a figure' },
  '保存后这张图会变成表格，图题和引用名已保留；取消则保持原样。': {
    ja: '保存すると、この図は表に変わります（キャプションとラベルは引き継ぎます）。キャンセルすると元のままです。',
    en: 'Saving turns this figure into a table, keeping its caption and label; cancel to leave it as it is.',
  },
  '保存后这张表格会变成图，图题和引用名已保留；取消则保持原样。': {
    ja: '保存すると、この表は図に変わります（キャプションとラベルは引き継ぎます）。キャンセルすると元のままです。',
    en: 'Saving turns this table into a figure, keeping its caption and label; cancel to leave it as it is.',
  },
});
