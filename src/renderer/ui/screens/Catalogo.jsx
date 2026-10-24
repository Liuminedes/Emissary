import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Tag, Loader2, X, Car, Package, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { catalogTerms } from '../../../main/whatsapp/flows/terms.js';

export function Catalogo() {
  // Las palabras de la pantalla (vehículo, producto…) dependen de la plantilla del negocio
  const [terms, setTerms] = useState(catalogTerms());
  const ui = terms.ui;
  const Icono = terms.porPresupuesto ? Car : Package;
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Estado para el modal de edición/creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    loadCatalogo();
  }, []);

  const loadCatalogo = async () => {
    setIsLoading(true);
    try {
      const [data, negocio] = await Promise.all([window.emissary.listCatalogo(), window.emissary.getNegocio()]);
      setTerms(catalogTerms(negocio?.marca));
      setItems(data || []);
    } catch (err) {
      toast.error('Error al cargar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Estás seguro de eliminar este ítem?')) {
      try {
        await window.emissary.deleteCatalogoItem(id);
        toast.success('Ítem eliminado');
        loadCatalogo();
      } catch (err) {
        toast.error('Error al eliminar');
      }
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item || { 
      id: null, 
      nombre: '', 
      categoria: 'SUV', 
      emoji: terms.emoji,
      descripcion: '',
      specs: {},
      variantes: [{ version: 'Base', precio: 0, bono: 0 }] 
    });
    setIsModalOpen(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    try {
      await window.emissary.upsertCatalogoItem(editingItem);
      toast.success('Ítem guardado exitosamente');
      setIsModalOpen(false);
      loadCatalogo();
    } catch (err) {
      toast.error('Error al guardar el ítem');
    }
  };

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...editingItem.variantes];
    newVariants[index][field] = value;
    setEditingItem({ ...editingItem, variantes: newVariants });
  };

  const addVariant = () => {
    setEditingItem({
      ...editingItem,
      variantes: [...editingItem.variantes, { version: '', precio: 0, bono: 0, year: new Date().getFullYear() }]
    });
  };

  const removeVariant = (index) => {
    const newVariants = editingItem.variantes.filter((_, i) => i !== index);
    setEditingItem({ ...editingItem, variantes: newVariants });
  };

  const filteredItems = items.filter(i => 
    i.nombre.toLowerCase().includes(search.toLowerCase()) || 
    i.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryColor = (cat) => {
    const lower = cat.toLowerCase();
    if (lower.includes('suv')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (lower.includes('sedan') || lower.includes('sedán')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (lower.includes('hatchback')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (lower.includes('pick')) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-primary/10 text-primary border-primary/20';
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Catálogo de Productos</h1>
          <p className="text-muted-foreground mt-1 text-base">{ui.subtitulo}</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary-hover transition-all shadow-float active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {ui.agregar}
        </button>
      </header>

      {/* Buscador */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={ui.buscar} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-card border border-border/60 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Grid de Catálogo */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p>Cargando inventario...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground bg-card/50 border border-border/50 rounded-3xl border-dashed">
          <Icono className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium text-foreground">{ui.vacioTitulo}</p>
          <p className="text-sm">{ui.vacioHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <motion.div 
              key={item.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group bg-card border border-border/60 rounded-3xl shadow-glass overflow-hidden hover:border-primary/30 transition-all hover:shadow-float flex flex-col"
            >
              <div className="p-6 pb-4 border-b border-border/30 flex justify-between items-start bg-gradient-to-br from-background to-muted/20">
                <div>
                  <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border mb-3 ${getCategoryColor(item.categoria)}`}>
                    {item.categoria}
                  </div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span>{item.emoji || terms.emoji}</span>
                    {item.nombre}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {item.descripcion || 'Sin descripción detallada.'}
                  </p>
                </div>
              </div>
              
              <div className="p-6 pt-4 flex-1 flex flex-col gap-3 bg-background/50">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {ui.variantes} disponibles ({item.variantes?.length || 0})
                </div>
                <div className="space-y-2 flex-1">
                  {item.variantes?.map((v, i) => (
                    <div key={i} className="flex flex-col p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm truncate pr-2">{v.version}</span>
                        <span className="font-bold text-primary whitespace-nowrap">${Number(v.precio).toLocaleString()}</span>
                      </div>
                      {v.bono > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md w-fit">
                          <Tag className="w-3 h-3" /> {ui.bono}: ${Number(v.bono).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-border/30 flex justify-end gap-2 bg-card">
                <button 
                  onClick={() => openModal(item)} 
                  className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-muted/50 hover:bg-primary/10 hover:text-primary rounded-xl transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                <button 
                  onClick={() => handleDelete(item.id)} 
                  className="px-4 py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors"
                  title={ui.eliminar}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de Edición (Premium Drawer/Modal) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="relative w-full max-w-3xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] z-10"
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/10">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  {editingItem?.id ? <Edit2 className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                  {editingItem?.id ? ui.editar : ui.nuevo}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="item-form" onSubmit={saveItem} className="space-y-8">
                  {/* Detalles Básicos */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Información General</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">{ui.nombre}</label>
                        <input required type="text" value={editingItem?.nombre} onChange={e => setEditingItem({...editingItem, nombre: e.target.value})} placeholder={ui.nombreEj} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Categoría</label>
                        <select required value={editingItem?.categoria} onChange={e => setEditingItem({...editingItem, categoria: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
                          <option value="Gasolina">Gasolina</option>
                          <option value="Híbrido">Híbrido</option>
                          <option value="Eléctrico">Eléctrico</option>
                          <option value="Diésel">Diésel</option>
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <label className="text-sm font-medium">Descripción (Opcional, visible para el cliente)</label>
                        <textarea rows="2" value={editingItem?.descripcion} onChange={e => setEditingItem({...editingItem, descripcion: e.target.value})} placeholder={ui.descEj} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"></textarea>
                      </div>
                    </div>
                  </section>

                  {/* {ui.variantesYPrecios} */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Versiones y Precios</h3>
                      <button type="button" onClick={addVariant} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-semibold transition-colors">
                        <Plus className="w-4 h-4" /> {ui.agregarVariante}
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {editingItem?.variantes.map((v, index) => (
                        <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-muted/20 p-4 rounded-2xl border border-border/50">
                          <div className="flex-1 w-full space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase">{ui.nombreVariante}</label>
                            <input required type="text" value={v.version} placeholder={ui.varianteEj} onChange={e => handleVariantChange(index, 'version', e.target.value)} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-all" />
                          </div>
                          <div className="flex-1 w-full space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Precio Lista ($)</label>
                            <input required type="number" min="0" value={v.precio} onChange={e => handleVariantChange(index, 'precio', e.target.value)} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-primary transition-all font-medium text-primary" />
                          </div>
                          <div className="flex-1 w-full space-y-1.5">
                            <label className="text-[11px] font-semibold text-emerald-500 uppercase">{ui.bonoLabel}</label>
                            <input type="number" min="0" value={v.bono} onChange={e => handleVariantChange(index, 'bono', e.target.value)} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition-all font-medium text-emerald-600" />
                          </div>
                          
                          {editingItem.variantes.length > 1 && (
                            <div className="pt-5 flex justify-end w-full md:w-auto">
                              <button type="button" onClick={() => removeVariant(index)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </form>
              </div>

              <div className="p-6 border-t border-border/50 bg-muted/10 flex justify-end gap-3 rounded-b-3xl">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-xl transition-colors">
                  Cancelar
                </button>
                <button form="item-form" type="submit" className="px-8 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover shadow-float active:scale-95 transition-all">
                  {ui.guardar}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
