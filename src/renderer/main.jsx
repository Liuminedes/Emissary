import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.jsx';
import './ui/index.css';
import { initTheme } from './ui/utils/theme';
import { ConfirmProvider } from './ui/components/ConfirmDialog';

initTheme();

// Errores de la interfaz que ningún componente capturó: al registro de errores del equipo
window.addEventListener('error', (e) => window.emissary?.logError?.(`${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => window.emissary?.logError?.(`Promesa rechazada: ${e.reason?.stack || e.reason}`));

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ConfirmProvider>
      <App />
    </ConfirmProvider>
  </React.StrictMode>
);
