import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCcw, Send, Bell, PauseCircle } from 'lucide-react';
import { createEngine } from '../../../../main/whatsapp/flows/conversation.flow.js';
import { optionTag } from '../../../../main/whatsapp/flows/flowRuntime.js';
import { serialize } from '../../flow/model.js';
import { Bubble, chatBackground } from './WhatsAppPreview';

const USER = 'simulador@s.whatsapp.net';
const LEAD_LABELS = { name: 'Nombre', phone: 'Teléfono', interest: 'Interés', budget: 'Presupuesto', employment: 'Ocupación', income: 'Ingresos', creditCheck: 'Centrales' };

// Prueba el flujo con el MISMO motor que usa el bot, sobre lo que hay en el lienzo (aunque no esté guardado).
// Nada de lo que se escribe aquí sale por WhatsApp ni se guarda en los leads.
export function Simulator({ nodes, edges, negocio, onStep }) {
  const [log, setLog] = useState([]);
  const [text, setText] = useState('');
  const [step, setStep] = useState(null);
  const [lead, setLead] = useState({});
  const [paused, setPaused] = useState(false);
  const flowRef = useRef(null);
  const catalogRef = useRef([]);
  const engineRef = useRef(null);
  const endRef = useRef(null);
  flowRef.current = serialize(nodes, edges);

  useEffect(() => { window.emissary.listCatalogo().then((c) => { catalogRef.current = c || []; }).catch(() => {}); }, []);

  const build = useCallback(() => {
    const sessions = new Map();
    const eventos = [];
    const engine = createEngine({
      NegocioRepo: { get: () => negocio || {} },
      SesionesRepo: {
        isGloballyPaused: () => false,
        isExcluded: () => false,
        get: (u) => structuredClone(sessions.get(u)) || { userId: u, step: 'WELCOME', pushName: 'Carlos', advisorTook: false, handoffMode: false, lead: {}, catalog: {}, createdAt: 1, updatedAt: 1 },
        save: (s) => { sessions.set(s.userId, structuredClone(s)); return s; },
      },
      LeadsRepo: { upsert() {}, updateEtapaByUserId() {} },
      FlujoRepo: { getFlow: () => flowRef.current },
      CatalogoRepo: {
        listAll: () => catalogRef.current,
        getCategories: () => Object.entries(catalogRef.current.reduce((m, i) => ({ ...m, [i.categoria]: (m[i.categoria] || 0) + 1 }), {})).map(([name, count]) => ({ name, count })),
      },
      sendHandoffNotification: () => eventos.push('Aquí se avisaría al asesor'),
    });
    return { engine, sessions, eventos };
  }, [negocio]);

  const send = useCallback((raw) => {
    const t = raw.trim();
    if (!t) return;
    if (!engineRef.current) engineRef.current = build();
    const { engine, sessions, eventos } = engineRef.current;
    eventos.length = 0;
    const replies = engine.handleIncomingMessage({ userId: USER, text: t, pushName: 'Carlos' });
    const s = sessions.get(USER);
    setStep(s?.step || null);
    setLead(s?.lead || {});
    setPaused(Boolean(s?.handoffMode));
    onStep?.(s?.step || null);
    setLog((l) => [
      ...l,
      { from: 'user', text: t },
      ...replies.map((r) => ({ from: 'bot', text: r })),
      ...eventos.map((e) => ({ from: 'system', text: e, icon: 'bell' })),
      ...(!replies.length && s?.handoffMode ? [{ from: 'system', text: 'El bot queda en pausa: ahora atiende el asesor', icon: 'pause' }] : []),
    ]);
  }, [build, onStep]);

  const reset = useCallback(() => {
    engineRef.current = null;
    setLog([]); setStep(null); setLead({}); setPaused(false); onStep?.(null);
    setTimeout(() => send('Hola'), 0); // el cliente escribe primero: el bot responde con el bloque de inicio
  }, [send, onStep]);

  useEffect(() => { reset(); return () => onStep?.(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [log]);

  const actual = step ? flowRef.current.nodes.find((n) => n.id === step) : null;
  const rapidas = !paused && actual?.data.options?.length ? actual.data.options : [];
  const guardados = Object.entries(lead).filter(([, v]) => v);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Prueba la conversación como si fueras el cliente. No se envía nada por WhatsApp.</p>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted"><RotateCcw className="w-3.5 h-3.5" />Reiniciar</button>
      </div>

      <div className={`${chatBackground} flex-1 min-h-[240px] rounded-2xl p-3 overflow-y-auto flex flex-col gap-2 custom-scrollbar`} role="log" aria-live="polite" aria-label="Conversación de prueba">
        {log.map((m, i) => (m.from === 'system'
          ? <div key={i} className="self-center flex items-center gap-1.5 text-[11px] text-muted-foreground bg-card/80 px-3 py-1 rounded-full">{m.icon === 'bell' ? <Bell className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}{m.text}</div>
          : <Bubble key={i} text={m.text} from={m.from} />))}
        <div ref={endRef} />
      </div>

      {rapidas.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Respuestas rápidas">
          {rapidas.map((o, i) => {
            const menu = actual.data.menu;
            const envia = menu === 'letters' ? optionTag('letters', i).replace(')', '') : menu === 'numbers' ? String(i + 1) : (o.label || o.keyword || String(i + 1));
            return (
              <button key={o.id} type="button" onClick={() => send(envia)} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
                {menu !== 'none' && menu ? `${envia} · ` : ''}{o.label || o.keyword}
              </button>
            );
          })}
        </div>
      )}

      {guardados.length > 0 && (
        <p className="text-[11px] text-muted-foreground bg-muted rounded-lg px-3 py-2">
          <span className="font-semibold">Datos guardados en el lead:</span> {guardados.map(([k, v]) => `${LEAD_LABELS[k] || k}: ${v}`).join(' · ')}
        </p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); setText(''); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Escribe como cliente" placeholder={paused ? 'El bot está en pausa; reinicia para probar de nuevo' : 'Escribe como cliente…'} disabled={paused}
          className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
        <button type="submit" disabled={paused || !text.trim()} aria-label="Enviar" className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
