import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import About from '../views/About';
import { useContent } from './ContentContext';
import CustomPage from './CustomPage';
import { useEditMode } from './EditMode';
import { BUILTIN_ROUTES } from './pages';

// Unknown addresses go home, but not while a signed-in owner's content (with hidden pages) is still loading.
const NotFound: React.FC = () => {
  const { ready } = useEditMode();
  return ready ? <Navigate to="/" replace /> : null;
};

/** Routes follow the navigation data; hidden pages only open for the signed-in owner. */
const SiteRoutes: React.FC = () => {
  const { navigation } = useContent();
  const { loggedIn } = useEditMode();
  return (
    <Routes>
      <Route path="/" element={<About />} />
      {navigation
        .filter((item) => loggedIn || !item.hidden)
        .map((item) => {
          if (item.type === 'page') {
            return <Route key={item.id} path={`/p/${item.slug}`} element={<CustomPage item={item} />} />;
          }
          if (item.type === 'builtin' && item.page !== 'about') {
            const { path, component: Page } = BUILTIN_ROUTES[item.page];
            return <Route key={item.id} path={path} element={<Page />} />;
          }
          return null;
        })}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default SiteRoutes;
