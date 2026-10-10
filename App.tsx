import React from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SiteRoutes from './components/SiteRoutes';
import { ContentProvider } from './components/ContentContext';
import { EditModeProvider } from './components/EditMode';
import { LoginCallback } from './lib/session';

/** Everything inside the router; tests render it with a MemoryRouter. */
export const SiteLayout: React.FC = () => {
  // A results paper widens on large screens to fit its outline beside the text.
  const wide = /^\/results\/[^/]+/.test(useLocation().pathname);
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className={`flex-grow w-full max-w-5xl ${wide ? 'xl:max-w-[88rem]' : ''} mx-auto px-6 md:px-12`}>
        <SiteRoutes />
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC<{ loginCallback: LoginCallback | null }> = ({ loginCallback }) => (
  <ContentProvider>
    <EditModeProvider loginCallback={loginCallback}>
      <HashRouter>
        <SiteLayout />
      </HashRouter>
    </EditModeProvider>
  </ContentProvider>
);

export default App;
