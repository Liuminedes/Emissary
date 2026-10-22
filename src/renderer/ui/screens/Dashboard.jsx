import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, LogOut, CheckCircle2, Loader2, Smartphone, AlertCircle, QrCode } from 'lucide-react';
import { toast } from 'sonner';

// Mapa de estados y colores/iconos
const STATUS_MAP = {
  connected: { label: 'Conectado', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2, pulse: false },
  connecting: { label: 'Conectando...', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Loader2, pulse: true },
  qr: { label: 'Esperando QR', color: 'text-primary', bg: 'bg-primary/10', icon: QrCode, pulse: true },
  disconnected: { label: 'Desconectado', color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertCircle, pulse: false },
};

export function Dashboard({ asesor, negocio }) {
  const [waStatus, setWaStatus] = useState('connecting');
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [isScraping, setIsScraping] = useState(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [connectingSlow, setConnectingSlow] = useState(false);

  // Si "conectando" dura demasiado (sin internet, Baileys colgado) se ofrece salir del overlay
  useEffect(() => {
    if (waStatus !== 'connecting') {
      setConnectingSlow(false);
      return;
    }
    const t = setTimeout(() => setConnectingSlow(true), 10000);
    return () => clearTimeout(t);
  }, [waStatus]);

  useEffect(() => {
    // Obtenemos estado inicial
    window.emissary.getWaStatus().then((res) => {
      setWaStatus(res.status);
      if (res.qrDataUrl) setQrDataUrl(res.qrDataUrl);
    });

    // Nos suscribimos a cambios
    const unsubscribe = window.emissary.onWaStatus((statusUpdate) => {
      setWaStatus(statusUpdate.status);
      if (statusUpdate.qrDataUrl) setQrDataUrl(statusUpdate.qrDataUrl);
      
      if (statusUpdate.status === 'connected') {
        toast.success('WhatsApp conectado correctamente', { icon: '🟢' });
      } else if (statusUpdate.status === 'disconnected') {
        toast.error('WhatsApp se ha desconectado', { icon: '🔴' });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleScrape = async () => {
    setIsScraping(true);
    const t = toast.loading('Actualizando catálogo desde la web...');
    try {
      const res = await window.emissary.scrapeCatalogo();
      if (!res?.ok) {
        toast.error('No se pudo actualizar el catálogo', { id: t, description: res?.error });
      } else {
        toast.success(`${res.actualizados} precios actualizados (${res.count} ítems leídos de la web)`, { id: t });
      }
    } catch (err) {
      toast.error('Error al actualizar catálogo', { id: t, description: err.message });
    } finally {
      setIsScraping(false);
    }
  };

  const handleLogout = async () => {
    toast('Cerrando sesión de WhatsApp...');
    await window.emissary.logoutWa();
  };

  const currentStatus = STATUS_MAP[waStatus] || STATUS_MAP.disconnected;
  const StatusIcon = currentStatus.icon;

  return (
    <>
      <AnimatePresence>
        {waStatus === 'connecting' && !overlayDismissed && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
            
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-card rounded-3xl shadow-glass-dark border border-border/50 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse" />
                <Smartphone className="w-10 h-10 text-primary relative z-10" />
              </div>
              
              <h1 className="text-3xl font-bold tracking-tight mb-2">Emissary</h1>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Conectando motor de WhatsApp...
              </p>
              {connectingSlow && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Está tardando más de lo normal. Revisa tu conexión a internet.</p>
                  <button
                    onClick={() => setOverlayDismissed(true)}
                    className="px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Continuar sin esperar
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-8 relative z-10"
      >
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Bienvenido, {asesor?.nombre || 'Asesor'}</h1>
          <p className="text-muted-foreground mt-1 text-lg">Aquí tienes el resumen de tu bot {negocio?.nombre_negocio ? `para ${negocio.nombre_negocio}` : ''}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Tarjeta de Estado de WhatsApp */}
          <motion.div 
            className="bg-card rounded-2xl border border-border/50 shadow-glass overflow-hidden relative group"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            {/* Subtle gradient background based on status */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-20 transition-colors duration-500 blur-2xl ${currentStatus.bg}`} />
            
            <div className="p-6 relative z-10 flex flex-col h-full">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-500 ${currentStatus.bg} ${currentStatus.color}`}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">Estado del Bot</h2>
                    <p className="text-sm text-muted-foreground">Conexión de WhatsApp</p>
                  </div>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={waStatus}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${currentStatus.bg} ${currentStatus.color}`}
                  >
                    <StatusIcon className={`w-4 h-4 ${currentStatus.pulse && waStatus !== 'connecting' ? 'animate-spin' : ''}`} />
                    {currentStatus.label}
                  </motion.div>
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {waStatus === 'qr' && qrDataUrl && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-6 flex flex-col items-center justify-center overflow-hidden"
                  >
                    <div className="bg-white p-3 rounded-2xl shadow-inner border border-border/50">
                      <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 text-center">Escanea este código con tu WhatsApp</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-auto pt-4 flex gap-3">
                <button 
                  onClick={handleLogout}
                  className="flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-transparent hover:bg-muted text-sm font-medium transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-4 h-4" />
                  Re-vincular
                </button>
              </div>
            </div>
          </motion.div>

          {/* Tarjeta de Acciones Rápidas */}
          <motion.div 
            className="bg-card rounded-2xl border border-border/50 shadow-glass p-6"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Sincronización</h2>
                <p className="text-sm text-muted-foreground">Manten tu inventario al día</p>
              </div>
            </div>

            {!negocio?.scrape_url ? (
              <div className="bg-muted/50 rounded-xl p-6 border border-border/50 text-center flex flex-col items-center justify-center h-[120px]">
                <p className="text-sm text-foreground font-medium">Catálogo Local Activo</p>
                <p className="text-xs text-muted-foreground mt-1">Configura una URL en Ajustes si deseas sincronizar precios web.</p>
              </div>
            ) : (
              <>
                <div className="bg-muted/50 rounded-xl p-4 mb-6 border border-border/50">
                  <p className="text-sm text-foreground">
                    Extrae los últimos precios, modelos y bonos directamente desde el sitio web configurado.
                  </p>
                </div>

                <button 
                  onClick={handleScrape}
                  disabled={isScraping}
                  className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-float hover:shadow-float-hover"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Actualizar Precios del Catálogo
                    </>
                  )}
                </button>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
