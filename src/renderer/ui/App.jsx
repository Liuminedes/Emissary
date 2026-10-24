import React, { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Inbox } from './screens/Inbox';
import { Catalogo } from './screens/Catalogo';
import { Mensajes } from './screens/Mensajes';
import { Leads } from './screens/Leads';
import { Ajustes } from './screens/Ajustes';
import { Login } from './screens/Login';
import { Guia } from './screens/Guia';
import { EnvioMasivo } from './screens/EnvioMasivo';

const toastStyle = {
  style: {
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '12px',
  },
};

export function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [routeParams, setRouteParams] = useState(null); // datos para la pantalla de destino (ej. qué conversación abrir)
  const [negocio, setNegocio] = useState(null);
  const [user, setUser] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshNegocio = useCallback(async () => {
    const neg = await window.emissary.getNegocio();
    setNegocio(neg);
    return neg;
  }, []);

  // Entra a la aplicación con una sesión ya abierta
  const enter = useCallback(async (sessionUser) => {
    const neg = await refreshNegocio();
    setUser(sessionUser);
    setCurrentRoute(neg?.tour_completo ? 'dashboard' : 'guia_mandatory');
  }, [refreshNegocio]);

  useEffect(() => {
    (async () => {
      try {
        const status = await window.emissary.authStatus();
        setNeedsSetup(status.needsSetup);
        if (status.user) await enter(status.user);
      } catch (err) {
        console.error('Error al cargar datos base', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [enter]);

  const navigate = useCallback((route, params = null) => {
    setRouteParams(params);
    setCurrentRoute(route);
  }, []);

  const handleLogout = async () => {
    await window.emissary.authLogout();
    setUser(null);
    setNegocio(null);
    setCurrentRoute('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Cargando" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login needsSetup={needsSetup} onAuthenticated={(u) => { setNeedsSetup(false); enter(u); }} />
        <Toaster position="bottom-right" richColors toastOptions={toastStyle} />
      </>
    );
  }

  if (currentRoute === 'guia_mandatory') {
    return (
      <>
        <Guia onComplete={() => { refreshNegocio(); setCurrentRoute('dashboard'); }} isStandalone={false} />
        <Toaster position="bottom-right" richColors toastOptions={toastStyle} />
      </>
    );
  }

  return (
    <>
      <Layout
        currentRoute={currentRoute}
        onNavigate={navigate}
        onLogout={handleLogout}
        negocio={negocio}
        user={user}
      >
        {currentRoute === 'dashboard' && <Dashboard asesor={{ nombre: negocio?.nombre_asesor || user.username }} negocio={negocio} onNegocioChange={refreshNegocio} onNavigate={navigate} />}
        {currentRoute === 'inbox' && <Inbox initialUserId={routeParams?.userId} />}
        {currentRoute === 'catalogo' && <Catalogo />}
        {currentRoute === 'mensajes' && <Mensajes />}
        {currentRoute === 'masivos' && <EnvioMasivo />}
        {currentRoute === 'leads' && <Leads onNavigate={navigate} />}
        {currentRoute === 'ajustes' && <Ajustes user={user} onNegocioChange={refreshNegocio} />}
        {currentRoute === 'guia' && <Guia onComplete={() => setCurrentRoute('dashboard')} isStandalone={true} />}
      </Layout>

      <Toaster position="bottom-right" richColors toastOptions={toastStyle} />
    </>
  );
}
