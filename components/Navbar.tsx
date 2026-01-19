import React from 'react';
import { NavLink, Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  const links = [
    { name: 'about', path: '/' },
    { name: 'experiences', path: '/experiences' },
    { name: 'publications', path: '/publications' },
    { name: 'projects', path: '/projects' },
    { name: 'talks', path: '/talks' },
    { name: 'awards', path: '/awards' },
    // { name: 'cv', path: '/cv' }, // Temporarily hidden
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100 py-4 px-6 md:px-12 mb-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <Link 
          to="/" 
          className="text-xl font-bold text-gray-900 mb-4 md:mb-0 hover:text-purple-600 transition-colors duration-200 group"
        >
          Zihan <span className="font-light text-gray-600 group-hover:text-purple-500 transition-colors duration-200">ZHAO</span>
        </Link>
        
        <div className="flex gap-6 text-sm font-medium">
          {links.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              className={({ isActive }) =>
                `hover:text-purple-600 transition-colors ${
                  isActive ? 'text-purple-600' : 'text-gray-500'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;