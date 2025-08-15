/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { Analytics } from '@vercel/analytics/next';

if (import.meta && (import.meta as any).env && (import.meta as any).env.PROD) {
  const methods = [
    'log',
    'info',
    'debug',
    'trace',
    'table',
    'group',
    'groupCollapsed',
    'groupEnd',
    'time',
    'timeEnd',
  ] as const;
  methods.forEach(m => {
    (console as any)[m] = () => {};
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Analytics />
    <App />
  </React.StrictMode>
);
