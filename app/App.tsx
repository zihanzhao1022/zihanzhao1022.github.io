import React, { useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toast } from '../components/EditMode';
import { MOCK_MODE } from '../lib/session';
import { useT } from '../lib/phrases/app';
import { Account, connectRepo, connectedRepo, signIn, signOut, signedIn } from './accounts';
import { AccountProvider, useAccount } from './AccountContext';
import AppShell, { SignInDialog } from './AppShell';
import Dashboard from './Dashboard';
import Landing from './Landing';
import PaperRoute from './PaperRoute';
import Setup from './Setup';

/** The signed-in account's notices: saves, uploads, switches. */
const Notices: React.FC = () => {
  const account = useAccount();
  if (!account?.toast) return null;
  return <Toast message={account.toast.message} onClose={() => account.setToast(null)} action={account.toast.action} />;
};

const Pages: React.FC<{ account: Account | null; onAccount: (account: Account | null) => void }> = ({ account, onAccount }) => {
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);
  const [repo, setRepo] = useState(() => (account ? connectedRepo(account.login) : null));

  const choose = (next: Account) => {
    signIn(next);
    setChoosing(false);
    setRepo(connectedRepo(next.login));
    onAccount(next);
    navigate('/');
  };
  const leave = () => {
    signOut();
    onAccount(null);
    navigate('/');
  };

  const pages = (
    <AppShell account={account} onSignIn={() => setChoosing(true)} onSignOut={leave}>
      <Routes>
        <Route path="/" element={!account ? <Landing onSignIn={() => setChoosing(true)} /> : repo ? <Dashboard /> : <Navigate to="/setup" replace />} />
        <Route
          path="/setup"
          element={
            account ? (
              <Setup
                account={account}
                onConnect={(chosen) => {
                  connectRepo(account.login, chosen);
                  setRepo(chosen);
                  navigate('/');
                }}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/p/:owner/:slug" element={<PaperRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {choosing && <SignInDialog current={account} onChoose={choose} onClose={() => setChoosing(false)} />}
      <Notices />
    </AppShell>
  );
  // Switching accounts starts the lists over.
  return account ? (
    <AccountProvider key={account.login} account={account}>
      {pages}
    </AccountProvider>
  ) : (
    pages
  );
};

/** Galley, the results pages as an app of their own: a prototype that runs on made-up accounts in this browser. */
const App: React.FC = () => {
  const t = useT();
  const [account, setAccount] = useState<Account | null>(signedIn);
  if (!MOCK_MODE) {
    return <p className="p-10 text-center text-gray-600">{t('Galley 原型只能在本地用 npm run dev:mock 打开。')}</p>;
  }
  return (
    <HashRouter>
      <Pages account={account} onAccount={setAccount} />
    </HashRouter>
  );
};

export default App;
