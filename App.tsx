import React from 'react';
import { HashRouter } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SiteRoutes from './components/SiteRoutes';
import { ContentProvider } from './components/ContentContext';
import { EditModeProvider } from './components/EditMode';
import { LoginCallback } from './lib/session';

/** Everything inside the router; tests render it with a MemoryRouter. */
export const SiteLayout: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-white">
    <Navbar />
    <main className="flex-grow w-full max-w-5xl mx-auto px-6 md:px-12">
      <SiteRoutes />
    </main>
    <Footer />
  </div>
);

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
