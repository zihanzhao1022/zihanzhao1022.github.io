import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiteLayout } from '../App';
import { ContentContext } from '../components/ContentContext';
import { EditModeContext, EditModeValue } from '../components/EditMode';
import { NavItem, SiteContent } from '../types';
import fixture from './__fixtures__/content.json';

const navigation: NavItem[] = [
  { id: 'about', type: 'builtin', page: 'about', label: 'about' },
  { id: 'publications', type: 'builtin', page: 'publications', label: 'papers' },
  { id: 'teaching', type: 'page', label: 'teaching', slug: 'teaching', title: 'Teaching', body: '## Courses\n- Algorithms' },
  { id: 'secret', type: 'page', label: 'secret', slug: 'secret', title: 'Secret page', body: 'Not for visitors', hidden: true },
  { id: 'cv', type: 'builtin', page: 'cv', label: 'cv', hidden: true },
  { id: 'scholar', type: 'link', label: 'scholar', url: 'https://scholar.google.com/x' },
];
const content: SiteContent = { ...(fixture as SiteContent), navigation };

const owner: EditModeValue = {
  editing: true,
  loggedIn: true,
  canLogin: true,
  ready: true,
  open: () => {},
  login: () => {},
  reorder: () => {},
};

const render = (path: string, mode?: EditModeValue): string => {
  const page = (
    <ContentContext.Provider value={content}>
      <MemoryRouter initialEntries={[path]}>
        <SiteLayout />
      </MemoryRouter>
    </ContentContext.Provider>
  );
  return renderToStaticMarkup(mode ? <EditModeContext.Provider value={mode}>{page}</EditModeContext.Provider> : page);
};

const navOf = (html: string): string => html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));

describe('navigation for visitors', () => {
  it('shows the visible entries in order, with their labels', () => {
    const nav = navOf(render('/'));
    const positions = ['about', 'papers', 'teaching', 'scholar'].map((label) => nav.indexOf(`>${label}<`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(nav).not.toContain('>secret<');
    expect(nav).not.toContain('>cv<');
    expect(nav).toContain('href="/publications"');
  });

  it('opens external links in a new tab', () => {
    expect(navOf(render('/'))).toContain('href="https://scholar.google.com/x" target="_blank" rel="noreferrer"');
  });

  it('renders custom pages from their Markdown', () => {
    const html = render('/p/teaching');
    expect(html).toContain('Teaching');
    expect(html).toContain('Courses</h2>');
    expect(html).toContain('<li>Algorithms</li>');
  });

  it('does not open hidden pages', () => {
    expect(render('/p/secret')).not.toContain('Not for visitors');
    expect(render('/cv')).not.toContain('Download PDF');
  });
});

describe('navigation for the owner', () => {
  it('shows hidden entries faded, with the edit button', () => {
    const nav = navOf(render('/', owner));
    expect(nav).toContain('>secret<');
    expect(nav).toContain('opacity-50');
    expect(nav).toContain('编辑导航');
  });

  it('opens hidden pages', () => {
    expect(render('/p/secret', owner)).toContain('Not for visitors');
  });
});
