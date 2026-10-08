import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiteLayout } from '../App';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import ResultPage from '../components/results/ResultPage';
import ResultsList from '../components/results/ResultsList';
import { ResultsAccess, ResultsAccessContext } from '../components/results/access';
import { NavItem, ResultPaper, SiteContent } from '../types';
import fixture from './__fixtures__/content.json';

const output = (pdf: string) => ({ pdf, width: 345, height: 120 });

const results: ResultPaper[] = [
  {
    id: 'res-pub',
    slug: 'public-paper',
    title: 'A made-up published paper',
    authors: ['**Me**', 'Coauthor'],
    venue: 'Made-up Conf',
    year: 2027,
    summary: 'Main tables.',
    blocks: [
      { id: 'b1', kind: 'table', source: '\\toprule', output: output('results/res-pub/b1-aaaa.pdf') },
      { id: 'b2', kind: 'text', hidden: true, output: output('results/res-pub/b2-bbbb.pdf') },
    ],
  },
  { id: 'res-draft', slug: 'draft', title: 'A made-up draft', authors: [], hidden: true, blocks: [] },
  {
    id: 'res-review',
    slug: 'reviewed',
    title: 'A made-up paper a collaborator edited',
    authors: [],
    editors: ['alice'],
    collaboratorIds: { alice: 101 },
    pendingReview: ['alice'],
    blocks: [{ id: 'b5', kind: 'table', source: '\\toprule', output: output('results/res-review/b5-eeee.pdf') }],
  },
];

const navigation = (hidden: boolean): NavItem[] => [
  { id: 'about', type: 'builtin', page: 'about', label: 'about' },
  { id: 'results', type: 'builtin', page: 'results', label: 'results', ...(hidden ? { hidden: true } : {}) },
];

const content = (hiddenNav = false): SiteContent => ({ ...(fixture as SiteContent), navigation: navigation(hiddenNav), results });

const owner: EditModeValue = {
  editing: true,
  loggedIn: true,
  canLogin: true,
  ready: true,
  open: () => {},
  login: () => {},
  reorder: () => {},
  reorderBlocks: () => {},
};

const privateAccess: ResultsAccess = { state: 'private', readFile: async () => new Uint8Array() };

function render(path: string, page: React.ReactElement, mode?: EditModeValue, access?: ResultsAccess): string {
  const tree = (
    <ContentContext.Provider value={content()}>
      <ResultsAccessContext.Provider value={access ?? null}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/results" element={<ResultsList />} />
            <Route path="/results/:slug" element={page} />
          </Routes>
        </MemoryRouter>
      </ResultsAccessContext.Provider>
    </ContentContext.Provider>
  );
  return renderToStaticMarkup(mode ? <EditModeContext.Provider value={mode}>{tree}</EditModeContext.Provider> : tree);
}

describe('results list', () => {
  it('shows visitors the published papers only, linking to their pages', () => {
    const html = render('/results', <ResultPage />);
    expect(html).toContain('A made-up published paper');
    expect(html).toContain('href="/results/public-paper"');
    expect(html).toContain('Made-up Conf · 2027');
    expect(html).not.toContain('A made-up draft');
    expect(html).not.toContain('添加论文');
  });

  it('shows the owner every paper, hidden ones marked', () => {
    const html = render('/results', <ResultPage />, owner, privateAccess);
    expect(html).toContain('A made-up draft');
    expect(html).toContain('已隐藏');
    expect(html).toContain('添加论文');
  });

  it('tells the owner when the private repository cannot be read', () => {
    const html = render('/results', <ResultPage />, owner, { state: 'unavailable', reason: 'missing', readFile: async () => new Uint8Array() });
    expect(html).toContain('读不到私有仓库');
  });
});

