import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const MAX = 1000;

const cuando = (ms) => new Date(ms).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Notas internas de seguimiento: solo las ve el asesor, nunca el cliente
export function LeadNotes({ leadId, onCountChange }) {
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { window.emissary.listLeadNotes(leadId).then(setNotes).catch(() => setNotes([])); }, [leadId]);

  // Seguro síncrono contra el doble guardado: dos eventos seguidos (o una tecla mantenida) leen el mismo texto antes de que
  // React lo borre. No se libera al terminar, sino cuando el texto cambia de verdad (se borró o el usuario escribe otra nota).
  const inflight = useRef(false);
  useEffect(() => { inflight.current = false; }, [text]);

  const add = async (e) => {
    e.preventDefault();
    if (e.repeat || !text.trim() || inflight.current) return;
    inflight.current = true;
    setBusy(true);
    try {
      const res = await window.emissary.addLeadNote(leadId, text);
      if (!res.ok) { inflight.current = false; return toast.error(res.error); }
      const next = [res.data, ...notes];
      setNotes(next); setText(''); onCountChange(next.length);
    } catch (err) {
      inflight.current = false;
      toast.error('No se pudo guardar la nota');
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    await window.emissary.deleteLeadNote(id);
    const next = notes.filter((n) => n.id !== id);
    setNotes(next); onCountChange(next.length);
  };

  if (!notes) return <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} rows={2} aria-label="Nueva nota"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(e); }}
          placeholder="Ej. Llamar el lunes, pidió descuento…"
          className="flex-1 resize-none bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Añadir nota" title="Añadir nota (Ctrl+Enter)"
          className="self-end p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary-hover transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          {notes.map((n) => (
            <li key={n.id} className="group bg-muted/40 rounded-xl px-3 py-2 text-sm">
              <div className="flex items-start gap-2">
                <p className="flex-1 whitespace-pre-wrap break-words">{n.texto}</p>
                <button type="button" onClick={() => remove(n.id)} aria-label="Eliminar nota"
                  className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{cuando(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
