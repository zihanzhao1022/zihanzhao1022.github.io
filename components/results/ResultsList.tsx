import React from 'react';
import { Link } from 'react-router-dom';
import { paperPath } from '../../lib/results';
import { ResultPaper } from '../../types';
import { useContent } from '../ContentContext';
import { AddButton, EditButton, HiddenBadge, useEditMode, useVisibleItems } from '../EditMode';
import { SortableGroup } from '../SortableGroup';
import { useResultsAccess } from './access';
import Authors from './Authors';

const UNAVAILABLE: Record<string, string> = {
  missing: '读不到私有仓库 zihanzhao1022/homepage-private：请确认仓库存在，并且 GitHub App 已安装到它上面。',
  empty: '私有仓库 zihanzhao1022/homepage-private 还是空的：在 GitHub 上给它加一个 README，再刷新页面。',
  error: '读取私有仓库失败，请刷新页面重试。',
};

/**
 * Shown to the owner when the private list cannot be read (the page then shows the published snapshot),
 * or when the site's copy of the published papers fell behind.
 */
export const ResultsUnavailable: React.FC = () => {
  const access = useResultsAccess();
  if (access?.state === 'unavailable') {
    return (
      <div role="alert" className="mb-8 p-4 rounded-lg bg-amber-50 text-sm text-amber-800">
        {UNAVAILABLE[access.reason ?? 'error']} 现在显示的是网站上已公开的内容，暂时不能编辑。
      </div>
    );
  }
  if (access?.siteBehind) {
    return (
      <div role="alert" className="mb-8 p-4 rounded-lg bg-amber-50 text-sm text-amber-800">
        网站上的公开内容还没有同步成功，访客看到的可能是旧版本（隐藏的论文也可能还在）。
        <button type="button" onClick={access.syncSite} className="ml-2 font-medium underline hover:text-amber-900">
          立即同步
        </button>
      </div>
    );
  }
  return null;
};

const PaperCard: React.FC<{ paper: ResultPaper }> = ({ paper }) => (
  <div className={`relative p-4 rounded-lg hover:bg-gray-50 transition-colors duration-300${paper.hidden ? ' opacity-50' : ''}`}>
    <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">
      <EditButton request={{ kind: 'edit', collection: 'results', id: paper.id }} label="编辑论文信息" className="float-right ml-3" />
      <Link to={paperPath(paper)} className="hover:text-purple-600 transition-colors">
        {paper.title}
      </Link>
      {paper.hidden && <HiddenBadge />}
    </h3>
    {paper.authors.length > 0 && (
      <div className="text-gray-700 text-sm mb-2 font-light">
        <Authors authors={paper.authors} />
      </div>
    )}
    {(paper.venue || paper.year) && (
      <div className="text-sm italic text-gray-500 mb-2">{[paper.venue, paper.year].filter(Boolean).join(' · ')}</div>
    )}
    {paper.summary && <p className="text-sm text-gray-600 mb-2">{paper.summary}</p>}
    <Link to={paperPath(paper)} className="text-xs font-medium text-purple-600 hover:underline">
      view results →
    </Link>
  </div>
);

/** The list of papers on the results pages. */
const ResultsList: React.FC = () => {
  const papers = useVisibleItems(useContent().results);
  const { editing } = useEditMode();

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          results
          <AddButton request={{ kind: 'add', collection: 'results' }} text="添加论文" className="ml-3" />
        </h1>
        <p className="text-sm text-gray-500">figures, tables and notes from my papers.</p>
      </div>
      <ResultsUnavailable />
      <SortableGroup
        collection="results"
        items={papers}
        className="space-y-4"
        renderItem={(paper) => <PaperCard paper={paper} />}
      />
      {papers.length === 0 && (
        <div className="text-center text-gray-500 py-12 italic">
          {editing ? '还没有论文，点上面的"添加论文"开始。新论文默认只有你能看到。' : 'Nothing here yet.'}
        </div>
      )}
    </div>
  );
};

export default ResultsList;
