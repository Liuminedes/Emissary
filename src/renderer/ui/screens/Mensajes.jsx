import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Background, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Loader2, Plus, Minus, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { MessageNode } from '../components/nodes/MessageNode';

const nodeTypes = {
  messageNode: MessageNode,
};

let idCounter = 0;
const getId = () => `node_${Date.now()}_${idCounter++}`;

function SmoothZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left" className="bg-card border border-border/50 shadow-glass p-1.5 rounded-xl flex flex-col gap-1.5 m-6">
      <button onClick={() => zoomIn({ duration: 300 })} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
        <Plus className="w-4 h-4" />
      </button>
      <button onClick={() => zoomOut({ duration: 300 })} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
        <Minus className="w-4 h-4" />
      </button>
      <div className="w-full h-px bg-border/50" />
      <button onClick={() => fitView({ duration: 500, padding: 0.2 })} className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
        <MousePointer2 className="w-4 h-4" />
      </button>
    </Panel>
  );
}

function AddNodePanel() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Panel position="left" className="bg-card/80 backdrop-blur-md border border-border/50 shadow-glass p-4 rounded-2xl m-6 mt-32 w-64 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-sm">Añadir Bloque</h3>
        <p className="text-xs text-muted-foreground mt-1">Arrastra un bloque al lienzo para expandir tu flujo.</p>
      </div>
      <div
        className="bg-primary/10 border border-primary/30 text-primary rounded-xl p-3 text-sm font-medium cursor-grab active:cursor-grabbing hover:bg-primary/20 transition-colors shadow-sm flex items-center justify-center"
        onDragStart={(event) => onDragStart(event, 'messageNode')}
        draggable
      >
        + Mensaje Personalizado
      </div>
    </Panel>
  );
}

