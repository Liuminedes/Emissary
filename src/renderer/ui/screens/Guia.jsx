import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  LayoutDashboard, 
  ShoppingBag, 
  MessageSquare, 
  Users, 
  Settings, 
  Rocket 
} from 'lucide-react';
import { toast } from 'sonner';

const SLIDES = [
  {
    id: 'welcome',
    title: 'Bienvenido a Emissary',
    description: 'Tu asistente automatizado de ventas por WhatsApp. Hagamos un breve recorrido para conocer todas las herramientas que tienes a tu disposición.',
    icon: Rocket,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    id: 'dashboard',
    title: 'Dashboard (Centro de Mando)',
    description: 'Aquí tendrás una vista general de tu negocio. Puedes revisar el estado de conexión de tu WhatsApp, revincularlo si es necesario y monitorear métricas clave en tiempo real.',
    icon: LayoutDashboard,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10'
  },
  {
    id: 'catalogo',
    title: 'Tu Catálogo',
    description: 'Organiza todos los productos o servicios que ofreces. El bot consultará esta base de datos automáticamente cuando un cliente esté interesado en conocer tus precios y opciones.',
    icon: ShoppingBag,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  {
    id: 'mensajes',
    title: 'Plantillas de Mensajes',
    description: 'Esta sección es fundamental: aquí podrás definir y personalizar los mensajes predeterminados a modo de respuesta que el bot utilizará para interactuar con tus clientes en cada etapa.',
    icon: MessageSquare,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    id: 'leads',
    title: 'Gestión de Leads',
    description: 'Un directorio detallado para visualizar de forma clara a las personas que te escriben y saber exactamente en qué estado de la secuencia se encuentran. ¡Organiza tu embudo de ventas sin perder de vista a nadie!',
    icon: Users,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    id: 'ajustes',
    title: 'Ajustes del Sistema',
    description: 'Configura el nombre de tu empresa, el color de la interfaz, paúsale temporalmente las respuestas automáticas al bot si quieres intervenir, y mucho más.',
    icon: Settings,
    color: 'text-slate-500',
    bg: 'bg-slate-500/10'
  }
];

// Variantes para la animación horizontal (deslizamiento)
const variants = {
  enter: (direction) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1
  },
  exit: (direction) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95
    };
  }
};

export function Guia({ onComplete, isStandalone = false }) {
  const [[page, direction], setPage] = useState([0, 0]);
  const [saving, setSaving] = useState(false);

  const slideIndex = Math.abs(page) % SLIDES.length;
  const currentSlide = SLIDES[slideIndex];
  const isLast = slideIndex === SLIDES.length - 1;

  const paginate = (newDirection) => {
    setPage([page + newDirection, newDirection]);
  };

  const handleFinish = async () => {
    if (isStandalone) {
      // Si el tour se abrió manualmente desde el Sidebar, simplemente cerramos/redirigimos
      onComplete();
      return;
    }

    setSaving(true);
    try {
      const negocio = await window.emissary.getNegocio();
      if (negocio) {
        await window.emissary.saveNegocio({
          ...negocio,
          tour_completo: true
        });
      }
      onComplete();
    } catch (err) {
      toast.error('Error al guardar progreso de la guía');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-3xl flex flex-col h-[600px] bg-card/80 backdrop-blur-2xl border border-border/50 rounded-[2.5rem] shadow-glass relative z-10 overflow-hidden">
        
        {/* Progress Bar Header */}
        <div className="pt-8 px-10 flex gap-2">
          {SLIDES.map((_, idx) => (
            <div key={idx} className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: idx <= slideIndex ? '100%' : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {/* Slides Content */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-10">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="absolute w-full flex flex-col items-center text-center px-10"
            >
              <div className={`w-24 h-24 sm:w-32 sm:h-32 mb-8 rounded-3xl ${currentSlide.bg} ${currentSlide.color} flex items-center justify-center shadow-inner border border-white/20`}>
                <currentSlide.icon className="w-12 h-12 sm:w-16 sm:h-16" strokeWidth={1.5} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-foreground">
                {currentSlide.title}
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                {currentSlide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-8 px-10 flex items-center justify-between border-t border-border/30 bg-muted/5">
          <button
            onClick={() => paginate(-1)}
            disabled={slideIndex === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
              slideIndex === 0 
                ? 'text-transparent pointer-events-none' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <ChevronLeft className="w-5 h-5 -ml-1" />
            Anterior
          </button>

          <button
            onClick={isLast ? handleFinish : () => paginate(1)}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-float active:scale-[0.98]"
          >
            {isLast ? (
              <>
                {saving ? 'Guardando...' : 'Comenzar'}
                {!saving && <CheckCircle2 className="w-5 h-5 ml-1" />}
              </>
            ) : (
              <>
                Siguiente
                <ChevronRight className="w-5 h-5 -mr-1" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
