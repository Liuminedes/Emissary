import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, Megaphone, ShieldAlert, ShieldCheck, Smartphone, X } from 'lucide-react';
import { MetaGuia } from './MetaGuia';

const OPCIONES = {
  meta: {
    icono: ShieldCheck,
    titulo: 'API oficial de Meta',
    resumen: 'El canal que WhatsApp ofrece para empresas.',
    pros: ['Es el canal oficial: tu número no se expone a bloqueos por automatizar.', 'Mensajes con plantillas aprobadas y datos de entrega.'],
    contras: ['Hay que verificar la empresa y esperar la aprobación de las plantillas.', 'Cada mensaje de marketing se cobra.', 'Todavía no está conectada a Emissary: hoy sirve para dejar la cuenta lista.'],
  },
  baileys: {
    icono: Smartphone,
    titulo: 'Mi WhatsApp vinculado',
    resumen: 'El mismo número que ya vinculaste con el código QR.',
    pros: ['Gratis y listo en este momento.', 'Usas el número que ya tienes.'],
    contras: ['No es oficial: WhatsApp puede bloquear el número.', 'Escribirle a quien no te escribió primero es lo que más lo expone.', 'Puede dejar de funcionar si WhatsApp cambia algo.'],
  },
};

// Se muestra al activar los envíos masivos: pregunta cómo se quieren hacer, con pros y contras, antes de activarlos.
// onActivar(canal) guarda el cambio; canal 'meta' además lleva a la guía de Meta.
export function DifusionesActivar({ onActivar, onClose }) {
  const [paso, setPaso] = useState('elegir'); // elegir | meta | baileys
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const activar = async (canal) => {
    setBusy(true);
    try { await onActivar(canal); } finally { setBusy(false); }
  };

  const tarjeta = (id) => {
    const o = OPCIONES[id];
    const Icono = o.icono;
    return (
      <div key={id} className="flex flex-col rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 font-semibold"><Icono className="w-5 h-5 text-primary" aria-hidden="true" />{o.titulo}</div>
        <p className="text-xs text-muted-foreground mt-1">{o.resumen}</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {o.pros.map((t) => <li key={t} className="flex gap-2"><Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" aria-label="A favor" />{t}</li>)}
          {o.contras.map((t) => <li key={t} className="flex gap-2"><X className="w-4 h-4 shrink-0 mt-0.5 text-destructive" aria-label="En contra" />{t}</li>)}
        </ul>
        <button type="button" onClick={() => setPaso(id)} className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
          {id === 'meta' ? 'Quiero usar la API de Meta' : 'Usar mi WhatsApp vinculado'}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <motion.div role="dialog" aria-modal="true" aria-labelledby="difusiones-title" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/10">
          <h2 id="difusiones-title" className="text-xl font-semibold flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" />Activar envíos masivos</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="p-2 text-muted-foreground hover:bg-muted rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {paso === 'elegir' && (
            <>
              <p className="text-sm text-muted-foreground">¿Cómo quieres enviar tus difusiones? Puedes cambiar de idea después: esta pantalla solo te explica las dos formas.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{tarjeta('meta')}{tarjeta('baileys')}</div>
            </>
          )}

          {paso === 'meta' && (
            <>
              <button type="button" onClick={() => setPaso('elegir')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="w-4 h-4" />Volver</button>
              <MetaGuia />
              <p className="text-sm text-muted-foreground">Mientras preparas Meta, puedes activar las difusiones con tu WhatsApp vinculado. La guía quedará disponible en Envíos Masivos.</p>
            </>
          )}

          {paso === 'baileys' && (
            <>
              <button type="button" onClick={() => setPaso('elegir')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="w-4 h-4" />Volver</button>
              <div role="note" className="flex gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-2xl px-4 py-3 text-sm">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p><strong>Riesgo de bloqueo.</strong> Esta conexión no es la API oficial. Escribirle a personas que no te han escrito primero, o a muchos seguidos, puede hacer que WhatsApp bloquee tu número.</p>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                <li>Envía solo a quienes te pidieron información o aceptaron recibir tus mensajes.</li>
                <li>Empieza con pocos contactos y aumenta poco a poco; Emissary ya espacia los mensajes entre 10 y 60 segundos.</li>
                <li>Si alguien pide que no le escribas más, no le vuelvas a enviar: Emissary aún no lo registra por ti.</li>
              </ul>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border/50 bg-muted/10">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
          {paso !== 'elegir' && (
            <button type="button" onClick={() => activar(paso)} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {paso === 'meta' ? 'Activar con mi WhatsApp por ahora' : 'Activar envíos masivos'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
