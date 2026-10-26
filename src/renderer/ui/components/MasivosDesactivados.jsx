import React from 'react';
import { ShieldAlert } from 'lucide-react';

// Lo que ve quien llega a Envíos Masivos mientras están apagados (el servidor también los rechaza)
export function MasivosDesactivados({ user, onNavigate }) {
  const admin = user?.role === 'admin';
  return (
    <div className="max-w-xl mx-auto mt-16 text-center bg-card border border-border/50 rounded-2xl shadow-glass p-10">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-5"><ShieldAlert className="w-7 h-7" aria-hidden="true" /></div>
      <h1 className="text-xl font-semibold tracking-tight">Envíos masivos desactivados</h1>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Escribirle a muchos contactos que no te han escrito primero es lo que más expone un número de WhatsApp a ser bloqueado.
        Por eso esta función viene apagada. {admin ? 'Puedes activarla en Ajustes si entiendes el riesgo.' : 'Un administrador puede activarla desde Ajustes.'}
      </p>
      {admin && (
        <button type="button" onClick={() => onNavigate?.('ajustes')} className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
          Ir a Ajustes
        </button>
      )}
    </div>
  );
}
