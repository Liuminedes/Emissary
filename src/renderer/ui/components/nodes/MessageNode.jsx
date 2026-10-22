import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MessageSquareText, Trash2, Edit2, Check, Plus, X } from 'lucide-react';

export function MessageNode({ id, data, isConnectable }) {
  const { setNodes, setEdges } = useReactFlow();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(data.label || 'Nuevo Mensaje');

  // Funciones de eliminación
  const deleteNode = () => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    data.onLabelChange(id, titleValue);
  };

  const addOption = () => {
    const newOptions = [...(data.options || []), { id: `opt_${Date.now()}`, keyword: 'Nueva Opción' }];
    data.onOptionsChange(id, newOptions);
  };

  const removeOption = (optId) => {
    const newOptions = (data.options || []).filter(o => o.id !== optId);
    data.onOptionsChange(id, newOptions);
    // Eliminar también las aristas que salían de este handle
    setEdges((edges) => edges.filter((e) => !(e.source === id && e.sourceHandle === optId)));
  };

  const updateOption = (optId, value) => {
    const newOptions = (data.options || []).map(o => o.id === optId ? { ...o, keyword: value } : o);
    data.onOptionsChange(id, newOptions);
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-glass overflow-hidden w-[350px] group transition-all hover:border-primary/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]">
      
      {/* Target handle principal (Entrada) */}
      {id !== 'welcome' && (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          className="w-4 h-4 bg-primary border-4 border-background"
        />
      )}

      {/* Cabecera del Nodo */}
      <div className="p-3 border-b border-border/30 bg-muted/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageSquareText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input 
                  autoFocus
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
                  onBlur={handleTitleSubmit}
                  className="w-full bg-background border border-primary/50 rounded px-1.5 py-0.5 text-sm font-semibold outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h3 className="font-semibold text-sm leading-tight truncate">{data.label}</h3>
                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>
        
        {/* Eliminar Nodo */}
        {id !== 'welcome' && (
          <button onClick={deleteNode} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded-lg transition-colors shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contenido / Editor del Mensaje */}
      <div className="p-4 bg-background">
        <textarea
          value={data.value || ''}
          onChange={(e) => data.onChange(id, e.target.value)}
          placeholder="Escribe el mensaje aquí..."
          className="w-full h-[80px] bg-muted/30 border border-border/50 rounded-xl p-3 text-xs resize-none outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner nodrag"
        />
      </div>

      {/* Opciones (Condicionales / Ramificaciones) */}
      <div className="bg-muted/10 p-4 border-t border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opciones de Respuesta</span>
          <button onClick={addOption} className="text-primary hover:bg-primary/10 p-1 rounded transition-colors flex items-center gap-1 text-[10px] font-medium">
            <Plus className="w-3 h-3" /> Añadir
          </button>
        </div>

        <div className="space-y-2">
          {(!data.options || data.options.length === 0) ? (
            /* Handle por defecto si no hay opciones */
            <div className="relative border border-border/50 rounded-lg p-2 text-xs bg-background flex items-center justify-between text-muted-foreground italic">
              Continuar al siguiente paso
              <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="w-4 h-4 bg-primary border-4 border-background !right-[-24px]"
              />
            </div>
          ) : (
            data.options.map((opt) => (
              <div key={opt.id} className="relative border border-primary/30 rounded-lg p-2 text-xs bg-primary/5 flex items-center gap-2 group/opt">
                <input
                  value={opt.keyword}
                  onChange={(e) => updateOption(opt.id, e.target.value)}
                  placeholder="Ej: Si"
                  className="bg-transparent font-medium text-primary w-full outline-none nodrag"
                />
                <button onClick={() => removeOption(opt.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover/opt:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={opt.id}
                  isConnectable={isConnectable}
                  className="w-4 h-4 bg-primary border-4 border-background !right-[-24px]"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
