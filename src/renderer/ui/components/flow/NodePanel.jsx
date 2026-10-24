import React, { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Copy, Flag, AlertTriangle, Info } from 'lucide-react';
import { CAPTURE_FIELDS, optionTag } from '../../../../main/whatsapp/flows/flowRuntime.js';
import { newOption } from '../../flow/model.js';
import { Bubble, sampleText, chatBackground } from './WhatsAppPreview';

const field = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';
const VARIABLES = [
  ['{asesor}', 'Asesor'], ['{negocio}', 'Negocio'], ['{nombre}', 'Nombre del cliente'], ['{horario}', 'Horario'], ['{portfolio_url}', 'Enlace'], ['{{catalogo}}', 'Catálogo'],
];

// Alias separados por coma. Mantiene el texto tal como se escribe para no comerse la coma ni el espacio al teclear.
function AliasInput({ option, onCommit }) {
  const [raw, setRaw] = useState((option.keywords || []).join(', '));
  return (
    <input
      value={raw}
      onChange={(e) => { setRaw(e.target.value); onCommit(e.target.value.split(',').map((s) => s.trim()).filter(Boolean)); }}
      placeholder="Otras formas de elegirla, separadas por coma"
      aria-label={`Otras formas de elegir ${option.label || 'esta alternativa'}`}
      className={`${field} text-xs py-1.5`}
    />
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function NodePanel({ node, isStart, issues, negocio, onPatch, onSetStart, onDuplicate, onDelete }) {
  const textRef = useRef(null);
  const d = node.data;
  const options = d.options || [];
  const style = d.menu === 'letters' || d.menu === 'numbers' ? d.menu : 'none';

  const patch = (p, key) => onPatch(node.id, p, key);
  const setOptions = (next, key) => patch({ options: next }, key);

  const insertVariable = (v) => {
    const el = textRef.current;
    const value = d.value || '';
    const [a, b] = el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
    patch({ value: value.slice(0, a) + v + value.slice(b) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + v.length, a + v.length); });
  };

  // La primera alternativa de un bloque que no tenía menú lo activa por letras, para que se vea en el mensaje
  const addOption = () => patch({ options: [...options, newOption(options.length)], ...(d.menu ? {} : { menu: 'letters' }) });

  const move = (i, dir) => {
    const next = [...options];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setOptions(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label htmlFor="np-titulo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre del bloque</label>
          <input id="np-titulo" value={d.label || ''} onChange={(e) => patch({ label: e.target.value }, 'label')} className={`${field} mt-1 font-medium`} />
        </div>
        <button type="button" onClick={() => onSetStart(node.id)} disabled={isStart} title="El bot empieza la conversación por este bloque"
          className={`mt-5 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${isStart ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'border-border hover:bg-muted'}`}>
          <Flag className="w-3.5 h-3.5" />{isStart ? 'Es el inicio' : 'Hacer inicio'}
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="space-y-1.5">
          {issues.map((it, i) => (
            <li key={i} className={`flex gap-2 text-xs rounded-lg px-3 py-2 ${it.level === 'error' ? 'bg-destructive/10 text-destructive' : it.level === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
              {it.level === 'info' ? <Info className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}{it.text}
            </li>
          ))}
        </ul>
      )}

      <Section title="Mensaje" hint="Lo que el bot le escribe al cliente en este paso.">
        <textarea ref={textRef} value={d.value || ''} onChange={(e) => patch({ value: e.target.value }, 'value')} rows={5}
          aria-label="Mensaje del bloque" placeholder="Escribe el mensaje…" className={`${field} resize-y leading-relaxed`} />
        <div className="flex flex-wrap gap-1.5" aria-label="Insertar variable">
          {VARIABLES.map(([v, name]) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} title={`Inserta ${v}`}
              className="text-[11px] px-2 py-1 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors">+ {name}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">*negrita*, _cursiva_ y ~tachado~ funcionan como en WhatsApp.</p>
      </Section>

      <Section title="Alternativas" hint="Si das alternativas (Plan A, B, C…), cada una puede llevar a un bloque distinto.">
        <div role="group" aria-label="Cómo se listan las alternativas" className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl text-xs font-medium">
          {[['letters', 'Letras (A, B, C)'], ['numbers', 'Números (1, 2, 3)'], ['none', 'Sin lista']].map(([k, name]) => (
            <button key={k} type="button" onClick={() => patch({ menu: k })} aria-pressed={style === k}
              className={`py-1.5 rounded-lg transition-colors ${style === k ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{name}</button>
          ))}
        </div>
        {style === 'none' && options.length > 0 && <p className="text-[11px] text-muted-foreground">Sin lista automática: escribe tú las alternativas dentro del mensaje.</p>}

        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={o.id} className="border border-border/60 rounded-xl p-2.5 space-y-2 bg-background/50">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">
                  {style === 'letters' ? optionTag('letters', i).replace(')', '') : style === 'numbers' ? i + 1 : '·'}
                </span>
                <input value={o.label ?? o.keyword ?? ''} onChange={(e) => setOptions(options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)), `o-${o.id}`)}
                  aria-label={`Texto de la alternativa ${i + 1}`} placeholder="Texto de la alternativa" className={`${field} py-1.5`} />
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === options.length - 1} aria-label="Bajar" className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => setOptions(options.filter((x) => x.id !== o.id))} aria-label={`Quitar la alternativa ${o.label || i + 1}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>
              </div>
              <AliasInput key={o.id} option={o} onCommit={(keywords) => setOptions(options.map((x) => (x.id === o.id ? { ...x, keywords } : x)), `k-${o.id}`)} />
            </li>
          ))}
        </ul>
        <button type="button" onClick={addOption}
          className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
          <Plus className="w-4 h-4" />Añadir alternativa
        </button>
        {options.length > 0 && (
          <div>
            <label htmlFor="np-fallback" className="text-[11px] font-medium text-muted-foreground">Si el cliente no responde con ninguna alternativa</label>
            <input id="np-fallback" value={d.fallback || ''} onChange={(e) => patch({ fallback: e.target.value }, 'fallback')} placeholder="Opción no válida. Elige una de las opciones indicadas 👆" className={`${field} mt-1 text-xs py-1.5`} />
          </div>
        )}
      </Section>

      <Section title="Guardar la respuesta" hint="Lo que el cliente responda en este paso se guarda en su ficha de lead.">
        <select value={d.capture || ''} onChange={(e) => patch({ capture: e.target.value || undefined })} aria-label="Guardar la respuesta del cliente en" className={field}>
          <option value="">No guardar nada</option>
          {Object.entries(CAPTURE_FIELDS).map(([k, name]) => <option key={k} value={k}>{name}</option>)}
        </select>
      </Section>

      <Section title="Al llegar a este bloque">
        <select value={d.action || ''} onChange={(e) => patch({ action: e.target.value || undefined })} aria-label="Acción al llegar a este bloque" className={field}>
          <option value="">Seguir normal</option>
          <option value="handoff">Transferir a un asesor (avisa y el bot se pausa)</option>
          <option value="restart">Reiniciar la conversación</option>
        </select>
      </Section>

      <Section title="Vista previa en WhatsApp">
        <div className={`${chatBackground} rounded-2xl p-3 flex flex-col`}>
          <Bubble text={sampleText(node, negocio) || '…'} />
        </div>
      </Section>

      <div className="flex gap-2 pt-2 border-t border-border/50">
        <button type="button" onClick={() => onDuplicate(node.id)} className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted"><Copy className="w-4 h-4" />Duplicar</button>
        <button type="button" onClick={() => onDelete(node.id)} className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10"><Trash2 className="w-4 h-4" />Eliminar</button>
      </div>
    </div>
  );
}
