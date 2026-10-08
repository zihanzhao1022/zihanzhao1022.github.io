import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, EyeOff } from 'lucide-react';
import { NavItem } from '../types';
import { useContent } from './ContentContext';
import { EditButton, useEditMode } from './EditMode';
import { pathOf } from './pages';
import { isCollaborator, useResultsAccess } from './results/access';

const isResults = (item: NavItem): boolean => item.type === 'builtin' && item.page === 'results';
const RESULTS_ITEM: NavItem = { id: 'results', type: 'builtin', page: 'results', label: 'results' };

const Navbar: React.FC = () => {
  const { navigation } = useContent();
  const { editing, loggedIn } = useEditMode();
  const access = useResultsAccess();
  // Hidden items show while editing. The results page stays hidden from the public, but whoever signs in to
  // it (the owner, or people a paper is shared with) always finds it in the navigation.
  const signedIn = loggedIn && access !== null;
  const items = navigation.filter((item) => editing || !item.hidden || (signedIn && isResults(item)));
  // Collaborators' copy of the navigation never had the hidden entry: the public build leaves hidden items out.
  if (isCollaborator(access) && !items.some(isResults)) items.push(RESULTS_ITEM);
  // Only edit mode marks what visitors cannot see.
  const dimmed = (item: NavItem): boolean => editing && Boolean(item.hidden);

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 py-4 px-6 md:px-12 mb-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <Link
          to="/"
          className="text-xl font-bold text-gray-900 mb-4 md:mb-0 hover:text-purple-600 transition-colors duration-200 group"
        >
          Zihan <span className="font-light text-gray-600 group-hover:text-purple-500 transition-colors duration-200">ZHAO</span>
        </Link>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
          {items.map((item) =>
            item.type === 'link' ? (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 hover:text-purple-600 transition-colors text-gray-500${dimmed(item) ? ' opacity-50' : ''}`}
              >
                {item.label}
                <ExternalLink size={12} />
                {dimmed(item) && <EyeOff size={12} />}
              </a>
            ) : (
              <NavLink
                key={item.id}
                to={pathOf(item)}
                className={({ isActive }) =>
                  `hover:text-purple-600 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-500'}${dimmed(item) ? ' opacity-50' : ''}`
                }
              >
                {item.label}
                {dimmed(item) && <EyeOff size={12} className="inline ml-1 -mt-0.5" />}
              </NavLink>
            ),
          )}
          <EditButton request={{ kind: 'navigation' }} label="编辑导航" text="编辑导航" className="-my-1" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
