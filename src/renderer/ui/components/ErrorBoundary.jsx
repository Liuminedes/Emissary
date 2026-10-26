import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Si una pantalla falla, el resto de la app (menú, sesión) sigue usable en vez de dejar la ventana en blanco
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[Emissary] error en pantalla:', error);
    window.emissary?.logError?.(error?.stack || String(error)); // queda en el registro de errores del equipo
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="h-full flex flex-col items-center justify-center text-center gap-4 p-8">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Algo salió mal en esta pantalla</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Puedes seguir usando el resto de Emissary desde el menú. Si se repite, avisa a soporte.</p>
        </div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }
}