describe('paper page', () => {
  it('shows visitors the visible blocks only', () => {
    const html = render('/results/public-paper', <ResultPage />);
    expect(html).toContain('A made-up published paper');
    expect(html).toContain('<strong');
    expect(html.match(/relative mx-auto bg-white/g)).toHaveLength(1);
    expect(html).not.toContain('导言区与附件');
    expect(html).not.toContain('编辑');
    expect(html).not.toContain('复制 LaTeX');
  });

  it('gives the owner every block with editing controls', () => {
    const html = render('/results/public-paper', <ResultPage />, owner, privateAccess);
    expect(html.match(/relative mx-auto bg-white/g)).toHaveLength(2);
    expect(html).toContain('导言区与附件');
    expect(html).toContain('编辑表格');
    expect(html.match(/复制 LaTeX<\/button>/g)).toHaveLength(1);
    expect(html).toContain('已隐藏');
    for (const label of ['文字', '图', '表格']) expect(html).toContain(label);
  });

  it('tells the owner a hidden paper is not public yet', () => {
    const html = render('/results/draft', <ResultPage />, owner, privateAccess);
    expect(html).toContain('这篇论文目前不公开');
  });

  it('asks visitors to sign in at an unknown address: it may be a paper shared with them', () => {
    expect(render('/results/nope', <ResultPage />)).toContain('Sign in with GitHub to see the results shared with you.');
  });

  it('sends the signed-in owner back to the list from an unknown address', () => {
    expect(render('/results/nope', <ResultPage />, owner, privateAccess)).toBe('');
  });

  it("asks the owner to publish collaborators' edits to a published paper", () => {
    const html = render('/results/reviewed', <ResultPage />, owner, { ...privateAccess, approveEdits: () => {} });
    expect(html).toContain('@alice 修改过这篇已公开的论文');
    expect(html).toContain('发布这些修改');
  });

  it('waits for the owner private list before deciding a paper is missing', () => {
    expect(render('/results/nope', <ResultPage />, { ...owner, ready: false })).toBe('');
  });
});

describe('collaborators', () => {
  const collaborator: EditModeValue = { ...owner, editing: false };
  const access: ResultsAccess = {
    role: 'collaborator',
    state: 'private',
    readFile: async () => new Uint8Array(),
    shared: { 'res-draft': 'viewer', 'res-review': 'editor' },
  };

  it('lists the papers shared with them, hidden or not, with their role', () => {
    const html = render('/results', <ResultPage />, collaborator, access);
    expect(html).toContain('A made-up draft');
    expect(html).toContain('仅查看');
    expect(html).toContain('你可以编辑');
    expect(html).not.toContain('添加论文');
    expect(html).not.toContain('编辑论文信息');
  });

  it('lets an editor edit the blocks of their paper, but not its information', () => {
    const html = render('/results/reviewed', <ResultPage />, collaborator, access);
    expect(html).toContain('导言区与附件');
    expect(html).toContain('编辑表格');
    expect(html.match(/复制 LaTeX<\/button>/g)).toHaveLength(1);
    expect(html).not.toContain('编辑论文信息');
    expect(html).toContain('作者确认后才会更新');
    expect(html).not.toContain('发布这些修改');
  });

  it('shows a viewer the paper without editing controls', () => {
    const html = render('/results/draft', <ResultPage />, collaborator, access);
    expect(html).toContain('只有作者和受邀的协作者能看到');
    expect(html).not.toContain('导言区与附件');
    expect(html).not.toContain('编辑');
  });
});

describe('results routes', () => {
  const site = (path: string, hiddenNav: boolean, mode?: EditModeValue): string => {
    const tree = (
      <ContentContext.Provider value={content(hiddenNav)}>
        <MemoryRouter initialEntries={[path]}>
          <SiteLayout />
        </MemoryRouter>
      </ContentContext.Provider>
    );
    return renderToStaticMarkup(mode ? <EditModeContext.Provider value={mode}>{tree}</EditModeContext.Provider> : tree);
  };

  it('lists the results page in the navigation only when it is not hidden', () => {
    expect(site('/', false)).toContain('href="/results"');
    expect(site('/', true)).not.toContain('href="/results"');
  });

  it('asks visitors to sign in at a hidden results address instead of sending them home', () => {
    expect(site('/results/draft', true)).toContain('Sign in with GitHub to see the results shared with you.');
  });
});
