import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Catalogo } from './screens/Catalogo';
import { Mensajes } from './screens/Mensajes';
import { Leads } from './screens/Leads';
import { Ajustes } from './screens/Ajustes';
import { SetupWizard } from './screens/SetupWizard';
import { Guia } from './screens/Guia';
import { EnvioMasivo } from './screens/EnvioMasivo';

export function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [negocio, setNegocio] = useState(null);
  const [asesor, setAsesor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga inicial
    const boot = async () => {
      try {
        const neg = await window.emissary.getNegocio();
        setNegocio(neg);
        // Supongamos que el asesor viene dentro del negocio o de otro método.
        // Si no hay un método específico, lo tomaremos de la config.
        setAsesor({ nombre: neg?.nombre_asesor || 'Asesor' });

        if (!neg?.setup_completo) {
          setCurrentRoute('setup');
        } else if (!neg?.tour_completo) {
          setCurrentRoute('guia_mandatory');
        }
      } catch (err) {
        console.error("Error al cargar datos base", err);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  const handleLogout = async () => {
    await window.emissary.logoutWa();
    // La UI reaccionará vía onWaStatus en el Dashboard o globalmente
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (currentRoute === 'setup') {
    return (
      <>
        <SetupWizard onComplete={() => setCurrentRoute('dashboard')} />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  if (currentRoute === 'guia_mandatory') {
    return (
      <>
        <Guia onComplete={() => setCurrentRoute('dashboard')} isStandalone={false} />
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  return (
    <>
      <Layout 
        currentRoute={currentRoute} 
        onNavigate={setCurrentRoute} 
        onLogout={handleLogout}
        negocio={negocio}
      >
        {currentRoute === 'dashboard' && <Dashboard asesor={asesor} negocio={negocio} />}
        {currentRoute === 'catalogo' && <Catalogo />}
        {currentRoute === 'mensajes' && <Mensajes />}
        {currentRoute === 'masivos' && <EnvioMasivo />}
        {currentRoute === 'leads' && <Leads />}
        {currentRoute === 'ajustes' && <Ajustes />}
        {currentRoute === 'guia' && <Guia onComplete={() => setCurrentRoute('dashboard')} isStandalone={true} />}
      </Layout>

      <Toaster 
        position="bottom-right" 
        richColors 
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '12px'
          }
        }}
      />
    </>
  );
}
