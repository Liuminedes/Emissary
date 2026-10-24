import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Loader2, Power, PlayCircle, Settings2, ShieldCheck, RefreshCw, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { applyAccentColor } from '../utils/colors';
import { ThemeToggle } from '../components/ThemeToggle';
import { AccountSecurity, UsersAdmin, WhatsAppUnlink } from '../components/AccountPanels';

export function Ajustes({ user, onNegocioChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre_negocio: '',
    nombre_asesor: '',
    telefono: '',
    portfolio_url: '',
    color_acento: '',
    scrape_url: '',
    scrape_selector: ''
  });
  
  const [isPaused, setIsPaused] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const neg = await window.emissary.getNegocio();
      if (neg) {
        setFormData({
          nombre_negocio: neg.nombre_negocio || '',
          nombre_asesor: neg.nombre_asesor || '',
          telefono: neg.telefono || '',
          portfolio_url: neg.portfolio_url || '',
          color_acento: neg.color_acento || '#000000',
          scrape_url: neg.scrape_url || '',
          scrape_selector: neg.scrape_selector || ''
        });
      }

      const pauseState = await window.emissary.isGloballyPaused();
      setIsPaused(pauseState);

      const launchState = await window.emissary.getAutoLaunch();
      setAutoLaunch(launchState);
    } catch (err) {
      toast.error('Error al cargar ajustes');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Live preview para el color
    if (name === 'color_acento') {
      applyAccentColor(value);
    }
  };

  const handleColorPreset = (colorHex) => {
    setFormData(prev => ({ ...prev, color_acento: colorHex }));
    applyAccentColor(colorHex);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await window.emissary.saveNegocio({ ...formData, telefono: formData.telefono.replace(/[^0-9]/g, '') });
      applyAccentColor(formData.color_acento); // Aseguramos que se aplique y se guarde
      await onNegocioChange?.(); // el checklist del Dashboard y el resto de la app leen el negocio actualizado
      toast.success('Configuración guardada exitosamente');
    } catch (err) {
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async () => {
    const newState = !isPaused;
    try {
      await window.emissary.setGlobalPause(newState);
      setIsPaused(newState);
      toast(newState ? 'Bot pausado globalmente' : 'Bot reanudado');
    } catch (err) {
      toast.error('Error al cambiar estado del bot');
    }
  };

  const toggleAutoLaunch = async () => {
    const newState = !autoLaunch;
    try {
      await window.emissary.setAutoLaunch(newState);
      setAutoLaunch(newState);
      toast.success(newState ? 'Auto-inicio activado' : 'Auto-inicio desactivado');
    } catch (err) {
      toast.error('Error al configurar auto-inicio');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1 text-lg">Configuración general de Emissary</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Perfil y Negocio */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="bg-card border border-border/50 rounded-2xl shadow-glass overflow-hidden">
            <div className="p-6 border-b border-border/30 bg-muted/10 flex items-center gap-3">
              <Settings2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-medium">Datos Generales</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Negocio</label>
                  <input 
                    type="text" 
                    name="nombre_negocio"
                    value={formData.nombre_negocio}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <p className="text-xs text-muted-foreground">Este nombre puede ser visible en algunas respuestas del bot.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre del Asesor</label>
                  <input 
                    type="text" 
                    name="nombre_asesor"
                    value={formData.nombre_asesor}
                    onChange={handleChange}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <p className="text-xs text-muted-foreground">El nombre con el que el bot se presenta o transfiere la conversación.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">WhatsApp del asesor</label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    placeholder="Ej. 573001234567"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Con código de país y sin +. Así el bot no se responde a sí mismo y distingue tus mensajes de los del cliente.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">URL del Portafolio Personal (Opcional)</label>
                  <input 
                    type="url" 
                    name="portfolio_url"
                    value={formData.portfolio_url}
                    onChange={handleChange}
                    placeholder="https://miportafolio.com"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">URL pública donde los clientes pueden ver tu información completa de contacto.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" /> Color de Acento
                  </label>
                  
                  <div className="flex gap-3 items-center">
                    {/* Native Color Picker ocultando la UI por defecto de los navegadores mediante CSS o usando el nativo */}
                    <input 
                      type="color" 
                      name="color_acento"
                      value={formData.color_acento || '#000000'}
                      onChange={handleChange}
                      className="w-12 h-12 rounded-xl border border-border cursor-pointer shadow-sm p-0.5 bg-background overflow-hidden"
                    />
                    
                    <input 
                      type="text" 
                      name="color_acento"
                      value={formData.color_acento}
                      onChange={handleChange}
                      className="flex-1 max-w-[200px] bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm uppercase"
                    />
                  </div>

                  {/* Presets rápidos */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground mr-2 uppercase tracking-wider font-medium">Presets:</span>
                    {['#8E27F5', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#64748b'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorPreset(color)}
                        className={`w-6 h-6 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-110 ${formData.color_acento === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        style={{ backgroundColor: color }}
                        aria-label={`Seleccionar color ${color}`}
                      />
                    ))}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">Cambia el color principal de esta interfaz. ¡Pruébalo, se actualiza en tiempo real!</p>
                </div>
              </div>
            </div>

            {/* Sincronización Web */}
            <div className="p-6 border-t border-border/30 bg-muted/5 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-medium">Sincronización de Catálogo</h2>
            </div>
            
            <div className="p-6 space-y-6 border-t border-border/30">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL del Sitio Web</label>
                  <input 
                    type="url" 
                    name="scrape_url"
                    value={formData.scrape_url}
                    onChange={handleChange}
                    placeholder="https://www.tudominio.com/productos"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">La dirección de la página desde donde el bot extraerá los precios y modelos al sincronizar.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selector CSS (Opcional)</label>
                  <input 
                    type="text" 
                    name="scrape_selector"
                    value={formData.scrape_selector}
                    onChange={handleChange}
                    placeholder=".producto-item, article.car"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Regla CSS para identificar los productos en el HTML (si lo dejas vacío, el motor usará reglas heurísticas automáticas).</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-muted/10 border-t border-border/30 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary-hover transition-colors shadow-float active:scale-95 disabled:opacity-70"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>

        {/* Columna Derecha: Sistema y Toggles */}
        <div className="space-y-6">
          <div className="bg-card border border-border/50 rounded-2xl shadow-glass overflow-hidden">
            <div className="p-6 border-b border-border/30 bg-muted/10 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-medium">Sistema</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Toggle de Pausa */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-sm">Pausar Bot</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Detiene temporalmente las respuestas automáticas.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={togglePause}
                    role="switch"
                    aria-checked={isPaused}
                    aria-label="Pausar bot"
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${isPaused ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPaused ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {isPaused && (
                  <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium">
                    <Power className="w-4 h-4" />
                    El bot no está respondiendo mensajes
                  </div>
                )}
              </div>

              <hr className="border-border/50" />

              {/* Toggle de Auto-inicio */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-sm">Auto-inicio</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Abrir Emissary al encender el equipo.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={toggleAutoLaunch}
                    role="switch"
                    aria-checked={autoLaunch}
                    aria-label="Auto-inicio"
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${autoLaunch ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoLaunch ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {autoLaunch && (
                  <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-medium">
                    <PlayCircle className="w-4 h-4" />
                    Emissary se iniciará con Windows
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl shadow-glass p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-sm">Apariencia</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Modo claro u oscuro.</p>
            </div>
            <ThemeToggle />
          </div>

          <WhatsAppUnlink />
        </div>

      </div>

      {/* Cuenta y usuarios: a lo ancho, la columna lateral es muy angosta para estos formularios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <AccountSecurity />
        {user?.role === 'admin' && <UsersAdmin currentUserId={user.id} />}
      </div>
    </div>
  );
}
