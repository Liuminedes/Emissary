import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ListChecks, Loader2, Save, Send, ShieldCheck, Trash2, TriangleAlert, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { ETAPAS } from '../../../main/db/scoring.js';
import { CALIFICACIONES, MAX_POR_LISTA } from '../../../main/db/segmentos.js';
import { useConfirm } from '../components/ConfirmDialog';

const FILTRO_VACIO = { etapas: [], calificaciones: [], diasSinContacto: 0, interes: '' };
const input = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
const card = 'bg-card border border-border/50 rounded-2xl shadow-sm';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fecha = (ms) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

const PRACTICAS = [
  'Difunde solo a quienes ya te escribieron o te pidieron información. Nunca a listas compradas o frías.',
  'Usa las listas de difusión de la app de WhatsApp Business, enviadas por ti desde el celular. Máximo 256 por lista, y solo les llega a quienes te tienen guardado: por eso exportamos los contactos.',
  'Una o dos difusiones por semana como máximo, en horario hábil, con un mensaje breve y útil.',
  'Invita a pedir la baja (por ejemplo «Responde BAJA si no quieres más mensajes»). Emissary la registra sola y esa persona sale de todos los segmentos.',
  'Si alguien pide que no le escribas más, no le vuelvas a enviar. Si te bloquean o reportan seguido, detente.',
  'Con un número nuevo, las primeras dos semanas solo responde; no difundas.',
];

