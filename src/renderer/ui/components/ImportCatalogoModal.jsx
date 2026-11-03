import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, Loader2, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';

const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// Vista previa de una importación desde Excel: muestra qué se crea, qué cambia de precio y qué se quitaría, y recién ahí se confirma.
export function ImportCatalogoModal({ preview, onClose, onDone }) {
  const { archivo, columnas, resumen, cambios, ausentes, omitidas } = preview;
  const [reemplazar, setReemplazar] = useState(true); // una lista de precios es el catálogo completo
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);
  const quita = reemplazar ? resumen.ausentes : 0;
  const total = resumen.nuevas + resumen.actualizadas + quita;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const aplicar = async () => {
    setBusy(true);
    try {
      const res = await window.emissary.importCatalogoApply({ quitarAusentes: reemplazar });
      if (res?.error) throw new Error(res.error);
      toast.success(`Catálogo actualizado: ${resumen.nuevas} nuevas, ${resumen.actualizadas} con precio nuevo${quita ? `, ${quita} quitadas` : ''}`);
      onDone();
    } catch (err) {
      toast.error(err.message || 'No se pudo importar el catálogo');
      setBusy(false);
    }
  };

  const chip = (n, label, tone) => (
    <div className={`rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-xl font-semibold leading-none">{n}</p>
      <p className="text-xs mt-1 opacity-80">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="import-title"
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-3xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/10">
          <div className="min-w-0">
            <h2 id="import-title" className="text-xl font-semibold flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary" />Importar catálogo</h2>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{archivo}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar" className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <p className="text-sm text-muted-foreground">
            El precio será el de la columna <strong className="text-foreground">«{columnas.precio}»</strong>; la versión, la de «{columnas.version}»
            {columnas.nota ? <> y la promoción, la de «{columnas.nota}»</> : null}. Después puedes cambiar cualquier precio uno por uno desde el catálogo.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {chip(resumen.nuevas, 'versiones nuevas', 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}
            {chip(resumen.actualizadas, 'precios que cambian', 'border-primary/30 bg-primary/10 text-primary')}
            {chip(resumen.sinCambios, 'sin cambios', 'border-border bg-muted/30')}
            {chip(resumen.ausentes, 'no están en el archivo', 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300')}
          </div>

          {cambios.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Qué se va a crear o cambiar</h3>
              <ul className="max-h-56 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40 text-sm">
                {cambios.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate"><strong>{c.modelo}</strong> · {c.version}{c.year ? ` ${c.year}` : ''}</span>
                    <span className="shrink-0 tabular-nums">
                      {c.tipo === 'nueva'
                        ? <><span className="text-xs font-semibold text-emerald-600 mr-2">NUEVA</span>{money(c.precio)}</>
                        : <><span className="text-muted-foreground line-through mr-2">{money(c.antes)}</span>{money(c.precio)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.ausentes > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold mb-1">Lo que hoy está en tu catálogo y no viene en el archivo ({resumen.ausentes})</legend>
              <label className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${reemplazar ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="modo" checked={reemplazar} onChange={() => setReemplazar(true)} className="mt-1" />
                <span className="text-sm"><strong>Reemplazar el catálogo con este archivo</strong> (recomendado si es la lista completa). Se quitan esas {resumen.ausentes} versiones; los modelos completos que no vienen quedan ocultos.</span>
              </label>
              <label className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${!reemplazar ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" name="modo" checked={!reemplazar} onChange={() => setReemplazar(false)} className="mt-1" />
                <span className="text-sm"><strong>Solo agregar y actualizar</strong>. No se quita nada; pueden quedar versiones viejas junto a las nuevas.</span>
              </label>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Ver cuáles son</summary>
                <p className="mt-1">{ausentes.map((a) => `${a.modelo} · ${a.version}`).join(' — ')}</p>
              </details>
            </fieldset>
          )}

          {omitidas.length > 0 && (
            <div role="note" className="flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{omitidas.length} fila(s) se omitieron: {omitidas.slice(0, 6).map((o) => `fila ${o.fila} (${o.modelo}: ${o.motivo.toLowerCase()})`).join('; ')}{omitidas.length > 6 ? '…' : ''}.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-border/50 bg-muted/10">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
          <button type="button" onClick={aplicar} disabled={busy || total === 0} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {total === 0 ? 'Nada que importar' : `Importar (${total} cambios)`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
