import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Play, Square, Users, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function EnvioMasivo() {
  const [contactosRaw, setContactosRaw] = useState('');
  const [plantilla, setPlantilla] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ total: 0, enviados: 0, currentNumber: '', currentName: '' });
  const [waStatus, setWaStatus] = useState('disconnected');

  useEffect(() => {
    // Escuchar estado de WA
    window.emissary.getWaStatus().then(st => setWaStatus(st?.status));
    const unsubWa = window.emissary.onWaStatus(st => setWaStatus(st?.status));

    // Escuchar progreso masivo
    const unsubProgress = window.emissary.onMasivoProgress((data) => {
      setProgress(data);
    });

    // Escuchar finalización
    const unsubDone = window.emissary.onMasivoDone((data) => {
      setIsSending(false);
      toast.success(`Campaña finalizada. ${data.enviados} mensajes enviados.`);
    });

    return () => {
      unsubWa();
      unsubProgress();
      unsubDone();
    };
  }, []);

  const parseContactos = (text) => {
    const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];
    for (const linea of lineas) {
      if (linea.includes(',')) {
        const [numero, ...nombreArr] = linea.split(',');
        parsed.push({
          numero: numero.trim(),
          nombre: nombreArr.join(',').trim()
        });
      } else {
        parsed.push({
          numero: linea,
          nombre: ''
        });
      }
    }
    return parsed;
  };

  const handleStart = async () => {
    if (waStatus !== 'connected') {
      toast.error('WhatsApp no está conectado. Ve al Dashboard para vincular tu cuenta.');
      return;
    }
    
    const contactos = parseContactos(contactosRaw);
    if (contactos.length === 0) {
      toast.error('No has ingresado ningún contacto válido.');
      return;
    }
    if (!plantilla.trim()) {
      toast.error('El mensaje no puede estar vacío.');
      return;
    }

    setIsSending(true);
    setProgress({ total: contactos.length, enviados: 0, currentNumber: '', currentName: '' });
    
    // Inicia en background y libera la UI de inmediato
    const res = await window.emissary.startMasivo({ contactos, plantilla });
    if (!res?.success) {
      setIsSending(false);
      toast.error(res?.message || 'No se pudo iniciar la campaña');
      return;
    }
    toast.info('Campaña iniciada. Los mensajes se están enviando en segundo plano.');
  };

  const handleCancel = async () => {
    await window.emissary.cancelMasivo();
    setIsSending(false);
    toast.info('Envío masivo cancelado. (Puede tardar unos segundos en detenerse)');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <Megaphone className="w-8 h-8 text-primary" />
          Envíos Masivos
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Envía mensajes de bienvenida a listas de contactos para iniciar conversaciones que serán gestionadas por el bot automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna Izquierda: Contactos */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Contactos</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Pega un número por línea. Si deseas incluir el nombre, sepáralo por una coma (ej: <code className="text-xs bg-muted px-1 rounded">3001234567, Juan Pérez</code>). Se asume código <code className="text-xs bg-muted px-1 rounded">+57</code> por defecto si no lo incluyes.
          </p>
          <textarea
            className="flex-1 min-h-[250px] w-full bg-background border border-input rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary/50 outline-none resize-none"
            placeholder={"3001234567, Juan Pérez\n+52 55 1234 5678, María Gómez\n3159998888"}
            value={contactosRaw}
            onChange={e => setContactosRaw(e.target.value)}
            disabled={isSending}
          />
          <div className="mt-3 flex justify-between items-center text-xs text-muted-foreground">
            <span>{parseContactos(contactosRaw).length} contactos detectados</span>
          </div>
        </div>

        {/* Columna Derecha: Mensaje */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Mensaje de Bienvenida</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Escribe el mensaje que recibirán. Usa <code className="text-xs bg-muted px-1 rounded">{'{nombre}'}</code> para personalizarlo. El bot pausará su secuencia hasta que el prospecto responda.
          </p>
          <textarea
            className="flex-1 min-h-[250px] w-full bg-background border border-input rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none"
            placeholder={"¡Hola {nombre}! Bienvenido a nuestro servicio. Cuéntanos en qué te podemos ayudar hoy."}
            value={plantilla}
            onChange={e => setPlantilla(e.target.value)}
            disabled={isSending}
          />
        </div>
      </div>

      {/* Barra de Progreso y Acciones */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full">
            <AnimatePresence mode="wait">
              {!isSending && progress.total === 0 ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 text-muted-foreground"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">Configura tus contactos y el mensaje para comenzar. Para evitar bloqueos en WhatsApp, el sistema envía los mensajes espaciados aleatoriamente (entre 10 y 60 segundos).</span>
                </motion.div>
              ) : (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <div className="flex justify-between text-sm font-medium">
                    <span>
                      {isSending ? 'Enviando mensajes...' : 'Campaña Finalizada'} 
                      {isSending && progress.currentName && <span className="text-muted-foreground font-normal ml-2">→ {progress.currentName}</span>}
                    </span>
                    <span>{progress.enviados} de {progress.total}</span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress.total > 0 ? (progress.enviados / progress.total) * 100 : 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            {!isSending ? (
              <button
                onClick={handleStart}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <Play className="w-5 h-5" />
                Iniciar Envío
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 px-6 py-3 rounded-xl font-medium hover:bg-destructive hover:text-destructive-foreground transition-all"
              >
                <Square className="w-5 h-5" fill="currentColor" />
                Detener
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
