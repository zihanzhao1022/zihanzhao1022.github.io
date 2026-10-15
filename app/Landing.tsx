import React from 'react';
import { ArrowLeftRight, FolderUp, ListTree, MessageSquare, Presentation, ZoomIn } from 'lucide-react';
import { useT } from '../lib/phrases/app';
import { ACCOUNTS } from './accounts';
import Avatar from './Avatar';

/** A results page in miniature: the outline, a section with a figure, a comment in the margin, two readers. */
const Sheet: React.FC = () => {
  const t = useT();
  const [, alice, bob] = ACCOUNTS;
  return (
    <div className="mx-auto w-full max-w-[42rem] select-none" aria-hidden="true">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 rounded-sm border border-gray-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_40px_-24px_rgba(24,24,27,0.35)] sm:grid-cols-[6rem_minmax(0,1fr)_10rem]">
        <nav className="hidden space-y-2 pt-1 text-[11px] text-gray-400 sm:block">
          <p className="text-gray-500">{t('目录')}</p>
          <p>1 Setup</p>
          <p>2 Method</p>
          <p className="-ml-1.5 rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">3 Results</p>
          <p className="pl-3">{t('图 2')}</p>
          <p className="pl-3">{t('表 1')}</p>
          <p>References</p>
        </nav>
        <div className="font-serif-display text-[13px] leading-relaxed text-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-base font-semibold">3&nbsp;&nbsp;Results</p>
            <span className="flex -space-x-1.5">
              <Avatar account={alice} size={22} className="ring-2 ring-white" />
              <Avatar account={bob} size={22} className="ring-2 ring-white" />
            </span>
          </div>
          <p>
            Ours improves accuracy on <mark className="rounded-sm bg-amber-200/80 px-0.5 text-gray-900">all four made-up tasks</mark>, while the
            baseline drops on the last two.
          </p>
          <svg viewBox="0 0 280 120" className="my-4 w-full">
            <line x1="20" y1="104" x2="276" y2="104" stroke="#d4d4d8" />
            {[
              [56, 40],
              [70, 52],
              [62, 44],
              [80, 58],
            ].map(([ours, base], index) => (
              <g key={index} transform={`translate(${36 + index * 62} 0)`}>
                <rect x="0" y={104 - base} width="18" height={base} fill="#d4d4d8" />
                <rect x="21" y={104 - ours - 18} width="18" height={ours + 18} fill="#6d28d9" />
              </g>
            ))}
          </svg>
          <p className="text-center text-[12px] text-gray-600">Figure 2: Accuracy of the made-up methods.</p>
        </div>
        {/* The margin, where comments sit beside what they are about. */}
        <div className="hidden pt-9 sm:block">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] leading-snug text-gray-800">
            <div className="mb-1.5 flex items-center gap-1.5 text-gray-500">
              <Avatar account={alice} size={18} />
              <span>Alice</span>
            </div>
            {t('这个提升是 5 次运行的平均吗？')}
          </div>
        </div>
      </div>
    </div>
  );
};

/** What a visitor sees first: what Galley is for, and the way in. */
const Landing: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
  const t = useT();
  const steps = [
    { title: t('连接一个仓库'), body: t('选一个 GitHub 私有仓库，Galley 只读写这一个。') },
    { title: t('放进结果'), body: t('粘贴 LaTeX，或者把图、表格文件拖进来，在浏览器里直接编译。') },
    { title: t('分享'), body: t('按 GitHub 用户名邀请合作者，或者公开一个只读链接。') },
  ];
  const features = [
    { icon: ListTree, text: t('目录跟着 \\section 自动生成') },
    { icon: ArrowLeftRight, text: t('图和表格可以互相切换，两份都保留') },
    { icon: ZoomIn, text: t('点图放大，PDF 矢量图怎么放大都清楚') },
    { icon: MessageSquare, text: t('批注贴在原文上，还能看到谁在看哪一段') },
    { icon: Presentation, text: t('演示模式：一块一屏，方向键翻页') },
    { icon: FolderUp, text: t('把整个文件夹拖进来就能上传') },
  ];
  return (
    <div className="pb-24">
      <section className="grid items-center gap-14 py-14 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] xl:py-20">
        <div>
          <h1 className="font-serif-display text-4xl leading-tight text-gray-900 sm:text-[2.75rem]">
            <span className="block">{t('写论文用 Overleaf，')}</span>
            <span className="block">{t('给人看结果用 Galley。')}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-600">
            {t('把 LaTeX 写的文字、图和表格编译成一页页清楚的结果，按章节排好。合作者在页边批注，组会时直接演示。所有内容都存在你自己的 GitHub 私有仓库里。')}
          </p>
          <button type="button" onClick={onSignIn} className="mt-8 inline-flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t('用 GitHub 登录')}
          </button>
        </div>
        <Sheet />
      </section>

      <section className="border-t border-gray-200 pt-12">
        <h2 className="font-serif-display text-2xl text-gray-900">{t('三步开始')}</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="font-serif-display text-3xl text-violet-700">{index + 1}</span>
              <p className="mt-2 font-medium text-gray-900">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 border-t border-gray-200 pt-12">
        <h2 className="font-serif-display text-2xl text-gray-900">{t('为展示结果而做')}</h2>
        <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {features.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-gray-700">
              <Icon size={18} className="mt-0.5 shrink-0 text-violet-700" />
              {text}
            </li>
          ))}
        </ul>
        <p className="mt-12 text-sm text-gray-500">{t('Galley 开源（AGPL-3.0）。编译在你的浏览器里完成，服务器只负责登录、共享和批注。')}</p>
      </section>
    </div>
  );
};

export default Landing;
