import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Loader2, Store, UserRound, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { setupSteps } from '../../../main/db/setup.js';

// Tipos de negocio. Volkswagen, KIA y JAC solo se muestran en instalaciones anteriores que ya los usan.
const PLANTILLAS = [
  { id: 'Nuevos', label: 'Concesionario de vehículos nuevos', hint: 'Catálogo, cotización, financiación y asesor' },
  { id: 'Usados', label: 'Concesionario de vehículos usados', hint: 'Disponibles, retoma, financiación y asesor' },
  { id: 'Restaurante', label: 'Restaurante', hint: 'Carta, pedidos a domicilio y horarios' },
  { id: 'Blanco', label: 'En blanco', hint: 'Sin plantilla: tú armas el flujo' },
];
const LEGADO = ['Volkswagen', 'KIA', 'JAC'];
const CATALOGOS_EJEMPLO = ['Volkswagen', 'KIA', 'JAC'];
const nombrePlantilla = (id) => PLANTILLAS.find((m) => m.id === id)?.label || id;

const input = 'w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

// Fuera del componente padre a propósito: si se definiera dentro, cada tecla lo remontaría y el input perdería el foco
function Step({ n, icon: Icon, title, summary, isDone, isOpen, onToggle, children }) {
  return (
    <li className="border-t border-border/40 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${isDone ? 'bg-emerald-500/15 text-emerald-600' : isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          {isDone ? <Check className="w-5 h-5" /> : n}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 font-medium"><Icon className="w-4 h-4 text-muted-foreground" />{title}</span>
          {isDone && summary && <span className="block text-sm text-muted-foreground truncate mt-0.5">{summary}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-6 pb-6 pt-1 pl-[4.75rem]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// Checklist de primera configuración. Desaparece cuando negocio, asesor y WhatsApp están listos.
export function SetupChecklist({ negocio, waStatus, onSaved }) {
  const [form, setForm] = useState({ nombre_negocio: '', marca: '', ejemplo: '', nombre_asesor: '', telefono: '' });
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!negocio) return;
    setForm((f) => ({
      ...f,
      nombre_negocio: negocio.nombre_negocio || '',
      marca: negocio.marca || '',
      nombre_asesor: negocio.nombre_asesor || '',
      telefono: negocio.telefono || '',
    }));
  }, [negocio]);

  const steps = setupSteps(negocio);
  const done = { negocio: steps.negocio, asesor: steps.asesor, whatsapp: waStatus === 'connected' };
  const total = Object.values(done).filter(Boolean).length;
  const firstPending = ['negocio', 'asesor', 'whatsapp'].find((k) => !done[k]);
  const current = open ?? firstPending;

  if (!negocio || total === 3) return null;

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveNegocio = async (e) => {
    e.preventDefault();
    if (!form.nombre_negocio.trim() || !form.marca) return toast.error('Indica el nombre del negocio y elige una plantilla');
    // Cambiar de plantilla reemplaza el flujo y el catálogo
    const cambia = form.marca !== negocio.marca;
    if (cambia && negocio.marca && !window.confirm('Cambiar la plantilla reemplaza tu flujo de mensajes y tu catálogo actuales. ¿Continuar?')) return;
    setSaving(true);
    try {
      await window.emissary.saveNegocio({ nombre_negocio: form.nombre_negocio.trim() });
      if (cambia) await window.emissary.applyBrand(form.marca, form.marca === 'Nuevos' ? form.ejemplo : '');
      await onSaved();
      setOpen(null);
      toast.success('Datos del negocio guardados');
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const saveAsesor = async (e) => {
    e.preventDefault();
    const telefono = form.telefono.replace(/[^0-9]/g, '');
    if (!form.nombre_asesor.trim()) return toast.error('Escribe el nombre del asesor');
    if (telefono.length < 10) return toast.error('El WhatsApp debe incluir el código de país, por ejemplo 573001234567');
    setSaving(true);
    try {
      await window.emissary.saveNegocio({ nombre_asesor: form.nombre_asesor.trim(), telefono });
      await onSaved();
      setOpen(null);
      toast.success('Asesor guardado');
    } catch {
      toast.error('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id) => setOpen(current === id ? '' : id);

  const submitBtn = (label) => (
    <button
      type="submit"
      disabled={saving}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-70"
    >
      {saving && <Loader2 className="w-4 h-4 animate-spin" />}{label}
    </button>
  );

  return (
    <section aria-labelledby="setup-title" className="bg-card border border-border/50 rounded-2xl shadow-glass overflow-hidden">
      <div className="p-6 pb-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="setup-title" className="text-lg font-semibold tracking-tight">Configura tu entorno de atención</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {steps.negocio && steps.asesor ? 'Solo falta conectar tu WhatsApp.' : 'El bot empezará a responder cuando completes los datos del negocio y del asesor.'}
            </p>
          </div>
          <span className="text-sm font-medium text-muted-foreground shrink-0">{total} de 3</span>
        </div>
        <div className="h-2 rounded-full bg-muted mt-4 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={total} aria-label="Progreso de la configuración">
          <motion.div className="h-full bg-primary rounded-full" initial={false} animate={{ width: `${(total / 3) * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
      </div>

      <ol>
        <Step n={1} isDone={done.negocio} isOpen={current === 'negocio'} onToggle={() => toggle('negocio')} icon={Store} title="Tu negocio" summary={`${negocio.nombre_negocio} · ${nombrePlantilla(negocio.marca)}`}>
          <form onSubmit={saveNegocio} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label htmlFor="cl-negocio" className="text-sm font-medium">Nombre del negocio</label>
              <input id="cl-negocio" name="nombre_negocio" value={form.nombre_negocio} onChange={set} placeholder="Tu negocio" className={input} />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium mb-1.5">¿Qué tipo de negocio es?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...PLANTILLAS, ...(LEGADO.includes(negocio.marca) ? [{ id: negocio.marca, label: negocio.marca, hint: 'Plantilla anterior' }] : [])].map((m) => (
                  <label key={m.id} className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer transition-all ${form.marca === m.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/50'}`}>
                    <input type="radio" name="marca" value={m.id} checked={form.marca === m.id} onChange={set} className="sr-only" />
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground">{m.hint}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Carga un flujo de conversación listo para que lo edites en el módulo Mensajes.</p>
            </fieldset>
            {form.marca === 'Nuevos' && form.marca !== negocio.marca && (
              <div className="space-y-1.5">
                <label htmlFor="cl-ejemplo" className="text-sm font-medium">Catálogo de ejemplo (opcional)</label>
                <select id="cl-ejemplo" name="ejemplo" value={form.ejemplo} onChange={set} className={input}>
                  <option value="">Empezar sin catálogo</option>
                  {CATALOGOS_EJEMPLO.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Precarga modelos y precios de una marca para que veas cómo funciona. Luego puedes editarlo o borrarlo.</p>
              </div>
            )}
            {submitBtn('Guardar negocio')}
          </form>
        </Step>

        <Step n={2} isDone={done.asesor} isOpen={current === 'asesor'} onToggle={() => toggle('asesor')} icon={UserRound} title="Asesor y WhatsApp de atención" summary={`${negocio.nombre_asesor} · +${negocio.telefono}`}>
          <form onSubmit={saveAsesor} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label htmlFor="cl-asesor" className="text-sm font-medium">Nombre del asesor</label>
              <input id="cl-asesor" name="nombre_asesor" value={form.nombre_asesor} onChange={set} placeholder="Ej. Juan Pérez" className={input} />
              <p className="text-xs text-muted-foreground">Así se presentará el bot ante tus clientes.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cl-tel" className="text-sm font-medium">WhatsApp del asesor</label>
              <input id="cl-tel" name="telefono" type="tel" value={form.telefono} onChange={set} placeholder="573001234567" className={`${input} font-mono`} />
              <p className="text-xs text-muted-foreground">Con código de país. Evita que el bot se responda a sí mismo y distingue tus mensajes de los del cliente.</p>
            </div>
            {submitBtn('Guardar asesor')}
          </form>
        </Step>

        <Step n={3} isDone={done.whatsapp} isOpen={current === 'whatsapp'} onToggle={() => toggle('whatsapp')} icon={Smartphone} title="Conectar WhatsApp">
          <p className="text-sm text-muted-foreground max-w-lg">
            {waStatus === 'qr'
              ? 'Escanea el código QR de la tarjeta "Estado del bot" con el WhatsApp del asesor (Dispositivos vinculados).'
              : waStatus === 'connecting'
                ? 'Conectando… en unos segundos aparecerá un código QR para escanear.'
                : 'Esperando la conexión. Si tarda, revisa tu internet.'}
          </p>
        </Step>
      </ol>
    </section>
  );
}