// Plantilla por defecto (unificada)
const DEFAULT_NODES = [
  { id: 'welcome', type: 'messageNode', position: { x: 250, y: 300 }, data: { label: 'Bienvenida y Menú', value: '👋 Hola, cómo estás? Te habla *{asesor}* 😊\n\nCuéntame, ¿qué necesitas hoy? 👇\n\n*1️⃣* 🚗 Ver el catálogo\n*2️⃣* 💰 Cotizar un vehículo\n*3️⃣* 💳 Opciones de financiación\n*4️⃣* 💬 Hablar directamente conmigo', options: [
    { id: 'opt_menu_1', keyword: '1' },
    { id: 'opt_menu_2', keyword: '2' },
    { id: 'opt_menu_3', keyword: '3' },
    { id: 'opt_menu_4', keyword: '4' }
  ]}},
  
  // Catálogo
  { id: 'catalogIntro', type: 'messageNode', position: { x: 850, y: -100 }, data: { label: 'Catálogo', value: '{{catalogo}}', options: [] } },
  
  // Cotización (Lead)
  { id: 'askInterest', type: 'messageNode', position: { x: 850, y: 150 }, data: { label: 'Preguntar Interés', value: 'Perfecto! 🙌 Ya tienes algún modelo en mente o quieres que te oriente?', options: [] } },
  { id: 'askBudget', type: 'messageNode', position: { x: 1250, y: 150 }, data: { label: 'Presupuesto', value: 'Para orientarte mejor, con qué presupuesto cuentas? 💵\n\n*1️⃣* Hasta $90M\n*2️⃣* $90M – $150M\n*3️⃣* $150M – $220M\n*4️⃣* Más de $220M', options: [] } },
  { id: 'askEmployment', type: 'messageNode', position: { x: 1650, y: 150 }, data: { label: 'Actividad Laboral', value: 'Y cuál es tu actividad laboral? 💼\n\n*1️⃣* Empleado\n*2️⃣* Independiente\n*3️⃣* Pensionado', options: [] } },
  { id: 'askIncome', type: 'messageNode', position: { x: 2050, y: 150 }, data: { label: 'Ingresos', value: 'Perfecto! Y cuánto son tus ingresos mensuales aproximadamente? 📊', options: [] } },
  { id: 'askCreditCheck', type: 'messageNode', position: { x: 2450, y: 150 }, data: { label: 'Centrales', value: 'Cómo estás en centrales de riesgo? Esto nos ayuda a buscar la mejor opción de crédito 🏦\n\n*1️⃣* ✅ Sin reportes\n*2️⃣* ⚠️ Con reportes', options: [] } },
  { id: 'askLeadName', type: 'messageNode', position: { x: 2850, y: 150 }, data: { label: 'Nombre', value: 'Ya casi! Cuál es tu nombre completo? ✍️', options: [] } },
  { id: 'askLeadPhone', type: 'messageNode', position: { x: 3250, y: 150 }, data: { label: 'Teléfono', value: 'Y a qué número te puedo contactar? 📱', options: [] } },
  { id: 'handoff', type: 'messageNode', position: { x: 3650, y: 150 }, data: { label: 'Despedida Lead', value: '¡Listo! 🏆 Recibí toda la info, muy pronto me pongo en contacto contigo. Si necesitas algo antes, escríbeme aquí mismo 😊', options: [] } },

  // Financiación
  { id: 'financingInfo', type: 'messageNode', position: { x: 850, y: 550 }, data: { label: 'Financiación', value: '💳 Tenemos varias opciones de financiación:\n\n✅ Plazos hasta 84 meses\n✅ Cuota inicial desde el 20%\n✅ Tasas preferenciales para empleados\n\n¿Quieres que te asesore con esto?', options: [] } },
  { id: 'financingOptions', type: 'messageNode', position: { x: 1250, y: 550 }, data: { label: 'Opciones Financiación', value: '*1️⃣* Sí, quiero asesoría personalizada\n*2️⃣* Primero quiero ver el catálogo\n*3️⃣* Volver al menú', options: [
    { id: 'opt_fin_1', keyword: '1' },
    { id: 'opt_fin_2', keyword: '2' },
    { id: 'opt_fin_3', keyword: '3' }
  ]}},

  // Handoff Directo
  { id: 'handoffDirect', type: 'messageNode', position: { x: 850, y: 900 }, data: { label: 'Contacto Directo', value: '¡Claro! 💬 Ya te atiendo personalmente, en un momento estoy contigo 🙌', options: [] } },
];

