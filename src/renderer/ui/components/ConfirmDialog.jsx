import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, MotionConfig } from 'framer-motion';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { nextFocusIndex } from '../utils/focus';

const ConfirmContext = createContext(null);

// const ok = await confirm({ title, message, confirmLabel, cancelLabel, danger })
// Reemplaza window.confirm: no bloquea la ventana, se ve como el resto de la app y es accesible por teclado y lector de pantalla.
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return confirm;
}

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const pending = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    pending.current?.(false); // un diálogo nuevo cancela el anterior
    pending.current = resolve;
    setOpts(options);
  }), []);

  const close = useCallback((ok) => {
    pending.current?.(ok);
    pending.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && <Dialog opts={opts} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function Dialog({ opts, onClose }) {
  const { title, message, confirmLabel = 'Continuar', cancelLabel = 'Cancelar', danger = false } = opts;
  const titleId = useId();
  const descId = useId();
  const root = useRef(null);
  const cancelBtn = useRef(null);
  const okBtn = useRef(null);

  // El foco entra al diálogo (en "Cancelar" si la acción es destructiva) y vuelve a donde estaba al cerrarlo
  useEffect(() => {
    const previo = document.activeElement;
    (danger ? cancelBtn : okBtn).current?.focus();
    return () => { if (previo && document.contains(previo)) previo.focus(); };
  }, [danger]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(false); return; }
    if (e.key !== 'Tab') return;
    const items = [...root.current.querySelectorAll('button:not([disabled])')];
    const next = nextFocusIndex(items.indexOf(document.activeElement), items.length, e.shiftKey);
    if (next >= 0) { e.preventDefault(); items[next].focus(); }
  };

  const Icon = danger ? AlertTriangle : HelpCircle;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose(false)} aria-hidden="true"
        />
        <motion.div
          ref={root} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={message ? descId : undefined}
          initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl shadow-float p-6"
        >
          <div className="flex gap-4">
            <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              <Icon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
              {message && <p id={descId} className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button ref={cancelBtn} type="button" onClick={() => onClose(false)}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">{cancelLabel}</button>
            <button ref={okBtn} type="button" onClick={() => onClose(true)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${danger ? 'bg-destructive text-destructive-foreground hover:opacity-90' : 'bg-primary text-primary-foreground hover:bg-primary-hover'}`}>{confirmLabel}</button>
          </div>
        </motion.div>
      </div>
    </MotionConfig>,
    document.body,
  );
}
