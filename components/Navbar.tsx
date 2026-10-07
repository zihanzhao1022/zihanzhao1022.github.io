import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ExternalLink, EyeOff } from 'lucide-react';
import { useContent } from './ContentContext';
import { EditButton, useVisibleItems } from './EditMode';
import { pathOf } from './pages';

const Navbar: React.FC = () => {
  const items = useVisibleItems(useContent().navigation);

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
                className={`inline-flex items-center gap-1 hover:text-purple-600 transition-colors text-gray-500${item.hidden ? ' opacity-50' : ''}`}
              >
                {item.label}
                <ExternalLink size={12} />
                {item.hidden && <EyeOff size={12} />}
              </a>
            ) : (
              <NavLink
                key={item.id}
                to={pathOf(item)}
                className={({ isActive }) =>
                  `hover:text-purple-600 transition-colors ${isActive ? 'text-purple-600' : 'text-gray-500'}${item.hidden ? ' opacity-50' : ''}`
                }
              >
                {item.label}
                {item.hidden && <EyeOff size={12} className="inline ml-1 -mt-0.5" />}
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
