import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, MiniMap, MarkerType, applyNodeChanges, applyEdgeChanges, useReactFlow, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Loader2, Plus, Minus, Maximize2, Undo2, Redo2, LayoutGrid, RotateCcw, ChevronDown, MousePointerClick, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { MessageNode } from '../components/nodes/MessageNode';
import { NodePanel } from '../components/flow/NodePanel';
import { Simulator } from '../components/flow/Simulator';
import { FlowContext } from '../flow/FlowContext';
import { BLOCK_KINDS, createBlock, serialize, freeHandle, pruneEdges, validateFlow, autoLayout, newId } from '../flow/model';
import { startNodeOf, optionTag } from '../../../main/whatsapp/flows/flowRuntime.js';

const nodeTypes = { messageNode: MessageNode };
const MAX_HISTORY = 60;
const edgeStyle = { stroke: 'hsl(var(--primary))', strokeWidth: 2 };

const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

function FlowEditor() {
  const rf = useReactFlow();
  const wrapper = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState('editar');
  const [negocio, setNegocio] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [, bump] = useState(0);

  // Referencias al último estado: los atajos de teclado y los callbacks encadenados no deben ver datos viejos
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const edgesRef = useRef(edges); edgesRef.current = edges;
  const past = useRef([]);
  const future = useRef([]);
  const lastEdit = useRef({ key: null, at: 0 });

  const snapshot = () => ({ nodes: nodesRef.current, edges: edgesRef.current });

  // Toda modificación pasa por aquí para poder deshacerla. Escribir seguido en un mismo campo cuenta como un solo cambio.
  const commit = useCallback((nextNodes, nextEdges, key) => {
    const now = Date.now();
    const sameEdit = key && lastEdit.current.key === key && now - lastEdit.current.at < 1200;
    if (!sameEdit) { past.current.push(snapshot()); if (past.current.length > MAX_HISTORY) past.current.shift(); }
    lastEdit.current = { key, at: now };
    future.current = [];
    setNodes(nextNodes);
    setEdges(nextEdges);
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    const s = past.current.pop();
    if (!s) return;
    future.current.push(snapshot());
    lastEdit.current = { key: null, at: 0 };
    setNodes(s.nodes); setEdges(s.edges); bump((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const s = future.current.pop();
    if (!s) return;
    past.current.push(snapshot());
    lastEdit.current = { key: null, at: 0 };
    setNodes(s.nodes); setEdges(s.edges); bump((n) => n + 1);
  }, []);

  // ---------- Carga y guardado ----------
  const load = useCallback((flow) => {
    setNodes(flow.nodes);
    setEdges(flow.edges || []);
    setSaved(JSON.stringify(serialize(flow.nodes, flow.edges || [])));
    past.current = []; future.current = []; setSelectedId(null); bump((n) => n + 1);
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 60);
  }, [rf]);

  useEffect(() => {
    (async () => {
      try {
        setNegocio(await window.emissary.getNegocio());
        let flow = await window.emissary.getFlujo();
        if (!flow?.nodes?.length) flow = await window.emissary.resetFlujoToTemplate();
        if (flow?.nodes?.length) load(flow);
      } catch {
        toast.error('Error al cargar el flujo');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const issues = useMemo(() => validateFlow(nodes, edges), [nodes, edges]);
  const issuesByNode = useMemo(() => {
    const map = {};
    for (const i of issues) if (i.nodeId && i.level !== 'info') { map[i.nodeId] ||= { error: 0, warn: 0 }; map[i.nodeId][i.level] += 1; }
    return map;
  }, [issues]);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const startId = useMemo(() => (nodes.length ? startNodeOf(nodes).id : null), [nodes]);
  const dirty = useMemo(() => saved !== '' && JSON.stringify(serialize(nodes, edges)) !== saved, [nodes, edges, saved]);

  const save = useCallback(async () => {
    const hard = validateFlow(nodesRef.current, edgesRef.current).filter((i) => i.level === 'error');
    if (hard.length && !window.confirm(`Hay ${hard.length} ${hard.length === 1 ? 'error' : 'errores'} en el flujo (por ejemplo: ${hard[0].text}) ¿Guardar de todos modos?`)) return;
    setSaving(true);
    try {
      const flow = serialize(nodesRef.current, edgesRef.current);
      await window.emissary.saveFlujo(flow.nodes, flow.edges);
      setSaved(JSON.stringify(flow));
      toast.success('Flujo guardado. El bot ya usa esta versión.');
    } catch (err) {
      toast.error(String(err?.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '') || 'No se pudo guardar el flujo');
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(); }
      else if (!isTyping(e.target) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (!isTyping(e.target) && k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save, undo, redo]);

  const restoreTemplate = async () => {
    if (!window.confirm('Esto reemplaza tu flujo actual por la plantilla de tu tipo de negocio. Perderás los cambios que hayas hecho. ¿Continuar?')) return;
    try {
      load(await window.emissary.resetFlujoToTemplate());
      toast.success('Plantilla restaurada');
    } catch {
      toast.error('No se pudo restaurar la plantilla');
    }
  };

  // ---------- Edición ----------
  const patchNode = useCallback((id, patch, key) => {
    const nextNodes = nodesRef.current.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    const nextEdges = 'options' in patch ? pruneEdges(nextNodes, edgesRef.current) : edgesRef.current;
    commit(nextNodes, nextEdges, key ? `${id}:${key}` : undefined);
  }, [commit]);

  const deleteNodes = useCallback((ids) => {
    if (nodesRef.current.length - ids.length < 1) { toast.error('El flujo necesita al menos un bloque'); return; }
    const nextNodes = nodesRef.current.filter((n) => !ids.includes(n.id));
    commit(nextNodes, pruneEdges(nextNodes, edgesRef.current));
    setSelectedId((s) => (ids.includes(s) ? null : s));
  }, [commit]);

  const duplicateNode = useCallback((id) => {
    const src = nodesRef.current.find((n) => n.id === id);
    if (!src) return;
    const copy = {
      ...src, id: newId(), selected: false, position: { x: src.position.x + 40, y: src.position.y + 60 },
      data: { ...structuredClone(src.data), label: `${src.data.label || 'Bloque'} (copia)`, isStart: false, options: (src.data.options || []).map((o) => ({ ...structuredClone(o), id: newId('o') })) },
    };
    commit([...nodesRef.current, copy], edgesRef.current);
    setSelectedId(copy.id);
  }, [commit]);

  const setStart = useCallback((id) => {
    commit(nodesRef.current.map((n) => ({ ...n, data: { ...n.data, isStart: n.id === id } })), edgesRef.current);
  }, [commit]);

  const addBlock = useCallback((kind) => {
    const sel = nodesRef.current.find((n) => n.id === selectedId);
    let position;
    if (sel) {
      const hermanos = edgesRef.current.filter((e) => e.source === sel.id).length;
      position = { x: sel.position.x + 420, y: sel.position.y + hermanos * 230 };
    } else {
      const r = wrapper.current?.getBoundingClientRect();
      position = rf.screenToFlowPosition({ x: r ? r.left + r.width / 2 : 400, y: r ? r.top + r.height / 2 : 300 });
      position = { x: position.x - 160, y: position.y - 100 };
    }
    const block = createBlock(kind, position);
    // A continuación del bloque seleccionado: se conecta solo a su primera salida libre
    const free = sel ? freeHandle(sel, edgesRef.current) : undefined;
    const nextEdges = free
      ? [...edgesRef.current, { id: newId('e'), source: sel.id, target: block.id, ...(free.handle ? { sourceHandle: free.handle } : {}), animated: true }]
      : edgesRef.current;
    commit([...nodesRef.current, block], nextEdges);
    setSelectedId(block.id);
    setTab('editar');
    setAddOpen(false);
    setTimeout(() => rf.setCenter(position.x + 160, position.y + 110, { zoom: Math.max(rf.getZoom(), 0.7), duration: 400 }), 60);
  }, [selectedId, rf, commit]);

  const tidy = useCallback(() => {
    const sizeOf = (n) => ({ w: n.measured?.width || 320, h: n.measured?.height || 200 });
    commit(autoLayout(nodesRef.current, edgesRef.current, sizeOf), edgesRef.current);
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 80);
  }, [commit, rf]);

  const focusNode = useCallback((id) => {
    const n = nodesRef.current.find((m) => m.id === id);
    if (!n) return;
    setSelectedId(id); setTab('editar');
    rf.setCenter(n.position.x + 160, n.position.y + 110, { zoom: Math.max(rf.getZoom(), 0.7), duration: 400 });
  }, [rf]);

  // ---------- Eventos del lienzo ----------
  const onNodesChange = useCallback((changes) => {
    const removes = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removes.length) { deleteNodes(removes); return; }
    const rest = changes.filter((c) => c.type !== 'select'); // la selección la controlamos nosotros
    if (rest.length) setNodes((nds) => applyNodeChanges(rest, nds));
  }, [deleteNodes]);

  const onEdgesChange = useCallback((changes) => {
    const removes = changes.filter((c) => c.type === 'remove').map((c) => c.id);
    if (removes.length) { commit(nodesRef.current, edgesRef.current.filter((e) => !removes.includes(e.id))); return; }
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [commit]);

  // Cada alternativa lleva a un solo bloque: conectar de nuevo reemplaza la flecha anterior
  const onConnect = useCallback((c) => {
    const mismo = (e) => e.source === c.source && (e.sourceHandle || null) === (c.sourceHandle || null);
    commit(nodesRef.current, [...edgesRef.current.filter((e) => !mismo(e)), { id: newId('e'), source: c.source, target: c.target, ...(c.sourceHandle ? { sourceHandle: c.sourceHandle } : {}), animated: true }]);
  }, [commit]);

  const onNodeDragStart = useCallback(() => {
    past.current.push(snapshot()); if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = []; lastEdit.current = { key: null, at: 0 }; bump((n) => n + 1);
  }, []);

  // ---------- Lo que se pinta ----------
  const shownNodes = useMemo(() => nodes.map((n) => ({ ...n, selected: n.id === selectedId })), [nodes, selectedId]);
  const shownEdges = useMemo(() => edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source);
    const i = src ? (src.data.options || []).findIndex((o) => o.id === e.sourceHandle) : -1;
    const base = { ...e, type: 'smoothstep', style: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' } };
    if (i < 0) return base;
    const tag = src.data.menu === 'letters' ? optionTag('letters', i).replace(')', '') : src.data.menu === 'numbers' ? String(i + 1) : '';
    const label = [tag, (src.data.options[i].label || '').slice(0, 14)].filter(Boolean).join(' · ');
    return { ...base, label, labelStyle: { fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }, labelBgStyle: { fill: 'hsl(var(--card))' }, labelBgPadding: [6, 3], labelBgBorderRadius: 6 };
  }), [edges, nodes]);

  const ctx = useMemo(() => ({ startId, activeId, issues: issuesByNode }), [startId, activeId, issuesByNode]);
  const selected = nodes.find((n) => n.id === selectedId);
  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  if (loading) return <div className="flex justify-center items-center h-full min-h-[60vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const tabBtn = (id, label, badge) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
      {label}{badge}
    </button>
  );
  const iconBtn = 'p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

  return (
    <FlowContext.Provider value={ctx}>
      <div className="h-full w-full flex flex-col">
        <header className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur">
          <div className="mr-auto min-w-0">
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">Flujo de conversación
              {dirty && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Cambios sin guardar</span>}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Así responde tu bot: pregunta y respuesta, sin IA. Haz clic en un bloque para editarlo.</p>
          </div>

          <div className="relative">
            <button type="button" onClick={() => setAddOpen((v) => !v)} aria-haspopup="menu" aria-expanded={addOpen}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80">
              <Plus className="w-4 h-4" />Añadir bloque<ChevronDown className="w-4 h-4" />
            </button>
            {addOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-72 z-30 bg-card border border-border rounded-2xl shadow-float p-1.5">
                {selectedId && <p className="px-3 pt-2 pb-1 text-[11px] text-muted-foreground">Se conectará a continuación del bloque seleccionado.</p>}
                {BLOCK_KINDS.map((k) => (
                  <button key={k.id} role="menuitem" type="button" onClick={() => addBlock(k.id)} className="w-full text-left px-3 py-2 rounded-xl hover:bg-muted">
                    <span className="block text-sm font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{k.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <button type="button" onClick={undo} disabled={!canUndo} className={iconBtn} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={redo} disabled={!canRedo} className={iconBtn} aria-label="Rehacer" title="Rehacer (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
            <button type="button" onClick={tidy} className={iconBtn} aria-label="Ordenar automáticamente" title="Ordenar automáticamente"><LayoutGrid className="w-4 h-4" /></button>
            <button type="button" onClick={restoreTemplate} className={iconBtn} aria-label="Restaurar plantilla" title="Restaurar plantilla"><RotateCcw className="w-4 h-4" /></button>
          </div>

          <button type="button" onClick={save} disabled={saving || !dirty} title="Guardar (Ctrl+S)"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover shadow-float disabled:opacity-50 disabled:shadow-none transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 relative" ref={wrapper}>
            <ReactFlow
              nodes={shownNodes} edges={shownEdges} nodeTypes={nodeTypes}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeDragStart={onNodeDragStart}
              onNodeClick={(_, n) => { setSelectedId(n.id); setTab((t) => (t === 'revision' ? 'editar' : t)); }}
              onPaneClick={() => setSelectedId(null)}
              deleteKeyCode={['Delete', 'Backspace']} minZoom={0.1} maxZoom={1.5} fitView proOptions={{ hideAttribution: true }}
              className="bg-muted/10"
            >
              <Background gap={22} size={1} className="opacity-60" />
              <MiniMap pannable zoomable className="!bg-card !border !border-border rounded-xl overflow-hidden" nodeColor="hsl(var(--primary))" maskColor="hsl(var(--muted) / 0.6)" />
              <Panel position="bottom-left" className="bg-card border border-border/60 shadow-glass p-1 rounded-xl flex flex-col gap-0.5 !m-4">
                <button type="button" onClick={() => rf.zoomIn({ duration: 200 })} className={iconBtn} aria-label="Acercar"><Plus className="w-4 h-4" /></button>
                <button type="button" onClick={() => rf.zoomOut({ duration: 200 })} className={iconBtn} aria-label="Alejar"><Minus className="w-4 h-4" /></button>
                <button type="button" onClick={() => rf.fitView({ duration: 300, padding: 0.15 })} className={iconBtn} aria-label="Ver todo el flujo"><Maximize2 className="w-4 h-4" /></button>
              </Panel>
              <Panel position="top-left" className="!m-4">
                <p className="text-[11px] text-muted-foreground bg-card/90 border border-border/60 rounded-lg px-3 py-1.5 max-w-xs">
                  Une los bloques arrastrando desde el punto de una alternativa hasta otro bloque. Clic en una flecha y Supr para quitarla.
                </p>
              </Panel>
            </ReactFlow>
          </div>

          <aside className="w-[360px] shrink-0 border-l border-border/50 bg-card/60 flex flex-col" aria-label="Panel del flujo">
            <div role="tablist" className="flex border-b border-border/50 px-2">
              {tabBtn('editar', 'Editar')}
              {tabBtn('revision', 'Revisión', issues.some((i) => i.level !== 'info') ? <span className={`ml-1.5 inline-block min-w-[1.25rem] px-1 rounded-full text-[11px] ${errorCount ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'}`}>{issues.filter((i) => i.level !== 'info').length}</span> : null)}
              {tabBtn('probar', 'Probar')}
            </div>

            <div key={selectedId || 'ninguno'} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5" hidden={tab !== 'editar'}>
              {selected ? (
                <NodePanel key={selected.id} node={selected} isStart={startId === selected.id} negocio={negocio}
                  issues={issues.filter((i) => i.nodeId === selected.id)}
                  onPatch={patchNode} onSetStart={setStart} onDuplicate={duplicateNode} onDelete={(id) => deleteNodes([id])} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground px-6">
                  <MousePointerClick className="w-8 h-8" />
                  <p className="text-sm font-medium text-foreground">Selecciona un bloque</p>
                  <p className="text-xs">Haz clic en cualquier bloque del lienzo para cambiar su mensaje, sus alternativas (Plan A, B, C…) y qué dato guarda. O añade uno nuevo desde el botón de arriba.</p>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-2" hidden={tab !== 'revision'}>
              {issues.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground py-10"><CheckCircle2 className="w-8 h-8 text-emerald-500" /><p className="text-sm font-medium text-foreground">Todo en orden</p><p className="text-xs">No encontré problemas en el flujo.</p></div>
              ) : issues.map((it, i) => (
                <button key={i} type="button" disabled={!it.nodeId} onClick={() => it.nodeId && focusNode(it.nodeId)}
                  className={`w-full text-left flex gap-2.5 text-xs rounded-xl px-3 py-2.5 transition-colors ${it.level === 'error' ? 'bg-destructive/10 text-destructive hover:bg-destructive/15' : it.level === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
                  {it.level === 'info' ? <Info className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}<span>{it.text}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 p-5" hidden={tab !== 'probar'}>
              <Simulator nodes={nodes} edges={edges} negocio={negocio} onStep={setActiveId} />
            </div>
          </aside>
        </div>
      </div>
    </FlowContext.Provider>
  );
}

export function Mensajes() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
