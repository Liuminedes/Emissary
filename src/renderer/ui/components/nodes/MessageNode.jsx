import React, { memo, useContext, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { MessageSquareText, ListChecks, UserRound, RotateCcw, PenLine, Flag, AlertTriangle } from 'lucide-react';
import { FlowContext } from '../../flow/FlowContext';
import { CAPTURE_FIELDS, optionTag } from '../../../../main/whatsapp/flows/flowRuntime.js';

const handleClass = '!w-3.5 !h-3.5 !bg-primary !border-2 !border-background';

function iconFor(data) {
  if (data.action === 'handoff') return UserRound;
  if (data.action === 'restart') return RotateCcw;
  if ((data.options || []).length) return ListChecks;
  if (data.capture) return PenLine;
  return MessageSquareText;
}

// Tarjeta del lienzo: solo muestra. Se edita en el panel lateral, donde hay espacio para trabajar cómodo.
export const MessageNode = memo(function MessageNode({ id, data, selected }) {
  const { startId, activeId, issues } = useContext(FlowContext);
  const updateNodeInternals = useUpdateNodeInternals();
  const options = data.options || [];
  const Icon = iconFor(data);
  const problemas = issues[id] || { error: 0, warn: 0 };
  const sinSalida = data.action === 'handoff' || data.action === 'restart';

  // Los puntos de conexión cambian de lugar al añadir, quitar o reordenar alternativas
  const firma = options.map((o) => o.id).join('|');
  useEffect(() => { updateNodeInternals(id); }, [firma, id, updateNodeInternals]);

  const ring = activeId === id ? 'ring-2 ring-emerald-500 border-emerald-500' : selected ? 'ring-2 ring-primary border-primary' : 'border-border/60 hover:border-primary/50';

  return (
    <div className={`w-[320px] bg-card rounded-2xl border shadow-glass transition-all ${ring}`}>
      <Handle type="target" position={Position.Left} className={handleClass} />

      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="w-8 h-8 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></div>
        <h3 className="font-semibold text-sm truncate flex-1">{data.label || 'Sin título'}</h3>
        {startId === id && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full"><Flag className="w-3 h-3" />Inicio</span>}
        {(problemas.error > 0 || problemas.warn > 0) && (
          <span title={`${problemas.error} errores, ${problemas.warn} avisos`} className={problemas.error ? 'text-destructive' : 'text-amber-500'}><AlertTriangle className="w-4 h-4" /></span>
        )}
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground whitespace-pre-line line-clamp-3 min-h-[2.25rem]">{data.value || <span className="italic">Sin mensaje todavía</span>}</p>

      {options.length > 0 && (
        <ul className="border-t border-border/40 py-1">
          {options.map((o, i) => (
            <li key={o.id} className="relative flex items-center gap-2 pl-4 pr-5 py-1.5 text-xs">
              <span className="w-6 h-6 shrink-0 rounded-md bg-primary/10 text-primary font-semibold flex items-center justify-center text-[11px]">
                {data.menu === 'numbers' ? i + 1 : data.menu === 'letters' ? optionTag('letters', i).replace(')', '') : '·'}
              </span>
              <span className="truncate font-medium">{o.label || o.keyword || <em className="text-destructive not-italic">Sin texto</em>}</span>
              <Handle type="source" position={Position.Right} id={o.id} className={`${handleClass} !-right-[7px]`} />
            </li>
          ))}
        </ul>
      )}

      {(data.capture || data.action) && (
        <div className="px-4 py-2 border-t border-border/40 flex flex-wrap gap-1.5">
          {data.capture && <span className="text-[10px] font-medium bg-sky-500/10 text-sky-600 px-2 py-0.5 rounded-full">Guarda: {CAPTURE_FIELDS[data.capture] || data.capture}</span>}
          {data.action === 'handoff' && <span className="text-[10px] font-medium bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">Avisa al asesor</span>}
          {data.action === 'restart' && <span className="text-[10px] font-medium bg-violet-500/10 text-violet-600 px-2 py-0.5 rounded-full">Reinicia</span>}
        </div>
      )}

      {!options.length && !sinSalida && (
        <div className="relative px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground italic flex justify-end pr-6">
          Siguiente
          <Handle type="source" position={Position.Right} className={`${handleClass} !-right-[7px]`} />
        </div>
      )}
    </div>
  );
});
