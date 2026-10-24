import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
import './ui/index.css';
import { initTheme } from './ui/utils/theme';
import { ConfirmProvider } from './ui/components/ConfirmDialog';

initTheme();

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>
);
