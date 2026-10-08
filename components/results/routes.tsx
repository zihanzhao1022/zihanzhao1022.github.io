import React, { Suspense, lazy } from 'react';

// The results pages (and pdf.js with them) load only when someone opens them.
const ResultsList = lazy(() => import('./ResultsList'));
const ResultPage = lazy(() => import('./ResultPage'));

export const ResultsListRoute: React.FC = () => (
  <Suspense fallback={null}>
    <ResultsList />
  </Suspense>
);

export const ResultPageRoute: React.FC = () => (
  <Suspense fallback={null}>
    <ResultPage />
  </Suspense>
);
