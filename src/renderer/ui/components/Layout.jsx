import React from 'react';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from './ErrorBoundary';
import { applyAccentColor } from '../utils/colors';

export function Layout({ currentRoute, onNavigate, onLogout, negocio, user, children }) {
  // Inyectamos el color de acento cuando el componente se monta o el negocio cambia
  React.useEffect(() => {
    if (negocio?.color_acento) {
      applyAccentColor(negocio.color_acento);
    }
  }, [negocio?.color_acento]);

  return (
    <div className="flex min-h-screen bg-background/50 relative selection:bg-primary/20 selection:text-primary">
      {/* Background sutil con blur opcional para dar más ambiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/30 to-background -z-10" />
      
      <Sidebar 
        currentRoute={currentRoute} 
        onNavigate={onNavigate} 
        onLogout={onLogout}
        user={user}
      />
      
      <main className={`flex-1 overflow-y-auto h-screen relative ${currentRoute === 'mensajes' ? 'p-0' : 'px-10 py-10'}`}>
        <div className="w-full h-full mx-auto max-w-none">
          <ErrorBoundary key={currentRoute}>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
