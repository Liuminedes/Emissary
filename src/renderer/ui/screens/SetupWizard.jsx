import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, User, QrCode, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 'negocio', label: 'Negocio', icon: Store },
  { id: 'asesor', label: 'Asesor', icon: User },
  { id: 'qr', label: 'Vincular', icon: QrCode },
];

export function SetupWizard({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre_negocio: '',
    marca: 'Volkswagen', // Valor por defecto
    color_acento: '#3b82f6', // Azul por defecto
    nombre_asesor: ''
  });
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waError, setWaError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Si llegamos al paso del QR, nos suscribimos al estado de WhatsApp
    if (currentStep === 2) {
      window.emissary.getWaStatus().then((res) => {
        setWaStatus(res.status);
        if (res.qrDataUrl) setQrDataUrl(res.qrDataUrl);
        if (res.error) setWaError(res.error);
      });

      const unsubscribe = window.emissary.onWaStatus((update) => {
        setWaStatus(update.status);
        if (update.qrDataUrl) setQrDataUrl(update.qrDataUrl);
        if (update.error) setWaError(update.error);
        
        if (update.status === 'connected') {
          toast.success('WhatsApp vinculado exitosamente');
          setTimeout(() => {
            handleComplete();
          }, 1500);
        }
      });

      return () => unsubscribe();
    }
  }, [currentStep]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async () => {
    if (currentStep === 0 && !formData.nombre_negocio) {
      return toast.error('Ingresa el nombre del negocio');
    }
    if (currentStep === 1 && !formData.nombre_asesor) {
      return toast.error('Ingresa el nombre del asesor');
    }

    // Si pasamos al QR, guardamos los datos primero
    if (currentStep === 1) {
      setIsSaving(true);
      try {
        await window.emissary.saveNegocio({
          nombre_negocio: formData.nombre_negocio,
          marca: formData.marca,
          color_acento: formData.color_acento,
          nombre_asesor: formData.nombre_asesor
        });
        setCurrentStep(2);
      } catch (err) {
        toast.error('Error al guardar datos');
      } finally {
        setIsSaving(false);
      }
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleComplete = async () => {
    try {
      await window.emissary.completeSetup();
      onComplete();
    } catch (err) {
      toast.error('Error al finalizar el setup');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/30 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card/80 backdrop-blur-2xl border border-border/50 rounded-3xl shadow-glass overflow-hidden"
      >
        {/* Header (Progress) */}
        <div className="p-8 pb-0">
          <div className="flex items-center justify-between relative mb-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full -z-10 overflow-hidden">
              <motion.div 
                className="h-full bg-primary rounded-full" 
                initial={{ width: '0%' }}
                animate={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
            
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStep;
              const isPast = idx < currentStep;
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 bg-card px-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isActive ? 'bg-primary text-primary-foreground shadow-float' : 
                    isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isPast ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium ${isActive || isPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'anticipate' }}
              className="min-h-[200px]"
            >
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Datos del Negocio</h2>
                    <p className="text-muted-foreground text-sm mt-1">Configura la identidad de tu empresa.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre del Negocio</label>
                    <input 
                      type="text" 
                      name="nombre_negocio"
                      value={formData.nombre_negocio}
                      onChange={handleChange}
                      placeholder="Ej. Almotoces S.A." 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Marca o Plantilla</label>
                    <div className="relative">
                      <select 
                        name="marca"
                        value={formData.marca}
                        onChange={handleChange}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 pl-10 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
                      >
                        <option value="Volkswagen">Volkswagen</option>
                        <option value="JAC">JAC</option>
                        <option value="KIA">KIA</option>
                      </select>
                      <Store className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                      <ChevronRight className="absolute right-3 top-3.5 w-5 h-5 text-muted-foreground rotate-90" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">El bot cargará el catálogo adaptado a esta opción.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Color de Acento (HEX)</label>
                    <div className="flex gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl border border-border shrink-0 shadow-sm"
                        style={{ backgroundColor: formData.color_acento }}
                      />
                      <input 
                        type="text" 
                        name="color_acento"
                        value={formData.color_acento}
                        onChange={handleChange}
                        placeholder="#3b82f6" 
                        className="flex-1 bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold tracking-tight">Perfil del Asesor</h2>
                    <p className="text-muted-foreground text-sm mt-1">¿Cómo te presentará el bot?</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tu Nombre</label>
                    <input 
                      type="text" 
                      name="nombre_asesor"
                      value={formData.nombre_asesor}
                      onChange={handleChange}
                      placeholder="Ej. Juan Pérez" 
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5 flex flex-col items-center text-center">
                  <h2 className="text-2xl font-semibold tracking-tight">Vincular WhatsApp</h2>
                  <p className="text-muted-foreground text-sm">Abre WhatsApp en tu teléfono y escanea este código.</p>
                  
                  <div className="w-64 h-64 bg-white rounded-2xl p-4 shadow-glass-dark border border-border flex items-center justify-center relative overflow-hidden mt-4">
                    {waStatus === 'error' ? (
                      <div className="flex flex-col items-center text-red-500 text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                          <span className="font-bold">!</span>
                        </div>
                        <span className="text-sm font-semibold">Error interno</span>
                        <p className="text-xs text-red-400 mt-1 max-w-[200px] break-words">
                          {waError || 'El bot no pudo iniciar. Revisa tu red o reinicia.'}
                        </p>
                      </div>
                    ) : waStatus === 'connected' ? (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-emerald-500 flex flex-col items-center"
                      >
                        <CheckCircle2 className="w-16 h-16 mb-2" />
                        <span className="font-semibold">¡Conectado!</span>
                      </motion.div>
                    ) : qrDataUrl ? (
                      <motion.img 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={qrDataUrl} 
                        alt="WhatsApp QR Code" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-sm">Generando QR...</span>
                      </div>
                    )}

                    {/* Escaneo overlay animation */}
                    {qrDataUrl && waStatus !== 'connected' && waStatus !== 'error' && (
                      <motion.div 
                        animate={{ top: ['-10%', '110%'] }}
                        transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                        className="absolute left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_3px_rgba(var(--primary),0.5)] z-10"
                      />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {currentStep < 2 && (
          <div className="p-8 pt-0 flex justify-end">
            <button 
              onClick={handleNext}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary-hover transition-colors shadow-float active:scale-[0.98]"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuar'}
              {!isSaving && <ChevronRight className="w-5 h-5 -mr-1" />}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
