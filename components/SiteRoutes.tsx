import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import About from '../views/About';
import { useContent } from './ContentContext';
import CustomPage from './CustomPage';
import { useEditMode } from './EditMode';
import { BUILTIN_ROUTES } from './pages';
import { ResultPageRoute } from './results/routes';

// Development only: a page for trying the TeX engine. Production builds drop it and the engine.
const TexLab = import.meta.env.DEV ? React.lazy(() => import('../editor/tex/TexLab')) : null;

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
            return (
              <React.Fragment key={item.id}>
                <Route path={path} element={<Page />} />
                {/* Each paper of the results list has its own page. */}
                {item.page === 'results' && <Route path="/results/:slug" element={<ResultPageRoute />} />}
              </React.Fragment>
            );
          }
          return null;
        })}
      {TexLab && (
        <Route
          path="/__tex"
          element={
            <React.Suspense fallback={null}>
              <TexLab />
            </React.Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default SiteRoutes;