function Chip({ activo, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${activo ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
      {children}
    </button>
  );
}

export function Difusiones() {
  const confirmar = useConfirm();
  const [filtro, setFiltro] = useState(FILTRO_VACIO);
  const [segmentos, setSegmentos] = useState([]);
  const [segmentoId, setSegmentoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [preview, setPreview] = useState(null);
  const [historial, setHistorial] = useState({ recientes: [], semana: 0 });
  const [bajas, setBajas] = useState([]);
  const [numeroBaja, setNumeroBaja] = useState('');
  const [registro, setRegistro] = useState(null); // { cantidad, nota } mientras se registra una difusión
  const [busy, setBusy] = useState('');

  const cargar = useCallback(async () => {
    const [segs, hist, bj] = await Promise.all([window.emissary.listSegmentos(), window.emissary.historialDifusiones(), window.emissary.listBajas()]);
    setSegmentos(segs || []);
    setHistorial(hist || { recientes: [], semana: 0 });
    setBajas(bj || []);
  }, []);

  useEffect(() => { cargar().catch(() => toast.error('No se pudieron cargar las difusiones')); }, [cargar]);

  // La vista previa se recalcula al cambiar el filtro (con una pausa corta mientras se escribe)
  useEffect(() => {
    const t = setTimeout(() => window.emissary.previewDifusion(filtro).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(t);
  }, [filtro, bajas.length]);

  const toggle = (campo, valor) => setFiltro((f) => ({ ...f, [campo]: f[campo].includes(valor) ? f[campo].filter((x) => x !== valor) : [...f[campo], valor] }));

  const elegirSegmento = (id) => {
    setSegmentoId(id);
    const s = segmentos.find((x) => String(x.id) === id);
    setFiltro(s ? s.filtro : FILTRO_VACIO);
    setNombre(s ? s.nombre : '');
  };

  const guardarSegmento = async () => {
    if (!nombre.trim()) return toast.error('Ponle un nombre al segmento');
    setBusy('guardar');
    try {
      const id = await window.emissary.saveSegmento({ id: segmentoId || undefined, nombre, filtro });
      await cargar();
      setSegmentoId(String(id));
      toast.success('Segmento guardado');
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar');
    } finally { setBusy(''); }
  };

  const borrarSegmento = async () => {
    const ok = await confirmar({ title: 'Eliminar segmento', message: 'Solo se borra el filtro guardado; tus leads no cambian.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await window.emissary.deleteSegmento(Number(segmentoId));
    setSegmentoId(''); setNombre(''); setFiltro(FILTRO_VACIO);
    cargar();
  };

  const exportar = async (formato) => {
    setBusy(formato);
    try {
      const res = await window.emissary.exportDifusion(filtro, formato, nombre);
      if (res?.canceled) return;
      if (!res?.ok) return toast.error(res?.error || 'No se pudo exportar');
      toast.success(res.archivos > 1 ? `${res.count} contactos en ${res.archivos} archivos (de a ${MAX_POR_LISTA})` : `${res.count} contactos exportados`);
    } finally { setBusy(''); }
  };

  const registrar = async (e) => {
    e.preventDefault();
    setBusy('registrar');
    try {
      await window.emissary.registrarDifusion({ segmento: nombre, cantidad: Number(registro.cantidad), nota: registro.nota });
      setRegistro(null);
      await cargar();
      toast.success('Difusión registrada');
    } catch (err) {
      toast.error(err.message || 'No se pudo registrar');
    } finally { setBusy(''); }
  };

  const agregarBaja = async (e) => {
    e.preventDefault();
    const res = await window.emissary.addBaja(numeroBaja);
    if (!res?.ok) return toast.error(res?.error || 'No se pudo agregar');
    setNumeroBaja('');
    cargar();
  };

  const listos = preview?.total ?? 0;
  const sobrecarga = historial.semana >= 2;
  const bajasOrdenadas = useMemo(() => bajas.slice(0, 50), [bajas]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2"><Send className="w-8 h-8 text-primary" />Difusiones</h1>
        <p className="text-muted-foreground max-w-2xl">Arma el segmento de contactos, expórtalo y envía tu difusión desde la app de WhatsApp Business. Emissary lleva la cuenta y respeta las bajas.</p>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="font-semibold flex items-center gap-2 mb-3"><ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />Cómo difundir sin que te bloqueen</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">{PRACTICAS.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={`${card} p-5 space-y-4`} aria-labelledby="seg-title">
          <h2 id="seg-title" className="font-semibold flex items-center gap-2"><ListChecks className="w-5 h-5 text-primary" aria-hidden="true" />Segmento</h2>

          <label className="block text-sm">
            <span className="font-medium">Segmentos guardados</span>
            <select value={segmentoId} onChange={(e) => elegirSegmento(e.target.value)} className={`${input} mt-1`}>
              <option value="">Nuevo segmento</option>
              {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Etapa del lead</legend>
            <div className="flex flex-wrap gap-2">{ETAPAS.map((e) => <Chip key={e} activo={filtro.etapas.includes(e)} onClick={() => toggle('etapas', e)}>{cap(e)}</Chip>)}</div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Calificación</legend>
            <div className="flex flex-wrap gap-2">{Object.entries(CALIFICACIONES).map(([k, v]) => <Chip key={k} activo={filtro.calificaciones.includes(k)} onClick={() => toggle('calificaciones', k)}>{v}</Chip>)}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm"><span className="font-medium">Sin contacto hace (días)</span>
              <input type="number" min="0" max="3650" value={filtro.diasSinContacto || ''} placeholder="0" onChange={(e) => setFiltro({ ...filtro, diasSinContacto: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="block text-sm"><span className="font-medium">Interés contiene</span>
              <input type="text" value={filtro.interes} placeholder="Ej. Sportage" onChange={(e) => setFiltro({ ...filtro, interes: e.target.value })} className={`${input} mt-1`} />
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del segmento" aria-label="Nombre del segmento" className={input} />
            <button type="button" onClick={guardarSegmento} disabled={busy === 'guardar'} className="inline-flex items-center gap-2 px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60">
              {busy === 'guardar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar
            </button>
            {segmentoId && <button type="button" onClick={borrarSegmento} aria-label="Eliminar segmento" className="px-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>}
          </div>
        </section>

        <section className={`${card} p-5 space-y-4`} aria-labelledby="listos-title">
          <h2 id="listos-title" className="font-semibold">Contactos listos</h2>
          <div aria-live="polite">
            <p className="text-4xl font-bold tracking-tight">{preview ? listos : '…'}</p>
            {preview && (
              <p className="text-sm text-muted-foreground mt-1">
                {preview.enBaja > 0 && <>{preview.enBaja} en baja (excluidos). </>}
                {preview.sinNumero > 0 && <>{preview.sinNumero} sin número conocido. </>}
                {preview.partes > 1 && <>Se reparte en {preview.partes} listas de hasta {MAX_POR_LISTA}.</>}
              </p>
            )}
          </div>
          {preview?.muestra?.length > 0 && (
            <ul className="text-sm divide-y divide-border/40 rounded-xl border border-border/60">
              {preview.muestra.map((c) => <li key={c.numero} className="flex justify-between px-3 py-1.5"><span className="truncate">{c.nombre || 'Sin nombre'}</span><span className="text-muted-foreground tabular-nums">+{c.numero}</span></li>)}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => exportar('vcf')} disabled={!listos || busy === 'vcf'} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50">
              {busy === 'vcf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Exportar contactos (.vcf)
            </button>
            <button type="button" onClick={() => exportar('csv')} disabled={!listos || busy === 'csv'} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
              <Download className="w-4 h-4" />Lista (.csv)
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Importa el archivo .vcf en el celular (Android: Contactos › Importar; iPhone: ábrelo desde Archivos o el correo) para que queden guardados. Luego, en WhatsApp Business: Nueva difusión › elige esos contactos.
          </p>

          {registro ? (
            <form onSubmit={registrar} className="rounded-xl border border-border p-3 space-y-2 text-sm">
              <label className="block"><span className="font-medium">¿A cuántos se la enviaste?</span>
                <input type="number" min="1" required value={registro.cantidad} onChange={(e) => setRegistro({ ...registro, cantidad: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="block"><span className="font-medium">Nota (opcional)</span>
                <input type="text" value={registro.nota} maxLength={200} placeholder="Ej. promoción de noviembre" onChange={(e) => setRegistro({ ...registro, nota: e.target.value })} className={`${input} mt-1`} /></label>
              <div className="flex gap-2">
                <button type="submit" disabled={busy === 'registrar'} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-60">Registrar</button>
                <button type="button" onClick={() => setRegistro(null)} className="px-4 py-2 rounded-xl border border-border">Cancelar</button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setRegistro({ cantidad: listos || '', nota: '' })} className="text-sm text-primary hover:underline">Ya envié esta difusión: registrarla</button>
          )}
        </section>
      </div>

      {sobrecarga && (
        <div role="alert" className="flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>Ya registraste {historial.semana} difusiones en los últimos 7 días. Espera antes de enviar otra: escribir seguido es lo que más expone el número.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className={`${card} p-5`}>
          <h2 className="font-semibold mb-3">Difusiones registradas</h2>
          {historial.recientes.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has registrado ninguna.</p> : (
            <ul className="text-sm divide-y divide-border/40">
              {historial.recientes.slice(0, 8).map((d) => (
                <li key={d.id} className="flex justify-between gap-3 py-1.5">
                  <span className="truncate">{fecha(d.created_at)} · {d.segmento || 'Sin segmento'}{d.nota ? ` · ${d.nota}` : ''}{d.canal === 'masivo' ? ' · envío masivo' : ''}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">{d.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-5`} aria-labelledby="bajas-title">
          <h2 id="bajas-title" className="font-semibold flex items-center gap-2 mb-1"><UserX className="w-5 h-5 text-primary" aria-hidden="true" />Bajas ({bajas.length})</h2>
          <p className="text-xs text-muted-foreground mb-3">Quien escribe «BAJA» queda aquí solo y no entra a ningún segmento.</p>
          <form onSubmit={agregarBaja} className="flex gap-2 mb-3">
            <input type="tel" value={numeroBaja} onChange={(e) => setNumeroBaja(e.target.value)} placeholder="573001234567" aria-label="Número a dar de baja" className={`${input} font-mono`} />
            <button type="submit" disabled={!numeroBaja.trim()} className="px-4 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">Agregar</button>
          </form>
          <ul className="text-sm divide-y divide-border/40 max-h-48 overflow-y-auto">
            {bajasOrdenadas.map((b) => (
              <li key={b.user_id} className="flex justify-between items-center py-1.5">
                <span className="tabular-nums">{b.numero ? `+${b.numero}` : b.user_id}</span>
                <button type="button" onClick={async () => { await window.emissary.removeBaja(b.user_id); cargar(); }} className="text-xs text-primary hover:underline">Quitar</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
