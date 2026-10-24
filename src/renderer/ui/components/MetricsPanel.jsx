import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, UserPlus, Flame, Headset, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const ETAPAS = [
  { id: 'nuevo', label: 'Nuevo', color: 'bg-blue-500' },
  { id: 'cotizando', label: 'Cotizando', color: 'bg-amber-500' },
  { id: 'negociacion', label: 'Negociación', color: 'bg-purple-500' },
  { id: 'cerrado', label: 'Cerrado', color: 'bg-emerald-500' },
  { id: 'perdido', label: 'Perdido', color: 'bg-rose-500' },
];
const SERIES = [
  { id: 'cliente', label: 'Clientes', color: 'bg-primary' },
  { id: 'bot', label: 'Bot', color: 'bg-sky-400' },
  { id: 'asesor', label: 'Asesor', color: 'bg-amber-400' },
];

const card = 'bg-card border border-border/50 rounded-2xl shadow-glass';

function Kpi({ icon: Icon, label, value, hint, tone = 'default', onClick }) {
  const tones = { default: 'bg-primary/10 text-primary', hot: 'bg-orange-500/10 text-orange-600', alert: 'bg-amber-500/15 text-amber-600' };
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      </div>
      <dd className="mt-3 text-3xl font-semibold tracking-tight">{value}</dd>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const cls = `${card} p-5 text-left transition-all ${tone === 'alert' ? 'ring-1 ring-amber-500/40' : ''}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:shadow-float hover:-translate-y-0.5 w-full`}><dl>{body}</dl></button>
    : <div className={cls}><dl>{body}</dl></div>;
}

function Delta({ hoy, ayer }) {
  if (hoy === ayer) return <span className="inline-flex items-center gap-1"><Minus className="w-3 h-3" />igual que ayer</span>;
  const sube = hoy > ayer;
  const Icon = sube ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center gap-1 ${sube ? 'text-emerald-600' : 'text-rose-600'}`}><Icon className="w-3 h-3" />{Math.abs(hoy - ayer)} {sube ? 'más' : 'menos'} que ayer</span>;
}

function Funnel({ embudo, total }) {
  const max = Math.max(1, ...Object.values(embudo));
  return (
    <ul className="space-y-3">
      {ETAPAS.map((e) => (
        <li key={e.id}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{e.label}</span>
            <span className="text-muted-foreground tabular-nums">{embudo[e.id]}{total ? ` · ${Math.round((embudo[e.id] / total) * 100)}%` : ''}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full ${e.color} transition-all duration-500`} style={{ width: `${(embudo[e.id] / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Activity({ dias }) {
  const totales = dias.map((d) => d.cliente + d.bot + d.asesor);
  const max = Math.max(1, ...totales);
  const resumen = dias.map((d, i) => `${d.etiqueta} ${totales[i]}`).join(', ');
  return (
    <div>
      <div role="img" aria-label={`Mensajes por día, últimos 7 días: ${resumen}`} className="flex items-end gap-2 h-36">
        {dias.map((d, i) => (
          <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={`${d.dia}: ${totales[i]} mensajes`}>
            <span className="text-[11px] text-muted-foreground tabular-nums">{totales[i] || ''}</span>
            <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${(totales[i] / max) * 100}%`, minHeight: totales[i] ? 4 : 0 }}>
              {SERIES.map((s) => d[s.id] > 0 && <div key={s.id} className={s.color} style={{ height: `${(d[s.id] / totales[i]) * 100}%` }} />)}
            </div>
            <span className={`text-[11px] ${i === dias.length - 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{d.etiqueta}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
        {SERIES.map((s) => <span key={s.id} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />{s.label}</span>)}
      </div>
      {/* Los mismos datos para lectores de pantalla */}
      <table className="sr-only">
        <caption>Mensajes por día</caption>
        <thead><tr><th>Día</th>{SERIES.map((s) => <th key={s.id}>{s.label}</th>)}</tr></thead>
        <tbody>{dias.map((d) => <tr key={d.dia}><td>{d.dia}</td>{SERIES.map((s) => <td key={s.id}>{d[s.id]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function MetricsPanel({ onNavigate }) {
  const [m, setM] = useState(null);

  const load = useCallback(() => { window.emissary.getMetricas().then(setM).catch(() => {}); }, []);

  useEffect(() => {
    load();
    // Se refresca al llegar o salir mensajes (con un respiro para no recalcular en cada uno) y cada minuto
    let t;
    const off = window.emissary.onInboxUpdated(() => { clearTimeout(t); t = setTimeout(load, 800); });
    const tick = setInterval(load, 60_000);
    return () => { off(); clearTimeout(t); clearInterval(tick); };
  }, [load]);

  if (!m) return null;
  const sinActividad = m.leadsTotal === 0 && m.actividad.every((d) => d.cliente + d.bot + d.asesor === 0);

  return (
    <section aria-labelledby="metricas-titulo" className="space-y-4">
      <h2 id="metricas-titulo" className="text-lg font-semibold tracking-tight">Resumen de tu atención</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi icon={MessageCircle} label="Conversaciones hoy" value={m.conversacionesHoy} hint={<Delta hoy={m.conversacionesHoy} ayer={m.conversacionesAyer} />} />
        <Kpi icon={UserPlus} label="Leads nuevos (7 días)" value={m.leadsNuevos7d} hint={`${m.leadsTotal} en total`} onClick={() => onNavigate?.('leads')} />
        <Kpi icon={Flame} tone="hot" label="Leads calientes" value={m.leadsCalientes} hint="Con buen perfil y aún abiertos" onClick={() => onNavigate?.('leads')} />
        <Kpi icon={Headset} tone={m.esperandoAsesor > 0 ? 'alert' : 'default'} label="Esperando asesor" value={m.esperandoAsesor}
          hint={m.esperandoAsesor > 0 ? 'Pidieron hablar contigo: respóndeles' : 'Nadie en espera'} onClick={() => onNavigate?.('inbox')} />
      </div>

      {sinActividad ? (
        <div className={`${card} p-8 text-center text-sm text-muted-foreground`}>Aún no hay actividad. Cuando un cliente escriba, aquí verás tus conversaciones, leads y el embudo.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${card} p-6`}>
            <h3 className="font-medium mb-4">Embudo de leads</h3>
            <Funnel embudo={m.embudo} total={m.leadsTotal} />
          </div>
          <div className={`${card} p-6`}>
            <h3 className="font-medium mb-4">Mensajes de los últimos 7 días</h3>
            <Activity dias={m.actividad} />
          </div>
        </div>
      )}
    </section>
  );
}