const DEFAULT_EDGES = [
  // Menu ramificaciones
  { id: 'e-menu-cat', source: 'welcome', sourceHandle: 'opt_menu_1', target: 'catalogIntro', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-menu-lead', source: 'welcome', sourceHandle: 'opt_menu_2', target: 'askInterest', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-menu-fin', source: 'welcome', sourceHandle: 'opt_menu_3', target: 'financingInfo', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-menu-agent', source: 'welcome', sourceHandle: 'opt_menu_4', target: 'handoffDirect', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  
  // Cotizacion secuencia lineal
  { id: 'e-askInterest-askBudget', source: 'askInterest', target: 'askBudget', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askBudget-askEmployment', source: 'askBudget', target: 'askEmployment', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askEmployment-askIncome', source: 'askEmployment', target: 'askIncome', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askIncome-askCreditCheck', source: 'askIncome', target: 'askCreditCheck', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askCreditCheck-askLeadName', source: 'askCreditCheck', target: 'askLeadName', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askLeadName-askLeadPhone', source: 'askLeadName', target: 'askLeadPhone', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-askLeadPhone-handoff', source: 'askLeadPhone', target: 'handoff', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },

  // Financiacion secuencia
  { id: 'e-finInfo-finOpt', source: 'financingInfo', target: 'financingOptions', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  
  // Financiacion ramificaciones
  { id: 'e-finOpt-agent', source: 'financingOptions', sourceHandle: 'opt_fin_1', target: 'handoffDirect', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-finOpt-cat', source: 'financingOptions', sourceHandle: 'opt_fin_2', target: 'catalogIntro', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
  { id: 'e-finOpt-menu', source: 'financingOptions', sourceHandle: 'opt_fin_3', target: 'welcome', animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } },
];

function FlowEditor() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    loadMensajes();
  }, []);

  const handleNodeTextChange = useCallback((id, newValue) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          node.data = { ...node.data, value: newValue };
        }
        return node;
      })
    );
  }, []);

  const handleNodeLabelChange = useCallback((id, newLabel) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          node.data = { ...node.data, label: newLabel };
        }
        return node;
      })
    );
  }, []);

  const handleNodeOptionsChange = useCallback((id, newOptions) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          node.data = { ...node.data, options: newOptions };
        }
        return node;
      })
    );
  }, []);

  const attachFunctionsToNodes = (rawNodes) => {
    return rawNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onChange: handleNodeTextChange,
        onLabelChange: handleNodeLabelChange,
        onOptionsChange: handleNodeOptionsChange
      }
    }));
  };

  const loadMensajes = async () => {
    setLoading(true);
    try {
      const dbFlow = await window.emissary.getFlujo();
      
      if (dbFlow && dbFlow.nodes && dbFlow.nodes.length > 0) {
        setNodes(attachFunctionsToNodes(dbFlow.nodes));
        setEdges(dbFlow.edges || []);
      } else {
        const newFlow = await window.emissary.resetFlujoToTemplate();
        if (newFlow && newFlow.nodes && newFlow.nodes.length > 0) {
          setNodes(attachFunctionsToNodes(newFlow.nodes));
          setEdges(newFlow.edges || []);
        }
      }
    } catch (err) {
      toast.error('Error al cargar la estructura del flujo');
    } finally {
      setLoading(false);
    }
  };

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } }, eds));
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }
      
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNodeId = getId();
      const newNode = {
        id: newNodeId,
        type,
        position,
        data: { 
          id: newNodeId,
          label: 'Nuevo Mensaje',
          value: '', 
          options: [],
          onChange: handleNodeTextChange,
          onLabelChange: handleNodeLabelChange,
          onOptionsChange: handleNodeOptionsChange
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, handleNodeTextChange, handleNodeLabelChange, handleNodeOptionsChange],
  );

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Guardar el grafo completo JSON en la base de datos!
      // Tenemos que remover las funciones de `data` antes de enviarlo porque IPC no puede serializar funciones
      const cleanNodes = nodes.map(n => {
        const { onChange, onLabelChange, onOptionsChange, ...cleanData } = n.data;
        return { ...n, data: cleanData };
      });

      await window.emissary.saveFlujo(cleanNodes, edges);
      toast.success('¡Flujo guardado con éxito! El bot utilizará esta estructura.');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el flujo');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    if (confirm('¿Estás seguro de que deseas borrar tu flujo actual y restaurar la plantilla optimizada para tu marca? Perderás cualquier cambio manual.')) {
      setLoading(true);
      try {
        const newFlow = await window.emissary.resetFlujoToTemplate();
        if (newFlow && newFlow.nodes && newFlow.nodes.length > 0) {
          setNodes(attachFunctionsToNodes(newFlow.nodes));
          setEdges(newFlow.edges || []);
        }
        toast.success('Plantilla de tu marca restaurada exitosamente.');
      } catch (err) {
        toast.error('Error al restaurar la plantilla.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col relative" ref={reactFlowWrapper}>
      
      <div className="absolute top-0 left-0 right-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Flujo Visual de Conversación
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Beta</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Arrastra los bloques, conecta los pasos y edita los textos. Usa variables como {'{{nombre}}'}</p>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={handleResetTemplate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 shadow-sm active:scale-95 transition-all"
          >
            Restaurar Plantilla
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary-hover shadow-float active:scale-95 transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar Flujo Completo
          </button>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        className="w-full h-full bg-muted/5"
      >
        <Background color="#a855f7" gap={20} size={1} opacity={0.15} />
        <SmoothZoomControls />
        <AddNodePanel />
      </ReactFlow>
    </div>
  );
}

export function Mensajes() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
