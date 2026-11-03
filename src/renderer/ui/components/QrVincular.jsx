import React, { useEffect, useState } from 'react';
import { Loader2, Maximize2, X } from 'lucide-react';

// QR de vinculación con dos ayudas para el iPhone, cuyo lector es más exigente: verlo ampliado y vincular con un código en vez de escanear.
export function QrVincular({ qrDataUrl, telefono }) {
  const [grande, setGrande] = useState(false);
  const [codigoAbierto, setCodigoAbierto] = useState(false);
  const [numero, setNumero] = useState(telefono || '');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!grande) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setGrande(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grande]);

  const pedirCodigo = async (e) => {
    e.preventDefault();
    setError(''); setCodigo(''); setBusy(true);
    try {
      const res = await window.emissary.requestPairingCode(numero);
      if (res?.error) setError(res.error);
      else setCodigo(String(res.code).replace(/^(.{4})(.{4})$/, '$1-$2'));
    } catch {
      setError('No se pudo pedir el código. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button type="button" onClick={() => setGrande(true)} aria-label="Ver el código QR más grande" className="group relative bg-white p-4 rounded-2xl shadow-inner border border-border/50">
        <img src={qrDataUrl} alt="Código QR para vincular WhatsApp" className="w-64 h-64 object-contain" />
        <span className="absolute top-2 right-2 p-1 rounded-lg bg-black/5 text-black/50 group-hover:text-black"><Maximize2 className="w-4 h-4" aria-hidden="true" /></span>
      </button>
      <p className="text-sm text-muted-foreground mt-3 text-center">Escanea este código con tu WhatsApp. En iPhone, acércalo y usa «Ver más grande» si no lo lee.</p>

      <button type="button" onClick={() => setCodigoAbierto((v) => !v)} aria-expanded={codigoAbierto} className="mt-2 text-sm text-primary hover:underline">
        ¿No te deja escanear? Vincular con un código
      </button>

      {codigoAbierto && (
        <form onSubmit={pedirCodigo} className="mt-3 w-full max-w-xs space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Número del WhatsApp a vincular</span>
            <input type="tel" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="573001234567" className="mt-1 w-full bg-background border border-border rounded-xl px-3 py-2 font-mono outline-none focus:border-primary" />
          </label>
          <button type="submit" disabled={busy || !numero.trim()} className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Obtener código
          </button>
          {error && <p role="alert" className="text-destructive font-medium">{error}</p>}
          {codigo && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-mono font-semibold tracking-widest" aria-live="polite">{codigo}</p>
              <p className="text-xs text-muted-foreground mt-2">En el celular: WhatsApp › Dispositivos vinculados › Vincular un dispositivo › <strong>Vincular con número de teléfono</strong> y escribe este código.</p>
            </div>
          )}
        </form>
      )}

      {grande && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-6" role="dialog" aria-modal="true" aria-label="Código QR ampliado" onClick={() => setGrande(false)}>
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setGrande(false)} autoFocus aria-label="Cerrar" className="absolute top-2 right-2 p-1.5 rounded-full text-black/50 hover:bg-black/5"><X className="w-5 h-5" /></button>
            <img src={qrDataUrl} alt="Código QR ampliado" className="w-[min(80vh,80vw,480px)] aspect-square object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
