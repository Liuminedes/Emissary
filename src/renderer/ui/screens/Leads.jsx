import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Phone, Calendar, Search, Tag, DollarSign, Briefcase, Wallet, ChevronDown, UserRound, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const STAGES = [
  { id: 'nuevo', label: 'Nuevo', color: 'bg-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-500/10' },
  { id: 'cotizando', label: 'Cotizando', color: 'bg-amber-500', text: 'text-amber-600', bgLight: 'bg-amber-500/10' },
  { id: 'negociacion', label: 'Negociación', color: 'bg-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-500/10' },
  { id: 'cerrado', label: 'Cerrado', color: 'bg-emerald-500', text: 'text-emerald-600', bgLight: 'bg-emerald-500/10' },
  { id: 'perdido', label: 'Perdido', color: 'bg-rose-500', text: 'text-rose-600', bgLight: 'bg-rose-500/10' },
];

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
       <div className="mt-0.5 p-1.5 bg-muted/50 rounded-lg text-muted-foreground/80">
         <Icon className="w-4 h-4" />
       </div>
       <div className="flex-1 min-w-0">
         <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
         <p className="text-sm font-medium text-foreground truncate">{value}</p>
       </div>
    </div>
  );
}

export function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState('nuevo');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await window.emissary.listLeads();
      setLeads(data || []);
    } catch (err) {
      toast.error('Error al cargar leads');
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (lead, newStageId) => {
    if (lead.etapa === newStageId) return;

    // Actualización Optimista
    const previousLeads = [...leads];
    setLeads(leads.map(l => l.id === lead.id ? { ...l, etapa: newStageId } : l));

    try {
      await window.emissary.updateLeadEtapa(lead.id, newStageId);
      toast.success(`Movido a ${STAGES.find(s => s.id === newStageId)?.label}`);
    } catch (err) {
      toast.error('Error al actualizar etapa');
      setLeads(previousLeads); // Rollback
    }
  };

  const filteredLeads = leads.filter(l =>
    l.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    l.telefono?.includes(search)
  );

  const activeLeads = filteredLeads.filter(l => l.etapa === selectedStage);

  return (
    <div className="h-full flex flex-col space-y-8 overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">Leads</h1>
          <p className="text-muted-foreground mt-2 text-lg">Directorio detallado de prospectos por etapa</p>
        </div>

        <div className="relative w-full sm:w-72 group">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-card border border-border/60 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
          />
        </div>
      </header>

      {/* Tabs Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar shrink-0">
        {STAGES.map(stage => {
          const isSelected = selectedStage === stage.id;
          const count = leads.filter(l => l.etapa === stage.id).length;
          
          return (
            <button
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className={`relative flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-300 shrink-0 ${
                isSelected 
                  ? 'bg-card border-border/80 shadow-md ring-1 ring-border/30' 
                  : 'bg-transparent border-transparent hover:bg-muted/40 text-muted-foreground'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${stage.color} shadow-sm ${isSelected ? 'ring-4 ring-background' : ''}`} />
              <span className={`font-semibold tracking-tight ${isSelected ? 'text-foreground' : ''}`}>
                {stage.label}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors ${
                isSelected ? `${stage.bgLight} ${stage.text}` : 'bg-muted/80 text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {activeLeads.map(lead => {
                const currentStage = STAGES.find(s => s.id === lead.etapa);
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    key={lead.id}
                    className="bg-card border border-border/50 rounded-3xl p-6 shadow-glass hover:shadow-float transition-all relative overflow-hidden group flex flex-col h-full"
                  >
                    {/* Brillo superior decorativo */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 opacity-80 ${currentStage.color}`} />
                    
                    {/* Header de la tarjeta */}
                    <div className="flex items-center gap-4 mb-6 relative">
                      <div className={`w-14 h-14 rounded-2xl ${currentStage.bgLight} ${currentStage.text} flex items-center justify-center font-bold text-xl shadow-inner border border-white/20`}>
                        {lead.nombre ? lead.nombre.charAt(0).toUpperCase() : <UserRound className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className="font-bold text-lg leading-tight truncate text-foreground">{lead.nombre || 'Sin Nombre'}</h3>
                        <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1 truncate">
                          <Phone className="w-3.5 h-3.5" /> 
                          {lead.telefono}
                        </p>
                      </div>
                      
                      {/* Botón de reiniciar sesión del bot */}
                      <button
                        onClick={async () => {
                           if(window.confirm('¿Deseas reiniciar la sesión de este lead? El bot le volverá a enviar el mensaje de bienvenida.')){
                             await window.emissary.resetSesion(lead.user_id);
                             toast.success('Sesión reiniciada');
                           }
                        }}
                        className="absolute right-0 top-0 p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                        title="Reiniciar Bot para este prospecto"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cuerpo de la tarjeta (Detalles) */}
                    <div className="space-y-4 mb-6 flex-1">
                      <DetailRow icon={Tag} label="Interés Principal" value={lead.interes} />
                      <DetailRow icon={DollarSign} label="Presupuesto" value={lead.presupuesto} />
                      <DetailRow icon={Briefcase} label="Ocupación" value={lead.empleo} />
                      <DetailRow icon={Wallet} label="Nivel de Ingresos" value={lead.ingreso} />
                      <DetailRow icon={Calendar} label="Fecha de Registro" value={lead.fecha ? new Date(lead.fecha).toLocaleDateString() : null} />
                    </div>

                    {/* Acción inferior */}
                    <div className="mt-auto pt-5 border-t border-border/40">
                      <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">
                        Mover prospecto a
                      </label>
                      <div className="relative">
                        <select
                          value={lead.etapa}
                          onChange={(e) => handleStageChange(lead, e.target.value)}
                          className="w-full bg-muted/30 border border-border/50 rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer hover:bg-muted/50 transition-colors text-foreground"
                        >
                          {STAGES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              
              {activeLeads.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                    <UserRound className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-xl font-semibold">No hay leads aquí</h3>
                  <p className="text-muted-foreground mt-2 max-w-sm">No tienes prospectos en esta etapa actualmente. Cuando muevas o recibas nuevos leads aparecerán aquí.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
}