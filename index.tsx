import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { takeLoginCallback } from './lib/session';

// Read GitHub's login redirect before the router looks at the address bar.
const loginCallback = takeLoginCallback();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App loginCallback={loginCallback} />
  </React.StrictMode>
);
